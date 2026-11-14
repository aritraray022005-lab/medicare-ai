const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// QR payload is an opaque token (see util/qrToken.util.js). Length is bounded
// so oversized payloads are rejected before any database work happens.
const scanQrSchema = z.object({
    token: z
        .string({ error: "QR token is required" })
        .trim()
        .min(10, "Invalid QR code")
        .max(200, "Invalid QR code")
});

const startConsultationSchema = z.object({
    appointmentId: z
        .string()
        .regex(objectIdRegex, "Invalid appointment ID")
});

module.exports = {
    scanQrSchema,
    startConsultationSchema
};
