/**
 * Smart Hospital Queue & Patient Flow - integration tests
 *
 * Runs against a REAL MongoDB in a throw-away database (dropped at the end).
 * Safety: only runs against a localhost URI. Set TEST_MONGO_URI, or MONGO_URI
 * pointing to localhost. Otherwise the file is skipped (exit 0).
 * Tests that need multi-document transactions (booking, doctor confirm) run only
 * when MongoDB is a replica set; everything else (QR, check-in, cron, concurrency)
 * runs on a standalone server too.
 */
process.env.DISABLE_APPOINTMENT_CRON = "1";
require("dotenv").config();
process.env.JWT_TOKEN_SECRET = process.env.JWT_TOKEN_SECRET || "test-secret";

const assert = require("assert");
const mongoose = require("mongoose");

const uri = process.env.TEST_MONGO_URI || process.env.MONGO_URI || "";
if (!/mongodb:\/\/(127\.0\.0\.1|localhost)/.test(uri)) {
    console.log("=== Smart Queue tests SKIPPED: no localhost TEST_MONGO_URI / MONGO_URI (never run against remote DBs) ===");
    process.exit(0);
}

const Appointment = require("../src/models/appointment.model");
const RoomBooking = require("../src/models/roomBooking.model");
const OutboxNotification = require("../src/models/outboxNotification.model");
const patientController = require("../src/controller/patient.controller");
const doctorController = require("../src/controller/doctor.controller");
const checkinController = require("../src/controller/checkin.controller");
const { runAppointmentLifecycleSweep } = require("../src/jobs/appointmentCron");
const { deriveToken, hashToken, generateNonce } = require("../src/util/qrToken.util");
const { buildQrFields } = require("../src/services/checkin.service");

let passed = 0, total = 0, skipped = 0;
async function test(name, fn, { needsReplicaSet = false } = {}) {
    total++;
    if (needsReplicaSet && !global.__isReplicaSet) {
        skipped++;
        console.log(`  [SKIP] ${name} (requires replica set)`);
        return;
    }
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

(async () => {
    const dbName = `medcare_smartqueue_test_${Date.now()}`;
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 3000 }).catch((e) => {
        console.log("=== Smart Queue tests SKIPPED: cannot connect to MongoDB:", e.message, "===");
        process.exit(0);
    });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    global.__isReplicaSet = !!hello.setName;
    console.log(`=== Smart Queue tests (db=${dbName}, replicaSet=${global.__isReplicaSet}) ===`);

    await Appointment.init();
    const col = (n) => mongoose.connection.db.collection(n);

    // ---------- fixtures ----------
    const orgA = oid(), orgB = oid(), doctorId = oid(), patientId = oid(), roomId = oid();
    const now0 = new Date();
    const hourStart = new Date(Math.ceil((now0.getTime() + 30 * MIN) / HOUR) * HOUR); // next full hour (UTC), >= 30 min ahead

    await col("organizations").insertMany([
        { _id: orgA, name: "Alpha Hospital", email: "a@org.test", registrationNumber: "REG-A", phone: "1111111111", timezone: "UTC", isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false },
        { _id: orgB, name: "Beta Hospital", email: "b@org.test", registrationNumber: "REG-B", phone: "2222222222", timezone: "UTC", isEmailVerified: true, isVerifiedByAdmin: true, isBlocked: false }
    ]);
    await col("doctors").insertOne({ _id: doctorId, name: "Dr. Rao", email: "rao@test.com", specialization: "Cardiology", qualification: "MD", experience: 10, isEmailVerified: true, isBlocked: false, password: "x", nmrNumber: "SECRET-NMR" });
    await col("patients").insertOne({ _id: patientId, name: "Pat Patient", email: "pat@test.com" });
    await col("rooms").insertOne({ _id: roomId, organization: orgA, roomNumber: "R-204", floor: "2nd Floor", department: "Cardio", isOperational: true });
    const affId = oid();
    await col("doctororganizations").insertOne({ _id: affId, doctor: doctorId, organization: orgA, status: "Approved", scheduleVersion: 1 });

    async function mkWindow(start, end) {
        const slotId = oid();
        const localDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
        await col("roomslots").insertOne({ _id: slotId, organization: orgA, room: roomId, date: localDate, startDateTime: start, endDateTime: end, status: "Reserved", timezone: "UTC", localStartTime: start.toISOString().slice(11, 16), localEndTime: end.toISOString().slice(11, 16) });
        const b = await RoomBooking.collection.insertOne({ roomSlot: slotId, room: roomId, organization: orgA, doctor: doctorId, startDateTime: start, endDateTime: end, status: "Active", timezone: "UTC" });
        return b.insertedId;
    }

    let apptCounter = 0;
    async function mkAppt(o = {}) {
        apptCounter++;
        const start = o.start || new Date(Date.now() - 5 * MIN);
        const end = o.end || new Date(Date.now() + 25 * MIN);
        const _id = oid();
        const nonce = generateNonce();
        const token = deriveToken(_id, nonce);
        const doc = await Appointment.create({
            _id,
            patient: o.patient || oid(),
            doctor: o.doctor || doctorId,
            date: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())),
            time: String(apptCounter % 24).padStart(2, "0") + ":" + String(Math.floor(apptCounter / 24)).padStart(2, "0"),
            status: o.status || "Confirmed",
            bookingType: o.bookingType || "Organization",
            organization: o.organization === undefined ? orgA : o.organization,
            room: roomId,
            startDateTime: start,
            endDateTime: end,
            timezone: "UTC",
            qrNonce: nonce,
            qrTokenHash: hashToken(token),
            qrIssuedAt: new Date(),
            qrExpiresAt: end,
            checkedInAt: o.checkedInAt || null
        });
        return { id: doc._id, token };
    }
    const scan = async (org, token) => {
        const res = mockRes();
        await checkinController.scanQr({ organization: { _id: org, timezone: "UTC" }, body: { token } }, res);
        return res;
    };
    const statusOf = async (id) => (await Appointment.findById(id)).status;

    // ---------- PURE UNIT ----------
    await test("QR token contains no ID/personal data and only the hash is stored", async () => {
        const id = oid(), nonce = generateNonce();
        const token = deriveToken(id, nonce);
        assert(/^mc1_[A-Za-z0-9_-]{43}$/.test(token));
        assert(!token.includes(String(id)));
        assert.notStrictEqual(hashToken(token), token);
        assert.strictEqual(deriveToken(id, nonce), token);                // re-derivable
        assert.notStrictEqual(deriveToken(id, generateNonce()), token);   // nonce-bound
        const { a } = { a: 1 }; assert(a);
        const f = buildQrFields(id, new Date());
        assert(f.qrTokenHash && f.qrNonce && !("qrToken" in f));
    });

    // ---------- PART 1: EXPIRED VISIBILITY ----------
    const pastStart = new Date(now0.getTime() - 7 * 24 * HOUR);
    await mkWindow(pastStart, new Date(pastStart.getTime() + 4 * HOUR));                                   // 1 week ago
    const todayExpiredStart = new Date(Math.floor((now0.getTime() - 3 * HOUR) / HOUR) * HOUR);
    const todayStraddle = await mkWindow(todayExpiredStart, new Date(todayExpiredStart.getTime() + 6 * HOUR)); // began 3-4h ago, ends 2-3h ahead
    const futureStart = new Date(hourStart.getTime() + 3 * 24 * HOUR);
    await mkWindow(futureStart, new Date(futureStart.getTime() + 2 * HOUR));                               // 3 days ahead

    const availability = async () => {
        const res = mockRes();
        await patientController.getOrganizationAppointmentAvailability(
            { params: { organizationId: String(orgA) }, query: { doctorId: String(doctorId) } }, res);
        return res;
    };

    await test("historical schedules are hidden; today's ended slots hidden; future slots visible", async () => {
        const res = await availability();
        assert.strictEqual(res.statusCode, 200);
        const windows = res.data.slots;
        const times = windows.flatMap((w) => w.availableTimes);
        assert(times.length > 0);
        assert(times.every((t) => new Date(t.endUtc).getTime() > Date.now()), "an ended slot was returned");
        assert(!windows.some((w) => new Date(w.endDateTime) < new Date()), "past window returned");
        assert(windows.some((w) => new Date(w.startDateTime).getTime() === futureStart.getTime()), "future window missing");
        assert(windows.some((w) => new Date(w.startDateTime).getTime() === todayExpiredStart.getTime()), "today's remaining slots missing");
    });

    await test("availability + doctors APIs never expose room / floor / internal ids", async () => {
        const a = JSON.stringify((await availability()).data);
        const res = mockRes();
        await patientController.getOrganizationDoctors({ params: { organizationId: String(orgA) } }, res);
        const d = JSON.stringify(res.data);
        for (const s of [a, d]) {
            assert(!/R-204|2nd Floor|roomNumber|floor|roomBooking|roomSlot|"room"/i.test(s), "room data leaked: " + s.slice(0, 200));
            assert(!s.includes(String(roomId)) && !s.includes(String(todayStraddle)));
        }
        assert(!d.includes("SECRET-NMR") && !d.includes("password"), "doctor credentials leaked");
        assert(res.data.doctors[0].specialization === "Cardiology");
    });

    const book = async (date, time) => {
        const res = mockRes();
        await patientController.bookAppointment({
            userDetails: { _id: patientId },
            body: { bookingType: "Organization", organizationId: String(orgA), doctorId: String(doctorId), date, time, durationMinutes: 30 }
        }, res);
        return res;
    };
    const ymd = (d) => d.toISOString().slice(0, 10);
    const hm = (d) => d.toISOString().slice(11, 16);

    await test("direct API booking of an expired slot (past date) is rejected", async () => {
        const res = await book(ymd(pastStart), hm(pastStart));
        assert.strictEqual(res.statusCode, 409);
        assert(/ended|no longer/i.test(res.data.msg));
    });
    await test("direct API booking of an ended slot today is rejected", async () => {
        const res = await book(ymd(todayExpiredStart), hm(todayExpiredStart)); // ended 2.5-3.5h ago
        assert.strictEqual(res.statusCode, 409);
    });

    let bookedId;
    await test("future slot can be booked; response hides room data; no room in patient email", async () => {
        const res = await book(ymd(futureStart), hm(futureStart));
        assert.strictEqual(res.statusCode, 201, JSON.stringify(res.data));
        const s = JSON.stringify(res.data);
        assert(!/R-204|2nd Floor|"room"|roomSlot|roomBooking/.test(s), "leak in booking response");
        bookedId = res.data.data._id;
        const stored = await Appointment.findById(bookedId);
        assert.strictEqual(String(stored.room), String(roomId)); // room resolved on the server
        const mails = await OutboxNotification.find({ recipientEmail: "pat@test.com" }).lean();
        assert(mails.length > 0 && !JSON.stringify(mails).includes("R-204"), "room number in patient email");
    }, { needsReplicaSet: true });

    await test("client-supplied room ids are not trusted (foreign room/booking is rejected)", async () => {
        const res = mockRes();
        await patientController.bookAppointment({
            userDetails: { _id: patientId },
            body: { bookingType: "Organization", organizationId: String(orgA), doctorId: String(doctorId), roomId: String(oid()), date: ymd(futureStart), time: "00:00" }
        }, res);
        assert([403, 400, 409].includes(res.statusCode));
    });

    await test("booked slot disappears from availability (room/doctor occupancy)", async () => {
        const res = await availability();
        const t = res.data.slots.flatMap((w) => w.availableTimes).find((x) => x.startUtc === futureStart.toISOString());
        assert(t && t.isAvailable === false);
    }, { needsReplicaSet: true });

    await test("doctor confirmation does not pre-issue a future QR; patient gets PNG QR on appointment day; room hidden; Checked-In can scan", async () => {
        const doc = await Appointment.findById(bookedId);
        // bring the appointment to "today" window so check-in is open
        await Appointment.updateOne({ _id: bookedId }, { $set: { startDateTime: new Date(Date.now() - 5 * MIN), endDateTime: new Date(Date.now() + 25 * MIN) } });
        const res = mockRes();
        await doctorController.updateAppointmentStatus({ userDetails: { _id: doctorId }, body: { appointmentId: String(bookedId), status: "confirmed" } }, res);
        assert.strictEqual(res.statusCode, 200, JSON.stringify(res.data));
        let withQr = await Appointment.findById(bookedId).select("+qrTokenHash +qrNonce");
        assert(!withQr.qrTokenHash && !withQr.qrNonce, "confirmation must not pre-issue QR credentials");

        const qres = mockRes();
        await checkinController.getAppointmentQr({ userDetails: { _id: patientId }, params: { appointmentId: String(bookedId) } }, qres);
        assert.strictEqual(qres.statusCode, 200, JSON.stringify(qres.data));
        assert(qres.data.qrCodeDataUrl.startsWith("data:image/png;base64,"));
        withQr = await Appointment.findById(bookedId).select("+qrTokenHash +qrNonce");
        assert(withQr.qrTokenHash && withQr.qrNonce, "credentials should be lazily issued after the local-day check");
        assert(!JSON.stringify(qres.data).includes(withQr.qrTokenHash));

        const list = mockRes();
        await patientController.getAllAppointment({ userDetails: { _id: patientId } }, list);
        const ls = JSON.stringify(list.data);
        assert(!/R-204|2nd Floor|"room"|roomSlot|roomBooking|qrTokenHash|qrNonce/.test(ls), "leak in appointment list");
        assert(list.data.data[0].qr.available === true && list.data.data[0].organization.name === "Alpha Hospital");

        const r = await scan(orgA, deriveToken(bookedId, withQr.qrNonce));
        assert.strictEqual(r.statusCode, 200, JSON.stringify(r.data));
        assert.strictEqual(r.data.ticket.roomNumber, "R-204");
        assert.strictEqual(r.data.ticket.floor, "2nd Floor");
        assert.strictEqual(r.data.ticket.hospitalName, "Alpha Hospital");
        assert.strictEqual(r.data.ticket.patientName, "Pat Patient");
        assert.strictEqual(r.data.ticket.doctorName, "Dr. Rao");
        assert.strictEqual(r.data.ticket.appointmentId, String(bookedId));
        assert(r.data.ticket.checkInTime && r.data.ticket.queueNumber === 1);
        // patient can no longer cancel after check-in
        const cres = mockRes();
        await patientController.cancelAppointment({ userDetails: { _id: patientId }, body: { appointmentId: String(bookedId) } }, cres);
        assert.strictEqual(cres.statusCode, 400);
        // doctor cannot overwrite Checked-In
        const dres = mockRes();
        await doctorController.updateAppointmentStatus({ userDetails: { _id: doctorId }, body: { appointmentId: String(bookedId), status: "cancelled" } }, dres);
        assert.strictEqual(dres.statusCode, 409);
    }, { needsReplicaSet: true });

    // ---------- PART 2: QR VALIDATION ----------
    await test("valid QR accepted by the correct hospital; ticket + Checked-In state", async () => {
        const a = await mkAppt();
        const r = await scan(orgA, a.token);
        assert.strictEqual(r.statusCode, 200);
        assert.strictEqual(r.data.appointment.status, "Checked-In");
        assert.strictEqual(await statusOf(a.id), "Checked-In");
        assert(r.data.ticket.queueLabel.startsWith("Q-"));
    });
    await test("wrong hospital cannot scan (and appointment stays Confirmed)", async () => {
        const a = await mkAppt();
        const r = await scan(orgB, a.token);
        assert.strictEqual(r.statusCode, 403); assert.strictEqual(r.data.code, "WRONG_HOSPITAL");
        assert.strictEqual(await statusOf(a.id), "Confirmed");
    });
    await test("invalid / malformed / unknown QR rejected", async () => {
        assert.strictEqual((await scan(orgA, "garbage")).statusCode, 400);
        assert.strictEqual((await scan(orgA, deriveToken(oid(), generateNonce()))).statusCode, 404);
    });
    await test("expired QR rejected (slot ended, still Confirmed)", async () => {
        const a = await mkAppt({ start: new Date(Date.now() - 40 * MIN), end: new Date(Date.now() - 10 * MIN) });
        const r = await scan(orgA, a.token);
        assert.strictEqual(r.statusCode, 410); assert.strictEqual(r.data.code, "QR_EXPIRED");
        assert.strictEqual(await statusOf(a.id), "Confirmed");
    });
    await test("duplicate scan rejected", async () => {
        const a = await mkAppt();
        assert.strictEqual((await scan(orgA, a.token)).statusCode, 200);
        const r = await scan(orgA, a.token);
        assert.strictEqual(r.statusCode, 409); assert.strictEqual(r.data.code, "ALREADY_CHECKED_IN");
    });
    await test("cancelled / pending / completed / expired / missed / legacy no-show appointments cannot be scanned", async () => {
        const expect = { Cancelled: [409, "APPOINTMENT_CANCELLED"], Pending: [409, "APPOINTMENT_NOT_CONFIRMED"], Completed: [409, "APPOINTMENT_COMPLETED"], Expired: [410, "QR_EXPIRED"], Missed: [410, "QR_EXPIRED"], "No-Show": [410, "QR_EXPIRED"] };
        for (const [status, [code, c]] of Object.entries(expect)) {
            const a = await mkAppt({ status });
            const r = await scan(orgA, a.token);
            assert.strictEqual(r.statusCode, code, status); assert.strictEqual(r.data.code, c, status);
            assert.strictEqual(await statusOf(a.id), status);
        }
    });
    await test("check-in not open before the appointment day", async () => {
        const a = await mkAppt({ start: new Date(Date.now() + 2 * 24 * HOUR), end: new Date(Date.now() + 2 * 24 * HOUR + 30 * MIN) });
        const r = await scan(orgA, a.token);
        assert.strictEqual(r.data.code, "CHECKIN_NOT_OPEN");
    });
    await test("independent (non-hospital) appointments have no QR", async () => {
        const a = await mkAppt({ bookingType: "Independent", organization: null });
        const res = mockRes();
        await checkinController.getAppointmentQr({ userDetails: { _id: (await Appointment.findById(a.id)).patient }, params: { appointmentId: String(a.id) } }, res);
        assert.strictEqual(res.statusCode, 400);
    });
    await test("a patient cannot fetch another patient's QR", async () => {
        const a = await mkAppt();
        const res = mockRes();
        await checkinController.getAppointmentQr({ userDetails: { _id: oid() }, params: { appointmentId: String(a.id) } }, res);
        assert.strictEqual(res.statusCode, 404);
    });

    await test("CONCURRENCY: 15 simultaneous scans of one QR -> exactly one check-in", async () => {
        const a = await mkAppt();
        const results = await Promise.all(Array.from({ length: 15 }, () => scan(orgA, a.token)));
        const ok = results.filter((r) => r.statusCode === 200);
        assert.strictEqual(ok.length, 1, "successes=" + ok.length);
        assert(results.filter((r) => r !== ok[0]).every((r) => r.statusCode === 409 && r.data.code === "ALREADY_CHECKED_IN"));
        const d = await Appointment.findById(a.id);
        assert.strictEqual(d.status, "Checked-In"); assert(d.queueNumber >= 1);
    });
    await test("CONCURRENCY: 20 different patients checking in at once get unique queue numbers", async () => {
        const doc2 = oid();
        await col("doctors").insertOne({ _id: doc2, name: "Dr. Q", email: "q@test.com", specialization: "ENT", isEmailVerified: true, isBlocked: false });
        const appts = await Promise.all(Array.from({ length: 20 }, () => mkAppt({ doctor: doc2 })));
        const rs = await Promise.all(appts.map((a) => scan(orgA, a.token)));
        assert(rs.every((r) => r.statusCode === 200));
        const nums = rs.map((r) => r.data.appointment.queueNumber).sort((x, y) => x - y);
        assert.deepStrictEqual(nums, Array.from({ length: 20 }, (_, i) => i + 1));
    });

    await test("queue board + ticket re-print (no new queue number)", async () => {
        const a = await mkAppt();
        const first = await scan(orgA, a.token);
        const res = mockRes();
        await checkinController.reprintTicket({ organization: { _id: orgA }, params: { appointmentId: String(a.id) } }, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.ticket.queueNumber, first.data.appointment.queueNumber);
        const other = mockRes();
        await checkinController.reprintTicket({ organization: { _id: orgB }, params: { appointmentId: String(a.id) } }, other);
        assert.strictEqual(other.statusCode, 404);
        const q = mockRes();
        await checkinController.getQueue({ organization: { _id: orgA, timezone: "UTC" }, query: {} }, q);
        assert(q.data.queue.length >= 1);
    });

    await test("doctor starts consultation: Checked-In -> In Progress (only own, only checked-in)", async () => {
        const a = await mkAppt();
        const run = async (doc) => { const r = mockRes(); await checkinController.startConsultation({ userDetails: { _id: doc }, body: { appointmentId: String(a.id) } }, r); return r; };
        assert.strictEqual((await run(doctorId)).statusCode, 409);   // not checked in yet
        await scan(orgA, a.token);
        assert.strictEqual((await run(oid())).statusCode, 404);      // other doctor
        assert.strictEqual((await run(doctorId)).statusCode, 200);
        assert.strictEqual(await statusOf(a.id), "In Progress");
        assert.strictEqual((await run(doctorId)).statusCode, 409);
    });

    // ---------- CRON ----------
    await test("cron: finalises at EXACT slot END (no grace); Missed for unattended; expired; cancelled untouched; idempotent", async () => {
        await Appointment.deleteMany({});
        const T = new Date("2026-11-12T04:30:00.000Z"); // 10:00 IST
        const end = new Date(T.getTime() + 30 * MIN);   // 10:30 IST
        const mk = (o) => mkAppt({ start: T, end, ...o });
        const checked = await mk({ status: "Checked-In" });
        const inprog = await mk({ status: "In Progress" });
        const unattended = await mk({ status: "Confirmed" });
        const cancelled = await mk({ status: "Cancelled" });
        const pending = await mk({ status: "Pending" });
        const completedAlready = await mk({ status: "Completed" });

        // 1 ms before END: nothing changes
        let s = await runAppointmentLifecycleSweep(new Date(end.getTime() - 1));
        assert.deepStrictEqual(s, { expired: 0, completed: 0, missed: 0, legacyExpired: 0 });
        assert.strictEqual(await statusOf(checked.id), "Checked-In");
        assert.strictEqual(await statusOf(unattended.id), "Confirmed");

        // Exactly at END (10:30 IST): finalised immediately, no grace period
        s = await runAppointmentLifecycleSweep(end);
        assert.strictEqual(s.completed, 2);
        assert.strictEqual(s.missed, 1);
        assert.strictEqual(await statusOf(pending.id), "Expired");
        assert.strictEqual(await statusOf(checked.id), "Completed");
        assert.strictEqual(await statusOf(inprog.id), "Completed");
        assert.strictEqual(await statusOf(unattended.id), "Missed");     // never attended => not "Completed"
        assert.strictEqual(await statusOf(cancelled.id), "Cancelled");   // never overwritten
        assert.strictEqual(await statusOf(completedAlready.id), "Completed");
        // missed-run catch-up + idempotency
        s = await runAppointmentLifecycleSweep(new Date(end.getTime() + 5 * 24 * HOUR));
        assert.deepStrictEqual(s, { expired: 0, completed: 0, missed: 0, legacyExpired: 0 });
        assert.strictEqual((await Appointment.findById(checked.id)).completedBy, "System");
        assert.strictEqual((await Appointment.findById(unattended.id)).missedAt.getTime(), end.getTime());
    });
    await test("cron: legacy independent Pending (date+time only) expires in Asia/Kolkata", async () => {
        const mk = (time) => Appointment.collection.insertOne({ patient: oid(), doctor: oid(), date: new Date("2026-11-12T00:00:00Z"), time, status: "Pending", bookingType: "Independent" });
        const past = await mk("10:00"), future = await mk("16:00");
        // 10:30 IST = 05:00 UTC
        await runAppointmentLifecycleSweep(new Date("2026-11-12T05:00:00Z"));
        assert.strictEqual(await statusOf(past.insertedId), "Expired");
        assert.strictEqual(await statusOf(future.insertedId), "Pending");
    });

    console.log(`Smart Queue Test Results: ${passed}/${total - skipped} passed${skipped ? `, ${skipped} skipped (no replica set)` : ""}.`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    process.exit(passed === total - skipped ? 0 : 1);
})().catch(async (e) => { console.error(e); try { await mongoose.connection.dropDatabase(); } catch (_) {} process.exit(1); });
