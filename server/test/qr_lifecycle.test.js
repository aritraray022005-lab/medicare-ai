/**
 * QR check-in availability + automatic appointment finalisation - integration tests
 *
 * Runs against a REAL MongoDB in a throw-away database (dropped at the end).
 * Safety: only runs against a localhost URI. Set TEST_MONGO_URI, or MONGO_URI
 * pointing to localhost. Otherwise the file is skipped (exit 0).
 *
 * All "current time" values are injected, so every scenario is deterministic and
 * independent of the machine clock / timezone.
 */
process.env.DISABLE_APPOINTMENT_CRON = "1";
require("dotenv").config();
process.env.JWT_TOKEN_SECRET = process.env.JWT_TOKEN_SECRET || "test-secret";

const assert = require("assert");
const mongoose = require("mongoose");

const uri = process.env.TEST_MONGO_URI || process.env.MONGO_URI || "";
if (!/mongodb:\/\/(127\.0\.0\.1|localhost)/.test(uri)) {
    console.log("=== QR lifecycle tests SKIPPED: no localhost TEST_MONGO_URI / MONGO_URI (never run against remote DBs) ===");
    process.exit(0);
}

const Appointment = require("../src/models/appointment.model");
// Registered so ticket generation can populate them (the running server loads all models).
require("../src/models/patient.model");
require("../src/models/doctor.model");
require("../src/models/organization.model");
require("../src/models/room.model");
const checkinController = require("../src/controller/checkin.controller");
const checkinService = require("../src/services/checkin.service");
const { runAppointmentLifecycleSweep } = require("../src/jobs/appointmentCron");
const { deriveToken, hashToken, generateNonce } = require("../src/util/qrToken.util");
const { toPatientAppointmentView } = require("../src/util/appointmentView.util");
const lifecycle = require("../src/util/appointmentLifecycle.util");
const { DateTime } = require("luxon");

let passed = 0, total = 0;
async function test(name, fn) {
    total++;
    try {
        await fn();
        passed++;
        console.log(`  [PASS] ${name}`);
    } catch (e) {
        console.error(`  [FAIL] ${name}: ${e.message}`);
    }
}

function mockRes() {
    return {
        statusCode: 200, data: null, headers: {},
        status(c) { this.statusCode = c; return this; },
        json(p) { this.data = p; return this; },
        set(k, v) { this.headers[k] = v; return this; }
    };
}

const oid = () => new mongoose.Types.ObjectId();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const utc = (iso) => new Date(iso);

(async () => {
    const dbName = `medcare_qrlifecycle_test_${Date.now()}`;
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 3000 }).catch((e) => {
        console.log("=== QR lifecycle tests SKIPPED: cannot connect to MongoDB:", e.message, "===");
        process.exit(0);
    });
    console.log(`=== QR lifecycle tests (db=${dbName}) ===`);
    await Appointment.init();
    const col = (n) => mongoose.connection.db.collection(n);

    // ---------- fixtures ----------
    const orgKol = oid(), orgNY = oid(), orgAkl = oid(), orgNoTz = oid(), orgOther = oid();
    const roomId = oid(), patientId = oid(), doctorId = oid();
    const orgBase = { isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false };
    await col("organizations").insertMany([
        { _id: orgKol, name: "Kolkata Hospital", email: "k@org.test", registrationNumber: "R-K", phone: "1111111111", timezone: "Asia/Kolkata", ...orgBase },
        { _id: orgNY, name: "NY Hospital", email: "n@org.test", registrationNumber: "R-N", phone: "2222222222", timezone: "America/New_York", ...orgBase },
        { _id: orgAkl, name: "Auckland Hospital", email: "a@org.test", registrationNumber: "R-A", phone: "3333333333", timezone: "Pacific/Auckland", ...orgBase },
        { _id: orgNoTz, name: "No TZ Hospital", email: "z@org.test", registrationNumber: "R-Z", phone: "4444444444", ...orgBase },
        { _id: orgOther, name: "Other Hospital", email: "o@org.test", registrationNumber: "R-O", phone: "5555555555", timezone: "Asia/Kolkata", ...orgBase }
    ]);
    await col("doctors").insertOne({ _id: doctorId, name: "Dr. Rao", email: "rao@test.com", specialization: "Cardiology", isEmailVerified: true, isBlocked: false });
    await col("patients").insertOne({ _id: patientId, name: "Pat Patient", email: "pat@test.com" });
    await col("rooms").insertOne({ _id: roomId, organization: orgKol, roomNumber: "R-204", floor: "2nd Floor", department: "Cardio", isOperational: true });

    let counter = 0;
    /**
     * Creates a hospital appointment. `timezone` undefined => "Asia/Kolkata";
     * pass null to simulate a record without a stored timezone.
     */
    async function mkAppt(o = {}) {
        counter++;
        const start = o.start, end = o.end;
        const _id = oid();
        const nonce = generateNonce();
        const token = deriveToken(_id, nonce);
        const tz = o.timezone === undefined ? "Asia/Kolkata" : o.timezone;
        const doc = await Appointment.create({
            _id,
            patient: o.patient || patientId,
            doctor: o.doctor || oid(),
            date: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())),
            time: String(counter % 24).padStart(2, "0") + ":" + String(Math.floor(counter / 24) % 60).padStart(2, "0"),
            status: o.status || "Confirmed",
            bookingType: o.bookingType || "Organization",
            organization: o.organization === undefined ? orgKol : o.organization,
            room: roomId,
            startDateTime: start,
            endDateTime: end,
            timezone: tz,
            ...(o.noQr ? {} : { qrNonce: nonce, qrTokenHash: hashToken(token), qrIssuedAt: new Date(), qrExpiresAt: end }),
            checkedInAt: o.checkedInAt || null,
            noShowAt: o.noShowAt || null
        });
        return { id: doc._id, token, nonce, doctor: doc.doctor };
    }
    const statusOf = async (id) => (await Appointment.findById(id)).status;
    const getQr = async (a, now, patient = patientId) => {
        try { return { ok: await checkinService.getPatientQr({ patientId: patient, appointmentId: a.id, now }) }; }
        catch (e) { return { err: e }; }
    };
    const scan = async (a, now, org = orgKol, token = a.token) => {
        try { return { ok: await checkinService.checkInByToken({ organizationId: org, token, now }) }; }
        catch (e) { return { err: e }; }
    };
    const expectErr = (r, status, code) => {
        assert(r.err, "expected an error but call succeeded");
        assert.strictEqual(r.err.statusCode, status, `status ${r.err.statusCode} / ${r.err.code}`);
        assert.strictEqual(r.err.code, code);
    };

    // 20 Nov 2026, 20:00-20:30 IST  == 14:30-15:00 UTC
    const S = utc("2026-11-20T14:30:00.000Z");
    const E = utc("2026-11-20T15:00:00.000Z");

    // =====================================================================
    // PURE UNIT: lifecycle constants / helpers
    // =====================================================================
    await test("constants: Missed added, legacy No-Show kept, no grace helper left", async () => {
        assert.strictEqual(lifecycle.APPOINTMENT_STATUS.MISSED, "Missed");
        assert.strictEqual(lifecycle.APPOINTMENT_STATUS.NO_SHOW, "No-Show");
        assert(lifecycle.ALL_APPOINTMENT_STATUSES.includes("Missed") && lifecycle.ALL_APPOINTMENT_STATUSES.includes("No-Show"));
        assert.strictEqual(lifecycle.getCompletionGraceMinutes, undefined);
        assert.strictEqual(lifecycle.getFinalisationInstant, undefined);
    });

    await test("model: Missed and legacy No-Show are valid statuses; unknown is rejected; missedAt + noShowAt exist", async () => {
        const base = { patient: oid(), doctor: oid(), date: new Date(), time: "10:00" };
        assert.strictEqual(new Appointment({ ...base, status: "Missed" }).validateSync(), undefined);
        assert.strictEqual(new Appointment({ ...base, status: "No-Show" }).validateSync(), undefined);
        assert(new Appointment({ ...base, status: "Bogus" }).validateSync());
        assert(Appointment.schema.path("missedAt") && Appointment.schema.path("noShowAt"));
    });

    await test("timezone fallback: missing / invalid timezone resolves to Asia/Kolkata", async () => {
        assert.strictEqual(lifecycle.resolveTimezone(null), "Asia/Kolkata");
        assert.strictEqual(lifecycle.resolveTimezone(undefined), "Asia/Kolkata");
        assert.strictEqual(lifecycle.resolveTimezone("Mars/Olympus"), "Asia/Kolkata");
        assert.strictEqual(lifecycle.resolveTimezone("America/New_York"), "America/New_York");
    });

    // =====================================================================
    // QR AVAILABILITY (backend)
    // =====================================================================
    await test("QR becomes available immediately on the appointment date (09:00 IST for a 20:00 slot)", async () => {
        const a = await mkAppt({ start: S, end: E });
        const r = await getQr(a, utc("2026-11-20T03:30:00.000Z")); // 09:00 IST
        assert(r.ok, r.err && r.err.message);
        assert(r.ok.qrCodeDataUrl.startsWith("data:image/png;base64,"));
        assert.strictEqual(new Date(r.ok.expiresAt).getTime(), E.getTime(), "expiry must be the actual slot end");
        assert.deepStrictEqual(Object.keys(r.ok).sort(), ["expiresAt", "qrCodeDataUrl"]);
    });

    await test("QR is NOT available for a future date (service level), then available on the date without re-confirmation", async () => {
        const a = await mkAppt({ start: S, end: E });
        const dayBefore = utc("2026-11-19T10:00:00.000Z"); // 15:30 IST on the 19th
        expectErr(await getQr(a, dayBefore), 409, "QR_NOT_AVAILABLE_YET");
        const sevenDays = utc("2026-11-13T10:00:00.000Z");
        expectErr(await getQr(a, sevenDays), 409, "QR_NOT_AVAILABLE_YET");
        // the same stored appointment, nothing re-confirmed
        assert.strictEqual(await statusOf(a.id), "Confirmed");
        const onDay = await getQr(a, utc("2026-11-19T18:30:00.000Z")); // 00:00 IST on the 20th
        assert(onDay.ok, onDay.err && onDay.err.message);
    });

    await test("DIRECT API (controller): future-date QR retrieval is rejected and leaks nothing", async () => {
        const start = new Date(Date.now() + 26 * HOUR); // always a later local calendar date
        const a = await mkAppt({ start, end: new Date(start.getTime() + 30 * MIN) });
        const res = mockRes();
        await checkinController.getAppointmentQr({ userDetails: { _id: patientId }, params: { appointmentId: String(a.id) } }, res);
        assert.strictEqual(res.statusCode, 409);
        assert.strictEqual(res.data.code, "QR_NOT_AVAILABLE_YET");
        assert(!res.data.qrCodeDataUrl && !res.data.expiresAt);
    });

    await test("DIRECT API (controller): today's appointment returns the QR; response has no nonce/hash/room", async () => {
        const start = new Date(); // today by definition
        const a = await mkAppt({ start, end: new Date(start.getTime() + 30 * MIN) });
        const res = mockRes();
        await checkinController.getAppointmentQr({ userDetails: { _id: patientId }, params: { appointmentId: String(a.id) } }, res);
        assert.strictEqual(res.statusCode, 200, JSON.stringify(res.data));
        const stored = await Appointment.findById(a.id).select("+qrNonce +qrTokenHash");
        const body = JSON.stringify(res.data);
        assert(!body.includes(stored.qrNonce) && !body.includes(stored.qrTokenHash));
        assert(!/R-204|2nd Floor|roomSlot|roomBooking|"room"/.test(body));
        assert.strictEqual(res.headers["Cache-Control"], "no-store");
    });

    await test("QR retrieval is rejected once the actual slot END has passed (exactly at END, no grace)", async () => {
        const a = await mkAppt({ start: S, end: E });
        const justBefore = await getQr(a, new Date(E.getTime() - 1));
        assert(justBefore.ok, "must still be available 1ms before END");
        expectErr(await getQr(a, E), 410, "QR_EXPIRED");
        expectErr(await getQr(a, new Date(E.getTime() + 29 * MIN)), 410, "QR_EXPIRED"); // no 30-minute tail
        expectErr(await getQr(a, new Date(E.getTime() + 61 * MIN)), 410, "QR_EXPIRED"); // no 60-minute tail
    });

    await test("QR rules: only Confirmed organization appointments; owner only", async () => {
        const dayNow = utc("2026-11-20T04:30:00.000Z");
        const pend = await mkAppt({ start: S, end: E, status: "Pending" });
        expectErr(await getQr(pend, dayNow), 409, "QR_NOT_AVAILABLE");
        const indep = await mkAppt({ start: S, end: E, bookingType: "Independent", organization: null });
        expectErr(await getQr(indep, dayNow), 400, "QR_NOT_APPLICABLE");
        const mine = await mkAppt({ start: S, end: E });
        expectErr(await getQr(mine, dayNow, oid()), 404, "NOT_FOUND");
    });

    await test("lazy QR issuance for legacy appointments: issued on the date, stable, never issued for a future date", async () => {
        const a = await mkAppt({ start: S, end: E, noQr: true });
        expectErr(await getQr(a, utc("2026-11-18T10:00:00.000Z")), 409, "QR_NOT_AVAILABLE_YET");
        let raw = await Appointment.findById(a.id).select("+qrNonce +qrTokenHash");
        assert(!raw.qrNonce && !raw.qrTokenHash, "future-date request must not issue a QR");

        const first = await getQr(a, utc("2026-11-20T04:00:00.000Z"));
        assert(first.ok, first.err && first.err.message);
        raw = await Appointment.findById(a.id).select("+qrNonce +qrTokenHash");
        assert(raw.qrNonce && raw.qrTokenHash);
        assert.strictEqual(raw.qrTokenHash, hashToken(deriveToken(a.id, raw.qrNonce)), "hash = SHA-256(HMAC token)");
        const second = await getQr(a, utc("2026-11-20T05:00:00.000Z"));
        assert.strictEqual(second.ok.qrCodeDataUrl, first.ok.qrCodeDataUrl, "re-opening shows the same QR");
        // raw token is never persisted
        assert(!JSON.stringify(await col("appointments").findOne({ _id: a.id })).includes(deriveToken(a.id, raw.qrNonce)));
    });

    // =====================================================================
    // PATIENT-FACING VIEW (qr.available mirrors the backend rule)
    // =====================================================================
    await test("patient view: qr.available only on the appointment date, until END; no internals exposed", async () => {
        const a = await mkAppt({ start: S, end: E });
        const doc = await Appointment.findById(a.id).populate("organization", "name phone address timezone").lean();
        const at = (iso) => toPatientAppointmentView(doc, utc(iso));
        assert.strictEqual(at("2026-11-19T10:00:00.000Z").qr.available, false);          // day before
        assert.strictEqual(at("2026-11-19T10:00:00.000Z").qr.expiresAt, null);
        assert.strictEqual(at("2026-11-19T18:29:59.999Z").qr.available, false);          // 23:59:59 IST on the 19th
        assert.strictEqual(at("2026-11-19T18:30:00.000Z").qr.available, true);           // 00:00 IST on the 20th
        assert.strictEqual(at("2026-11-20T03:30:00.000Z").qr.available, true);           // 09:00 IST, before the 20:00 start
        assert.strictEqual(at("2026-11-20T14:59:59.999Z").qr.available, true);           // 1 ms before END
        assert.strictEqual(at("2026-11-20T15:00:00.000Z").qr.available, false);          // END
        const v = at("2026-11-20T03:30:00.000Z");
        assert.strictEqual(new Date(v.qr.expiresAt).getTime(), E.getTime());
        const s = JSON.stringify(v);
        assert(!/qrNonce|qrTokenHash|"room"|roomSlot|roomBooking|R-204|2nd Floor/.test(s), "internal data leaked: " + s);
        // other states
        for (const status of ["Pending", "Checked-In", "In Progress", "Completed", "Cancelled", "Expired", "Missed", "No-Show"]) {
            const d = { ...doc, status };
            assert.strictEqual(toPatientAppointmentView(d, utc("2026-11-20T03:30:00.000Z")).qr.available, false, status);
        }
    });

    await test("patient view works with an un-populated organization (uses the appointment timezone)", async () => {
        const a = await mkAppt({ start: S, end: E });
        const doc = await Appointment.findById(a.id).lean();
        assert.strictEqual(toPatientAppointmentView(doc, utc("2026-11-20T03:30:00.000Z")).qr.available, true);
        assert.strictEqual(toPatientAppointmentView(doc, utc("2026-11-19T03:30:00.000Z")).qr.available, false);
    });

    // =====================================================================
    // SCANNING
    // =====================================================================
    await test("scan: allowed BEFORE the scheduled start on the appointment day (10:00 IST for a 20:00 slot)", async () => {
        const a = await mkAppt({ start: S, end: E, doctor: doctorId });
        const r = await scan(a, utc("2026-11-20T04:30:00.000Z")); // 10:00 IST
        assert(r.ok, r.err && r.err.message);
        assert.strictEqual(r.ok.appointment.status, "Checked-In");
        assert.strictEqual(r.ok.appointment.queueNumber, 1);
        assert.strictEqual(r.ok.ticket.roomNumber, "R-204");       // staff ticket keeps room info
        assert.strictEqual(r.ok.ticket.floor, "2nd Floor");
        assert.strictEqual(r.ok.ticket.queueLabel, "Q-001");
        assert.strictEqual(r.ok.ticket.appointmentDate, "20 Nov 2026");
        assert.strictEqual(r.ok.ticket.appointmentTime, "20:00 - 20:30");
        assert.strictEqual(await statusOf(a.id), "Checked-In");
    });

    await test("scan: allowed at 00:00:00 IST on the day, rejected 1 ms earlier (local-midnight boundary)", async () => {
        const a = await mkAppt({ start: S, end: E });
        const early = await scan(a, utc("2026-11-19T18:29:59.999Z"));
        expectErr(early, 409, "CHECKIN_NOT_OPEN");
        assert.strictEqual(await statusOf(a.id), "Confirmed");
        const ok = await scan(a, utc("2026-11-19T18:30:00.000Z"));
        assert(ok.ok, ok.err && ok.err.message);
    });

    await test("scan: rejected on a FUTURE local calendar day", async () => {
        const a = await mkAppt({ start: S, end: E });
        expectErr(await scan(a, utc("2026-11-18T09:00:00.000Z")), 409, "CHECKIN_NOT_OPEN");
        assert.strictEqual(await statusOf(a.id), "Confirmed");
    });

    await test("scan: rejected on the WRONG local day even though the slot has not ended (overnight slot)", async () => {
        // 23:00 IST on the 19th -> 00:30 IST on the 20th
        const start = utc("2026-11-19T17:30:00.000Z"), end = utc("2026-11-19T19:00:00.000Z");
        const a = await mkAppt({ start, end });
        const lateNow = utc("2026-11-19T18:45:00.000Z"); // 00:15 IST on the 20th: slot still running, local date has rolled over
        const r = await scan(a, lateNow);
        expectErr(r, 410, "QR_EXPIRED");
        expectErr(await getQr(a, lateNow), 409, "QR_NOT_AVAILABLE");
        assert.strictEqual(await statusOf(a.id), "Confirmed");
        // while it is still the 19th locally the same QR works
        const ok = await scan(a, utc("2026-11-19T17:45:00.000Z"));
        assert(ok.ok, ok.err && ok.err.message);
    });

    await test("scan: rejected exactly at slot END and after (no 30/60-minute tail, qrExpiresAt cannot extend it)", async () => {
        const a = await mkAppt({ start: S, end: E });
        await Appointment.updateOne({ _id: a.id }, { $set: { qrExpiresAt: new Date(E.getTime() + 24 * HOUR) } }); // stale/long expiry
        expectErr(await scan(a, E), 410, "QR_EXPIRED");
        expectErr(await scan(a, new Date(E.getTime() + 29 * MIN)), 410, "QR_EXPIRED");
        expectErr(await scan(a, new Date(E.getTime() + 61 * MIN)), 410, "QR_EXPIRED");
        assert.strictEqual(await statusOf(a.id), "Confirmed");
        const lastMs = await scan(a, new Date(E.getTime() - 1));
        assert(lastMs.ok, lastMs.err && lastMs.err.message);
    });

    await test("scan: wrong hospital, duplicate and invalid tokens still behave as before", async () => {
        const a = await mkAppt({ start: S, end: E });
        const now = utc("2026-11-20T05:00:00.000Z");
        expectErr(await scan(a, now, orgOther), 403, "WRONG_HOSPITAL");
        assert.strictEqual(await statusOf(a.id), "Confirmed");
        assert((await scan(a, now)).ok);
        expectErr(await scan(a, now), 409, "ALREADY_CHECKED_IN");
        expectErr(await scan(a, now, orgKol, "garbage"), 400, "INVALID_QR");
        expectErr(await scan(a, now, orgKol, deriveToken(oid(), generateNonce())), 404, "INVALID_QR");
    });

    await test("scan: 12 concurrent scans of one QR -> exactly one check-in (atomic one-time scan)", async () => {
        const a = await mkAppt({ start: S, end: E });
        const now = utc("2026-11-20T05:00:00.000Z");
        const results = await Promise.all(Array.from({ length: 12 }, () => scan(a, now)));
        assert.strictEqual(results.filter((r) => r.ok).length, 1);
        assert(results.filter((r) => r.err).every((r) => r.err.code === "ALREADY_CHECKED_IN"));
    });

    // =====================================================================
    // FACILITY TIMEZONE EDGE CASES
    // =====================================================================
    await test("timezone: America/New_York - 23:30 local on 1 Nov is still 'today' although UTC date is already 2 Nov", async () => {
        const start = utc("2026-11-02T04:30:00.000Z"), end = utc("2026-11-02T05:00:00.000Z"); // 23:30-00:00 EST (1 Nov)
        const a = await mkAppt({ start, end, timezone: "America/New_York", organization: orgNY });
        const r = await getQr(a, utc("2026-11-02T03:00:00.000Z")); // 22:00 EST on 1 Nov (UTC date = 2 Nov)
        assert(r.ok, r.err && r.err.message);
        // 17:00 EST on 31 Oct (fall-back day is 1 Nov) -> still a future local date
        expectErr(await getQr(a, utc("2026-10-31T21:00:00.000Z")), 409, "QR_NOT_AVAILABLE_YET");
        // the scan agrees with the QR rule
        assert((await scan(a, utc("2026-11-02T03:00:00.000Z"), orgNY)).ok);
    });

    await test("timezone: Pacific/Auckland (UTC+13) - local date is ahead of UTC", async () => {
        // 20 Nov 08:00-08:30 NZDT == 19 Nov 19:00-19:30 UTC
        const start = utc("2026-11-19T19:00:00.000Z"), end = utc("2026-11-19T19:30:00.000Z");
        const a = await mkAppt({ start, end, timezone: "Pacific/Auckland", organization: orgAkl });
        // 07:00 NZDT on the 20th == 18:00 UTC on the 19th -> available (before start)
        assert((await getQr(a, utc("2026-11-19T18:00:00.000Z"))).ok);
        // 23:59 NZDT on the 19th == 10:59 UTC on the 19th -> future local date
        expectErr(await getQr(a, utc("2026-11-19T10:59:00.000Z")), 409, "QR_NOT_AVAILABLE_YET");
        expectErr(await scan(a, utc("2026-11-19T10:59:00.000Z"), orgAkl), 409, "CHECKIN_NOT_OPEN");
    });

    await test("timezone: missing appointment timezone falls back to the organization's configured timezone", async () => {
        const start = utc("2026-11-02T04:30:00.000Z"), end = utc("2026-11-02T05:00:00.000Z");
        const a = await mkAppt({ start, end, timezone: null, organization: orgNY });
        assert((await getQr(a, utc("2026-11-02T03:00:00.000Z"))).ok);                 // NY local = 1 Nov = appointment day
        expectErr(await getQr(a, utc("2026-10-31T21:00:00.000Z")), 409, "QR_NOT_AVAILABLE_YET");
    });

    await test("timezone: missing / invalid everywhere falls back to Asia/Kolkata", async () => {
        const a = await mkAppt({ start: S, end: E, timezone: null, organization: orgNoTz });
        assert((await getQr(a, utc("2026-11-19T18:30:00.000Z"))).ok);                 // 00:00 IST on the 20th
        expectErr(await getQr(a, utc("2026-11-19T18:29:00.000Z")), 409, "QR_NOT_AVAILABLE_YET");
        const b = await mkAppt({ start: S, end: E, timezone: "Mars/Olympus" });
        assert((await getQr(b, utc("2026-11-19T18:30:00.000Z"))).ok);
        expectErr(await getQr(b, utc("2026-11-19T18:29:00.000Z")), 409, "QR_NOT_AVAILABLE_YET");
    });

    await test("timezone: decision never depends on the server's local timezone", async () => {
        const original = process.env.TZ;
        try {
            for (const tz of ["UTC", "Pacific/Kiritimati", "America/Los_Angeles"]) {
                process.env.TZ = tz;
                const a = await mkAppt({ start: S, end: E });
                assert.strictEqual((await getQr(a, utc("2026-11-19T18:29:59.999Z"))).err.code, "QR_NOT_AVAILABLE_YET", tz);
                assert((await getQr(a, utc("2026-11-19T18:30:00.000Z"))).ok, tz);
            }
        } finally {
            if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
        }
    });

    // =====================================================================
    // AUTOMATIC FINALISATION (cron sweep)
    // =====================================================================
    await test("ACCEPTANCE 1: confirmed 09:00 -> QR -> scan 10:00 -> consultation -> auto Completed exactly at 20:30", async () => {
        const a = await mkAppt({ start: S, end: E, doctor: doctorId });
        assert((await getQr(a, utc("2026-11-20T03:30:00.000Z"))).ok, "QR visible at 09:00");
        const sc = await scan(a, utc("2026-11-20T04:30:00.000Z"));                    // 10:00 IST
        assert(sc.ok && sc.ok.appointment.status === "Checked-In");
        const started = await checkinService.startConsultation({ doctorId, appointmentId: a.id, now: utc("2026-11-20T05:00:00.000Z") });
        assert.strictEqual(started.status, "In Progress");

        await runAppointmentLifecycleSweep(new Date(E.getTime() - 1));                // 20:29:59.999
        assert.strictEqual(await statusOf(a.id), "In Progress");
        const s = await runAppointmentLifecycleSweep(E);                              // 20:30:00.000
        assert.strictEqual(s.completed >= 1, true);
        const final = await Appointment.findById(a.id);
        assert.strictEqual(final.status, "Completed");
        assert.strictEqual(final.completedBy, "System");
        assert.strictEqual(final.completedAt.getTime(), E.getTime());
        // QR / scan are dead afterwards
        expectErr(await getQr(a, new Date(E.getTime() + MIN)), 409, "QR_NOT_AVAILABLE");
    });

    await test("ACCEPTANCE 2: patient never arrives -> QR available all day, no scan, auto Missed at 20:30", async () => {
        const a = await mkAppt({ start: S, end: E });
        assert((await getQr(a, utc("2026-11-20T03:30:00.000Z"))).ok);
        assert((await getQr(a, new Date(E.getTime() - 1))).ok);
        await runAppointmentLifecycleSweep(new Date(E.getTime() - 1));
        assert.strictEqual(await statusOf(a.id), "Confirmed");
        await runAppointmentLifecycleSweep(E);
        const d = await Appointment.findById(a.id);
        assert.strictEqual(d.status, "Missed");
        assert.strictEqual(d.missedAt.getTime(), E.getTime());
        assert.strictEqual(d.noShowAt, null, "legacy field is not written for new records");
        assert.strictEqual(d.completedAt, null);
        // QR retrieval + scan are rejected with the Missed message
        const q = await getQr(a, new Date(E.getTime() + MIN));
        expectErr(q, 409, "QR_NOT_AVAILABLE");
        assert(/missed/i.test(q.err.message));
        expectErr(await scan(a, new Date(E.getTime() + MIN)), 410, "QR_EXPIRED");
        assert.strictEqual(await statusOf(a.id), "Missed");
    });

    await test("ACCEPTANCE 3: tomorrow's appointment - hidden today, direct call rejected, appears on the date", async () => {
        const a = await mkAppt({ start: S, end: E });
        const todayNow = utc("2026-11-19T06:00:00.000Z");
        expectErr(await getQr(a, todayNow), 409, "QR_NOT_AVAILABLE_YET");
        const doc = await Appointment.findById(a.id).lean();
        assert.strictEqual(toPatientAppointmentView(doc, todayNow).qr.available, false);
        assert.strictEqual(toPatientAppointmentView(doc, utc("2026-11-20T06:00:00.000Z")).qr.available, true);
        assert((await getQr(a, utc("2026-11-20T06:00:00.000Z"))).ok);
    });

    await test("ACCEPTANCE 4: after END QR retrieval and scan are rejected; terminal statuses stay unchanged", async () => {
        const after = new Date(E.getTime() + 5 * MIN);
        for (const status of ["Completed", "Cancelled", "Expired", "Missed", "No-Show"]) {
            const a = await mkAppt({ start: S, end: E, status });
            const before = await Appointment.findById(a.id).lean();
            await getQr(a, after); await scan(a, after);
            await runAppointmentLifecycleSweep(after);
            const now = await Appointment.findById(a.id).lean();
            assert.strictEqual(now.status, status);
            assert.strictEqual(String(now.updatedAt), String(before.updatedAt), `${status} document must not be touched`);
        }
    });

    await test("no grace period: Completed/Missed at END, not END+1h; still pending 1 ms earlier", async () => {
        await Appointment.deleteMany({});
        const checked = await mkAppt({ start: S, end: E, status: "Checked-In", checkedInAt: new Date(S) });
        const inprog = await mkAppt({ start: S, end: E, status: "In Progress", checkedInAt: new Date(S) });
        const unattended = await mkAppt({ start: S, end: E });
        const before = await runAppointmentLifecycleSweep(new Date(E.getTime() - 1));
        assert.deepStrictEqual(before, { expired: 0, completed: 0, missed: 0, legacyExpired: 0 });
        const at = await runAppointmentLifecycleSweep(E);
        assert.deepStrictEqual(at, { expired: 0, completed: 2, missed: 1, legacyExpired: 0 });
        assert.strictEqual(await statusOf(checked.id), "Completed");
        assert.strictEqual(await statusOf(inprog.id), "Completed");
        assert.strictEqual(await statusOf(unattended.id), "Missed");
    });

    await test("APPOINTMENT_COMPLETION_GRACE_MINUTES is ignored (no configurable grace)", async () => {
        process.env.APPOINTMENT_COMPLETION_GRACE_MINUTES = "120";
        try {
            await Appointment.deleteMany({});
            const a = await mkAppt({ start: S, end: E, status: "Checked-In", checkedInAt: new Date(S) });
            await runAppointmentLifecycleSweep(E);
            assert.strictEqual(await statusOf(a.id), "Completed");
        } finally {
            delete process.env.APPOINTMENT_COMPLETION_GRACE_MINUTES;
        }
    });

    await test("cron: Cancelled is never overwritten; unconfirmed Pending only Expires; Independent Confirmed untouched", async () => {
        await Appointment.deleteMany({});
        const cancelled = await mkAppt({ start: S, end: E, status: "Cancelled" });
        const pending = await mkAppt({ start: S, end: E, status: "Pending" });
        const indep = await mkAppt({ start: S, end: E, status: "Confirmed", bookingType: "Independent", organization: null });
        await runAppointmentLifecycleSweep(new Date(E.getTime() + 10 * 24 * HOUR));
        assert.strictEqual(await statusOf(cancelled.id), "Cancelled");
        assert.strictEqual(await statusOf(pending.id), "Expired");
        assert.strictEqual(await statusOf(indep.id), "Confirmed");
    });

    await test("cron: legacy No-Show records are preserved (never re-written to Missed, noShowAt kept)", async () => {
        await Appointment.deleteMany({});
        const noShowAt = utc("2026-11-10T12:00:00.000Z");
        const a = await mkAppt({ start: S, end: E, status: "No-Show", noShowAt });
        const s = await runAppointmentLifecycleSweep(new Date(E.getTime() + 3 * 24 * HOUR));
        assert.deepStrictEqual(s, { expired: 0, completed: 0, missed: 0, legacyExpired: 0 });
        const d = await Appointment.findById(a.id);
        assert.strictEqual(d.status, "No-Show");
        assert.strictEqual(d.noShowAt.getTime(), noShowAt.getTime());
        assert.strictEqual(d.missedAt, null);
        // patient-facing + QR messaging
        const q = await getQr(a, new Date(E.getTime() + HOUR));
        expectErr(q, 409, "QR_NOT_AVAILABLE");
        assert(/missed/i.test(q.err.message));
        expectErr(await scan(a, new Date(E.getTime() + HOUR)), 410, "QR_EXPIRED");
        const view = toPatientAppointmentView(await Appointment.findById(a.id).lean(), new Date(E.getTime() + HOUR));
        assert.strictEqual(view.status, "No-Show");
        assert.strictEqual(view.qr.available, false);
    });

    await test("cron: catch-up after downtime finalises everything that came due, once", async () => {
        await Appointment.deleteMany({});
        const ids = [];
        for (let i = 0; i < 6; i++) {
            const st = new Date(S.getTime() + i * 2 * HOUR), en = new Date(st.getTime() + 30 * MIN);
            ids.push((await mkAppt({ start: st, end: en, status: i % 2 ? "Checked-In" : "Confirmed", checkedInAt: i % 2 ? st : null })).id);
        }
        // server was down for two days
        const first = await runAppointmentLifecycleSweep(new Date(E.getTime() + 48 * HOUR));
        assert.deepStrictEqual(first, { expired: 0, completed: 3, missed: 3, legacyExpired: 0 });
        const second = await runAppointmentLifecycleSweep(new Date(E.getTime() + 49 * HOUR));
        assert.deepStrictEqual(second, { expired: 0, completed: 0, missed: 0, legacyExpired: 0 });
        const statuses = await Promise.all(ids.map(statusOf));
        assert.deepStrictEqual(statuses, ["Missed", "Completed", "Missed", "Completed", "Missed", "Completed"]);
    });

    await test("CRON CONCURRENCY: 8 overlapping sweeps (e.g. several server instances) finalise each row exactly once", async () => {
        await Appointment.deleteMany({});
        const N = 30;
        const checkedIds = [], confirmedIds = [];
        for (let i = 0; i < N; i++) {
            const attended = i % 2 === 0;
            const a = await mkAppt({ start: S, end: E, status: attended ? "In Progress" : "Confirmed", checkedInAt: attended ? new Date(S) : null });
            (attended ? checkedIds : confirmedIds).push(a.id);
        }
        const sums = await Promise.all(Array.from({ length: 8 }, () => runAppointmentLifecycleSweep(E)));
        assert.strictEqual(sums.reduce((n, x) => n + x.completed, 0), checkedIds.length, "each attended row completed once");
        assert.strictEqual(sums.reduce((n, x) => n + x.missed, 0), confirmedIds.length, "each unattended row missed once");
        assert((await Promise.all(checkedIds.map(statusOf))).every((s) => s === "Completed"));
        assert((await Promise.all(confirmedIds.map(statusOf))).every((s) => s === "Missed"));
        const again = await runAppointmentLifecycleSweep(E);
        assert.deepStrictEqual(again, { expired: 0, completed: 0, missed: 0, legacyExpired: 0 });
    });

    await test("RACE: scan vs. sweep around the END boundary never yields an inconsistent final state", async () => {
        await Appointment.deleteMany({});
        const appts = [];
        for (let i = 0; i < 10; i++) appts.push(await mkAppt({ start: S, end: E }));
        await Promise.all(appts.flatMap((a) => [
            scan(a, new Date(E.getTime() - 1)),
            runAppointmentLifecycleSweep(E),
            scan(a, new Date(E.getTime() - 1))
        ]));
        await runAppointmentLifecycleSweep(new Date(E.getTime() + MIN)); // the next minute's run
        let completedCount = 0, missedCount = 0;
        for (const a of appts) {
            const d = await Appointment.findById(a.id);
            if (d.checkedInAt) {
                completedCount++;
                assert.strictEqual(d.status, "Completed", "checked in => Completed");
                assert(d.queueNumber >= 1);
            } else {
                missedCount++;
                assert.strictEqual(d.status, "Missed", "never checked in => Missed");
            }
        }
        console.log(`        (race outcome: ${completedCount} checked-in->Completed, ${missedCount} Missed)`);
    });

    // =====================================================================
    // EXISTING QUEUE / TICKET / ROOM BEHAVIOUR PRESERVED
    // =====================================================================
    await test("queue numbering unchanged: sequential per doctor/local day, restarts for another doctor", async () => {
        await Appointment.deleteMany({});
        await col("queuecounters").deleteMany({});
        const d1 = oid(), d2 = oid();
        const now = utc("2026-11-20T05:00:00.000Z");
        const a1 = await mkAppt({ start: S, end: E, doctor: d1 });
        const a2 = await mkAppt({ start: S, end: E, doctor: d1 });
        const a3 = await mkAppt({ start: S, end: E, doctor: d1 });
        const b1 = await mkAppt({ start: S, end: E, doctor: d2 });
        const nums = [];
        for (const a of [a1, a2, a3, b1]) nums.push((await scan(a, now)).ok.appointment.queueNumber);
        assert.deepStrictEqual(nums, [1, 2, 3, 1]);
        assert.strictEqual((await Appointment.findById(a1.id)).queueDate, "2026-11-20");
    });

    await test("room allocation untouched: sweeps never modify room / roomSlot / roomBooking fields or RoomBooking rows", async () => {
        await Appointment.deleteMany({});
        const bookingId = oid(), slotId = oid();
        await col("roombookings").insertOne({ _id: bookingId, roomSlot: slotId, room: roomId, organization: orgKol, doctor: doctorId, startDateTime: S, endDateTime: E, status: "Active", timezone: "Asia/Kolkata" });
        const a = await mkAppt({ start: S, end: E });
        await Appointment.updateOne({ _id: a.id }, { $set: { roomSlot: slotId, roomBooking: bookingId } });
        const before = await Appointment.findById(a.id).lean();
        await runAppointmentLifecycleSweep(E);
        const after = await Appointment.findById(a.id).lean();
        assert.strictEqual(after.status, "Missed");
        for (const f of ["room", "roomSlot", "roomBooking", "doctor", "organization", "startDateTime", "endDateTime", "timezone", "queueNumber"]) {
            assert.strictEqual(String(after[f]), String(before[f]), f);
        }
        assert.strictEqual((await col("roombookings").findOne({ _id: bookingId })).status, "Active");
    });

    await test("checked-in appointments are listed on the queue board for the local day only", async () => {
        await Appointment.deleteMany({});
        const a = await mkAppt({ start: S, end: E });
        assert((await scan(a, utc("2026-11-20T05:00:00.000Z"))).ok);
        const board = await checkinService.getDailyQueue({ organizationId: orgKol, dateKey: "2026-11-20" });
        assert.strictEqual(board.length, 1);
        assert.strictEqual(board[0].roomNumber, "R-204");
        assert.strictEqual((await checkinService.getDailyQueue({ organizationId: orgKol, dateKey: "2026-11-21" })).length, 0);
        const reprint = await checkinService.getTicketForReprint({ organizationId: orgKol, appointmentId: a.id });
        assert.strictEqual(reprint.queueNumber, 1);
    });

    // keep luxon import exercised (sanity for boundary maths used above)
    await test("sanity: fixture instants map to the documented IST wall-clock times", async () => {
        assert.strictEqual(DateTime.fromJSDate(S, { zone: "Asia/Kolkata" }).toFormat("yyyy-LL-dd HH:mm"), "2026-11-20 20:00");
        assert.strictEqual(DateTime.fromJSDate(E, { zone: "Asia/Kolkata" }).toFormat("yyyy-LL-dd HH:mm"), "2026-11-20 20:30");
    });

    console.log(`QR Lifecycle Test Results: ${passed}/${total} passed.`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    process.exit(passed === total ? 0 : 1);
})().catch(async (e) => { console.error(e); try { await mongoose.connection.dropDatabase(); } catch (_) {} process.exit(1); });
