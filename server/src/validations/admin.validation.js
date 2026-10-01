const { z } = require("zod");


// =========================
// COMMON EMAIL VALIDATION
// =========================

const emailSchema = z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((email) => email.toLowerCase());


// =========================
// AUTH
// =========================

// Admin Register
const registerSchema = z.object({

    email: emailSchema,

    password: z
        .string()
        .min(8, "Password must contain at least 8 characters")
        .max(100, "Password cannot exceed 100 characters")

});


// Admin Login
const loginSchema = z.object({

    email: emailSchema,

    password: z
        .string()
        .min(1, "Password is required")

});


// =========================
// PASSWORD RESET
// =========================

// Send reset OTP
const sendResetOTPSchema = z.object({

    email: emailSchema

});


// Verify reset OTP
const verifyResetOTPSchema = z.object({

    email: emailSchema,

    OTP: z
        .string()
        .regex(
            /^\d{6}$/,
            "OTP must be a 6-digit number"
        )

});


// Change password
const changePasswordSchema = z.object({

    email: emailSchema,

    OTP: z
        .string()
        .regex(
            /^\d{6}$/,
            "OTP must be a 6-digit number"
        ),

    newpassword: z
        .string()
        .min(8, "New password must contain at least 8 characters")
        .max(100, "New password cannot exceed 100 characters")

});


// =========================
// DOCTOR VERIFICATION
// =========================
const doctorVerificationSchema = z.object({
    doctorId: z
        .string()
        .regex(
            /^[0-9a-fA-F]{24}$/,
            "Invalid Doctor ID"
        ),

    isVerified: z.boolean()
});


const doctorBlockSchema = z.object({
    doctorId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Doctor ID"),
    isBlocked: z.boolean()
});

const patientBlockSchema = z.object({
    patientId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Patient ID"),
    isBlocked: z.boolean()
});


// =========================
// EXPORT
// =========================

module.exports = {

    registerSchema,
    loginSchema,

    sendResetOTPSchema,
    verifyResetOTPSchema,
    changePasswordSchema,

    doctorVerificationSchema,
    doctorBlockSchema,
    patientBlockSchema

};