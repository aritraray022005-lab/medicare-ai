const assert = require("assert");
const { acquireScheduleLocks, LockAcquisitionError } = require("../src/util/lock.util");
const { checkDoctorScheduleConflicts } = require("../src/util/conflict.util");

console.log("=== Running Lock & Conflict Unit Tests (Phase 1) ===");

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

// 1. Lock acquisition requires active session
runTest("acquireScheduleLocks throws if session is missing", async () => {
    await assert.rejects(
        async () => acquireScheduleLocks({ roomId: "60c72b2f9b1d8b2bad123456" }),
        err => err.message.includes("session is required")
    );
});

// 2. Lock acquisition error structure
runTest("LockAcquisitionError preserves target and id metadata", () => {
    const err = new LockAcquisitionError("Room document missing", "Room", "room123");
    assert.strictEqual(err.name, "LockAcquisitionError");
    assert.strictEqual(err.target, "Room");
    assert.strictEqual(err.id, "room123");
    assert.strictEqual(err.status, 404);
});

// 3. Tier 3 Global Envelope Calculation
runTest("Tier 3 date envelope intersects local dates across timezones", () => {
    // Legacy date: Nov 15, 2026 UTC midnight
    const legacyDate = new Date(Date.UTC(2026, 10, 15));
    const y = legacyDate.getUTCFullYear();
    const m = legacyDate.getUTCMonth();
    const d = legacyDate.getUTCDate();

    // Envelope covers UTC+14 (Nov 14 10:00 UTC) to UTC-12 (Nov 16 12:00 UTC)
    const envelopeStart = new Date(Date.UTC(y, m, d) - 14 * 60 * 60 * 1000);
    const envelopeEnd = new Date(Date.UTC(y, m, d) + 36 * 60 * 60 * 1000);

    // Test a slot on Nov 15 in New York: 10:00 AM EDT (14:00 UTC)
    const slotStart = new Date("2026-11-15T14:00:00.000Z");
    const slotEnd = new Date("2026-11-15T14:30:00.000Z");

    const overlaps = slotStart < envelopeEnd && slotEnd > envelopeStart;
    assert.strictEqual(overlaps, true, "Candidate slot on Nov 15 must intersect Nov 15 global envelope");

    // Test a slot on Nov 18 (outside envelope)
    const outsideStart = new Date("2026-11-18T10:00:00.000Z");
    const outsideEnd = new Date("2026-11-18T10:30:00.000Z");
    const overlapsOutside = outsideStart < envelopeEnd && outsideEnd > envelopeStart;
    assert.strictEqual(overlapsOutside, false, "Candidate slot on Nov 18 must not intersect Nov 15 envelope");
});

console.log(`\nLock & Conflict Test Results: ${passed}/${total} passed.\n`);
if (passed !== total) process.exit(1);
