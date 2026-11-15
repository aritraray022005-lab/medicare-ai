const mongoose = require("mongoose");
const checkinService = require("../services/checkin.service");
const { CheckinError } = checkinService;
const { localDateKey, resolveTimezone } = require("../util/appointmentLifecycle.util");

function handleError(res, error, fallbackMessage) {
    if (error instanceof CheckinError) {
        return res.status(error.statusCode).json({
            status: "failed",
            code: error.code,
            msg: error.message
        });
    }
    console.error(fallbackMessage, error);
    return res.status(500).json({
        status: "failed",
        msg: fallbackMessage
    });
}

// ------------------------------------------------------------------
// PATIENT PORTAL: GET /api/patients/appointment/:appointmentId/qr
// ------------------------------------------------------------------
const getAppointmentQr = async (req, res) => {
    try {
        const patientId = req.userDetails?._id;
        if (!patientId) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const { appointmentId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            return res.status(400).json({ status: "failed", msg: "Invalid Appointment ID format." });
        }

        const qr = await checkinService.getPatientQr({ patientId, appointmentId });

        res.set("Cache-Control", "no-store");
        return res.status(200).json({
            status: "success",
            qrCodeDataUrl: qr.qrCodeDataUrl,
            expiresAt: qr.expiresAt
        });
    } catch (error) {
        return handleError(res, error, "Failed to generate QR code.");
    }
};

// ------------------------------------------------------------------
// ORGANIZATION PORTAL: POST /api/organizations/checkin/scan
// ------------------------------------------------------------------
const scanQr = async (req, res) => {
    try {
        // Organization identity comes ONLY from the authenticated session.
        const organizationId = req.organization._id;

        const { appointment, ticket } = await checkinService.checkInByToken({
            organizationId,
            token: req.body.token
        });

        res.set("Cache-Control", "no-store");
        return res.status(200).json({
            status: "success",
            msg: "Patient checked in successfully.",
            appointment: {
                _id: appointment._id,
                status: appointment.status,
                checkedInAt: appointment.checkedInAt,
                queueNumber: appointment.queueNumber
            },
            consultation: {
                roomNumber: ticket.roomNumber,
                floor: ticket.floor,
                department: ticket.department,
                doctorName: ticket.doctorName,
                doctorSpecialization: ticket.doctorSpecialization,
                patientName: ticket.patientName,
                queueNumber: ticket.queueNumber,
                queueLabel: ticket.queueLabel
            },
            ticket
        });
    } catch (error) {
        return handleError(res, error, "Check-in failed. Please try again.");
    }
};

// ------------------------------------------------------------------
// ORGANIZATION PORTAL: GET /api/organizations/checkin/queue?date=YYYY-MM-DD
// ------------------------------------------------------------------
const getQueue = async (req, res) => {
    try {
        const organizationId = req.organization._id;
        const tz = resolveTimezone(req.organization.timezone);

        let dateKey = localDateKey(new Date(), tz);
        if (req.query.date) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date))) {
                return res.status(400).json({ status: "failed", msg: "date must be YYYY-MM-DD." });
            }
            dateKey = String(req.query.date);
        }

        const queue = await checkinService.getDailyQueue({ organizationId, dateKey, timezone: tz });
        return res.status(200).json({ status: "success", date: dateKey, count: queue.length, queue });
    } catch (error) {
        return handleError(res, error, "Failed to load queue.");
    }
};

// ------------------------------------------------------------------
// ORGANIZATION PORTAL: GET /api/organizations/checkin/appointments/:appointmentId/ticket
// (re-print only; never creates a second check-in or queue number)
// ------------------------------------------------------------------
const reprintTicket = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            return res.status(400).json({ status: "failed", msg: "Invalid Appointment ID format." });
        }

        const ticket = await checkinService.getTicketForReprint({
            organizationId: req.organization._id,
            appointmentId
        });
        res.set("Cache-Control", "no-store");
        return res.status(200).json({ status: "success", ticket });
    } catch (error) {
        return handleError(res, error, "Failed to load ticket.");
    }
};

// ------------------------------------------------------------------
// DOCTOR PORTAL: PATCH /api/doctors/appointment/start
// ------------------------------------------------------------------
const startConsultation = async (req, res) => {
    try {
        const doctorId = req.userDetails?._id || req.userDetails?.id;
        if (!doctorId) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const appointment = await checkinService.startConsultation({
            doctorId,
            appointmentId: req.body.appointmentId
        });

        return res.status(200).json({
            status: "success",
            msg: "Consultation started.",
            data: {
                _id: appointment._id,
                status: appointment.status,
                consultationStartedAt: appointment.consultationStartedAt
            }
        });
    } catch (error) {
        return handleError(res, error, "Failed to start consultation.");
    }
};

module.exports = {
    getAppointmentQr,
    scanQr,
    getQueue,
    reprintTicket,
    startConsultation
};
