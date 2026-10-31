require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const Room = require("../src/models/room.model");
const RoomSlot = require("../src/models/roomSlot.model");
const RoomBooking = require("../src/models/roomBooking.model");
const RoomBookingRequest = require("../src/models/roomBookingRequest.model");
const DoctorOrganization = require("../src/models/doctorOrganization.model");
const Doctor = require("../src/models/doctor.model");
const Organization = require("../src/models/organization.model");
const OutboxNotification = require("../src/models/outboxNotification.model");
const Appointment = require("../src/models/appointment.model");
const DurableJob = require("../src/models/durableJob.model");
const roomController = require("../src/controller/room.controller");
const adminController = require("../src/controller/admin.controller");
const { acquireScheduleLocks } = require("../src/util/lock.util");
const { checkDoctorScheduleConflicts } = require("../src/util/conflict.util");
const { executeTransactionWithRetry } = require("../src/util/transaction.util");

// Mock OutboxNotification.create by default for unit tests to prevent connection buffering
OutboxNotification.create = async (docs) =>
    (Array.isArray(docs) ? docs : [docs]).map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));

// Default unit test mocks for lock acquisition to prevent Mongoose connection buffering
Organization.findOneAndUpdate = async (q) => ({ _id: q._id || new mongoose.Types.ObjectId(), scheduleVersion: 1 });
Room.findOneAndUpdate = async (q) => ({ _id: q._id || new mongoose.Types.ObjectId(), scheduleVersion: 1 });
Doctor.findOneAndUpdate = async (q) => ({ _id: q._id || new mongoose.Types.ObjectId(), scheduleVersion: 1 });
DoctorOrganization.findOneAndUpdate = async (q) => ({ _id: q._id || new mongoose.Types.ObjectId(), scheduleVersion: 1 });

// Default mock session for unit tests
const defaultMockSession = {
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: async () => {}
};
mongoose.startSession = async () => defaultMockSession;

function createMockQuery(doc = null) {
    const p = Promise.resolve(doc);
    p.session = () => p;
    p.select = () => p;
    p.populate = () => p;
    p.sort = () => p;
    p.limit = () => p;
    p.lean = () => Promise.resolve(doc);
    return p;
}

// Default mocks to prevent query buffering in background tasks
RoomBookingRequest.find = () => createMockQuery([]);
RoomBookingRequest.countDocuments = async () => 0;
Appointment.find = () => createMockQuery([]);
Appointment.findOne = () => createMockQuery(null);
DurableJob.findOne = () => createMockQuery(null);
DurableJob.create = async (docs) => (Array.isArray(docs) ? docs : [docs]).map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));
DurableJob.updateOne = async () => ({ modifiedCount: 1 });
DurableJob.findOneAndUpdate = () => createMockQuery(null);

console.log("=== Running Room Management, FCFS Allocation & Room Booking Unit Tests (Phase 5) ===");

let passed = 0;
let total = 0;

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

(async () => {
    const orgAId = new mongoose.Types.ObjectId();
    const orgBId = new mongoose.Types.ObjectId();
    const doc1Id = new mongoose.Types.ObjectId();
    const doc2Id = new mongoose.Types.ObjectId();
    const roomId = new mongoose.Types.ObjectId();
    const slotId = new mongoose.Types.ObjectId();

    // ========================================================
    // 1. ROOM MANAGEMENT & OWNERSHIP
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] Room creation rejects duplicate room numbers within same organization", async () => {
        const origFindOne = Room.findOne;
        Room.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), roomNumber: "101" });

        const req = {
            organization: { _id: orgAId },
            body: { roomNumber: "101", floor: "1st Floor" }
        };
        const res = createMockRes();

        await roomController.createRoom(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("already exists"));

        Room.findOne = origFindOne;
    });

    await runAsyncTest("[UNIT / MOCKED] Room lookup enforces organization ownership isolation", async () => {
        const origFindOne = Room.findOne;
        Room.findOne = async (query) => {
            assert.strictEqual(query.organization.toString(), orgAId.toString());
            return null;
        };

        const req = {
            organization: { _id: orgAId },
            params: { id: new mongoose.Types.ObjectId().toString() }
        };
        const res = createMockRes();

        await roomController.getRoomById(req, res);
        assert.strictEqual(res.statusCode, 404);

        Room.findOne = origFindOne;
    });

    await runAsyncTest("[UNIT / MOCKED] Operational status toggle updates room state and transitions pending requests", async () => {
        const origRoomFindOne = Room.findOne;
        const origSlotUpdateMany = RoomSlot.updateMany;
        const origReqUpdateMany = RoomBookingRequest.updateMany;

        const mockRoom = {
            _id: roomId,
            organization: orgAId,
            isOperational: true,
            save: async function () { return this; }
        };
        Room.findOne = () => createMockQuery(mockRoom);

        let slotsMovedToMaintenance = false;
        RoomSlot.updateMany = async (query, update) => {
            if (update.$set.status === "Maintenance") slotsMovedToMaintenance = true;
        };

        let requestsRejected = false;
        RoomBookingRequest.updateMany = async (query, update) => {
            if (update.$set.status === "REJECTED_ROOM_MAINTENANCE") requestsRejected = true;
        };

        const req = {
            organization: { _id: orgAId },
            params: { id: roomId.toString() },
            body: { isOperational: false }
        };
        const res = createMockRes();

        await roomController.toggleRoomOperational(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(mockRoom.isOperational, false);
        assert.strictEqual(slotsMovedToMaintenance, true);
        assert.strictEqual(requestsRejected, true);
        assert(res.data.msg.includes("under maintenance"));

        Room.findOne = origRoomFindOne;
        RoomSlot.updateMany = origSlotUpdateMany;
        RoomBookingRequest.updateMany = origReqUpdateMany;
    });

    // ========================================================
    // 2. AVAILABILITY INTERVALS & CONFLICTS
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] Availability rejects end time before or equal to start time", async () => {
        const origFindOne = Room.findOne;
        const origOrgFind = Organization.findById;

        Room.findOne = async () => ({ _id: roomId, isOperational: true });
        Organization.findById = async () => ({ _id: orgAId, timezone: "Asia/Kolkata" });

        const req = {
            organization: { _id: orgAId },
            params: { id: roomId.toString() },
            body: {
                dateStr: "2026-11-10",
                startTimeStr: "14:00",
                endTimeStr: "10:00"
            }
        };
        const res = createMockRes();

        await roomController.createRoomAvailability(req, res);
        assert.strictEqual(res.statusCode, 400);
        assert(res.data.msg.includes("strictly after start time"));

        Room.findOne = origFindOne;
        Organization.findById = origOrgFind;
    });

    await runAsyncTest("[UNIT / MOCKED] Availability creation rejects overlapping interval for same room", async () => {
        const origRoomFindOne = Room.findOne;
        const origRoomFindById = Room.findById;
        const origOrgFind = Organization.findById;
        const origSlotFindOne = RoomSlot.findOne;
        const origBookingFindOne = RoomBooking.findOne;

        Room.findOne = async () => ({ _id: roomId, isOperational: true });
        Room.findById = () => createMockQuery({ _id: roomId, isOperational: true });
        Organization.findById = () => createMockQuery({ _id: orgAId, timezone: "Asia/Kolkata", isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false });
        RoomBooking.findOne = () => createMockQuery(null);
        RoomSlot.findOne = (query) => {
            assert(query.startDateTime.$lt);
            assert(query.endDateTime.$gt);
            return createMockQuery({ _id: new mongoose.Types.ObjectId() });
        };

        const req = {
            organization: { _id: orgAId },
            params: { id: roomId.toString() },
            body: {
                dateStr: "2026-11-10",
                startTimeStr: "10:00",
                endTimeStr: "12:00"
            }
        };
        const res = createMockRes();

        await roomController.createRoomAvailability(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("overlaps with an existing room slot"));

        Room.findOne = origRoomFindOne;
        Room.findById = origRoomFindById;
        Organization.findById = origOrgFind;
        RoomSlot.findOne = origSlotFindOne;
        RoomBooking.findOne = origBookingFindOne;
    });

    await runAsyncTest("[UNIT / MOCKED] Availability creation rejected when active room booking exists in interval", async () => {
        const origRoomFindOne = Room.findOne;
        const origRoomFindById = Room.findById;
        const origOrgFind = Organization.findById;
        const origSlotFindOne = RoomSlot.findOne;
        const origBookingFindOne = RoomBooking.findOne;

        Room.findOne = async () => ({ _id: roomId, isOperational: true });
        Room.findById = () => createMockQuery({ _id: roomId, isOperational: true });
        Organization.findById = () => createMockQuery({ _id: orgAId, timezone: "Asia/Kolkata", isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false });
        RoomSlot.findOne = () => createMockQuery(null);
        RoomBooking.findOne = () => createMockQuery({ _id: new mongoose.Types.ObjectId(), status: "Active" });

        const req = {
            organization: { _id: orgAId },
            params: { id: roomId.toString() },
            body: {
                dateStr: "2026-11-10",
                startTimeStr: "10:00",
                endTimeStr: "12:00"
            }
        };
        const res = createMockRes();

        await roomController.createRoomAvailability(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("active room booking already exists"));

        Room.findOne = origRoomFindOne;
        Room.findById = origRoomFindById;
        Organization.findById = origOrgFind;
        RoomSlot.findOne = origSlotFindOne;
        RoomBooking.findOne = origBookingFindOne;
    });

    await runAsyncTest("[UNIT / MOCKED] Cannot cancel slot that has an active booking", async () => {
        const origSlotFindOne = RoomSlot.findOne;
        RoomSlot.findOne = () => createMockQuery({
            _id: slotId,
            organization: orgAId,
            room: roomId,
            activeBooking: new mongoose.Types.ObjectId(),
            status: "Reserved"
        });

        const req = {
            organization: { _id: orgAId },
            params: { slotId: slotId.toString() }
        };
        const res = createMockRes();

        await roomController.cancelRoomSlot(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("active room reservation"));

        RoomSlot.findOne = origSlotFindOne;
    });

    await runAsyncTest("[UNIT / MOCKED] Slot cancellation transitions current-generation requests to REJECTED_ROOM_MAINTENANCE", async () => {
        const origSlotFindOne = RoomSlot.findOne;
        const origReqUpdateMany = RoomBookingRequest.updateMany;

        const mockSlot = {
            _id: slotId,
            organization: orgAId,
            room: roomId,
            activeBooking: null,
            status: "Available",
            queueGeneration: 2,
            save: async function () { return this; }
        };
        RoomSlot.findOne = () => createMockQuery(mockSlot);

        let transitionedStatus = null;
        RoomBookingRequest.updateMany = async (query, update) => {
            transitionedStatus = update.$set.status;
        };

        const req = {
            organization: { _id: orgAId },
            params: { slotId: slotId.toString() }
        };
        const res = createMockRes();

        await roomController.cancelRoomSlot(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(mockSlot.status, "Maintenance");
        assert.strictEqual(transitionedStatus, "REJECTED_ROOM_MAINTENANCE");

        RoomSlot.findOne = origSlotFindOne;
        RoomBookingRequest.updateMany = origReqUpdateMany;
    });

    // ========================================================
    // 3. DOCTOR ELIGIBILITY & IDEMPOTENCY
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] Email-unverified doctor cannot request room", async () => {
        const origDocFind = Doctor.findById;
        Doctor.findById = async () => ({
            _id: doc1Id,
            isEmailVerified: false,
            isBlocked: false
        });

        const req = {
            userDetails: { _id: doc1Id },
            body: { slotId: slotId.toString() }
        };
        const res = createMockRes();

        await roomController.requestRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("Email verification required"));

        Doctor.findById = origDocFind;
    });

    await runAsyncTest("[UNIT / MOCKED] Blocked doctor cannot request room", async () => {
        const origDocFind = Doctor.findById;
        Doctor.findById = async () => ({
            _id: doc1Id,
            isEmailVerified: true,
            isBlocked: true
        });

        const req = {
            userDetails: { _id: doc1Id },
            body: { slotId: slotId.toString() }
        };
        const res = createMockRes();

        await roomController.requestRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("Doctor account is suspended"));

        Doctor.findById = origDocFind;
    });

    await runAsyncTest("[UNIT / MOCKED] Doctor without approved affiliation cannot request room", async () => {
        const origDocFind = Doctor.findById;
        const origSlotFind = RoomSlot.findById;
        const origOrgFind = Organization.findById;
        const origRoomFind = Room.findById;
        const origAffFind = DoctorOrganization.findOne;

        Doctor.findById = async () => ({ _id: doc1Id, isEmailVerified: true, isBlocked: false });
        RoomSlot.findById = async () => ({ _id: slotId, organization: orgAId, room: roomId, status: "Available" });
        Organization.findById = async () => ({ _id: orgAId, isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false });
        Room.findById = async () => ({ _id: roomId, isOperational: true });
        DoctorOrganization.findOne = async () => null;

        const req = {
            userDetails: { _id: doc1Id },
            body: { slotId: slotId.toString() }
        };
        const res = createMockRes();

        await roomController.requestRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("Approved affiliation"));

        Doctor.findById = origDocFind;
        RoomSlot.findById = origSlotFind;
        Organization.findById = origOrgFind;
        Room.findById = origRoomFind;
        DoctorOrganization.findOne = origAffFind;
    });

    await runAsyncTest("[UNIT / MOCKED] Doctor with approved affiliation but without doctor-admin verification is accepted", async () => {
        const origDocFind = Doctor.findById;
        const origSlotFind = RoomSlot.findById;
        const origOrgFind = Organization.findById;
        const origRoomFind = Room.findById;
        const origAffFind = DoctorOrganization.findOne;
        const origReqCreate = RoomBookingRequest.create;
        const origReqFindById = RoomBookingRequest.findById;
        const origFindOne = RoomBookingRequest.findOne;

        Doctor.findById = async () => ({
            _id: doc1Id,
            name: "Dr. Alice",
            email: "alice@doctor.com",
            isEmailVerified: true,
            isBlocked: false,
            isVerifiedByAdmin: false
        });

        const mockSlot = {
            _id: slotId,
            organization: orgAId,
            room: roomId,
            status: "Available",
            queueGeneration: 0,
            queueSequenceCounter: 0,
            save: async () => {}
        };
        RoomSlot.findById = () => createMockQuery(mockSlot);
        Organization.findById = async () => ({
            _id: orgAId,
            name: "City Care",
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false
        });
        Room.findById = async () => ({ _id: roomId, roomNumber: "201", isOperational: true });
        DoctorOrganization.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), status: "Approved" });
        RoomBookingRequest.findOne = () => createMockQuery(null);

        RoomBookingRequest.create = async (arr) => arr.map(doc => ({
            ...doc,
            _id: new mongoose.Types.ObjectId()
        }));

        RoomBookingRequest.findById = () => ({
            populate: () => Promise.resolve({
                _id: new mongoose.Types.ObjectId(),
                status: "PENDING",
                sequenceNumber: 1
            })
        });

        const req = {
            userDetails: { _id: doc1Id },
            body: { slotId: slotId.toString() }
        };
        const res = createMockRes();

        await roomController.requestRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(res.data.status, "success");

        Doctor.findById = origDocFind;
        RoomSlot.findById = origSlotFind;
        Organization.findById = origOrgFind;
        Room.findById = origRoomFind;
        DoctorOrganization.findOne = origAffFind;
        RoomBookingRequest.create = origReqCreate;
        RoomBookingRequest.findById = origReqFindById;
        RoomBookingRequest.findOne = origFindOne;
    });

    await runAsyncTest("[UNIT / MOCKED] Inactive room rejected for booking requests", async () => {
        const origDocFind = Doctor.findById;
        const origSlotFind = RoomSlot.findById;
        const origOrgFind = Organization.findById;
        const origRoomFind = Room.findById;

        Doctor.findById = async () => ({ _id: doc1Id, isEmailVerified: true, isBlocked: false });
        RoomSlot.findById = async () => ({ _id: slotId, organization: orgAId, room: roomId, status: "Available" });
        Organization.findById = async () => ({ _id: orgAId, isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false });
        Room.findById = async () => ({ _id: roomId, isOperational: false });

        const req = {
            userDetails: { _id: doc1Id },
            body: { slotId: slotId.toString() }
        };
        const res = createMockRes();

        await roomController.requestRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("non-operational or under maintenance"));

        Doctor.findById = origDocFind;
        RoomSlot.findById = origSlotFind;
        Organization.findById = origOrgFind;
        Room.findById = origRoomFind;
    });

    await runAsyncTest("[UNIT / MOCKED] Idempotent request handling with same clientRequestId and SAME slot returns 200", async () => {
        const origDocFind = Doctor.findById;
        const origSlotFind = RoomSlot.findById;
        const origOrgFind = Organization.findById;
        const origRoomFind = Room.findById;
        const origAffFind = DoctorOrganization.findOne;
        const origReqFindOne = RoomBookingRequest.findOne;

        Doctor.findById = async () => ({ _id: doc1Id, isEmailVerified: true, isBlocked: false });
        RoomSlot.findById = async () => ({ _id: slotId, organization: orgAId, room: roomId, status: "Available" });
        Organization.findById = async () => ({ _id: orgAId, isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false });
        Room.findById = async () => ({ _id: roomId, isOperational: true });
        DoctorOrganization.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), status: "Approved" });

        // Existing request on SAME slot
        RoomBookingRequest.findOne = async () => ({
            _id: new mongoose.Types.ObjectId(),
            doctor: doc1Id,
            roomSlot: slotId,
            clientRequestId: "req-unique-uuid-1234",
            status: "PENDING",
            sequenceNumber: 2
        });

        const req = {
            userDetails: { _id: doc1Id },
            body: { slotId: slotId.toString(), clientRequestId: "req-unique-uuid-1234" }
        };
        const res = createMockRes();

        await roomController.requestRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert(res.data.msg.includes("idempotent response"));
        assert.strictEqual(res.data.request.clientRequestId, "req-unique-uuid-1234");

        Doctor.findById = origDocFind;
        RoomSlot.findById = origSlotFind;
        Organization.findById = origOrgFind;
        Room.findById = origRoomFind;
        DoctorOrganization.findOne = origAffFind;
        RoomBookingRequest.findOne = origReqFindOne;
    });

    await runAsyncTest("[UNIT / MOCKED] Idempotent request handling with same clientRequestId and DIFFERENT slot returns HTTP 409", async () => {
        const origDocFind = Doctor.findById;
        const origSlotFind = RoomSlot.findById;
        const origOrgFind = Organization.findById;
        const origRoomFind = Room.findById;
        const origAffFind = DoctorOrganization.findOne;
        const origReqFindOne = RoomBookingRequest.findOne;

        Doctor.findById = async () => ({ _id: doc1Id, isEmailVerified: true, isBlocked: false });
        RoomSlot.findById = async () => ({ _id: slotId, organization: orgAId, room: roomId, status: "Available" });
        Organization.findById = async () => ({ _id: orgAId, isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false });
        Room.findById = async () => ({ _id: roomId, isOperational: true });
        DoctorOrganization.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), status: "Approved" });

        // Existing request on a DIFFERENT slot
        const differentSlotId = new mongoose.Types.ObjectId();
        RoomBookingRequest.findOne = async () => ({
            _id: new mongoose.Types.ObjectId(),
            doctor: doc1Id,
            roomSlot: differentSlotId,
            clientRequestId: "req-cross-slot-key",
            status: "PENDING",
            sequenceNumber: 1
        });

        const req = {
            userDetails: { _id: doc1Id },
            body: { slotId: slotId.toString(), clientRequestId: "req-cross-slot-key" }
        };
        const res = createMockRes();

        await roomController.requestRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("Idempotency key reuse across different room slots is not permitted"));

        Doctor.findById = origDocFind;
        RoomSlot.findById = origSlotFind;
        Organization.findById = origOrgFind;
        Room.findById = origRoomFind;
        DoctorOrganization.findOne = origAffFind;
        RoomBookingRequest.findOne = origReqFindOne;
    });

    await runAsyncTest("[UNIT / MOCKED] Missing or omitted clientRequestId creates valid queued request", async () => {
        const origDocFind = Doctor.findById;
        const origSlotFind = RoomSlot.findById;
        const origOrgFind = Organization.findById;
        const origRoomFind = Room.findById;
        const origAffFind = DoctorOrganization.findOne;
        const origReqCreate = RoomBookingRequest.create;
        const origReqFindById = RoomBookingRequest.findById;
        const origReqFindOne = RoomBookingRequest.findOne;

        Doctor.findById = async () => ({ _id: doc1Id, name: "Dr. Anon", email: "anon@doc.com", isEmailVerified: true, isBlocked: false });
        const mockSlot = { _id: slotId, organization: orgAId, room: roomId, status: "Available", queueGeneration: 0, queueSequenceCounter: 0, save: async () => {} };
        RoomSlot.findById = () => createMockQuery(mockSlot);
        Organization.findById = async () => ({ _id: orgAId, name: "City Care", isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false });
        Room.findById = async () => ({ _id: roomId, roomNumber: "101", isOperational: true });
        DoctorOrganization.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), status: "Approved" });
        RoomBookingRequest.findOne = () => createMockQuery(null);

        let createdDoc = null;
        RoomBookingRequest.create = async ([doc]) => {
            createdDoc = doc;
            return [{ ...doc, _id: new mongoose.Types.ObjectId() }];
        };
        RoomBookingRequest.findById = () => ({
            populate: () => Promise.resolve({ _id: new mongoose.Types.ObjectId(), status: "PENDING", sequenceNumber: 1 })
        });

        const req = {
            userDetails: { _id: doc1Id },
            body: { slotId: slotId.toString() } // No clientRequestId
        };
        const res = createMockRes();

        await roomController.requestRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(createdDoc.clientRequestId, undefined);

        Doctor.findById = origDocFind;
        RoomSlot.findById = origSlotFind;
        Organization.findById = origOrgFind;
        Room.findById = origRoomFind;
        DoctorOrganization.findOne = origAffFind;
        RoomBookingRequest.create = origReqCreate;
        RoomBookingRequest.findById = origReqFindById;
        RoomBookingRequest.findOne = origReqFindOne;
    });

    // ========================================================
    // 4. STRICT FCFS ALLOCATION & CANDIDATE TRANSACTION ISOLATION
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] Queue sequence cannot be overridden by client and is monotonically assigned", async () => {
        const origDocFind = Doctor.findById;
        const origSlotFind = RoomSlot.findById;
        const origOrgFind = Organization.findById;
        const origRoomFind = Room.findById;
        const origAffFind = DoctorOrganization.findOne;
        const origReqCreate = RoomBookingRequest.create;
        const origReqFindById = RoomBookingRequest.findById;
        const origFindOne = RoomBookingRequest.findOne;

        Doctor.findById = async () => ({
            _id: doc1Id,
            name: "Dr. Alice",
            email: "alice@doctor.com",
            isEmailVerified: true,
            isBlocked: false
        });
        const mockSlot = {
            _id: slotId,
            organization: orgAId,
            room: roomId,
            status: "Available",
            queueGeneration: 0,
            queueSequenceCounter: 5,
            save: async () => {}
        };
        RoomSlot.findById = () => createMockQuery(mockSlot);

        Organization.findById = async () => ({
            _id: orgAId,
            name: "City Care",
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false
        });
        Room.findById = async () => ({ _id: roomId, roomNumber: "101", isOperational: true });
        DoctorOrganization.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), status: "Approved" });
        RoomBookingRequest.findOne = () => createMockQuery(null);

        let savedSequenceNumber = null;
        RoomBookingRequest.create = async ([doc]) => {
            savedSequenceNumber = doc.sequenceNumber;
            return [{ ...doc, _id: new mongoose.Types.ObjectId() }];
        };

        RoomBookingRequest.findById = () => ({
            populate: () => Promise.resolve({
                _id: new mongoose.Types.ObjectId(),
                status: "PENDING",
                sequenceNumber: savedSequenceNumber
            })
        });

        const req = {
            userDetails: { _id: doc1Id },
            body: { slotId: slotId.toString(), sequenceNumber: 1 }
        };
        const res = createMockRes();

        await roomController.requestRoomBooking(req, res);
        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(savedSequenceNumber, 6, "Server must assign 6 regardless of client payload");

        Doctor.findById = origDocFind;
        RoomSlot.findById = origSlotFind;
        Organization.findById = origOrgFind;
        Room.findById = origRoomFind;
        DoctorOrganization.findOne = origAffFind;
        RoomBookingRequest.create = origReqCreate;
        RoomBookingRequest.findById = origReqFindById;
        RoomBookingRequest.findOne = origFindOne;
    });

    await runAsyncTest("[UNIT / MOCKED] Multiple candidates evaluate in separate transactions without lock inversion", async () => {
        const origSlotFindById = RoomSlot.findById;
        const origOrgFindById = Organization.findById;
        const origRoomFindById = Room.findById;
        const origBookingFindOne = RoomBooking.findOne;
        const origRequestFind = RoomBookingRequest.find;
        const origRequestFindById = RoomBookingRequest.findById;
        const origDocOrgFindOne = DoctorOrganization.findOne;
        const origDocFindById = Doctor.findById;
        const origBookingCreate = RoomBooking.create;
        const origRequestUpdateMany = RoomBookingRequest.updateMany;
        const origApptFindOne = Appointment.findOne;
        const origApptFind = Appointment.find;

        Appointment.findOne = () => createMockQuery(null);
        Appointment.find = () => createMockQuery([]);

        const mockSlot = {
            _id: slotId,
            organization: orgAId,
            room: roomId,
            status: "Queued",
            queueGeneration: 0,
            startDateTime: new Date("2026-11-10T09:00:00Z"),
            endDateTime: new Date("2026-11-10T11:00:00Z"),
            activeBooking: null,
            save: async () => {}
        };
        RoomSlot.findById = () => createMockQuery(mockSlot);
        Organization.findById = () => createMockQuery({
            _id: orgAId,
            name: "Facility A",
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false,
            timezone: "Asia/Kolkata"
        });
        Room.findById = () => createMockQuery({ _id: roomId, roomNumber: "101", isOperational: true });
        RoomBooking.findOne = () => createMockQuery(null);

        const cand1 = {
            _id: new mongoose.Types.ObjectId(),
            doctor: doc1Id,
            sequenceNumber: 1,
            queueGeneration: 0,
            status: "PENDING",
            save: async function () { return this; }
        };
        const cand2 = {
            _id: new mongoose.Types.ObjectId(),
            doctor: doc2Id,
            sequenceNumber: 2,
            queueGeneration: 0,
            status: "PENDING",
            save: async function () { return this; }
        };

        // When candidates query runs, returns cand1 then cand2
        RoomBookingRequest.find = () => createMockQuery([cand1, cand2]);
        RoomBookingRequest.findById = (id) => createMockQuery(
            id.toString() === cand1._id.toString() ? cand1 : cand2
        );

        DoctorOrganization.findOne = ({ doctor }) => createMockQuery({
            _id: new mongoose.Types.ObjectId(),
            doctor,
            status: "Approved"
        });

        // Doctor 1 is blocked; Doctor 2 is eligible
        Doctor.findById = (id) => createMockQuery(
            id.toString() === doc1Id.toString()
                ? { _id: doc1Id, isBlocked: true, isEmailVerified: true }
                : { _id: doc2Id, name: "Dr. Bob", email: "bob@doc.com", isBlocked: false, isEmailVerified: true }
        );

        let allocatedDoctor = null;
        RoomBooking.create = async ([doc]) => {
            allocatedDoctor = doc.doctor;
            return [{ ...doc, _id: new mongoose.Types.ObjectId() }];
        };
        RoomBookingRequest.updateMany = async () => {};

        const result = await roomController.processSlotAllocation(slotId);

        assert.strictEqual(result.allocated, true);
        assert.strictEqual(cand1.status, "REJECTED_DOCTOR_INELIGIBLE", "First candidate should be marked ineligible");
        assert.strictEqual(cand2.status, "ALLOCATED", "Second candidate in queue should receive allocation");
        assert.strictEqual(allocatedDoctor.toString(), doc2Id.toString());

        RoomSlot.findById = origSlotFindById;
        Organization.findById = origOrgFindById;
        Room.findById = origRoomFindById;
        RoomBooking.findOne = origBookingFindOne;
        RoomBookingRequest.find = origRequestFind;
        RoomBookingRequest.findById = origRequestFindById;
        DoctorOrganization.findOne = origDocOrgFindOne;
        Doctor.findById = origDocFindById;
        RoomBooking.create = origBookingCreate;
        RoomBookingRequest.updateMany = origRequestUpdateMany;
        Appointment.findOne = origApptFindOne;
        Appointment.find = origApptFind;
    });

    await runAsyncTest("[UNIT / MOCKED] More than 50 candidates processed across multi-batch queue without stranding", async () => {
        const origSlotFindById = RoomSlot.findById;
        const origOrgFindById = Organization.findById;
        const origRoomFindById = Room.findById;
        const origBookingFindOne = RoomBooking.findOne;
        const origRequestFind = RoomBookingRequest.find;
        const origRequestFindById = RoomBookingRequest.findById;
        const origDocOrgFindOne = DoctorOrganization.findOne;
        const origDocFindById = Doctor.findById;
        const origBookingCreate = RoomBooking.create;
        const origRequestUpdateMany = RoomBookingRequest.updateMany;
        const origApptFindOne = Appointment.findOne;
        const origApptFind = Appointment.find;

        Appointment.findOne = () => createMockQuery(null);
        Appointment.find = () => createMockQuery([]);

        const mockSlot = {
            _id: slotId,
            organization: orgAId,
            room: roomId,
            status: "Queued",
            queueGeneration: 0,
            startDateTime: new Date("2026-11-10T09:00:00Z"),
            endDateTime: new Date("2026-11-10T11:00:00Z"),
            activeBooking: null,
            save: async () => {}
        };
        RoomSlot.findById = () => createMockQuery(mockSlot);
        Organization.findById = () => createMockQuery({
            _id: orgAId,
            name: "Facility A",
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false,
            timezone: "Asia/Kolkata"
        });
        Room.findById = () => createMockQuery({ _id: roomId, roomNumber: "101", isOperational: true });
        RoomBooking.findOne = () => createMockQuery(null);

        // Build 60 candidates: 1..50 ineligible (blocked), 51 eligible
        const candidates = [];
        for (let i = 1; i <= 60; i++) {
            const candDocId = new mongoose.Types.ObjectId();
            candidates.push({
                _id: new mongoose.Types.ObjectId(),
                doctor: candDocId,
                sequenceNumber: i,
                queueGeneration: 0,
                status: "PENDING",
                isIneligible: i <= 50,
                save: async function () { return this; }
            });
        }

        // RoomBookingRequest.find simulates multi-batch querying
        RoomBookingRequest.find = (q) => {
            const pendingCandidates = candidates.filter(c => c.status === "PENDING");
            const sorted = pendingCandidates.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
            const batch = sorted.slice(0, 50);
            return createMockQuery(batch);
        };

        RoomBookingRequest.findById = (id) => {
            const found = candidates.find(c => c._id.toString() === id.toString());
            return createMockQuery(found || null);
        };

        DoctorOrganization.findOne = ({ doctor }) => createMockQuery({
            _id: new mongoose.Types.ObjectId(),
            doctor,
            status: "Approved"
        });

        Doctor.findById = (id) => {
            const cand = candidates.find(c => c.doctor.toString() === id.toString());
            if (cand && cand.isIneligible) {
                return createMockQuery({ _id: id, isBlocked: true, isEmailVerified: true });
            }
            return createMockQuery({ _id: id, name: "Eligible Candidate 51", email: "cand51@doc.com", isBlocked: false, isEmailVerified: true });
        };

        let winnerSeq = null;
        RoomBooking.create = async ([doc]) => {
            const winner = candidates.find(c => c.doctor.toString() === doc.doctor.toString());
            winnerSeq = winner ? winner.sequenceNumber : null;
            return [{ ...doc, _id: new mongoose.Types.ObjectId() }];
        };
        RoomBookingRequest.updateMany = async () => {};

        const result = await roomController.processSlotAllocation(slotId);

        assert.strictEqual(result.allocated, true, "Candidate 51 beyond the first 50 must be evaluated and allocated");
        assert.strictEqual(winnerSeq, 51, "Allocated candidate must be sequence #51");
        assert.strictEqual(candidates[0].status, "REJECTED_DOCTOR_INELIGIBLE", "First candidate was rejected");
        assert.strictEqual(candidates[49].status, "REJECTED_DOCTOR_INELIGIBLE", "Candidate 50 was rejected");
        assert.strictEqual(candidates[50].status, "ALLOCATED", "Candidate 51 was allocated");

        RoomSlot.findById = origSlotFindById;
        Organization.findById = origOrgFindById;
        Room.findById = origRoomFindById;
        RoomBooking.findOne = origBookingFindOne;
        RoomBookingRequest.find = origRequestFind;
        RoomBookingRequest.findById = origRequestFindById;
        DoctorOrganization.findOne = origDocOrgFindOne;
        Doctor.findById = origDocFindById;
        RoomBooking.create = origBookingCreate;
        RoomBookingRequest.updateMany = origRequestUpdateMany;
        Appointment.findOne = origApptFindOne;
        Appointment.find = origApptFind;
    });

    await runAsyncTest("[UNIT / MOCKED] Repeated processor execution on already reserved slot is idempotent and does not create duplicate booking", async () => {
        const origSlotFindById = RoomSlot.findById;
        const existingBookingId = new mongoose.Types.ObjectId();

        RoomSlot.findById = () => createMockQuery({
            _id: slotId,
            status: "Reserved",
            activeBooking: existingBookingId
        });

        const result = await roomController.processSlotAllocation(slotId);
        assert.strictEqual(result.allocated, false);
        assert(result.reason.includes("Reserved state"));

        RoomSlot.findById = origSlotFindById;
    });

    // ========================================================
    // 5. SCHEDULE CONFLICTS & ROOM BOOKING LIFECYCLE
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] Doctor cannot have overlapping active room reservations across organizations", async () => {
        const start = new Date("2026-11-10T09:00:00Z");
        const end = new Date("2026-11-10T12:00:00Z");

        const origBookingFindOne = RoomBooking.findOne;
        RoomBooking.findOne = () => createMockQuery({
            _id: new mongoose.Types.ObjectId(),
            organization: orgBId,
            status: "Active",
            startDateTime: start,
            endDateTime: end
        });

        const mockSession = {};
        const conflict = await checkDoctorScheduleConflicts(doc1Id, start, end, mockSession);

        assert(conflict, "Conflict must be detected");
        assert.strictEqual(conflict.hasConflict, true);
        assert.strictEqual(conflict.tier, "TIER1_ROOM_BOOKING");

        RoomBooking.findOne = origBookingFindOne;
    });

    await runAsyncTest("[UNIT / MOCKED] Booking cancellation updates status, audit metadata, and safely reopens slot", async () => {
        const bookingId = new mongoose.Types.ObjectId();
        const origBookingFindById = RoomBooking.findById;
        const origSlotFindById = RoomSlot.findById;
        const origDocFindById = Doctor.findById;
        const origOrgFindById = Organization.findById;
        const origRoomFindById = Room.findById;

        const mockBooking = {
            _id: bookingId,
            doctor: doc1Id,
            organization: orgAId,
            room: roomId,
            roomSlot: slotId,
            status: "Active",
            save: async function () { return this; }
        };

        const mockSlot = {
            _id: slotId,
            activeBooking: bookingId,
            queueGeneration: 1,
            queueSequenceCounter: 4,
            status: "Reserved",
            save: async function () { return this; }
        };

        RoomBooking.findById = () => createMockQuery(mockBooking);
        RoomSlot.findById = () => createMockQuery(mockSlot);
        Doctor.findById = () => createMockQuery({ name: "Dr. Alice", email: "alice@doc.com" });
        Organization.findById = () => createMockQuery({ name: "Hospital A", email: "hosp@a.com" });
        Room.findById = () => createMockQuery({ roomNumber: "101" });

        const req = {
            userDetails: { _id: doc1Id },
            params: { id: bookingId.toString() },
            body: { reason: "Personal emergency" }
        };
        const res = createMockRes();

        await roomController.cancelRoomBooking(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(mockBooking.status, "Cancelled");
        assert.strictEqual(mockBooking.cancellationReason, "Personal emergency");
        assert.strictEqual(mockBooking.cancelledByType, "Doctor");
        assert(mockBooking.cancelledAt instanceof Date);

        assert.strictEqual(mockSlot.activeBooking, null, "activeBooking reference must be cleared");
        assert.strictEqual(mockSlot.queueGeneration, 2, "queueGeneration must be bumped from 1 to 2");
        assert.strictEqual(mockSlot.queueSequenceCounter, 0, "queueSequenceCounter must be reset to 0");
        assert.strictEqual(mockSlot.status, "Available", "Slot status must be set back to Available");

        RoomBooking.findById = origBookingFindById;
        RoomSlot.findById = origSlotFindById;
        Doctor.findById = origDocFindById;
        Organization.findById = origOrgFindById;
        Room.findById = origRoomFindById;
    });

    // ========================================================
    // 6. ORGANIZATION BLOCKING & NON-OPERATIONAL ROOMS
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] acquireScheduleLocks acquires Organization lock first in hierarchy", async () => {
        let lockSequence = [];

        const origOrgFind = Organization.findOneAndUpdate;
        const origRoomFind = Room.findOneAndUpdate;
        const origDocFind = Doctor.findOneAndUpdate;
        const origDocOrgFind = DoctorOrganization.findOneAndUpdate;

        Organization.findOneAndUpdate = async () => {
            lockSequence.push("ORGANIZATION");
            return { _id: orgAId };
        };
        Room.findOneAndUpdate = async () => {
            lockSequence.push("ROOM");
            return { _id: roomId };
        };
        Doctor.findOneAndUpdate = async () => {
            lockSequence.push("DOCTOR");
            return { _id: doc1Id };
        };
        DoctorOrganization.findOneAndUpdate = async () => {
            lockSequence.push("DOCTOR_ORGANIZATION");
            return { _id: new mongoose.Types.ObjectId() };
        };

        const mockSession = {};
        await acquireScheduleLocks({
            organizationId: orgAId,
            roomId,
            doctorId: doc1Id,
            doctorOrganizationId: new mongoose.Types.ObjectId(),
            session: mockSession
        });

        assert.deepStrictEqual(
            lockSequence,
            ["ORGANIZATION", "ROOM", "DOCTOR", "DOCTOR_ORGANIZATION"],
            "Locks must be acquired strictly: Organization -> Room -> Doctor -> DoctorOrganization"
        );

        Organization.findOneAndUpdate = origOrgFind;
        Room.findOneAndUpdate = origRoomFind;
        Doctor.findOneAndUpdate = origDocFind;
        DoctorOrganization.findOneAndUpdate = origDocOrgFind;
    });

    await runAsyncTest("[UNIT / MOCKED] Organization blocking transitions pending queue requests to REJECTED_ORG_SUSPENDED", async () => {
        const origOrgFindById = Organization.findById;
        const origRoomFind = Room.find;
        const origSlotUpdateMany = RoomSlot.updateMany;
        const origReqUpdateMany = RoomBookingRequest.updateMany;

        Organization.findById = (id) => createMockQuery({
            _id: orgAId,
            name: "Blocked Hospital",
            email: "blocked@hosp.com",
            isBlocked: false,
            save: async () => {}
        });

        Room.find = () => createMockQuery([]);

        let updatedSlotStatus = null;
        RoomSlot.updateMany = async (query, update) => {
            updatedSlotStatus = update.$set.status;
        };

        let updatedReqStatus = null;
        RoomBookingRequest.updateMany = async (query, update) => {
            updatedReqStatus = update.$set.status;
        };

        const req = {
            userDetails: { _id: new mongoose.Types.ObjectId() },
            body: { organizationId: orgAId.toString(), isBlocked: true, reason: "Administrative audit" }
        };
        const res = createMockRes();

        await adminController.updateOrganizationBlockStatus(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(updatedSlotStatus, "Maintenance", "Available/Queued slots must be moved to Maintenance");
        assert.strictEqual(updatedReqStatus, "REJECTED_ORG_SUSPENDED", "Pending requests must transition to REJECTED_ORG_SUSPENDED");

        Organization.findById = origOrgFindById;
        Room.find = origRoomFind;
        RoomSlot.updateMany = origSlotUpdateMany;
        RoomBookingRequest.updateMany = origReqUpdateMany;
    });

    // ========================================================
    // 7. SCHEMA ENUM HARMONIZATION
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] RoomBookingRequest schema enum includes REJECTED_ROOM_MAINTENANCE and all controller statuses", async () => {
        const schemaEnum = RoomBookingRequest.schema.path("status").enumValues;

        const expectedStatuses = [
            "PENDING",
            "ALLOCATED",
            "REJECTED_DOCTOR_INELIGIBLE",
            "REJECTED_UNAFFILIATED",
            "REJECTED_CONFLICT",
            "REJECTED_SUPERSEDED",
            "REJECTED_ORG_SUSPENDED",
            "REJECTED_ROOM_MAINTENANCE",
            "CANCELLED"
        ];

        for (const st of expectedStatuses) {
            assert(schemaEnum.includes(st), `Schema enum must include status: ${st}`);
        }

        // Validate that an invalid status is rejected by schema validation
        const invalidDoc = new RoomBookingRequest({
            roomSlot: slotId,
            room: roomId,
            organization: orgAId,
            doctor: doc1Id,
            status: "INVALID_STATUS_XYZ"
        });

        const validationErr = await invalidDoc.validate().catch(err => err);
        assert(validationErr && validationErr.errors && validationErr.errors["status"], "Schema must reject invalid status");
    });

    // ========================================================
    // 8. TRANSACTION RETRY & OUTBOX INTEGRATION
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] Outbox notification failure aborts room booking request transaction", async () => {
        const origDocFind = Doctor.findById;
        const origSlotFind = RoomSlot.findById;
        const origOrgFind = Organization.findById;
        const origRoomFind = Room.findById;
        const origAffFind = DoctorOrganization.findOne;
        const origReqCreate = RoomBookingRequest.create;
        const origFindOne = RoomBookingRequest.findOne;
        const origOutboxCreate = OutboxNotification.create;
        const origStartSession = mongoose.startSession;

        Doctor.findById = async () => ({ _id: doc1Id, isEmailVerified: true, isBlocked: false });
        const mockSlot = {
            _id: slotId,
            organization: orgAId,
            room: roomId,
            status: "Available",
            queueGeneration: 0,
            queueSequenceCounter: 0,
            save: async () => {}
        };
        RoomSlot.findById = () => createMockQuery(mockSlot);
        Organization.findById = async () => ({ _id: orgAId, isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false });
        Room.findById = async () => ({ _id: roomId, isOperational: true });
        DoctorOrganization.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), status: "Approved" });
        RoomBookingRequest.findOne = () => createMockQuery(null);

        RoomBookingRequest.create = async (arr) => arr.map(doc => ({ ...doc, _id: new mongoose.Types.ObjectId() }));

        OutboxNotification.create = async () => {
            throw new Error("Simulated Outbox DB connection error");
        };

        let transactionAborted = false;
        let transactionCommitted = false;

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => { transactionCommitted = true; },
            abortTransaction: async () => { transactionAborted = true; },
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: doc1Id },
            body: { slotId: slotId.toString() }
        };
        const res = createMockRes();

        await roomController.requestRoomBooking(req, res);

        assert.strictEqual(transactionAborted, true, "Transaction must abort when outbox notification fails");
        assert.strictEqual(transactionCommitted, false, "Transaction must NOT commit");
        assert.strictEqual(res.statusCode, 500);

        Doctor.findById = origDocFind;
        RoomSlot.findById = origSlotFind;
        Organization.findById = origOrgFind;
        Room.findById = origRoomFind;
        DoctorOrganization.findOne = origAffFind;
        RoomBookingRequest.create = origReqCreate;
        RoomBookingRequest.findOne = origFindOne;
        OutboxNotification.create = origOutboxCreate;
        mongoose.startSession = origStartSession;
    });

    await runAsyncTest("[UNIT / MOCKED] executeTransactionWithRetry retries on TransientTransactionError and succeeds", async () => {
        let attempts = 0;
        const result = await executeTransactionWithRetry(async (session) => {
            attempts++;
            if (attempts === 1) {
                const transientErr = new Error("Write conflict in replica set");
                transientErr.code = 112; // WriteConflict
                throw transientErr;
            }
            return "SUCCESS_AFTER_RETRY";
        }, { maxRetries: 3, baseBackoffMs: 5 });

        assert.strictEqual(result, "SUCCESS_AFTER_RETRY");
        assert.strictEqual(attempts, 2, "Must retry exactly once after first transient failure");
    });

    await runAsyncTest("[UNIT / MOCKED] executeTransactionWithRetry retries commit on UnknownTransactionCommitResult", async () => {
        const origStartSession = mongoose.startSession;

        let commitAttempts = 0;
        let opRunCount = 0;

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => {
                commitAttempts++;
                if (commitAttempts === 1) {
                    const commitErr = new Error("Unknown commit result");
                    commitErr.name = "UnknownTransactionCommitResult";
                    throw commitErr;
                }
            },
            abortTransaction: async () => {},
            endSession: async () => {}
        });

        const result = await executeTransactionWithRetry(async (session) => {
            opRunCount++;
            return "COMMIT_RETRY_OK";
        }, { maxRetries: 3, baseBackoffMs: 5 });

        assert.strictEqual(result, "COMMIT_RETRY_OK");
        assert.strictEqual(opRunCount, 1, "Operation body must not be re-executed when only commit failed");
        assert.strictEqual(commitAttempts, 2, "Commit must be retried");

        mongoose.startSession = origStartSession;
    });

    console.log(`\nRoom Management & Booking Test Results: ${passed}/${total} passed.\n`);
    if (passed !== total) process.exit(1);
})();
