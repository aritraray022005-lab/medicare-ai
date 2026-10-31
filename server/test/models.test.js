const assert = require("assert");

console.log("=== Running Models & Schema Verification Tests (Phase 1) ===");

let passed = 0;
let total = 0;

function runTest(name, fn) {
    total++;
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}:`, err.message);
    }
}

// 1. Load All 13 Models
runTest("All 13 Mongoose models load cleanly", () => {
    const Admin = require("../src/models/admin.model");
    const Doctor = require("../src/models/doctor.model");
    const Patient = require("../src/models/patient.model");
    const Appointment = require("../src/models/appointment.model");
    const { Question, Answer } = require("../src/models/qa.model");
    const Organization = require("../src/models/organization.model");
    const DoctorOrganization = require("../src/models/doctorOrganization.model");
    const Room = require("../src/models/room.model");
    const RoomSlot = require("../src/models/roomSlot.model");
    const RoomBookingRequest = require("../src/models/roomBookingRequest.model");
    const RoomBooking = require("../src/models/roomBooking.model");
    const OutboxNotification = require("../src/models/outboxNotification.model");

    assert(Admin);
    assert(Doctor);
    assert(Patient);
    assert(Appointment);
    assert(Question);
    assert(Answer);
    assert(Organization);
    assert(DoctorOrganization);
    assert(Room);
    assert(RoomSlot);
    assert(RoomBookingRequest);
    assert(RoomBooking);
    assert(OutboxNotification);
});

// 2. Doctor Model scheduleVersion Check
runTest("Doctor schema declares scheduleVersion with default 0", () => {
    const Doctor = require("../src/models/doctor.model");
    const path = Doctor.schema.paths.scheduleVersion;
    assert(path, "Doctor schema must have scheduleVersion path");
    assert.strictEqual(path.instance, "Number");
    assert.strictEqual(path.defaultValue, 0);
});

// 3. Room Model scheduleVersion & Indexes Check
runTest("Room schema declares scheduleVersion and unique roomNumber index", () => {
    const Room = require("../src/models/room.model");
    const path = Room.schema.paths.scheduleVersion;
    assert(path, "Room schema must have scheduleVersion path");
    assert.strictEqual(path.instance, "Number");
    assert.strictEqual(path.defaultValue, 0);

    const indexes = Room.schema.indexes();
    const hasUniqueRoom = indexes.some(([keys, opts]) =>
        keys.organization === 1 && keys.roomNumber === 1 && opts.unique === true
    );
    assert(hasUniqueRoom, "Room schema must declare unique index on { organization: 1, roomNumber: 1 }");
});

// 4. Appointment Schema Phase 1 Extensions
runTest("Appointment schema declares all Phase 1 organization and interval fields", () => {
    const Appointment = require("../src/models/appointment.model");
    const paths = Appointment.schema.paths;

    assert(paths.bookingType, "Must have bookingType");
    assert.strictEqual(paths.bookingType.defaultValue, "Independent");
    assert(paths.organization, "Must have organization reference");
    assert(paths.room, "Must have room reference");
    assert(paths.roomSlot, "Must have roomSlot reference");
    assert(paths.roomBooking, "Must have roomBooking reference");
    assert(paths.startDateTime, "Must have startDateTime");
    assert(paths.endDateTime, "Must have endDateTime");
    assert(paths.timezone, "Must have timezone");
    assert(paths.isTimezoneUnconfirmed, "Must have isTimezoneUnconfirmed");
    assert.strictEqual(paths.isTimezoneUnconfirmed.defaultValue, false);
    assert(paths.isDurationEstimated, "Must have isDurationEstimated");
    assert.strictEqual(paths.isDurationEstimated.defaultValue, false);
    assert(paths.cancellationReason, "Must have cancellationReason");
    assert(paths.cancelledBy, "Must have cancelledBy");
    assert(paths.cancelledAt, "Must have cancelledAt");
    assert(paths.migrationBatchId, "Must have migrationBatchId");
});

// 5. Appointment Schema Indexes
runTest("Appointment schema preserves existing index and adds Phase 1 indexes", () => {
    const Appointment = require("../src/models/appointment.model");
    const indexes = Appointment.schema.indexes();

    // Existing partial unique index
    const hasLegacyIndex = indexes.some(([keys, opts]) =>
        keys.doctor === 1 && keys.date === 1 && keys.time === 1 && opts.unique === true
    );
    assert(hasLegacyIndex, "Legacy unique index { doctor: 1, date: 1, time: 1 } must be preserved");

    // Interval index
    const hasIntervalIndex = indexes.some(([keys, opts]) =>
        keys.doctor === 1 && keys.startDateTime === 1 && keys.endDateTime === 1 &&
        opts.partialFilterExpression && opts.partialFilterExpression.startDateTime
    );
    assert(hasIntervalIndex, "Interval index { doctor: 1, startDateTime: 1, endDateTime: 1 } must be declared");

    // Sparse roomBooking index
    const hasRoomBookingIndex = indexes.some(([keys, opts]) =>
        keys.roomBooking === 1 && opts.sparse === true
    );
    assert(hasRoomBookingIndex, "Sparse index { roomBooking: 1 } must be declared");
});

// 6. DoctorOrganization Affiliation Schema
runTest("DoctorOrganization declares partial unique index for active affiliations", () => {
    const DoctorOrganization = require("../src/models/doctorOrganization.model");
    const indexes = DoctorOrganization.schema.indexes();
    const hasUniqueActive = indexes.some(([keys, opts]) =>
        keys.doctor === 1 && keys.organization === 1 && opts.unique === true &&
        opts.partialFilterExpression && opts.partialFilterExpression.status
    );
    assert(hasUniqueActive, "DoctorOrganization must have unique partial index on { doctor: 1, organization: 1 }");
});

// 7. RoomSlot Queue Schema
runTest("RoomSlot declares queueGeneration and queueSequenceCounter", () => {
    const RoomSlot = require("../src/models/roomSlot.model");
    const paths = RoomSlot.schema.paths;
    assert(paths.queueGeneration, "Must have queueGeneration");
    assert.strictEqual(paths.queueGeneration.defaultValue, 0);
    assert(paths.queueSequenceCounter, "Must have queueSequenceCounter");
    assert.strictEqual(paths.queueSequenceCounter.defaultValue, 0);

    const indexes = RoomSlot.schema.indexes();
    const hasIntervalUnique = indexes.some(([keys, opts]) =>
        keys.room === 1 && keys.startDateTime === 1 && keys.endDateTime === 1 && opts.unique === true
    );
    assert(hasIntervalUnique, "RoomSlot must have unique index on { room: 1, startDateTime: 1, endDateTime: 1 }");
});

// 8. RoomBookingRequest Idempotency & Generation Indexes
runTest("RoomBookingRequest declares correct partial unique indexes for pending and clientRequestId", () => {
    const RoomBookingRequest = require("../src/models/roomBookingRequest.model");
    const indexes = RoomBookingRequest.schema.indexes();

    // Generation pending uniqueness
    const hasGenUnique = indexes.some(([keys, opts]) =>
        keys.roomSlot === 1 && keys.doctor === 1 && keys.queueGeneration === 1 &&
        opts.unique === true && opts.partialFilterExpression && opts.partialFilterExpression.status === "PENDING"
    );
    assert(hasGenUnique, "Must have unique index on { roomSlot: 1, doctor: 1, queueGeneration: 1 } for PENDING");

    // Scoped clientRequestId partial unique index
    const hasIdempotencyIndex = indexes.some(([keys, opts]) =>
        keys.doctor === 1 && keys.clientRequestId === 1 && opts.unique === true &&
        opts.partialFilterExpression && opts.partialFilterExpression.clientRequestId
    );
    assert(hasIdempotencyIndex, "Must have scoped partial unique index on { doctor: 1, clientRequestId: 1 }");

    // Sequence index
    const hasSequenceIndex = indexes.some(([keys]) =>
        keys.roomSlot === 1 && keys.queueGeneration === 1 && keys.sequenceNumber === 1
    );
    assert(hasSequenceIndex, "Must have FIFO index on { roomSlot: 1, queueGeneration: 1, sequenceNumber: 1 }");
});

// 9. OutboxNotification expireAt TTL Index
runTest("OutboxNotification declares expireAt with single-field TTL index", () => {
    const OutboxNotification = require("../src/models/outboxNotification.model");
    const paths = OutboxNotification.schema.paths;
    assert(paths.expireAt, "Must have expireAt path");
    assert.strictEqual(paths.expireAt.defaultValue, null);

    const indexes = OutboxNotification.schema.indexes();
    const hasTtlIndex = indexes.some(([keys, opts]) =>
        keys.expireAt === 1 && opts.expireAfterSeconds === 0
    );
    assert(hasTtlIndex, "Must have standard single-field TTL index on { expireAt: 1 } with expireAfterSeconds: 0");
});

console.log(`\nModels & Schema Test Results: ${passed}/${total} passed.\n`);
if (passed !== total) process.exit(1);
