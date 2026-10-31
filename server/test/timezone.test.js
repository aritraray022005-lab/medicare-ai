const assert = require("assert");
const { resolveLocalToUtc, TimezoneError } = require("../src/util/time.util");

console.log("=== Running Timezone & Luxon Unit Tests (Phase 1) ===");

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

// 1. Spring-Forward Gap in New York (2026-03-08 02:30 does not exist)
runTest("Spring-Forward Gap in New York throws NON_EXISTENT_LOCAL_TIME", () => {
    assert.throws(
        () => resolveLocalToUtc({ dateStr: "2026-03-08", timeStr: "02:30", timezone: "America/New_York" }),
        err => err.code === "NON_EXISTENT_LOCAL_TIME"
    );
});

// 2. Fall-Back Ambiguity without client offset
runTest("Fall-Back Ambiguity without client offset throws AMBIGUOUS_LOCAL_TIME", () => {
    assert.throws(
        () => resolveLocalToUtc({ dateStr: "2026-11-01", timeStr: "01:30", timezone: "America/New_York" }),
        err => {
            assert.strictEqual(err.code, "AMBIGUOUS_LOCAL_TIME");
            assert.deepStrictEqual(err.details.possibleOffsets, [-300, -240]);
            return true;
        }
    );
});

// 3. Fall-Back with EDT offset (-240)
runTest("Fall-Back with EDT offset (-240) resolves to 05:30 UTC", () => {
    const res = resolveLocalToUtc({
        dateStr: "2026-11-01",
        timeStr: "01:30",
        timezone: "America/New_York",
        clientOffsetMinutes: -240,
        durationMinutes: 30
    });
    assert.strictEqual(res.canonicalUtcIso, "2026-11-01T05:30:00.000Z");
    assert.strictEqual(res.localOffsetMinutes, -240);
    assert.strictEqual(res.startDateTime.toISOString(), "2026-11-01T05:30:00.000Z");
    assert.strictEqual(res.endDateTime.toISOString(), "2026-11-01T06:00:00.000Z");
});

// 4. Fall-Back with EST offset (-300)
runTest("Fall-Back with EST offset (-300) resolves to 06:30 UTC", () => {
    const res = resolveLocalToUtc({
        dateStr: "2026-11-01",
        timeStr: "01:30",
        timezone: "America/New_York",
        clientOffsetMinutes: -300,
        durationMinutes: 30
    });
    assert.strictEqual(res.canonicalUtcIso, "2026-11-01T06:30:00.000Z");
    assert.strictEqual(res.localOffsetMinutes, -300);
});

// 5. Fall-Back with Invalid Disambiguation Offset (-360)
runTest("Fall-Back with Invalid Disambiguation Offset throws INVALID_DISAMBIGUATION_OFFSET", () => {
    assert.throws(
        () => resolveLocalToUtc({
            dateStr: "2026-11-01",
            timeStr: "01:30",
            timezone: "America/New_York",
            clientOffsetMinutes: -360
        }),
        err => err.code === "INVALID_DISAMBIGUATION_OFFSET"
    );
});

// 6. Fall-Back with Malformed Offset (float)
runTest("Fall-Back with Malformed Offset throws MALFORMED_OFFSET", () => {
    assert.throws(
        () => resolveLocalToUtc({
            dateStr: "2026-11-01",
            timeStr: "01:30",
            timezone: "America/New_York",
            clientOffsetMinutes: -240.5
        }),
        err => err.code === "MALFORMED_OFFSET"
    );
});

// 7. Skipped Calendar Date in Samoa (Pacific/Apia 2011-12-30 never existed)
runTest("Skipped Calendar Date in Samoa throws NON_EXISTENT_LOCAL_TIME", () => {
    assert.throws(
        () => resolveLocalToUtc({ dateStr: "2011-12-30", timeStr: "10:00", timezone: "Pacific/Apia" }),
        err => err.code === "NON_EXISTENT_LOCAL_TIME"
    );
});

// 8. Normal Time in Asia/Kolkata (+05:30)
runTest("Normal Time in Asia/Kolkata resolves to 04:30 UTC", () => {
    const res = resolveLocalToUtc({
        dateStr: "2026-11-15",
        timeStr: "10:00",
        timezone: "Asia/Kolkata",
        durationMinutes: 45
    });
    assert.strictEqual(res.canonicalUtcIso, "2026-11-15T04:30:00.000Z");
    assert.strictEqual(res.localOffsetMinutes, 330);
    assert.strictEqual(res.endDateTime.toISOString(), "2026-11-15T05:15:00.000Z");
});

// 9. Fractional Offset in Asia/Kathmandu (+05:45)
runTest("Fractional Offset in Asia/Kathmandu resolves correctly (+345m)", () => {
    const res = resolveLocalToUtc({
        dateStr: "2026-11-15",
        timeStr: "10:00",
        timezone: "Asia/Kathmandu"
    });
    assert.strictEqual(res.canonicalUtcIso, "2026-11-15T04:15:00.000Z");
    assert.strictEqual(res.localOffsetMinutes, 345);
});

// 10. Invalid Calendar Date (Feb 30)
runTest("Invalid Calendar Date (Feb 30) throws NON_EXISTENT_CALENDAR_DATE", () => {
    assert.throws(
        () => resolveLocalToUtc({ dateStr: "2026-02-30", timeStr: "10:00", timezone: "Asia/Kolkata" }),
        err => err.code === "NON_EXISTENT_CALENDAR_DATE"
    );
});

// 11. Midnight Boundary (00:00)
runTest("Midnight Boundary (00:00) resolves to previous day 18:30 UTC", () => {
    const res = resolveLocalToUtc({
        dateStr: "2026-11-15",
        timeStr: "00:00",
        timezone: "Asia/Kolkata"
    });
    assert.strictEqual(res.canonicalUtcIso, "2026-11-14T18:30:00.000Z");
    assert.strictEqual(res.localOffsetMinutes, 330);
});

// 12. Invalid Duration (< 5 minutes)
runTest("Invalid Duration (< 5 mins) throws INVALID_DURATION", () => {
    assert.throws(
        () => resolveLocalToUtc({ dateStr: "2026-11-15", timeStr: "10:00", timezone: "Asia/Kolkata", durationMinutes: 0 }),
        err => err.code === "INVALID_DURATION"
    );
});

// 13. Invalid Duration (> 480 minutes)
runTest("Invalid Duration (> 480 mins) throws INVALID_DURATION", () => {
    assert.throws(
        () => resolveLocalToUtc({ dateStr: "2026-11-15", timeStr: "10:00", timezone: "Asia/Kolkata", durationMinutes: 500 }),
        err => err.code === "INVALID_DURATION"
    );
});

console.log(`\nTimezone Test Results: ${passed}/${total} passed.\n`);
if (passed !== total) process.exit(1);
