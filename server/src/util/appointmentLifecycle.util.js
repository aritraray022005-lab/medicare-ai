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
 *   Expired (slot ended)        No-Show (end + grace,               ▼
 *                               never checked in)             Completed (end + grace)
 *
 *   Cancelled can be reached from Pending / Confirmed only and is never overwritten.
 *
 * All instants are stored as UTC Dates. Wall-clock formatting uses the
 * organization timezone, falling back to Asia/Kolkata.
 */

const APPOINTMENT_STATUS = Object.freeze({
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    CHECKED_IN: "Checked-In",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    NO_SHOW: "No-Show"
});

const ALL_APPOINTMENT_STATUSES = Object.values(APPOINTMENT_STATUS);

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

function getCompletionGraceMinutes() {
    const raw = Number(process.env.APPOINTMENT_COMPLETION_GRACE_MINUTES);
    return Number.isFinite(raw) && raw >= 0 ? raw : 60;
}

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

function addMinutes(date, minutes) {
    return new Date(new Date(date).getTime() + minutes * 60 * 1000);
}

/** Instant at which a Checked-In / In Progress / unattended appointment is finalised. */
function getFinalisationInstant(end) {
    return addMinutes(end, getCompletionGraceMinutes());
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

function formatLocal(instant, timezone, format) {
    return DateTime.fromJSDate(new Date(instant), { zone: resolveTimezone(timezone) }).toFormat(format);
}

module.exports = {
    APPOINTMENT_STATUS,
    ALL_APPOINTMENT_STATUSES,
    SLOT_HOLDING_STATUSES,
    ATTENDED_STATUSES,
    DEFAULT_TIMEZONE,
    DEFAULT_SLOT_MINUTES,
    getCompletionGraceMinutes,
    resolveTimezone,
    getAppointmentWindow,
    isAppointmentWindowExpired,
    addMinutes,
    getFinalisationInstant,
    startOfLocalDay,
    localDateKey,
    formatLocal
};
