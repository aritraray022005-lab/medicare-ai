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
const Appointment = require("../src/models/appointment.model");
const DurableJob = require("../src/models/durableJob.model");
const OutboxNotification = require("../src/models/outboxNotification.model");

const patientController = require("../src/controller/patient.controller");
const doctorController = require("../src/controller/doctor.controller");
const adminController = require("../src/controller/admin.controller");
const roomController = require("../src/controller/room.controller");
const { acquireScheduleLocks } = require("../src/util/lock.util");

console.log("=== Running Organization-Based Patient Appointments & Concurrency Unit Tests (Phase 6) ===");

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
const patientId = new mongoose.Types.ObjectId();
const orgId = new mongoose.Types.ObjectId();
const doctorId = new mongoose.Types.ObjectId();
const roomId = new mongoose.Types.ObjectId();
const roomSlotId = new mongoose.Types.ObjectId();
const roomBookingId = new mongoose.Types.ObjectId();
const appointmentId = new mongoose.Types.ObjectId();

// Default Mock Data
const defaultDoctor = {
    _id: doctorId,
    name: "Dr. John Doe",
    email: "doctor@test.com",
    isEmailVerified: true,
    isVerifiedByAdmin: false, // Affiliated doctor
    isBlocked: false,
    availability: {
        sunday: ["10:00", "11:00"],
        monday: ["10:00", "11:00"]
    }
};

const defaultOrg = {
    _id: orgId,
    name: "Metro Health Hospital",
    isEmailVerified: true,
    isVerifiedByAdmin: true,
    isBlocked: false,
    timezone: "UTC",
    scheduleVersion: 1
};

const defaultAff = {
    _id: new mongoose.Types.ObjectId(),
    doctor: doctorId,
    organization: orgId,
    status: "Approved",
    scheduleVersion: 1
};

const defaultRoom = {
    _id: roomId,
    organization: orgId,
    roomNumber: "101",
    floor: "1st Floor",
    isOperational: true,
    scheduleVersion: 1
};

const defaultBooking = {
    _id: roomBookingId,
    organization: orgId,
    doctor: doctorId,
    room: roomId,
    roomSlot: roomSlotId,
    status: "Active",
    startDateTime: new Date("2026-11-15T09:00:00.000Z"),
    endDateTime: new Date("2026-11-15T13:00:00.000Z")
};

const defaultPatient = {
    _id: patientId,
    name: "Alice Patient",
    email: "alice@test.com"
};

// Install Safe Global Mocks (Prevent any Mongoose query buffering)
function resetMocks() {
    const freshDoctor = {
        _id: doctorId,
        name: "Dr. John Doe",
        email: "doctor@test.com",
        isEmailVerified: true,
        isVerifiedByAdmin: false, // Affiliated doctor
        isBlocked: false,
        availability: {
            sunday: ["10:00", "11:00"],
            monday: ["10:00", "11:00"]
        },
        save: async function() { return this; }
    };

    const freshOrg = {
        _id: orgId,
        name: "Metro Health Hospital",
        isEmailVerified: true,
        isVerifiedByAdmin: true,
        isBlocked: false,
        timezone: "UTC",
        scheduleVersion: 1,
        save: async function() { return this; }
    };

    const freshAff = {
        _id: new mongoose.Types.ObjectId(),
        doctor: doctorId,
        organization: orgId,
        status: "Approved",
        scheduleVersion: 1,
        save: async function() { return this; }
    };

    const freshRoom = {
        _id: roomId,
        organization: orgId,
        roomNumber: "101",
        floor: "1st Floor",
        isOperational: true,
        scheduleVersion: 1,
        save: async function() { return this; }
    };

    const freshBooking = {
        _id: roomBookingId,
        organization: orgId,
        doctor: doctorId,
        room: roomId,
        roomSlot: roomSlotId,
        status: "Active",
        startDateTime: new Date("2026-11-15T09:00:00.000Z"),
        endDateTime: new Date("2026-11-15T13:00:00.000Z"),
        save: async function() { return this; }
    };

    const freshSlot = {
        _id: roomSlotId,
        room: roomId,
        organization: orgId,
        status: "Reserved",
        queueGeneration: 1,
        queueSequenceCounter: 0,
        activeBooking: roomBookingId,
        save: async function() { return this; }
    };

    const freshPatient = {
        _id: patientId,
        name: "Alice Patient",
        email: "alice@test.com",
        save: async function() { return this; }
    };

    Patient.findById = () => createMockQuery(freshPatient);
    Patient.findOne = () => createMockQuery(freshPatient);

    Doctor.findById = () => createMockQuery(freshDoctor);
    Doctor.findOne = () => createMockQuery(freshDoctor);
    Doctor.findOneAndUpdate = async (filter) => ({ ...freshDoctor, _id: filter._id || doctorId, scheduleVersion: 2 });

    Organization.findById = () => createMockQuery(freshOrg);
    Organization.findOne = () => createMockQuery(freshOrg);
    Organization.findOneAndUpdate = async (filter) => ({ ...freshOrg, _id: filter._id || orgId, scheduleVersion: 2 });

    DoctorOrganization.findById = () => createMockQuery(freshAff);
    DoctorOrganization.findOne = () => createMockQuery(freshAff);
    DoctorOrganization.findOneAndUpdate = async () => ({ ...freshAff, scheduleVersion: 2 });

    Room.findById = () => createMockQuery(freshRoom);
    Room.findOne = () => createMockQuery(freshRoom);
    Room.findOneAndUpdate = async (filter) => ({ ...freshRoom, _id: filter._id || roomId, scheduleVersion: 2 });

    RoomBooking.findById = () => createMockQuery(freshBooking);
    RoomBooking.findOne = () => createMockQuery(null); // Return null for conflict searches!

    RoomSlot.findById = () => createMockQuery(freshSlot);
    RoomSlot.findOne = () => createMockQuery(freshSlot);

    Appointment.find = () => createMockQuery([]);
    Appointment.findOne = () => createMockQuery(null);
    Appointment.findById = () => createMockQuery(null);
    Appointment.create = async (arr) => arr.map(a => ({ ...a, _id: new mongoose.Types.ObjectId() }));
    Appointment.updateMany = async () => ({ modifiedCount: 1 });

    OutboxNotification.create = async (docs) => (Array.isArray(docs) ? docs : [docs]).map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));

    DurableJob.findOne = () => createMockQuery(null);
    DurableJob.create = async (docs) => (Array.isArray(docs) ? docs : [docs]).map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));
    DurableJob.updateOne = async () => ({ modifiedCount: 1 });
    DurableJob.findOneAndUpdate = () => createMockQuery(null);

    mongoose.startSession = async () => ({
        startTransaction: () => {},
        commitTransaction: async () => {},
        abortTransaction: async () => {},
        endSession: async () => {}
    });
}

(async () => {
    resetMocks();

    const sampleDate = "2026-11-15";
    const sampleTime = "10:00";

    // ========================================================
    // 1. ELIGIBILITY VALIDATION
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] Unverified organization cannot host appointments", async () => {
        resetMocks();
        Organization.findById = () => createMockQuery({
            ...defaultOrg,
            isVerifiedByAdmin: false // Not admin verified
        });

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("Organization is unverified"));
    });

    await runAsyncTest("[UNIT / MOCKED] Blocked organization cannot host appointments", async () => {
        resetMocks();
        Organization.findById = () => createMockQuery({
            ...defaultOrg,
            isBlocked: true // Suspended
        });

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("suspended"));
    });

    await runAsyncTest("[UNIT / MOCKED] Doctor with unverified email cannot accept organization appointments", async () => {
        resetMocks();
        Doctor.findById = () => createMockQuery({
            ...defaultDoctor,
            isEmailVerified: false
        });

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("Doctor email is not verified"));
    });

    await runAsyncTest("[UNIT / MOCKED] Blocked doctor cannot accept organization appointments", async () => {
        resetMocks();
        Doctor.findById = () => createMockQuery({
            ...defaultDoctor,
            isBlocked: true
        });

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("Doctor account is suspended"));
    });

    await runAsyncTest("[UNIT / MOCKED] Doctor without approved affiliation cannot accept organization appointments", async () => {
        resetMocks();
        DoctorOrganization.findOne = () => createMockQuery(null); // No affiliation

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("Doctor does not have an approved affiliation"));
    });

    await runAsyncTest("[UNIT / MOCKED] Doctor admin verification distinction: Independent bookings strictly require doctor admin verification", async () => {
        resetMocks();
        Doctor.findOne = () => createMockQuery(null); // Doctor is not admin verified, so Doctor.findOne({...isVerifiedByAdmin: true}) returns null

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Independent",
                doctorId: doctorId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 404);
        assert(res.data.msg.includes("Doctor not found or doctor is not verified"));
    });

    // ========================================================
    // 2. TIME & ROOM VALIDATION
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] Organization appointment succeeds when requested interval is fully inside doctor's active RoomBooking", async () => {
        resetMocks();
        let createdAppointment = null;
        Appointment.create = async (arr) => {
            createdAppointment = { ...arr[0], _id: new mongoose.Types.ObjectId() };
            return [createdAppointment];
        };

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime,
                durationMinutes: 30
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(res.data.status, "success");
        assert(createdAppointment !== null);
        assert.strictEqual(createdAppointment.bookingType, "Organization");
        assert.strictEqual(createdAppointment.organization.toString(), orgId.toString());
    });

    await runAsyncTest("[UNIT / MOCKED] Appointment rejected when requested interval starts before active RoomBooking interval", async () => {
        resetMocks();
        // Booking is 09:00 to 13:00 UTC. Patient requests 08:30 UTC.
        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: "2026-11-15",
                time: "08:30",
                durationMinutes: 30
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("is outside the doctor's room reservation"));
    });

    await runAsyncTest("[UNIT / MOCKED] Appointment rejected when requested interval extends past active RoomBooking end time", async () => {
        resetMocks();
        // Booking is 09:00 to 13:00 UTC. Patient requests 12:45 UTC for 30 mins (ends 13:15).
        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: "2026-11-15",
                time: "12:45",
                durationMinutes: 30
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("is outside the doctor's room reservation"));
    });

    await runAsyncTest("[UNIT / MOCKED] Appointment rejected when RoomBooking is cancelled/inactive", async () => {
        resetMocks();
        RoomBooking.findById = () => createMockQuery({
            ...defaultBooking,
            status: "Cancelled"
        });

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("Room booking is not active"));
    });

    await runAsyncTest("[UNIT / MOCKED] Appointment rejected when room is non-operational (maintenance)", async () => {
        resetMocks();
        Room.findById = () => createMockQuery({
            ...defaultRoom,
            isOperational: false
        });

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("Requested room is non-operational"));
    });

    // ========================================================
    // 3. CONFLICTS & CONCURRENCY
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] Cross-tier conflict: Organization booking rejected if doctor has overlapping active independent appointment", async () => {
        resetMocks();
        // Doctor already has an active appointment in that interval
        Appointment.findOne = (query) => {
            if (query && query.doctor) {
                return createMockQuery({
                    _id: new mongoose.Types.ObjectId(),
                    doctor: doctorId,
                    bookingType: "Independent",
                    status: "Confirmed",
                    startDateTime: new Date("2026-11-15T10:00:00.000Z"),
                    endDateTime: new Date("2026-11-15T10:30:00.000Z")
                });
            }
            return createMockQuery(null);
        };

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: "2026-11-15",
                time: "10:15",
                durationMinutes: 30
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("Doctor schedule conflict"));
    });

    await runAsyncTest("[UNIT / MOCKED] Canonical lock order: Organization -> Room -> Doctor -> DoctorOrganization", async () => {
        const lockedKeys = [];
        const mockSession = {};

        Organization.findOneAndUpdate = async (filter) => {
            lockedKeys.push("Organization:" + filter._id);
            return { _id: filter._id, scheduleVersion: 1 };
        };
        Room.findOneAndUpdate = async (filter) => {
            lockedKeys.push("Room:" + filter._id);
            return { _id: filter._id, scheduleVersion: 1 };
        };
        Doctor.findOneAndUpdate = async (filter) => {
            lockedKeys.push("Doctor:" + filter._id);
            return { _id: filter._id, scheduleVersion: 1 };
        };
        DoctorOrganization.findOneAndUpdate = async (filter) => {
            lockedKeys.push("DoctorOrganization:" + filter._id);
            return { _id: filter._id, scheduleVersion: 1 };
        };

        await acquireScheduleLocks({
            organizationId: orgId,
            roomId: roomId,
            doctorId: doctorId,
            doctorOrganizationId: defaultAff._id,
            session: mockSession
        });

        assert.strictEqual(lockedKeys.length, 4);
        assert(lockedKeys[0].startsWith("Organization:"));
        assert(lockedKeys[1].startsWith("Room:"));
        assert(lockedKeys[2].startsWith("Doctor:"));
        assert(lockedKeys[3].startsWith("DoctorOrganization:"));
    });

    await runAsyncTest("[UNIT / MOCKED] Concurrency: Two patients attempting same doctor/time — second detects room conflict", async () => {
        resetMocks();
        // Room conflict check inside transaction finds existing appointment
        Appointment.findOne = (query) => {
            if (query && query.room) {
                return createMockQuery({
                    _id: new mongoose.Types.ObjectId(),
                    room: roomId,
                    status: "Confirmed",
                    startDateTime: new Date("2026-11-15T10:00:00.000Z"),
                    endDateTime: new Date("2026-11-15T10:30:00.000Z")
                });
            }
            return createMockQuery(null);
        };

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("room is already reserved"));
    });

    await runAsyncTest("[UNIT / MOCKED] Concurrency: Post-lock revalidation aborts if organization is blocked while waiting for locks", async () => {
        resetMocks();
        let readCount = 0;
        Organization.findById = () => {
            readCount++;
            return createMockQuery({
                ...defaultOrg,
                isBlocked: readCount > 1 // Blocked on re-read after lock!
            });
        };

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("suspended"));
    });

    await runAsyncTest("[UNIT / MOCKED] Concurrency: Post-lock revalidation aborts if RoomBooking was cancelled while waiting for locks", async () => {
        resetMocks();
        let readCount = 0;
        RoomBooking.findById = () => {
            readCount++;
            return createMockQuery({
                ...defaultBooking,
                status: readCount > 1 ? "Cancelled" : "Active" // Cancelled on re-read after lock!
            });
        };

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("Room booking is no longer active"));
    });

    await runAsyncTest("[UNIT / MOCKED] Outbox notification failure aborts appointment transaction (rollback)", async () => {
        resetMocks();
        OutboxNotification.create = async () => {
            throw new Error("Simulated Outbox DB connection failure");
        };

        let transactionAborted = false;
        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => {},
            abortTransaction: async () => { transactionAborted = true; },
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: patientId },
            body: {
                bookingType: "Organization",
                organizationId: orgId.toString(),
                doctorId: doctorId.toString(),
                roomId: roomId.toString(),
                roomBookingId: roomBookingId.toString(),
                date: sampleDate,
                time: sampleTime
            }
        };
        const res = createMockRes();

        await patientController.bookAppointment(req, res);
        assert.strictEqual(transactionAborted, true, "Transaction must abort when outbox notification fails");
        assert.strictEqual(res.statusCode, 500);
    });

    // ========================================================
    // 4. APPOINTMENT LIFECYCLE & CANCELLATION
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] Patient can cancel appointment with transactional audit metadata and doctor outbox notification", async () => {
        resetMocks();
        let apptSaved = false;
        const mockAppt = {
            _id: appointmentId,
            patient: patientId,
            doctor: doctorId,
            organization: orgId,
            room: roomId,
            status: "Confirmed",
            save: async function() {
                apptSaved = true;
                assert.strictEqual(this.status, "Cancelled");
                assert.strictEqual(this.cancelledBy, "Patient");
                assert(this.cancellationReason.includes("Schedule conflict"));
            }
        };

        Appointment.findOne = () => createMockQuery(mockAppt);

        let notificationCreated = false;
        OutboxNotification.create = async (arr) => {
            notificationCreated = true;
            assert.strictEqual(arr[0].type, "APPOINTMENT_CANCELLED");
            return arr;
        };

        const req = {
            userDetails: { _id: patientId },
            body: {
                appointmentId: appointmentId.toString(),
                reason: "Schedule conflict"
            }
        };
        const res = createMockRes();

        await patientController.cancelAppointment(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(apptSaved, true);
        assert.strictEqual(notificationCreated, true);
    });

    await runAsyncTest("[UNIT / MOCKED] Doctor can confirm pending appointment atomically and queue patient notification", async () => {
        resetMocks();
        let apptSaved = false;
        const mockAppt = {
            _id: appointmentId,
            doctor: doctorId,
            patient: patientId,
            status: "Pending",
            date: new Date(),
            time: "10:00",
            save: async function() {
                apptSaved = true;
                assert.strictEqual(this.status, "Confirmed");
            }
        };

        Appointment.findOne = () => createMockQuery(mockAppt);

        let outboxCreated = false;
        OutboxNotification.create = async (arr) => {
            outboxCreated = true;
            assert.strictEqual(arr[0].type, "APPOINTMENT_CONFIRMED");
            return arr;
        };

        const req = {
            userDetails: { _id: doctorId },
            body: {
                appointmentId: appointmentId.toString(),
                status: "confirmed"
            }
        };
        const res = createMockRes();

        await doctorController.updateAppointmentStatus(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(apptSaved, true);
        assert.strictEqual(outboxCreated, true);
    });

    await runAsyncTest("[UNIT / MOCKED] Doctor can reject pending appointment with cancellation audit metadata", async () => {
        resetMocks();
        let apptSaved = false;
        const mockAppt = {
            _id: appointmentId,
            doctor: doctorId,
            patient: patientId,
            status: "Pending",
            date: new Date(),
            time: "10:00",
            save: async function() {
                apptSaved = true;
                assert.strictEqual(this.status, "Cancelled");
                assert.strictEqual(this.cancelledBy, "Doctor");
            }
        };

        Appointment.findOne = () => createMockQuery(mockAppt);

        let outboxCreated = false;
        OutboxNotification.create = async (arr) => {
            outboxCreated = true;
            assert.strictEqual(arr[0].type, "APPOINTMENT_CANCELLED");
            return arr;
        };

        const req = {
            userDetails: { _id: doctorId },
            body: {
                appointmentId: appointmentId.toString(),
                status: "cancelled"
            }
        };
        const res = createMockRes();

        await doctorController.updateAppointmentStatus(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(apptSaved, true);
        assert.strictEqual(outboxCreated, true);
    });

    await runAsyncTest("[UNIT / MOCKED] RoomBooking cancellation cascade cancels all associated patient appointments", async () => {
        resetMocks();
        const mockBooking = {
            ...defaultBooking,
            status: "Active",
            save: async function() {
                this.status = "Cancelled";
            }
        };

        RoomBooking.findById = () => createMockQuery(mockBooking);
        RoomBooking.findOne = () => createMockQuery(mockBooking);

        // Two affected patient appointments tied to this RoomBooking with save() method
        const mockAffectedAppointments = [
            {
                _id: new mongoose.Types.ObjectId(),
                patient: patientId,
                status: "Confirmed",
                save: async function() { this.status = "Cancelled"; }
            },
            {
                _id: new mongoose.Types.ObjectId(),
                patient: new mongoose.Types.ObjectId(),
                status: "Pending",
                save: async function() { this.status = "Cancelled"; }
            }
        ];

        Appointment.find = () => createMockQuery(mockAffectedAppointments);

        let outboxCount = 0;
        OutboxNotification.create = async (arr) => {
            outboxCount += arr.length;
            return arr;
        };

        const req = {
            organization: { _id: orgId },
            params: { id: roomBookingId.toString() },
            body: { reason: "Facility emergency maintenance" }
        };
        const res = createMockRes();

        await roomController.cancelRoomBooking(req, res);
        if (res.statusCode !== 200) {
            console.error("DEBUG cancelRoomBooking failure:", res.data);
        }
        assert.strictEqual(res.statusCode, 200);
        assert(outboxCount >= 2, "Notifications must be queued for all cancelled patient appointments");
    });

    // ========================================================
    // 5. HISTORICAL RESOLUTION (Phase 1 Audit Condition)
    // ========================================================

    await runAsyncTest("[UNIT / MOCKED] Historical resolution rejects stale RoomBooking reference after lock acquisition", async () => {
        resetMocks();
        const initialObservedBookingId = new mongoose.Types.ObjectId();
        const changedBookingId = new mongoose.Types.ObjectId(); // Stale reference race

        let readCount = 0;
        Appointment.findById = () => {
            readCount++;
            return createMockQuery({
                _id: appointmentId,
                patient: patientId,
                doctor: doctorId,
                room: roomId,
                organization: orgId,
                roomBooking: readCount === 1 ? initialObservedBookingId : changedBookingId,
                status: "Pending",
                isTimezoneUnconfirmed: true,
                date: new Date("2026-11-15T00:00:00.000Z"),
                time: "10:00"
            });
        };

        RoomBooking.findById = () => createMockQuery({
            _id: initialObservedBookingId,
            doctor: doctorId,
            room: roomId,
            organization: orgId,
            status: "Active",
            startDateTime: new Date("2026-11-15T09:00:00.000Z"),
            endDateTime: new Date("2026-11-15T13:00:00.000Z")
        });

        const req = {
            userDetails: { _id: new mongoose.Types.ObjectId() },
            params: { id: appointmentId.toString() },
            body: {
                roomBookingId: initialObservedBookingId.toString(),
                reason: "Administrative historical timezone alignment"
            }
        };
        const res = createMockRes();

        await adminController.resolveHistoricalAppointment(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("Stale reference detected"));
    });

    await runAsyncTest("[UNIT / MOCKED] Historical resolution rejects RoomBooking belonging to another doctor", async () => {
        resetMocks();
        const otherDoctorId = new mongoose.Types.ObjectId();

        Appointment.findById = () => createMockQuery({
            _id: appointmentId,
            patient: patientId,
            doctor: doctorId,
            room: roomId,
            organization: orgId,
            roomBooking: roomBookingId,
            status: "Pending",
            isTimezoneUnconfirmed: true,
            date: new Date("2026-11-15T00:00:00.000Z"),
            time: "10:00"
        });

        RoomBooking.findById = () => createMockQuery({
            _id: roomBookingId,
            doctor: otherDoctorId, // Different doctor!
            room: roomId,
            organization: orgId,
            status: "Active",
            startDateTime: new Date("2026-11-15T09:00:00.000Z"),
            endDateTime: new Date("2026-11-15T13:00:00.000Z")
        });

        const req = {
            userDetails: { _id: new mongoose.Types.ObjectId() },
            params: { id: appointmentId.toString() },
            body: {
                roomBookingId: roomBookingId.toString(),
                reason: "Administrative historical alignment"
            }
        };
        const res = createMockRes();

        await adminController.resolveHistoricalAppointment(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("appointment doctor"));
    });

    await runAsyncTest("[UNIT / MOCKED] Historical resolution rejects RoomBooking belonging to another room", async () => {
        resetMocks();
        const otherRoomId = new mongoose.Types.ObjectId();

        Appointment.findById = () => createMockQuery({
            _id: appointmentId,
            patient: patientId,
            doctor: doctorId,
            room: roomId, // Appointment room is roomId
            organization: orgId,
            roomBooking: roomBookingId,
            status: "Pending",
            isTimezoneUnconfirmed: true,
            date: new Date("2026-11-15T00:00:00.000Z"),
            time: "10:00"
        });

        RoomBooking.findById = () => createMockQuery({
            _id: roomBookingId,
            doctor: doctorId,
            room: otherRoomId, // RoomBooking belongs to otherRoomId!
            organization: orgId,
            status: "Active",
            startDateTime: new Date("2026-11-15T09:00:00.000Z"),
            endDateTime: new Date("2026-11-15T13:00:00.000Z")
        });

        const req = {
            userDetails: { _id: new mongoose.Types.ObjectId() },
            params: { id: appointmentId.toString() },
            body: {
                roomBookingId: roomBookingId.toString(),
                reason: "Administrative historical alignment"
            }
        };
        const res = createMockRes();

        await adminController.resolveHistoricalAppointment(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("appointment room"));
    });

    await runAsyncTest("[UNIT / MOCKED] Historical resolution succeeds and transitions isTimezoneUnconfirmed to false", async () => {
        resetMocks();
        let appointmentUpdated = false;
        const mockAppt = {
            _id: appointmentId,
            patient: patientId,
            doctor: doctorId,
            room: roomId,
            organization: orgId,
            roomBooking: roomBookingId,
            startDateTime: new Date("2026-11-15T10:00:00.000Z"),
            endDateTime: new Date("2026-11-15T10:30:00.000Z"),
            date: new Date("2026-11-15T00:00:00.000Z"),
            time: "10:00",
            status: "Confirmed",
            isTimezoneUnconfirmed: true,
            save: async function() {
                appointmentUpdated = true;
                assert.strictEqual(this.isTimezoneUnconfirmed, false);
            }
        };

        Appointment.findById = () => createMockQuery(mockAppt);

        const req = {
            userDetails: { _id: new mongoose.Types.ObjectId() },
            params: { id: appointmentId.toString() },
            body: {
                roomBookingId: roomBookingId.toString(),
                reason: "Verified and aligned with approved facility room booking"
            }
        };
        const res = createMockRes();

        await adminController.resolveHistoricalAppointment(req, res);
        if (res.statusCode !== 200) {
            console.error("DEBUG resolveHistoricalAppointment failure:", res.data);
        }
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.status, "success");
        assert.strictEqual(appointmentUpdated, true);
    });

    console.log(`\nPatient Appointment & Concurrency Test Results: ${passed}/${total} passed.\n`);
    if (passed !== total) process.exit(1);
})();
