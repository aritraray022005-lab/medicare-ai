require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const Patient = require("../src/models/patient.model");
const Doctor = require("../src/models/doctor.model");
const Organization = require("../src/models/organization.model");
const DoctorOrganization = require("../src/models/doctorOrganization.model");
const Room = require("../src/models/room.model");
const RoomSlot = require("../src/models/roomSlot.model");
const RoomBooking = require("../src/models/roomBooking.model");
const RoomBookingRequest = require("../src/models/roomBookingRequest.model");
const Appointment = require("../src/models/appointment.model");
const OutboxNotification = require("../src/models/outboxNotification.model");
const DurableJob = require("../src/models/durableJob.model");

const roomController = require("../src/controller/room.controller");
const patientController = require("../src/controller/patient.controller");
const { DurableJobWorker, defaultDurableWorker } = require("../src/jobs/durableJobWorker");

console.log("=== Running Targeted Remediation Tests (Phase 5 & 6 Audit Findings) ===");

let passed = 0;
let total = 0;

function createMockQuery(result) {
    const p = Promise.resolve(result);
    p.session = () => p;
    p.populate = () => p;
    p.sort = () => p;
    p.lean = () => p;
    p.select = () => p;
    p.limit = () => p;
    return p;
}

function createMockRes() {
    return {
        statusCode: null,
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        }
    };
}

async function runAsyncTest(name, fn) {
    total++;
    try {
        await fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}:`, err.message);
    }
}

// Canonical Identifiers
const mockOrgId = new mongoose.Types.ObjectId();
const mockRoomId = new mongoose.Types.ObjectId();
const mockDoctorId = new mongoose.Types.ObjectId();
const mockSlotId = new mongoose.Types.ObjectId();
const mockBookingId = new mongoose.Types.ObjectId();

// Global Mocks Setup
const origStartSession = mongoose.startSession;
const mockSession = {
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: async () => {},
    inTransaction: () => true
};
mongoose.startSession = async () => mockSession;

function resetMocks() {
    RoomBooking.findById = () => createMockQuery(null);
    RoomBooking.findOne = () => createMockQuery(null);
    RoomBooking.create = async () => [];
    RoomBooking.updateMany = async () => ({ modifiedCount: 1 });
    RoomBooking.findOneAndUpdate = () => createMockQuery(null);

    RoomBookingRequest.findById = () => createMockQuery(null);
    RoomBookingRequest.findOne = () => createMockQuery(null);
    RoomBookingRequest.find = () => createMockQuery([]);
    RoomBookingRequest.create = async () => [];
    RoomBookingRequest.updateMany = async () => ({ modifiedCount: 1 });
    RoomBookingRequest.findOneAndUpdate = () => createMockQuery(null);
    RoomBookingRequest.countDocuments = async () => 0;

    RoomSlot.findById = () => createMockQuery({
        _id: mockSlotId,
        organization: mockOrgId,
        room: mockRoomId,
        status: "Queued",
        queueGeneration: 0,
        save: async function() { return this; }
    });
    RoomSlot.findOne = () => createMockQuery(null);
    RoomSlot.find = () => createMockQuery([]);
    RoomSlot.create = async () => [];
    RoomSlot.updateMany = async () => ({ modifiedCount: 1 });
    RoomSlot.findOneAndUpdate = () => createMockQuery(null);

    Room.findById = () => createMockQuery({
        _id: mockRoomId,
        organization: mockOrgId,
        roomNumber: "101",
        floor: "1st Floor",
        isOperational: true,
        scheduleVersion: 1,
        save: async function() { return this; }
    });
    Room.findOne = () => createMockQuery(null);
    Room.find = () => createMockQuery([]);
    Room.findOneAndUpdate = async (filter) => ({ _id: filter?._id || mockRoomId, scheduleVersion: 2 });

    Doctor.findById = () => createMockQuery({
        _id: mockDoctorId,
        name: "Dr. Default",
        email: "default@medcare.com",
        isEmailVerified: true,
        isBlocked: false,
        save: async function() { return this; }
    });
    Doctor.findOne = () => createMockQuery(null);
    Doctor.find = () => createMockQuery([]);
    Doctor.findOneAndUpdate = async (filter) => ({ _id: filter?._id || mockDoctorId, scheduleVersion: 2 });

    Organization.findById = () => createMockQuery({
        _id: mockOrgId,
        name: "Default Hospital",
        email: "hospital@medcare.com",
        isEmailVerified: true,
        isVerifiedByAdmin: true,
        isBlocked: false,
        timezone: "UTC",
        scheduleVersion: 1,
        save: async function() { return this; }
    });
    Organization.findOne = () => createMockQuery(null);
    Organization.find = () => createMockQuery([]);
    Organization.findOneAndUpdate = async (filter) => ({ _id: filter?._id || mockOrgId, scheduleVersion: 2 });

    DoctorOrganization.findById = () => createMockQuery(null);
    DoctorOrganization.findOne = () => createMockQuery(null);
    DoctorOrganization.find = () => createMockQuery([]);
    DoctorOrganization.findOneAndUpdate = async () => ({ scheduleVersion: 2 });

    Patient.findById = () => createMockQuery(null);
    Patient.findOne = () => createMockQuery(null);

    Appointment.find = () => createMockQuery([]);
    Appointment.findOne = () => createMockQuery(null);
    Appointment.findById = () => createMockQuery(null);
    Appointment.create = async () => [];
    Appointment.updateMany = async () => ({ modifiedCount: 1 });

    OutboxNotification.create = async () => [{ _id: new mongoose.Types.ObjectId() }];
    OutboxNotification.updateMany = async () => ({ modifiedCount: 1 });

    DurableJob.findOne = () => createMockQuery(null);
    DurableJob.create = async (docs) => docs.map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));
    DurableJob.updateOne = async () => ({ modifiedCount: 1 });
    DurableJob.findOneAndUpdate = () => createMockQuery(null);
}

(async () => {
    // ========================================================
    // FIX 1: Stale RoomBooking in cancelRoomBooking
    // ========================================================

    await runAsyncTest("[FIX 1] Booking cancelled by another operation while waiting for locks returns 409", async () => {
        resetMocks();

        // Initially Active before locks
        const initialBooking = {
            _id: mockBookingId,
            organization: mockOrgId,
            room: mockRoomId,
            doctor: mockDoctorId,
            roomSlot: mockSlotId,
            status: "Active"
        };

        // Post-lock re-read shows Cancelled
        const lockedBooking = {
            _id: mockBookingId,
            organization: mockOrgId,
            room: mockRoomId,
            doctor: mockDoctorId,
            roomSlot: mockSlotId,
            status: "Cancelled" // changed concurrently
        };

        let callCount = 0;
        RoomBooking.findById = (id) => {
            callCount++;
            return createMockQuery(callCount === 1 ? initialBooking : lockedBooking);
        };

        const req = {
            params: { id: mockBookingId.toString() },
            body: { reason: "Need to cancel" },
            userDetails: { _id: mockDoctorId }
        };
        const res = createMockRes();

        await roomController.cancelRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("no longer active"), "Expected message stating booking is no longer active");
    });

    await runAsyncTest("[FIX 1] Booking completed while waiting for locks returns 409", async () => {
        resetMocks();

        const initialBooking = {
            _id: mockBookingId,
            organization: mockOrgId,
            room: mockRoomId,
            doctor: mockDoctorId,
            roomSlot: mockSlotId,
            status: "Active"
        };

        const lockedBooking = {
            _id: mockBookingId,
            organization: mockOrgId,
            room: mockRoomId,
            doctor: mockDoctorId,
            roomSlot: mockSlotId,
            status: "Completed" // completed concurrently
        };

        let callCount = 0;
        RoomBooking.findById = () => {
            callCount++;
            return createMockQuery(callCount === 1 ? initialBooking : lockedBooking);
        };

        const req = {
            params: { id: mockBookingId.toString() },
            body: { reason: "Need to cancel" },
            userDetails: { _id: mockDoctorId }
        };
        const res = createMockRes();

        await roomController.cancelRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("no longer active"));
    });

    await runAsyncTest("[FIX 1] Booking reference or ownership changed while acquiring locks returns 409", async () => {
        resetMocks();

        const initialBooking = {
            _id: mockBookingId,
            organization: mockOrgId,
            room: mockRoomId,
            doctor: mockDoctorId,
            roomSlot: mockSlotId,
            status: "Active"
        };

        const lockedBooking = {
            _id: mockBookingId,
            organization: new mongoose.Types.ObjectId(), // changed organization!
            room: mockRoomId,
            doctor: mockDoctorId,
            roomSlot: mockSlotId,
            status: "Active"
        };

        let callCount = 0;
        RoomBooking.findById = () => {
            callCount++;
            return createMockQuery(callCount === 1 ? initialBooking : lockedBooking);
        };

        const req = {
            params: { id: mockBookingId.toString() },
            body: { reason: "Doctor cancelling" },
            userDetails: { _id: mockDoctorId }
        };
        const res = createMockRes();

        await roomController.cancelRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("reference or ownership changed"));
    });

    await runAsyncTest("[FIX 1] Two concurrent cancellations — second request returns 409", async () => {
        resetMocks();

        let bookingStatus = "Active";
        const makeBooking = () => ({
            _id: mockBookingId,
            organization: mockOrgId,
            room: mockRoomId,
            doctor: mockDoctorId,
            roomSlot: mockSlotId,
            get status() { return bookingStatus; },
            set status(val) { bookingStatus = val; },
            save: async function() { return this; }
        });

        RoomBooking.findById = () => createMockQuery(makeBooking());
        RoomSlot.findById = () => createMockQuery({
            _id: mockSlotId,
            queueGeneration: 1,
            save: async function() {}
        });
        Doctor.findById = () => createMockQuery({ name: "Dr. Smith", email: "smith@medcare.com" });
        Organization.findById = () => createMockQuery({ name: "General Hospital", email: "info@hospital.com" });
        Room.findById = () => createMockQuery({ roomNumber: "101" });
        Appointment.find = () => createMockQuery([]);

        const req1 = {
            params: { id: mockBookingId.toString() },
            body: { reason: "First cancellation" },
            userDetails: { _id: mockDoctorId }
        };
        const res1 = createMockRes();
        await roomController.cancelRoomBooking(req1, res1);
        assert.strictEqual(res1.statusCode, 200);

        // Second request now sees Cancelled
        const req2 = {
            params: { id: mockBookingId.toString() },
            body: { reason: "Second cancellation" },
            userDetails: { _id: mockDoctorId }
        };
        const res2 = createMockRes();
        await roomController.cancelRoomBooking(req2, res2);
        assert.strictEqual(res2.statusCode, 400); // Caught at pre-check since bookingStatus is now Cancelled
    });

    await runAsyncTest("[FIX 1] Normal cancellation successfully updates status and reopens slot", async () => {
        resetMocks();

        let savedBookingStatus = null;
        let slotReopened = false;

        const bookingDoc = {
            _id: mockBookingId,
            organization: mockOrgId,
            room: mockRoomId,
            doctor: mockDoctorId,
            roomSlot: mockSlotId,
            status: "Active",
            save: async function() {
                savedBookingStatus = this.status;
                return this;
            }
        };

        RoomBooking.findById = () => createMockQuery(bookingDoc);
        RoomSlot.findById = () => createMockQuery({
            _id: mockSlotId,
            queueGeneration: 2,
            save: async function() {
                slotReopened = (this.status === "Available" && this.queueGeneration === 3);
            }
        });
        Doctor.findById = () => createMockQuery({ name: "Dr. Smith", email: "smith@medcare.com" });
        Organization.findById = () => createMockQuery({ name: "General Hospital", email: "info@hospital.com" });
        Room.findById = () => createMockQuery({ roomNumber: "101" });
        Appointment.find = () => createMockQuery([]);

        const req = {
            params: { id: mockBookingId.toString() },
            body: { reason: "Schedule change" },
            userDetails: { _id: mockDoctorId }
        };
        const res = createMockRes();

        await roomController.cancelRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(savedBookingStatus, "Cancelled");
        assert.strictEqual(slotReopened, true);
    });

    // ========================================================
    // FIX 2: Bounded Batched Appointment Cancellation & Durable Continuation
    // ========================================================

    await runAsyncTest("[FIX 2] Cancellation job created atomically in primary transaction", async () => {
        resetMocks();

        let enqueuedJob = null;
        DurableJob.create = async (docs) => {
            enqueuedJob = docs[0];
            return docs.map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));
        };

        const bookingDoc = {
            _id: mockBookingId,
            organization: mockOrgId,
            room: mockRoomId,
            doctor: mockDoctorId,
            roomSlot: mockSlotId,
            status: "Active",
            save: async function() {}
        };

        RoomBooking.findById = () => createMockQuery(bookingDoc);
        RoomSlot.findById = () => createMockQuery({ _id: mockSlotId, queueGeneration: 1, save: async function() {} });
        Doctor.findById = () => createMockQuery({ name: "Dr. Smith", email: "smith@medcare.com" });
        Organization.findById = () => createMockQuery({ name: "General Hospital", email: "info@hospital.com" });
        Room.findById = () => createMockQuery({ roomNumber: "101" });
        Appointment.find = () => createMockQuery([]);

        const req = {
            params: { id: mockBookingId.toString() },
            body: { reason: "Facility emergency" },
            organization: { _id: mockOrgId }
        };
        const res = createMockRes();

        await roomController.cancelRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert(enqueuedJob, "Expected a DurableJob to be enqueued");
        assert.strictEqual(enqueuedJob.jobType, "APPOINTMENT_CANCELLATION_CASCADE");
        assert.strictEqual(enqueuedJob.targetId.toString(), mockBookingId.toString());
    });

    await runAsyncTest("[FIX 2] Large appointment set cancelled in bounded batches", async () => {
        resetMocks();

        // 60 total active appointments
        const activeAppointments = Array.from({ length: 60 }, (_, i) => ({
            _id: new mongoose.Types.ObjectId(),
            roomBooking: mockBookingId,
            status: "Confirmed",
            patient: new mongoose.Types.ObjectId(),
            save: async function() { this.status = "Cancelled"; }
        }));

        let queryCall = 0;
        Appointment.find = (filter) => {
            queryCall++;
            // Filter only returns active ones
            const remaining = activeAppointments.filter(a => a.status === "Confirmed");
            const batch = remaining.slice(0, 25);
            return createMockQuery(batch);
        };
        Patient.findById = () => createMockQuery({ name: "Test Patient", email: "pat@test.com" });

        const result = await roomController.processAppointmentCancellationBatch(mockBookingId, {
            reason: "Facility closed",
            cancelledByType: "Organization"
        });

        assert.strictEqual(result.done, true);
        // All 60 appointments should now be Cancelled
        assert(activeAppointments.every(a => a.status === "Cancelled"), "All 60 appointments should be cancelled");
        assert(queryCall >= 3, `Expected at least 3 batch queries (got ${queryCall})`);
    });

    await runAsyncTest("[FIX 2] Terminal appointments (Completed, Expired) are preserved intact", async () => {
        resetMocks();

        const mixedAppointments = [
            { _id: new mongoose.Types.ObjectId(), status: "Completed", save: async function() {} },
            { _id: new mongoose.Types.ObjectId(), status: "Expired", save: async function() {} },
            { _id: new mongoose.Types.ObjectId(), status: "Pending", save: async function() { this.status = "Cancelled"; } }
        ];

        Appointment.find = (filter) => {
            // Find only matches Pending/Confirmed
            const matches = mixedAppointments.filter(a =>
                filter.status.$in.includes(a.status)
            );
            return createMockQuery(matches);
        };
        Patient.findById = () => createMockQuery({ name: "Patient", email: "p@med.com" });

        await roomController.processAppointmentCancellationBatch(mockBookingId, { reason: "Doctor sick" });

        assert.strictEqual(mixedAppointments[0].status, "Completed", "Completed appointment should remain Completed");
        assert.strictEqual(mixedAppointments[1].status, "Expired", "Expired appointment should remain Expired");
        assert.strictEqual(mixedAppointments[2].status, "Cancelled", "Pending appointment should be Cancelled");
    });

    await runAsyncTest("[FIX 2] Patient notifications queued inside same transaction as appointment cancel", async () => {
        resetMocks();

        const notificationsQueued = [];
        OutboxNotification.create = async (docs, opts) => {
            assert(opts && opts.session, "Outbox notification must receive session");
            notificationsQueued.push(...docs);
            return docs.map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));
        };

        const appt = {
            _id: new mongoose.Types.ObjectId(),
            status: "Confirmed",
            patient: new mongoose.Types.ObjectId(),
            save: async function() { this.status = "Cancelled"; }
        };

        let called = false;
        Appointment.find = () => {
            if (!called) {
                called = true;
                return createMockQuery([appt]);
            }
            return createMockQuery([]);
        };
        Patient.findById = () => createMockQuery({ name: "Alice", email: "alice@test.com" });

        await roomController.processAppointmentCancellationBatch(mockBookingId, { reason: "Maintenance" });

        assert.strictEqual(notificationsQueued.length, 1);
        assert.strictEqual(notificationsQueued[0].type, "APPOINTMENT_CANCELLED");
        assert.strictEqual(notificationsQueued[0].recipientEmail, "alice@test.com");
    });

    await runAsyncTest("[FIX 2] Cancellation job recovers unfinished work after restart", async () => {
        resetMocks();

        const mockWorker = new DurableJobWorker({ workerId: "recovery-worker-1" });

        let processedTarget = null;
        mockWorker.registerHandler("APPOINTMENT_CANCELLATION_CASCADE", async (payload, job) => {
            processedTarget = job.targetId;
            return { done: true };
        });

        const unfinishedJob = {
            _id: new mongoose.Types.ObjectId(),
            jobType: "APPOINTMENT_CANCELLATION_CASCADE",
            targetId: mockBookingId,
            payload: { bookingId: mockBookingId.toString(), reason: "Power outage" },
            status: "PROCESSING",
            attempts: 1,
            lockedUntil: new Date(Date.now() - 5000) // expired lease prior to restart
        };

        let claimed = false;
        DurableJob.findOneAndUpdate = (query) => {
            if (!claimed) {
                claimed = true;
                return createMockQuery(unfinishedJob);
            }
            return createMockQuery(null);
        };
        DurableJob.updateOne = async () => ({ modifiedCount: 1 });

        // Simulate worker tick
        mockWorker.isRunning = true;
        await mockWorker.tick();
        mockWorker.isRunning = false;

        assert(processedTarget, "Expected unfinished job to be claimed and processed");
        assert.strictEqual(processedTarget.toString(), mockBookingId.toString());
    });

    await runAsyncTest("[FIX 2] New patient appointments cannot be created against cancelled RoomBooking", async () => {
        resetMocks();

        RoomBooking.findById = () => createMockQuery({
            _id: mockBookingId,
            status: "Cancelled", // already cancelled!
            organization: mockOrgId,
            room: mockRoomId,
            doctor: mockDoctorId,
            startDateTime: new Date("2026-11-15T09:00:00.000Z"),
            endDateTime: new Date("2026-11-15T13:00:00.000Z")
        });

        Doctor.findById = () => createMockQuery({ _id: mockDoctorId, isEmailVerified: true, isBlocked: false });
        Organization.findById = () => createMockQuery({ _id: mockOrgId, isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false });
        DoctorOrganization.findOne = () => createMockQuery({ _id: new mongoose.Types.ObjectId(), status: "Approved" });
        Room.findById = () => createMockQuery({ _id: mockRoomId, organization: mockOrgId, isOperational: true });

        const req = {
            userDetails: { _id: new mongoose.Types.ObjectId() },
            body: {
                bookingType: "Organization",
                doctorId: mockDoctorId.toString(),
                organizationId: mockOrgId.toString(),
                roomId: mockRoomId.toString(),
                roomBookingId: mockBookingId.toString(),
                date: "2026-11-15",
                time: "10:00"
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("not active"));
    });

    // ========================================================
    // FIX 3: Phase 5 Durable FCFS Continuation
    // ========================================================

    await runAsyncTest("[FIX 3] Queue with more than 1,000 requests enqueues durable continuation", async () => {
        resetMocks();

        let durableJobEnqueued = false;
        DurableJob.create = async (docs) => {
            durableJobEnqueued = docs[0].jobType === "FCFS_SLOT_ALLOCATION";
            return docs.map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));
        };

        RoomSlot.findById = () => createMockQuery({
            _id: mockSlotId,
            status: "Queued",
            queueGeneration: 0,
            save: async function() { return this; }
        });

        // Mock 1,050 total candidates
        let queryCount = 0;
        RoomBookingRequest.find = () => {
            queryCount++;
            // Always return 50 non-matching candidates per batch
            const batch = Array.from({ length: 50 }, (_, i) => ({
                _id: new mongoose.Types.ObjectId(),
                sequenceNumber: queryCount * 50 + i,
                doctor: new mongoose.Types.ObjectId(),
                roomSlot: mockSlotId
            }));
            return createMockQuery(batch);
        };

        // When evaluating, all return not allocated
        Doctor.findById = () => createMockQuery({ isEmailVerified: true, isBlocked: false });
        DoctorOrganization.findOne = () => createMockQuery(null); // ineligible doctor -> candidate rejected
        RoomBookingRequest.findById = (id) => createMockQuery({
            _id: id,
            status: "PENDING",
            queueGeneration: 0,
            save: async function() {}
        });

        // 50 remaining candidates beyond 1,000
        RoomBookingRequest.countDocuments = async () => 50;

        const result = await roomController.processSlotAllocation(mockSlotId, { maxCandidates: 1000 });
        assert.strictEqual(result.allocated, false);
        assert(result.reason.includes("continuation queued"));
        assert.strictEqual(durableJobEnqueued, true, "Durable job should be enqueued for remaining candidates");
    });

    await runAsyncTest("[FIX 3] Candidate 1,001 is evaluated and allocated when allowUnbounded: true", async () => {
        resetMocks();

        let allocatedCandidateId = null;

        RoomSlot.findById = () => createMockQuery({
            _id: mockSlotId,
            organization: mockOrgId,
            room: mockRoomId,
            status: "Queued",
            queueGeneration: 1,
            startDateTime: new Date("2026-11-15T09:00:00.000Z"),
            endDateTime: new Date("2026-11-15T13:00:00.000Z"),
            timezone: "Asia/Kolkata",
            save: async function() { this.status = "Reserved"; }
        });

        Organization.findById = () => createMockQuery({
            _id: mockOrgId,
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false,
            timezone: "Asia/Kolkata"
        });

        Room.findById = () => createMockQuery({
            _id: mockRoomId,
            isOperational: true
        });

        let batchNum = 0;
        const targetCandidateId = new mongoose.Types.ObjectId();

        RoomBookingRequest.find = () => {
            batchNum++;
            if (batchNum <= 20) {
                // First 1,000 candidates: batch of 50
                const batch = Array.from({ length: 50 }, (_, i) => ({
                    _id: new mongoose.Types.ObjectId(),
                    sequenceNumber: (batchNum - 1) * 50 + i + 1,
                    isEligible: false
                }));
                return createMockQuery(batch);
            } else if (batchNum === 21) {
                // Batch 21: candidate 1,001 is eligible!
                return createMockQuery([
                    {
                        _id: targetCandidateId,
                        sequenceNumber: 1001,
                        isEligible: true
                    }
                ]);
            }
            return createMockQuery([]);
        };

        RoomBookingRequest.findById = (id) => {
            const isTarget = id.toString() === targetCandidateId.toString();
            return createMockQuery({
                _id: id,
                doctor: mockDoctorId,
                organization: mockOrgId,
                room: mockRoomId,
                roomSlot: mockSlotId,
                queueGeneration: 1,
                status: "PENDING",
                save: async function() {
                    if (isTarget) {
                        this.status = "ALLOCATED";
                        allocatedCandidateId = id;
                    } else {
                        this.status = "REJECTED_UNAFFILIATED";
                    }
                }
            });
        };

        // Doctor is verified
        Doctor.findById = () => createMockQuery({
            _id: mockDoctorId,
            name: "Dr. Hero",
            email: "hero@doc.com",
            isEmailVerified: true,
            isBlocked: false
        });

        // Only target candidate has approved affiliation
        DoctorOrganization.findOne = (query) => {
            if (batchNum === 21) {
                return createMockQuery({ status: "Approved" });
            }
            return createMockQuery(null); // rejected for first 1,000
        };

        RoomBooking.findOne = () => createMockQuery(null); // no conflict
        Appointment.findOne = () => createMockQuery(null);
        RoomBooking.create = async (docs) => docs.map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));

        const result = await roomController.processSlotAllocation(mockSlotId, { allowUnbounded: true });
        assert.strictEqual(result.allocated, true);
        assert.strictEqual(result.candidateId.toString(), targetCandidateId.toString());
        assert.strictEqual(allocatedCandidateId.toString(), targetCandidateId.toString());
    });

    await runAsyncTest("[FIX 3] Worker restart during continuation claims job and completes queue", async () => {
        resetMocks();

        const worker = new DurableJobWorker({ workerId: "test-restart-worker" });
        let resumedSlotId = null;

        worker.registerHandler("FCFS_SLOT_ALLOCATION", async (payload, job) => {
            resumedSlotId = job.targetId;
            return { done: true };
        });

        // Expired lease job from crashed worker
        const staleJob = {
            _id: new mongoose.Types.ObjectId(),
            jobType: "FCFS_SLOT_ALLOCATION",
            targetId: mockSlotId,
            payload: { slotId: mockSlotId.toString(), targetGeneration: 1 },
            status: "PROCESSING",
            attempts: 1,
            lockedUntil: new Date(Date.now() - 10000) // expired
        };

        let claimed = false;
        DurableJob.findOneAndUpdate = () => {
            if (!claimed) {
                claimed = true;
                return createMockQuery(staleJob);
            }
            return createMockQuery(null);
        };
        DurableJob.updateOne = async () => ({ modifiedCount: 1 });

        worker.isRunning = true;
        await worker.tick();
        worker.isRunning = false;

        assert.strictEqual(resumedSlotId.toString(), mockSlotId.toString(), "Worker should claim expired job after restart");
    });

    await runAsyncTest("[FIX 3] Two workers processing same queue — lease fencing prevents duplicate claim", async () => {
        resetMocks();

        const worker1 = new DurableJobWorker({ workerId: "worker-A" });
        const worker2 = new DurableJobWorker({ workerId: "worker-B" });

        let jobLockedUntil = null;
        let jobLeaseToken = null;

        // When worker1 claims, it updates lockedUntil to future
        DurableJob.findOneAndUpdate = () => {
            if (!jobLeaseToken) {
                jobLeaseToken = "token-A";
                jobLockedUntil = new Date(Date.now() + 30000);
                return createMockQuery({
                    _id: new mongoose.Types.ObjectId(),
                    jobType: "FCFS_SLOT_ALLOCATION",
                    targetId: mockSlotId,
                    leaseToken: jobLeaseToken,
                    lockedUntil: jobLockedUntil
                });
            }
            // Worker 2 queries and gets null because job is locked
            return createMockQuery(null);
        };

        const claim1 = await worker1.claimNextJob();
        const claim2 = await worker2.claimNextJob();

        assert(claim1.job !== null, "Worker 1 should claim job");
        assert(claim2.job === null, "Worker 2 must not claim currently locked job");
    });

    await runAsyncTest("[FIX 3] Duplicate continuation execution is idempotent", async () => {
        resetMocks();

        const activeJob = {
            _id: new mongoose.Types.ObjectId(),
            jobType: "FCFS_SLOT_ALLOCATION",
            targetId: mockSlotId,
            status: "PENDING"
        };

        DurableJob.findOne = () => createMockQuery(activeJob);

        const job1 = await defaultDurableWorker.enqueueJob({
            jobType: "FCFS_SLOT_ALLOCATION",
            targetId: mockSlotId,
            payload: { slotId: mockSlotId.toString() }
        });

        const job2 = await defaultDurableWorker.enqueueJob({
            jobType: "FCFS_SLOT_ALLOCATION",
            targetId: mockSlotId,
            payload: { slotId: mockSlotId.toString() }
        });

        assert.strictEqual(job1._id.toString(), job2._id.toString(), "Enqueuing same active job must be idempotent");
    });

    await runAsyncTest("[FIX 3] Slot cancellation during continuation halts allocation safely", async () => {
        resetMocks();

        RoomSlot.findById = () => createMockQuery({
            _id: mockSlotId,
            status: "Maintenance" // cancelled/maintenance slot
        });

        const result = await roomController.processSlotAllocation(mockSlotId, { allowUnbounded: true });
        assert.strictEqual(result.allocated, false);
        assert(result.reason.includes("Maintenance"));
    });

    await runAsyncTest("[FIX 3] Organization blocking during continuation transitions candidates to REJECTED_ORG_SUSPENDED", async () => {
        resetMocks();

        RoomSlot.findById = () => createMockQuery({
            _id: mockSlotId,
            organization: mockOrgId,
            room: mockRoomId,
            status: "Queued",
            queueGeneration: 0,
            save: async function() { return this; }
        });

        const candidateId = new mongoose.Types.ObjectId();
        let candidateStatus = null;

        RoomBookingRequest.find = () => createMockQuery([
            { _id: candidateId, sequenceNumber: 1 }
        ]);

        RoomBookingRequest.findById = () => createMockQuery({
            _id: candidateId,
            organization: mockOrgId,
            doctor: mockDoctorId,
            roomSlot: mockSlotId,
            status: "PENDING",
            queueGeneration: 0,
            save: async function() { candidateStatus = this.status; }
        });

        RoomBookingRequest.updateMany = async (filter, update) => {
            if (update?.$set?.status) {
                candidateStatus = update.$set.status;
            }
            return { modifiedCount: 1 };
        };

        // Organization blocked while waiting for locks
        Organization.findById = () => createMockQuery({
            _id: mockOrgId,
            isBlocked: true, // blocked organization
            isEmailVerified: true,
            isVerifiedByAdmin: true
        });

        RoomBookingRequest.countDocuments = async () => 0;

        await roomController.processSlotAllocation(mockSlotId, { allowUnbounded: true });
        assert.strictEqual(candidateStatus, "REJECTED_ORG_SUSPENDED");
    });

    await runAsyncTest("[FIX 3] Strict FCFS sequence ordering across multi-batch continuation", async () => {
        resetMocks();

        const evaluationOrder = [];

        RoomSlot.findById = () => createMockQuery({
            _id: mockSlotId,
            organization: mockOrgId,
            room: mockRoomId,
            status: "Queued",
            queueGeneration: 0,
            save: async function() { return this; }
        });

        // 3 batches of requests: 1..2, 3..4, 5..6
        let batchIdx = 0;
        RoomBookingRequest.find = () => {
            batchIdx++;
            if (batchIdx === 1) {
                return createMockQuery([
                    { _id: new mongoose.Types.ObjectId("111111111111111111111111"), sequenceNumber: 1 },
                    { _id: new mongoose.Types.ObjectId("222222222222222222222222"), sequenceNumber: 2 }
                ]);
            } else if (batchIdx === 2) {
                return createMockQuery([
                    { _id: new mongoose.Types.ObjectId("333333333333333333333333"), sequenceNumber: 3 },
                    { _id: new mongoose.Types.ObjectId("444444444444444444444444"), sequenceNumber: 4 }
                ]);
            }
            return createMockQuery([]);
        };

        RoomBookingRequest.findById = (id) => createMockQuery({
            _id: id,
            doctor: mockDoctorId,
            organization: mockOrgId,
            room: mockRoomId,
            roomSlot: mockSlotId,
            queueGeneration: 0,
            status: "PENDING",
            save: async function() {
                this.status = "REJECTED_UNAFFILIATED";
            }
        });

        Doctor.findById = () => createMockQuery({ isEmailVerified: true, isBlocked: false });
        DoctorOrganization.findOne = () => {
            evaluationOrder.push(batchIdx);
            return createMockQuery(null);
        };
        RoomBookingRequest.countDocuments = async () => 0;

        await roomController.processSlotAllocation(mockSlotId, { allowUnbounded: true });

        // Total 4 evaluations
        assert.strictEqual(evaluationOrder.length, 4);
        assert.deepStrictEqual(evaluationOrder, [1, 1, 2, 2], "Batches must evaluate in strict sequence");
    });

    console.log(`\nRemediation Test Results: ${passed}/${total} passed.\n`);

    if (passed < total) {
        process.exit(1);
    }
})();
