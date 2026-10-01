const { z } = require("zod");


// =====================================================
// COMMON VALIDATIONS
// =====================================================

const emailSchema = z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((email) => email.toLowerCase());


// =====================================================
// REGISTER
// =====================================================

const registerSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Name must contain at least 2 characters")
        .max(100, "Name cannot exceed 100 characters"),

    email: emailSchema,

    password: z
        .string()
        .min(8, "Password must contain at least 8 characters")
        .max(100, "Password cannot exceed 100 characters")
});


// =====================================================
// LOGIN
// =====================================================

const loginSchema = z.object({
    email: emailSchema,

    password: z
        .string()
        .min(1, "Password is required")
});


// =====================================================
// VERIFY EMAIL OTP
// =====================================================

const verifyEmailOTPSchema = z.object({
    OTP: z
        .string()
        .regex(/^\d{6}$/, "OTP must be a 6-digit number")
});


// =====================================================
// SEND RESET PASSWORD OTP
// =====================================================

const sendResetOTPSchema = z.object({
    email: emailSchema
});


// =====================================================
// VERIFY RESET PASSWORD OTP
// =====================================================

const verifyResetOTPSchema = z.object({
    email: emailSchema,

    OTP: z
        .string()
        .regex(/^\d{6}$/, "OTP must be a 6-digit number")
});


// =====================================================
// CHANGE PASSWORD
// =====================================================

const changePasswordSchema = z.object({
    email: emailSchema,

    OTP: z
        .string()
        .regex(/^\d{6}$/, "OTP must be a 6-digit number"),

    newpassword: z
        .string()
        .min(8, "New password must contain at least 8 characters")
        .max(100, "New password cannot exceed 100 characters")
});


// =====================================================
// UPDATE PATIENT PROFILE
// =====================================================

const updatePatientProfileSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(2, "Name must contain at least 2 characters")
            .max(100, "Name cannot exceed 100 characters")
            .optional(),

        phone: z
            .string()
            .trim()
            .regex(
                /^[6-9]\d{9}$/,
                "Invalid Indian phone number"
            )
            .optional(),

        age: z
            .string()
            .or(z.number())
            .optional(),

        dateOfBirth: z
            .string()
            .regex(
                /^\d{4}-\d{2}-\d{2}$/,
                "Date of birth must be in YYYY-MM-DD format"
            )
            .optional(),

        gender: z
            .enum(["Male", "Female", "Other"])
            .optional(),

        address: z
            .string()
            .trim()
            .max(500, "Address cannot exceed 500 characters")
            .optional()
    })
    .refine(
        (data) => Object.keys(data).length > 0,
        {
            message: "At least one field is required to update the profile"
        }
    );


// =====================================================
// BOOK APPOINTMENT
// =====================================================

const bookAppointmentSchema = z.object({
    doctorId: z
        .string()
        .regex(
            /^[0-9a-fA-F]{24}$/,
            "Invalid Doctor ID"
        ),

    date: z
        .string()
        .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date must be in YYYY-MM-DD format"
        ),

    time: z
        .string()
        .regex(
            /^([01]\d|2[0-3]):[0-5]\d$/,
            "Time must be in HH:mm format"
        ),

    reason: z
        .string()
        .trim()
        .max(
            500,
            "Reason cannot exceed 500 characters"
        )
        .optional()
});


// =====================================================
// CANCEL APPOINTMENT
// =====================================================

const cancelAppointmentSchema = z.object({
    appointmentId: z
        .string()
        .regex(
            /^[0-9a-fA-F]{24}$/,
            "Invalid Appointment ID"
        )
});


module.exports = {
    registerSchema,
    loginSchema,
    verifyEmailOTPSchema,
    sendResetOTPSchema,
    verifyResetOTPSchema,
    changePasswordSchema,
    updatePatientProfileSchema,
    bookAppointmentSchema,
    cancelAppointmentSchema
};