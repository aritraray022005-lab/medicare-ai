# MedCare AI – Expired-Slot Fix & Smart Hospital Queue: Implementation Guide

All paths are relative to your project root (the folder that contains `client/` and `server/`).
Copy the files in this ZIP over your project, keeping the same paths. Nothing here deploys anything.

---

## 1. Original bug and root cause

**Symptom:** a patient could see (and API-book) a doctor's room schedule from 5 Nov when today is 12 Nov.

**Root cause (all in `server/src/controller/patient.controller.js`):**
1. `getOrganizationAppointmentAvailability` loaded every *Active* `RoomBooking` for the doctor with **no time filter**, and never skipped slots in the past, so historical schedules and ended slots of today were returned.
2. `bookAppointment` never checked that the requested slot had not ended, so an expired slot could be booked by calling the API directly.
3. Doctor-side slot browsing (`getAvailableSlotsForDoctor` in `room.controller.js`) and `requestRoomBooking` also accepted expired room slots.

**Related problems found and fixed while implementing the spec**
- Patient APIs leaked room data: `room.roomNumber/floor` were populated in the doctors list, availability list and appointment list; booking/cancel responses returned `room`, `roomSlot`, `roomBooking` ids; the patient confirmation email contained "Room NNN" (booking flow **and** `admin.controller.js` resolution flow).
- `doctor.controller.updateAppointmentStatus` allowed any transition (it could overwrite Completed/Cancelled).
- Patient cancel was allowed from any status except Cancelled/Expired.
- The old cron compared `toTimeString()` in server-local time (not Asia/Kolkata) and only ever expired Pending rows.

---

## 2. Modified files

| File | Change |
|---|---|
| `server/src/controller/patient.controller.js` | Availability + doctors endpoints hide expired data and never return room data; booking validates expiry (before **and** inside the transaction), resolves the room on the server, no room in patient email; sanitized responses; list uses allow-listed view; cancel only from Pending/Confirmed (re-checked in the transaction). |
| `server/src/controller/doctor.controller.js` | Confirm only from Pending and not after the slot ended; cancel only from Pending/Confirmed; QR is issued on confirmation. |
| `server/src/controller/room.controller.js` | Doctors no longer see expired room slots; `requestRoomBooking` rejects expired slots (pre-check + inside transaction). |
| `server/src/controller/admin.controller.js` | Room-conflict check counts new statuses; patient email no longer names the room. |
| `server/src/util/conflict.util.js` | Checked-In / In Progress still occupy doctor/room time. |
| `server/src/models/appointment.model.js` | New statuses; QR (hash only), queue, check-in, completion fields; 2 new indexes. Existing indexes untouched. |
| `server/src/jobs/appointmentCron.js` | Rewritten lifecycle sweep (see §8). |
| `server/src/routes/organization.routes.js` | `/checkin/scan`, `/checkin/queue`, `/checkin/appointments/:id/ticket`. |
| `server/src/routes/patient.routes.js` | `GET /appointment/:appointmentId/qr`. |
| `server/src/routes/doctor.routes.js` | `PATCH /appointment/start`. |
| `server/package.json`, `server/package-lock.json` | `qrcode` dependency; `smart_queue` test added to `npm test`. |
| `server/.env.example` | New variables documented. |
| `server/test/patient_appointment.test.js` | One mock appointment now uses a future date (it used `new Date()` + 10:00, which is now correctly rejected as an ended slot). Nothing else changed. |
| `client/src/components/BookAppointment.jsx` | No room display, no room ids sent; wording changed from "room" to "consultation time"; per-slot date. |
| `client/src/components/AppointmentsList.jsx` | Doctor details, status labels, "Show check-in QR" panel; no room/floor. |
| `client/src/App.jsx` | Route `/organization/checkin` + "Patient Check-in" nav link. |
| `client/package.json`, `client/package-lock.json` | `jsqr` dependency (camera QR decoding). |

## 3. New files

| File | Purpose |
|---|---|
| `server/src/util/appointmentLifecycle.util.js` | Status constants, Asia/Kolkata helpers, window/expiry helpers. |
| `server/src/util/qrToken.util.js` | QR token derivation + SHA-256 hashing. |
| `server/src/util/appointmentView.util.js` | Allow-listed patient projection (never includes room data). |
| `server/src/models/queueCounter.model.js` | Per doctor / per day atomic queue counter. |
| `server/src/services/checkin.service.js` | QR issuance, atomic check-in, queue number, ticket, consultation start. |
| `server/src/controller/checkin.controller.js` | HTTP handlers. |
| `server/src/validations/checkin.validation.js` | Zod schemas. |
| `server/test/smart_queue.test.js` | 24 integration tests (real MongoDB). |
| `client/src/pages/OrganizationCheckin.jsx` | "Patient Check-in & Ticket Generation" page + 80 mm printable ticket. |

---

## 4. How it works

**Slot expiry.** A slot is expired when its scheduled **end** has passed (UTC instants compared with `Date.now()`). Availability returns only windows ending in the future and only 30-minute slots whose end is in the future. Booking re-checks before and inside the transaction.

**Room privacy.** Patients identify a slot by `organizationId + doctorId + date + time`. The server finds the doctor's Active `RoomBooking` that contains that interval and takes the room from it. `roomId`/`roomBookingId` in a request are deprecated: if still sent they are validated against the server-side record (never trusted). Patient responses are built from an allow-list, so room, floor, roomSlot, roomBooking and QR fields cannot leak.

**QR.** On confirmation the server stores a random 128-bit `qrNonce` and `qrTokenHash`. The QR token is `mc1_` + `HMAC-SHA256(QR_TOKEN_SECRET, "qr:v1:<appointmentId>:<nonce>")` - unpredictable, contains no ids/personal data, and is re-derivable so the patient can reopen the QR later. **Only the SHA-256 hash of the token is stored**; the token itself is never stored. QR/nonce fields are `select:false`. Appointments confirmed before this release get their QR lazily when the patient first opens it.

**Check-in** (`POST /api/organizations/checkin/scan`): the organization comes from the login session only. The status change is a single atomic `findOneAndUpdate` whose filter requires: same organization, same token hash, status `Confirmed`, not ended, not already checked in. Concurrent scans therefore cannot double check-in. The queue number comes from an atomic `$inc` counter (per doctor per local day).

**Ticket** contains hospital, patient, appointment id, doctor, specialization, date, time, room, floor, queue/token, check-in time. Print via the browser (`@page { size: 80mm auto }`). Re-print (`GET .../ticket`) re-renders the same ticket and queue number; it never creates a second check-in.

---

## 5. Installation

```bash
cd server && npm ci      # installs qrcode
cd ../client && npm ci   # installs jsqr
```
The lockfiles are included because your CI uses `npm ci`. Docker/Vercel/Render configuration needs no change.

## 6. Environment variables

| Variable | Where | Required | Notes |
|---|---|---|---|
| `QR_TOKEN_SECRET` | Render (backend) | **Recommended** | Long random string (`openssl rand -hex 32`). Falls back to `JWT_TOKEN_SECRET` if unset. Must be identical on every backend instance. Changing it invalidates already-issued QR codes (patients just reopen them; new tokens are not re-hashed automatically - see §7). |
| `APPOINTMENT_COMPLETION_GRACE_MINUTES` | Render | Optional | Default `60`. |
| `DISABLE_APPOINTMENT_CRON=1` | tests only | - | Prevents the cron from starting when a module is imported. |

## 7. Database changes

**No migration script is required.**
- New appointment fields default to `null`/`0`.
- New indexes (`qrTokenHash` unique-partial, `{status, endDateTime}`) are created by Mongoose at startup. If your production has `autoIndex` disabled, run `Appointment.syncIndexes()` once or create them manually.
- Your existing unique indexes on `(doctor,date,time)` / `(doctor,startDateTime,endDateTime)` cover Pending/Confirmed only. They were intentionally **not** changed (changing a partial filter would force a drop/recreate on a live DB). Checked-In/In Progress slots are protected by the application-level conflict checks, which now include those statuses. Optional hardening: drop and recreate those two indexes with the filter `status ∈ {Pending, Confirmed, Checked-In, In Progress}` during a quiet period.
- **If you change `QR_TOKEN_SECRET` after QR codes were issued:** the stored hashes no longer match the re-derived tokens. Clear them with
  `db.appointments.updateMany({status:"Confirmed"},{$set:{qrTokenHash:null,qrNonce:null}})` and they will be re-issued lazily.

**One-time effect of the first cron run after deploy (back up first).** The sweep catches up on everything overdue:
- hospital `Pending` appointments whose slot ended -> `Expired`;
- hospital `Confirmed` appointments that ended >60 min ago and were never checked in -> `No-Show` (they cannot be "Completed" because nobody was checked in);
- legacy independent `Pending` appointments in the past -> `Expired` (as before, now evaluated in Asia/Kolkata).
Independent-clinic `Confirmed` appointments are **not** modified.

## 8. Lifecycle & cron

```
Pending -> Confirmed (doctor) -> Checked-In (org scans QR) -> In Progress (doctor starts) -> Completed (end + 60 min, automatic)
Pending -> Expired (slot end)       Confirmed (never checked in) -> No-Show (end + 60 min)       Cancelled: Pending/Confirmed only
```
Example 12 Nov 2026, 10:00-10:30 IST: scanning stops at 10:30; attended appointments become Completed at 11:30 (tested at 11:29 = unchanged, 11:30 = Completed); unattended become No-Show at 11:30.

The cron runs every minute with `timezone: "Asia/Kolkata"`, is range-based (missed runs/redeploys are caught up, plus an immediate sweep when the DB connects), is idempotent, never overlaps itself, and each update is guarded by the current status in one `updateMany` so Cancelled is never overwritten and multiple instances cannot double-process. All timestamps are stored in UTC.

## 9. API changes

| Endpoint | Change |
|---|---|
| `GET /api/patients/organizations/:id/doctors` | Public doctor profile only (name, specialization, qualification, experience, bio, picture, fee, rating). `activeBookings` is now upcoming schedules **without** room/ids. |
| `GET /api/patients/organizations/:id/availability?doctorId&dateStr` | **Breaking:** no `room`, `roomBookingId`; `roomId` query param ignored. Windows: `{startDateTime,endDateTime,availableTimes:[{startUtc,endUtc,date,time,isAvailable}]}` + `timezone`. Expired data never returned. |
| `POST /api/patients/appointment` (Organization) | `roomId`/`roomBookingId` optional & deprecated. `409` for ended slots. Response is the sanitized view. |
| `GET /api/patients/appointment` | Allow-listed view: no `room/roomSlot/roomBooking`; adds `qr:{available,expiresAt}`, `checkedInAt`, `queueNumber`. |
| `DELETE /api/patients/appointment` | Only Pending/Confirmed can be cancelled. |
| **NEW** `GET /api/patients/appointment/:id/qr` | Patient-only, own confirmed hospital appointment, before its end. Returns `{qrCodeDataUrl, expiresAt}` (no token text, no ids). |
| **NEW** `POST /api/organizations/checkin/scan` `{token}` | Verified organization only. Errors: `INVALID_QR` 400/404, `WRONG_HOSPITAL` 403, `QR_EXPIRED` 410, `ALREADY_CHECKED_IN` / `APPOINTMENT_CANCELLED` / `APPOINTMENT_COMPLETED` / `APPOINTMENT_NOT_CONFIRMED` / `CHECKIN_NOT_OPEN` 409. |
| **NEW** `GET /api/organizations/checkin/queue?date=` | Today's checked-in patients (staff only). |
| **NEW** `GET /api/organizations/checkin/appointments/:id/ticket` | Re-print an existing ticket (own organization only). |
| **NEW** `PATCH /api/doctors/appointment/start` `{appointmentId}` | Checked-In -> In Progress (own appointments only). |
| `PATCH /api/doctors/appointment/status` | Now rejects invalid transitions with `409`. |

## 10. Manual integration steps

1. Back up your database.
2. Copy this ZIP's contents over your repo (same paths), commit on a branch.
3. `npm ci` in `server/` and `client/`; confirm `package-lock.json` files are committed (CI uses `npm ci`).
4. Add `QR_TOKEN_SECRET` (and optionally `APPOINTMENT_COMPLETION_GRACE_MINUTES`) in Render.
5. Push; let GitHub Actions run (`npm test` now includes `smart_queue.test.js`).
6. After deploy, watch the logs for the first catch-up line `[appointment-cron ... IST] expired=… completed=… no-show=…`.
7. Camera scanning needs HTTPS (Vercel provides it). Handheld/USB scanners work as keyboards in the check-in page's input box.
8. Printing: choose the 80 mm receipt printer in the browser print dialog (margins none, scale 100%). For A5, change `@page` in `OrganizationCheckin.jsx`.

## 11. Testing

```bash
cd server
# Only runs against localhost (never against a remote/Atlas URI):
TEST_MONGO_URI="mongodb://127.0.0.1:27017/" npm test
node test/smart_queue.test.js
```
`smart_queue.test.js` uses a throw-away database and drops it. With a replica set all 24 run; on a standalone server (as in your CI) the 3 tests that need transactions skip and 21 run. If no localhost MongoDB is reachable the file skips itself with exit 0.

Covered (your list): 1-3 historical/expired/future visibility; 4 direct booking of expired slots rejected; 5 correct hospital accepted; 6 wrong hospital rejected; 7 invalid + expired QR rejected; 8 duplicate scan rejected; 9 cancelled (also pending/completed/expired/no-show) rejected; 10 ticket contents; 11 no room data in any patient API or patient email; 12 completion at exactly end+60 min (59 min = unchanged), no-show, cancelled untouched, idempotent catch-up; 13 15 simultaneous scans of one QR -> exactly one check-in, and 20 simultaneous check-ins get unique queue numbers 1..20.

Results from my run (real MongoDB 8.3.7 replica set): all 11 backend test files pass (smart_queue 24/24, patient_appointment 25/25, room_booking 28/28, replica_set_integration 5/5, others unchanged). I also verified the tests really detect the bugs: removing the expiry filter and removing the atomic status condition from the check-in claim each make a test fail (the latter let 13 of 15 concurrent scans through).

Frontend: `vite build` succeeds and oxlint reports 0 errors. **The UI was not exercised in a real browser** (no camera/printer test) - please do the manual check below.

Manual E2E: book as patient -> doctor confirms -> patient opens *Show check-in QR* -> hospital logs in -> *Patient Check-in* -> scan -> ticket prints -> scan again (rejected) -> a second hospital's account scans the same QR (rejected).

## 12. Limitations and decisions to review

- **"Authorized user":** the codebase has one login per hospital organization (no staff sub-roles). "Authorized" = a verified, unblocked organization account whose id matches the appointment's organization. Patients cannot call the scan endpoint.
- **Check-in window:** opens at 00:00 (facility time) of the appointment day and closes at the slot end. Easy to change in `checkin.service.js` (`startOfLocalDay`).
- **Doctor "start consultation"** exists as an API (`PATCH /api/doctors/appointment/start`) but I did not add a button to `DoctorDashboard.jsx`.
- **Independent (non-hospital) appointments** have no QR/check-in and are not auto-completed. They can still be booked for past dates through the API; Part 1 targeted the hospital interface, so I left it. Worth a follow-up.
- No rate limiting was added to the scan endpoint (tokens are 256-bit, so guessing is impractical, but a limiter is cheap insurance).
- The cron is in-process (as before). On Render, if the service sleeps/redeploys, the catch-up sweep on reconnect covers missed windows.
- New files use LF line endings; your existing files keep their original CRLF/LF.
- Security note: the ZIP you uploaded contained `server/.env` with live-looking credentials. It is **not** in this output ZIP; consider rotating those keys.
