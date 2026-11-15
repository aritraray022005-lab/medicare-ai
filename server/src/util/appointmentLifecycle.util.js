const { DateTime, IANAZone } = require("luxon");

/**
 * Single source of truth for the appointment lifecycle.
 *
 *   Pending ──(doctor confirms)──► Confirmed ──(org scans QR)──► Checked-In
 *      │                               │                            │
 *      │                               │                  (doctor starts)
 *      │                               │                            ▼
 *      │                               │                       In Progress
 *      ▼                               ▼                            │
 *   Expired (slot ended)         Missed (slot ended,                ▼
 *                                never checked in)         Completed (slot ended)
 *
 *   - Finalisation happens at the exact scheduled slot END (endDateTime <= now).
 *     There is NO grace period.
 *   - "No-Show" is the legacy name of "Missed". It is still a valid status so
 *     historical records keep working, but new unattended appointments are "Missed".
 *   - Cancelled can be reached from Pending / Confirmed only and is never overwritten.
 *
 * QR availability (patient) and check-in (staff) are only possible on the
 * appointment's local calendar date in the facility timezone, at any time of that
 * day (no before-start restriction), until the actual slot END.
 *
 * All instants are stored as UTC Dates. Wall-clock formatting and calendar-date
 * comparisons use the facility timezone, falling back to Asia/Kolkata.
 */

const APPOINTMENT_STATUS = Object.freeze({
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    CHECKED_IN: "Checked-In",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    MISSED: "Missed",
    // Legacy name of MISSED. Kept so historical records remain valid.
    NO_SHOW: "No-Show"
});

const ALL_APPOINTMENT_STATUSES = Object.values(APPOINTMENT_STATUS);

// Statuses meaning "a hospital appointment the patient never attended".
// MISSED is the current status; NO_SHOW is the legacy one (historical records).
const UNATTENDED_FINAL_STATUSES = Object.freeze([
    APPOINTMENT_STATUS.MISSED,
    APPOINTMENT_STATUS.NO_SHOW
]);

// Statuses that still occupy a doctor / room time slot.
const SLOT_HOLDING_STATUSES = Object.freeze([
    APPOINTMENT_STATUS.PENDING,
    APPOINTMENT_STATUS.CONFIRMED,
    APPOINTMENT_STATUS.CHECKED_IN,
    APPOINTMENT_STATUS.IN_PROGRESS
]);

// Statuses in which the patient is physically at the hospital.
const ATTENDED_STATUSES = Object.freeze([
    APPOINTMENT_STATUS.CHECKED_IN,
    APPOINTMENT_STATUS.IN_PROGRESS
]);

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEFAULT_SLOT_MINUTES = 30;

function resolveTimezone(tz) {
    return tz && IANAZone.isValidZone(tz) ? tz : DEFAULT_TIMEZONE;
}

/**
 * Returns the scheduled [start, end] window of an appointment as UTC Dates.
 * Hospital appointments carry canonical startDateTime/endDateTime. Legacy
 * independent-clinic appointments only have a calendar date + "HH:mm", which
 * is interpreted in Asia/Kolkata and given the default slot duration.
 */
function getAppointmentWindow(appt) {
    if (appt && appt.startDateTime && appt.endDateTime) {
        return {
            start: new Date(appt.startDateTime),
            end: new Date(appt.endDateTime),
            derived: false
        };
    }

    if (!appt || !appt.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(appt.time || "")) {
        return { start: null, end: null, derived: true };
    }

    const d = new Date(appt.date);
    const [hour, minute] = appt.time.split(":").map(Number);
    const start = DateTime.fromObject(
        { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour, minute },
        { zone: appt.timezone && IANAZone.isValidZone(appt.timezone) ? appt.timezone : DEFAULT_TIMEZONE }
    );
    if (!start.isValid) {
        return { start: null, end: null, derived: true };
    }
    return {
        start: start.toUTC().toJSDate(),
        end: start.plus({ minutes: DEFAULT_SLOT_MINUTES }).toUTC().toJSDate(),
        derived: true
    };
}

/** True once the scheduled END time has passed. */
function isAppointmentWindowExpired(appt, now = new Date()) {
    const { end } = getAppointmentWindow(appt);
    return !!end && end.getTime() <= now.getTime();
}

/** Start of the appointment's local calendar day (UTC Date) in the given timezone. */
function startOfLocalDay(instant, timezone) {
    return DateTime.fromJSDate(new Date(instant), { zone: resolveTimezone(timezone) })
        .startOf("day")
        .toUTC()
        .toJSDate();
}

/** "YYYY-MM-DD" of an instant in the given timezone. */
function localDateKey(instant, timezone) {
    return DateTime.fromJSDate(new Date(instant), { zone: resolveTimezone(timezone) }).toISODate();
}

/**
 * Timezone-safe check that two instants fall on the same LOCAL calendar date in
 * the given facility timezone.
 */
function isSameLocalDay(a, b, timezone) {
    return localDateKey(a, timezone) === localDateKey(b, timezone);
}

/**
 * Backend decision: may the patient see / retrieve the check-in QR right now?
 *
 *   - hospital (Organization) appointment, status Confirmed
 *   - the actual slot END has not passed (endDateTime > now)
 *   - the appointment's local calendar date equals today's date in the facility
 *     timezone. There is deliberately NO before-start restriction: on the day of
 *     the appointment the QR is usable at any time.
 *
 * Returns { available, reason } where reason is one of:
 *   OK | NOT_APPLICABLE | NOT_CONFIRMED | EXPIRED | NOT_TODAY_FUTURE | NOT_TODAY_PAST
 */
function getQrAvailability(appt, now = new Date(), organizationTimezone = null) {
    if (!appt || appt.bookingType !== "Organization" || !appt.organization) {
        return { available: false, reason: "NOT_APPLICABLE" };
    }
    if (appt.status !== APPOINTMENT_STATUS.CONFIRMED) {
        return { available: false, reason: "NOT_CONFIRMED" };
    }
    if (!appt.startDateTime || !appt.endDateTime) {
        return { available: false, reason: "EXPIRED" };
    }
    if (new Date(appt.endDateTime).getTime() <= now.getTime()) {
        return { available: false, reason: "EXPIRED" };
    }

    const tz = resolveTimezone(appt.timezone || organizationTimezone);
    const apptDay = localDateKey(appt.startDateTime, tz);
    const today = localDateKey(now, tz);
    if (apptDay === today) {
        return { available: true, reason: "OK" };
    }
    return { available: false, reason: apptDay > today ? "NOT_TODAY_FUTURE" : "NOT_TODAY_PAST" };
}

function formatLocal(instant, timezone, format) {
    return DateTime.fromJSDate(new Date(instant), { zone: resolveTimezone(timezone) }).toFormat(format);
}

module.exports = {
    APPOINTMENT_STATUS,
    ALL_APPOINTMENT_STATUSES,
    SLOT_HOLDING_STATUSES,
    ATTENDED_STATUSES,
    UNATTENDED_FINAL_STATUSES,
    DEFAULT_TIMEZONE,
    DEFAULT_SLOT_MINUTES,
    resolveTimezone,
    getAppointmentWindow,
    isAppointmentWindowExpired,
    startOfLocalDay,
    localDateKey,
    isSameLocalDay,
    getQrAvailability,
    formatLocal
};
