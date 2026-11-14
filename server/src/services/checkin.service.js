const Appointment = require("../models/appointment.model");
const QueueCounter = require("../models/queueCounter.model");
const Room = require("../models/room.model");
const {
    APPOINTMENT_STATUS,
    ATTENDED_STATUSES,
    startOfLocalDay,
    localDateKey,
    formatLocal,
    resolveTimezone
} = require("../util/appointmentLifecycle.util");
const {
    generateNonce,
    deriveToken,
    hashToken,
    isWellFormedToken
} = require("../util/qrToken.util");

class CheckinError extends Error {
    constructor(code, statusCode, message) {
        super(message);
        this.name = "CheckinError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

// ------------------------------------------------------------------
// QR ISSUANCE (patient portal)
// ------------------------------------------------------------------

/**
 * Builds the QR fields for an appointment. Used when a doctor confirms an
 * appointment (inside the confirmation transaction) and for lazy issuance.
 */
function buildQrFields(appointmentId, endDateTime, now = new Date()) {
    const nonce = generateNonce();
    const token = deriveToken(appointmentId, nonce);
    return {
        qrNonce: nonce,
        qrTokenHash: hashToken(token),
        qrIssuedAt: now,
        qrExpiresAt: endDateTime ? new Date(endDateTime) : null
    };
}

const STATUS_MESSAGES_FOR_PATIENT_QR = {
    [APPOINTMENT_STATUS.PENDING]: "Your QR code becomes available once the doctor confirms your appointment.",
    [APPOINTMENT_STATUS.CHECKED_IN]: "You are already checked in. No QR code is needed.",
    [APPOINTMENT_STATUS.IN_PROGRESS]: "Your consultation is in progress.",
    [APPOINTMENT_STATUS.COMPLETED]: "This appointment is completed.",
    [APPOINTMENT_STATUS.CANCELLED]: "This appointment was cancelled.",
    [APPOINTMENT_STATUS.EXPIRED]: "This appointment has expired.",
    [APPOINTMENT_STATUS.NO_SHOW]: "This appointment was marked as a no-show."
};

/**
 * Returns the QR PNG (data URL) for a patient's confirmed hospital appointment.
 * The QR encodes only an opaque token. Nothing else is exposed.
 */
async function getPatientQr({ patientId, appointmentId, now = new Date() }) {
    const appt = await Appointment.findOne({ _id: appointmentId, patient: patientId })
        .select("+qrNonce +qrTokenHash");

    if (!appt) {
        throw new CheckinError("NOT_FOUND", 404, "Appointment not found.");
    }
    if (appt.bookingType !== "Organization" || !appt.organization) {
        throw new CheckinError("QR_NOT_APPLICABLE", 400, "QR check-in applies to hospital appointments only.");
    }
    if (appt.status !== APPOINTMENT_STATUS.CONFIRMED) {
        throw new CheckinError(
            "QR_NOT_AVAILABLE",
            409,
            STATUS_MESSAGES_FOR_PATIENT_QR[appt.status] || "QR code is not available for this appointment."
        );
    }
    if (!appt.endDateTime || appt.endDateTime.getTime() <= now.getTime()) {
        throw new CheckinError("QR_EXPIRED", 410, "This QR code has expired.");
    }

    let nonce = appt.qrNonce;

    if (!nonce || !appt.qrTokenHash) {
        // Lazy issuance (e.g. appointments confirmed before this feature shipped).
        const fields = buildQrFields(appt._id, appt.endDateTime, now);
        const res = await Appointment.updateOne(
            { _id: appt._id, qrTokenHash: null },
            { $set: fields }
        );
        if (res.modifiedCount === 1) {
            nonce = fields.qrNonce;
        } else {
            // Another request issued it first: use the stored nonce
            const fresh = await Appointment.findById(appt._id).select("+qrNonce");
            nonce = fresh && fresh.qrNonce;
        }
    }

    if (!nonce) {
        throw new CheckinError("QR_UNAVAILABLE", 500, "Could not issue QR code. Please try again.");
    }

    const token = deriveToken(appt._id, nonce);
    const QRCode = require("qrcode");
    const qrCodeDataUrl = await QRCode.toDataURL(token, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 320
    });

    return {
        qrCodeDataUrl,
        expiresAt: appt.endDateTime
    };
}

// ------------------------------------------------------------------
// QUEUE NUMBER
// ------------------------------------------------------------------

async function nextQueueNumber(organizationId, doctorId, dateKey) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const counter = await QueueCounter.findOneAndUpdate(
                { organization: organizationId, doctor: doctorId, dateKey },
                { $inc: { seq: 1 } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            return counter.seq;
        } catch (err) {
            // Two first-of-the-day check-ins can race on the upsert; retry.
            if (err && err.code === 11000 && attempt < 2) continue;
            throw err;
        }
    }
    throw new Error("Could not allocate queue number");
}

/** Assigns a queue number exactly once. Safe to call repeatedly / concurrently. */
async function ensureQueueNumber(appt) {
    if (appt.queueNumber) return appt;

    const dateKey = localDateKey(appt.startDateTime, appt.timezone);
    const number = await nextQueueNumber(appt.organization, appt.doctor, dateKey);

    const updated = await Appointment.findOneAndUpdate(
        { _id: appt._id, queueNumber: null },
        { $set: { queueNumber: number, queueDate: dateKey } },
        { new: true }
    );
    return updated || (await Appointment.findById(appt._id));
}

// ------------------------------------------------------------------
// TICKET
// ------------------------------------------------------------------

function formatQueueLabel(queueNumber) {
    return queueNumber ? `Q-${String(queueNumber).padStart(3, "0")}` : "—";
}

/**
 * Builds the printable consultation ticket. Room / floor are included here
 * because this is only ever returned to an authenticated hospital organization.
 */
async function buildTicket(appt) {
    await appt.populate([
        { path: "doctor", select: "name specialization" },
        { path: "patient", select: "name" },
        { path: "organization", select: "name timezone" }
    ]);
    const room = appt.room ? await Room.findById(appt.room).lean() : null;

    const tz = resolveTimezone(appt.timezone || (appt.organization && appt.organization.timezone));

    return {
        hospitalName: appt.organization ? appt.organization.name : "",
        patientName: appt.patient ? appt.patient.name : "",
        appointmentId: String(appt._id),
        appointmentRef: String(appt._id).slice(-8).toUpperCase(),
        doctorName: appt.doctor ? appt.doctor.name : "",
        doctorSpecialization: appt.doctor ? appt.doctor.specialization : "",
        appointmentDate: formatLocal(appt.startDateTime, tz, "dd LLL yyyy"),
        appointmentTime: `${formatLocal(appt.startDateTime, tz, "HH:mm")} - ${formatLocal(appt.endDateTime, tz, "HH:mm")}`,
        roomNumber: room ? room.roomNumber : null,
        floor: room && room.floor ? room.floor : null,
        department: room && room.department ? room.department : null,
        queueNumber: appt.queueNumber,
        queueLabel: formatQueueLabel(appt.queueNumber),
        checkInTime: appt.checkedInAt,
        checkInTimeDisplay: appt.checkedInAt ? formatLocal(appt.checkedInAt, tz, "dd LLL yyyy, HH:mm") : null,
        timezone: tz
    };
}

// ------------------------------------------------------------------
// CHECK-IN (organization portal)
// ------------------------------------------------------------------

function rejectionForStatus(status) {
    switch (status) {
        case APPOINTMENT_STATUS.CHECKED_IN:
        case APPOINTMENT_STATUS.IN_PROGRESS:
            return new CheckinError("ALREADY_CHECKED_IN", 409, "This patient has already been checked in.");
        case APPOINTMENT_STATUS.COMPLETED:
            return new CheckinError("APPOINTMENT_COMPLETED", 409, "This appointment is already completed.");
        case APPOINTMENT_STATUS.CANCELLED:
            return new CheckinError("APPOINTMENT_CANCELLED", 409, "This appointment was cancelled.");
        case APPOINTMENT_STATUS.EXPIRED:
        case APPOINTMENT_STATUS.NO_SHOW:
            return new CheckinError("QR_EXPIRED", 410, "This QR code has expired.");
        case APPOINTMENT_STATUS.PENDING:
            return new CheckinError("APPOINTMENT_NOT_CONFIRMED", 409, "This appointment has not been confirmed by the doctor.");
        default:
            return new CheckinError("INVALID_STATUS", 409, "This appointment cannot be checked in.");
    }
}

/**
 * Validates a scanned QR token for the authenticated hospital organization and,
 * if everything is valid, atomically moves the appointment to Checked-In.
 *
 * Concurrency: the status transition is ONE findOneAndUpdate whose filter holds
 * every precondition (status Confirmed, same organization, same token hash,
 * not yet ended). MongoDB guarantees only one concurrent caller can match it.
 */
async function checkInByToken({ organizationId, token, now = new Date() }) {
    if (!isWellFormedToken(token)) {
        throw new CheckinError("INVALID_QR", 400, "Invalid QR code.");
    }

    const tokenHash = hashToken(token);
    const appt = await Appointment.findOne({ qrTokenHash: tokenHash });

    if (!appt) {
        throw new CheckinError("INVALID_QR", 404, "Invalid QR code.");
    }

    if (!appt.organization || String(appt.organization) !== String(organizationId)) {
        throw new CheckinError("WRONG_HOSPITAL", 403, "This QR code is not valid for your hospital.");
    }

    if (appt.status !== APPOINTMENT_STATUS.CONFIRMED) {
        throw rejectionForStatus(appt.status);
    }

    const expiry = appt.qrExpiresAt || appt.endDateTime;
    if (!expiry || expiry.getTime() <= now.getTime() || !appt.endDateTime || appt.endDateTime.getTime() <= now.getTime()) {
        throw new CheckinError("QR_EXPIRED", 410, "This QR code has expired.");
    }

    // Check-in opens at the start of the appointment's (facility-local) day.
    const opensAt = startOfLocalDay(appt.startDateTime, appt.timezone);
    if (now.getTime() < opensAt.getTime()) {
        throw new CheckinError("CHECKIN_NOT_OPEN", 409, "Check-in opens on the day of the appointment.");
    }

    // ATOMIC CLAIM
    const claimed = await Appointment.findOneAndUpdate(
        {
            _id: appt._id,
            organization: organizationId,
            qrTokenHash: tokenHash,
            status: APPOINTMENT_STATUS.CONFIRMED,
            endDateTime: { $gt: now },
            checkedInAt: null
        },
        {
            $set: {
                status: APPOINTMENT_STATUS.CHECKED_IN,
                checkedInAt: now,
                checkedInBy: organizationId
            }
        },
        { new: true }
    );

    if (!claimed) {
        // Lost a race (or state changed between read and claim): report accurately.
        const current = await Appointment.findById(appt._id).select("status endDateTime");
        if (current && current.status === APPOINTMENT_STATUS.CONFIRMED) {
            throw new CheckinError("QR_EXPIRED", 410, "This QR code has expired.");
        }
        throw rejectionForStatus(current ? current.status : null);
    }

    const withQueue = await ensureQueueNumber(claimed);
    const ticket = await buildTicket(withQueue);

    return { appointment: withQueue, ticket };
}

/**
 * Re-renders the ticket of an already checked-in appointment of this
 * organization (e.g. paper jam). Does NOT create a new check-in or queue number.
 */
async function getTicketForReprint({ organizationId, appointmentId }) {
    const appt = await Appointment.findOne({ _id: appointmentId, organization: organizationId });
    if (!appt) {
        throw new CheckinError("NOT_FOUND", 404, "Appointment not found.");
    }
    if (!ATTENDED_STATUSES.includes(appt.status)) {
        throw new CheckinError("NOT_CHECKED_IN", 409, "Only checked-in appointments have a ticket.");
    }

    const withQueue = await ensureQueueNumber(appt);
    await Appointment.updateOne({ _id: withQueue._id }, { $inc: { ticketReprintCount: 1 } });
    return buildTicket(withQueue);
}

/** Today's checked-in patients of an organization (staff queue board). */
async function getDailyQueue({ organizationId, dateKey }) {
    const appts = await Appointment.find({
        organization: organizationId,
        queueDate: dateKey,
        status: { $in: ATTENDED_STATUSES }
    })
        .populate("doctor", "name specialization")
        .populate("patient", "name")
        .populate("room", "roomNumber floor department")
        .sort({ doctor: 1, queueNumber: 1 })
        .lean();

    return appts.map((a) => ({
        appointmentId: a._id,
        status: a.status,
        queueNumber: a.queueNumber,
        queueLabel: formatQueueLabel(a.queueNumber),
        patientName: a.patient ? a.patient.name : "",
        doctorName: a.doctor ? a.doctor.name : "",
        doctorSpecialization: a.doctor ? a.doctor.specialization : "",
        roomNumber: a.room ? a.room.roomNumber : null,
        floor: a.room ? a.room.floor : null,
        appointmentTime: `${formatLocal(a.startDateTime, a.timezone, "HH:mm")} - ${formatLocal(a.endDateTime, a.timezone, "HH:mm")}`,
        checkedInAt: a.checkedInAt
    }));
}

// ------------------------------------------------------------------
// DOCTOR STARTS CONSULTATION
// ------------------------------------------------------------------

async function startConsultation({ doctorId, appointmentId, now = new Date() }) {
    const updated = await Appointment.findOneAndUpdate(
        {
            _id: appointmentId,
            doctor: doctorId,
            status: APPOINTMENT_STATUS.CHECKED_IN
        },
        {
            $set: {
                status: APPOINTMENT_STATUS.IN_PROGRESS,
                consultationStartedAt: now
            }
        },
        { new: true }
    );

    if (!updated) {
        const existing = await Appointment.findOne({ _id: appointmentId, doctor: doctorId }).select("status");
        if (!existing) {
            throw new CheckinError("NOT_FOUND", 404, "Appointment not found or you are not authorized to update it.");
        }
        if (existing.status === APPOINTMENT_STATUS.IN_PROGRESS) {
            throw new CheckinError("ALREADY_IN_PROGRESS", 409, "Consultation is already in progress.");
        }
        throw new CheckinError(
            "NOT_CHECKED_IN",
            409,
            `A consultation can only be started for a checked-in patient (current status: ${existing.status}).`
        );
    }

    return updated;
}

module.exports = {
    CheckinError,
    buildQrFields,
    getPatientQr,
    ensureQueueNumber,
    buildTicket,
    checkInByToken,
    getTicketForReprint,
    getDailyQueue,
    startConsultation,
    formatQueueLabel
};
