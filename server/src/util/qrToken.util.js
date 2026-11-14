const crypto = require("crypto");

/**
 * QR token helpers for hospital check-in.
 *
 * Design
 * ------
 * - Each appointment gets a random 128-bit nonce (stored on the appointment,
 *   never sent to clients).
 * - The QR token is  "mc1_" + base64url( HMAC-SHA256(secret, "qr:v1:" + appointmentId + ":" + nonce) ).
 *   It is unpredictable without the server secret, contains no database IDs or
 *   personal data, and can be re-derived by the server so the patient can
 *   re-open their QR code later without the token ever being stored in clear.
 * - Only SHA-256(token) is persisted (qrTokenHash) and used for lookups.
 */

const TOKEN_PREFIX = "mc1_";
const TOKEN_REGEX = /^mc1_[A-Za-z0-9_-]{43}$/;

function getSecret() {
    const secret = process.env.QR_TOKEN_SECRET || process.env.JWT_TOKEN_SECRET;
    if (!secret) {
        throw new Error("QR_TOKEN_SECRET (or JWT_TOKEN_SECRET) must be configured to issue QR codes.");
    }
    return secret;
}

function generateNonce() {
    return crypto.randomBytes(16).toString("hex");
}

function deriveToken(appointmentId, nonce) {
    const mac = crypto
        .createHmac("sha256", getSecret())
        .update(`qr:v1:${String(appointmentId)}:${String(nonce)}`)
        .digest("base64url");
    return `${TOKEN_PREFIX}${mac}`;
}

function hashToken(token) {
    return crypto.createHash("sha256").update(String(token), "utf8").digest("hex");
}

function isWellFormedToken(token) {
    return typeof token === "string" && TOKEN_REGEX.test(token);
}

module.exports = {
    TOKEN_PREFIX,
    generateNonce,
    deriveToken,
    hashToken,
    isWellFormedToken
};
