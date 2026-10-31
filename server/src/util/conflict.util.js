const Appointment = require("../models/appointment.model");
const RoomBooking = require("../models/roomBooking.model");

/**
 * Checks for doctor schedule conflicts across Tier 1, Tier 2, and Tier 3.
 *
 * @param {string|mongoose.Types.ObjectId} doctorId
 * @param {Date} startDateTime Canonical UTC start timestamp
 * @param {Date} endDateTime Canonical UTC end timestamp
 * @param {mongoose.ClientSession} session Active MongoDB transaction session
 * @param {Object} [options]
 * @param {string|mongoose.Types.ObjectId} [options.excludeAppointmentId] Exclude self from appointment conflicts
 * @param {string|mongoose.Types.ObjectId} [options.excludeRoomBookingId] Exclude self from room booking conflicts
 * @returns {Promise<Object|null>} Returns conflict details or null if no conflict exists
 */
async function checkDoctorScheduleConflicts(doctorId, startDateTime, endDateTime, session, options = {}) {
    const { excludeAppointmentId = null, excludeRoomBookingId = null } = options;

    // ========================================================
    // TIER 1: ACTIVE ROOM BOOKINGS FOR THIS DOCTOR
    // ========================================================
    const roomBookingQuery = {
        doctor: doctorId,
        status: "Active",
        startDateTime: { $lt: endDateTime },
        endDateTime: { $gt: startDateTime }
    };
    if (excludeRoomBookingId) {
        roomBookingQuery._id = { $ne: excludeRoomBookingId };
    }

    const roomConflict = await RoomBooking.findOne(roomBookingQuery).session(session).lean();
    if (roomConflict) {
        return {
            hasConflict: true,
            tier: "TIER1_ROOM_BOOKING",
            reason: "Doctor has an overlapping active room reservation",
            conflictRecordId: roomConflict._id
        };
    }

    // ========================================================
    // TIER 2: CONFIRMED/PENDING APPOINTMENTS FOR THIS DOCTOR
    // ========================================================
    const apptQuery = {
        doctor: doctorId,
        status: { $in: ["Pending", "Confirmed"] },
        startDateTime: { $lt: endDateTime },
        endDateTime: { $gt: startDateTime }
    };
    if (excludeAppointmentId) {
        apptQuery._id = { $ne: excludeAppointmentId };
    }

    const apptConflict = await Appointment.findOne(apptQuery).session(session).lean();
    if (apptConflict) {
        return {
            hasConflict: true,
            tier: "TIER2_APPOINTMENT",
            reason: "Doctor has an overlapping patient appointment",
            conflictRecordId: apptConflict._id
        };
    }

    // ========================================================
    // TIER 3: UNCONFIRMED HISTORICAL APPOINTMENT WHOLE-DATE BLOCK
    // ========================================================
    const tier3Query = {
        doctor: doctorId,
        status: { $in: ["Pending", "Confirmed"] },
        isTimezoneUnconfirmed: true
    };
    if (excludeAppointmentId) {
        tier3Query._id = { $ne: excludeAppointmentId };
    }

    const unconfirmedAppointments = await Appointment.find(tier3Query)
        .select("_id date time")
        .session(session)
        .lean();

    for (const unconfirmed of unconfirmedAppointments) {
        if (!unconfirmed.date) continue;

        // Interpret legacy date as UTC midnight calendar date
        const y = unconfirmed.date.getUTCFullYear();
        const m = unconfirmed.date.getUTCMonth(); // 0-indexed
        const d = unconfirmed.date.getUTCDate();

        // Conservative global calendar date envelope:
        // Local day anywhere on Earth starts at UTC+14 (Date.UTC - 14h)
        // and ends at UTC-12 (Date.UTC + 36h)
        const envelopeStart = new Date(Date.UTC(y, m, d) - 14 * 60 * 60 * 1000);
        const envelopeEnd = new Date(Date.UTC(y, m, d) + 36 * 60 * 60 * 1000);

        // Check if proposed interval intersects the unconfirmed appointment's date envelope
        if (startDateTime < envelopeEnd && endDateTime > envelopeStart) {
            return {
                hasConflict: true,
                tier: "TIER3_HISTORICAL_DATE_BLOCK",
                reason: `Doctor has an unconfirmed historical appointment on date ${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")} blocking this entire date`,
                conflictRecordId: unconfirmed._id
            };
        }
    }

    return null; // Zero conflicts detected
}

module.exports = { checkDoctorScheduleConflicts };
