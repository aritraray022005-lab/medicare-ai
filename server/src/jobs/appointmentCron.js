const cron = require("node-cron");
const mongoose = require("mongoose");
const { DateTime } = require("luxon");
const Appointment = require("../models/appointment.model");
const {
    APPOINTMENT_STATUS,
    ATTENDED_STATUSES,
    DEFAULT_TIMEZONE,
    getAppointmentWindow
} = require("../util/appointmentLifecycle.util");

/**
 * Appointment lifecycle sweep.
 *
 * Every transition is:
 *   - range based (endDateTime <= now), so a missed run, a restart or a deploy
 *     simply gets picked up by the next run (catch-up);
 *   - idempotent and guarded by the CURRENT status inside a single updateMany, so a
 *     row is never updated twice, two server instances cannot double-process it, and
 *     Cancelled (or any other terminal status) is never overwritten.
 *
 * Rules (all instants are UTC in the database; logs use Asia/Kolkata):
 *   Pending                          and slot END passed            -> Expired
 *   Checked-In / In Progress          and slot END passed (end <= now) -> Completed
 *   Confirmed (hospital, no check-in) and slot END passed (end <= now) -> Missed
 *   Legacy independent Pending (no endDateTime) and start passed       -> Expired   (previous behaviour)
 *
 * There is NO grace period: finalisation happens at the exact scheduled slot END.
 * The job runs every minute, so the transition lands within the minute of the END
 * time, and anything missed (restart / deploy) is caught up on the next run.
 * "No-Show" is the legacy name of "Missed"; this job only ever writes "Missed".
 */

let isSweeping = false;

function stamp(now) {
    return DateTime.fromJSDate(now, { zone: DEFAULT_TIMEZONE }).toFormat("yyyy-LL-dd HH:mm:ss 'IST'");
}

async function runAppointmentLifecycleSweep(now = new Date()) {
    const summary = { expired: 0, completed: 0, missed: 0, legacyExpired: 0 };

    // 1. Unconfirmed appointments whose scheduled slot has ended
    const expired = await Appointment.updateMany(
        {
            status: APPOINTMENT_STATUS.PENDING,
            endDateTime: { $lte: now }
        },
        {
            $set: { status: APPOINTMENT_STATUS.EXPIRED, expiredAt: now }
        }
    );
    summary.expired = expired.modifiedCount || 0;

    // 2. Patients who attended (Checked-In / In Progress): complete at the exact slot END
    const completed = await Appointment.updateMany(
        {
            status: { $in: ATTENDED_STATUSES },
            endDateTime: { $lte: now }
        },
        {
            $set: {
                status: APPOINTMENT_STATUS.COMPLETED,
                completedAt: now,
                completedBy: "System"
            }
        }
    );
    summary.completed = completed.modifiedCount || 0;

    // 3. Confirmed hospital appointments where the patient never checked in.
    //    These are NOT completed consultations: they become Missed at the exact slot END.
    const missed = await Appointment.updateMany(
        {
            status: APPOINTMENT_STATUS.CONFIRMED,
            bookingType: "Organization",
            checkedInAt: null,
            endDateTime: { $lte: now }
        },
        {
            $set: { status: APPOINTMENT_STATUS.MISSED, missedAt: now }
        }
    );
    summary.missed = missed.modifiedCount || 0;

    // 4. Legacy independent-clinic appointments (no canonical interval): only date + "HH:mm".
    //    Interpreted in Asia/Kolkata. Same behaviour as before: expire once the start has passed.
    const nowLocal = DateTime.fromJSDate(now, { zone: DEFAULT_TIMEZONE });
    const dateUpperBound = new Date(Date.UTC(nowLocal.year, nowLocal.month - 1, nowLocal.day + 1));

    const legacyPending = await Appointment.find({
        status: APPOINTMENT_STATUS.PENDING,
        $or: [{ endDateTime: null }, { endDateTime: { $exists: false } }],
        date: { $lte: dateUpperBound }
    })
        .select("date time timezone")
        .lean();

    for (const appt of legacyPending) {
        const { start } = getAppointmentWindow(appt);
        if (start && start.getTime() <= now.getTime()) {
            const res = await Appointment.updateOne(
                { _id: appt._id, status: APPOINTMENT_STATUS.PENDING },
                { $set: { status: APPOINTMENT_STATUS.EXPIRED, expiredAt: now } }
            );
            summary.legacyExpired += res.modifiedCount || 0;
        }
    }

    return summary;
}

async function guardedSweep() {
    if (isSweeping) return null; // never overlap with a still-running sweep
    isSweeping = true;
    try {
        const now = new Date();
        const s = await runAppointmentLifecycleSweep(now);
        const total = s.expired + s.completed + s.missed + s.legacyExpired;
        if (total > 0) {
            console.log(
                `[appointment-cron ${stamp(now)}] expired=${s.expired + s.legacyExpired} completed=${s.completed} missed=${s.missed}`
            );
        }
        return s;
    } catch (error) {
        console.error("Error in appointment lifecycle cron job:", error);
        return null;
    } finally {
        isSweeping = false;
    }
}

let task = null;

function startAppointmentCron() {
    if (task) return task;

    // Every minute, evaluated in Asia/Kolkata
    task = cron.schedule("* * * * *", guardedSweep, {
        timezone: DEFAULT_TIMEZONE,
        name: "appointment-lifecycle"
    });

    // Catch-up for anything that came due while the server was down / redeploying
    if (mongoose.connection.readyState === 1) {
        guardedSweep();
    } else {
        mongoose.connection.once("open", guardedSweep);
    }

    return task;
}

if (process.env.DISABLE_APPOINTMENT_CRON !== "1") {
    startAppointmentCron();
}

module.exports = {
    runAppointmentLifecycleSweep,
    startAppointmentCron
};
