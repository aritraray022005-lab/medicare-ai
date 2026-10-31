const { z } = require("zod");

// =========================
// COMMON SCHEMAS
// =========================

const emailSchema = z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((email) => email.toLowerCase());

const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

// =========================
// ORGANIZATION AUTH SCHEMAS
// =========================

const registerSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Organization name must be at least 2 characters")
        .max(150, "Organization name cannot exceed 150 characters"),

    email: emailSchema,

    phone: z
        .string()
        .trim()
        .min(7, "Phone number must be at least 7 characters")
        .max(20, "Phone number cannot exceed 20 characters"),

    password: z
        .string()
        .min(8, "Password must contain at least 8 characters")
        .max(100, "Password cannot exceed 100 characters"),

    type: z.enum(["Hospital", "Clinic", "Medical Centre"], {
        errorMap: () => ({ message: "Type must be Hospital, Clinic, or Medical Centre" })
    }),

    registrationNumber: z
        .string()
        .trim()
        .min(2, "Registration number must be at least 2 characters")
        .max(100, "Registration number cannot exceed 100 characters"),

    address: z.object({
        street: z.string().trim().optional().default(""),
        city: z.string().trim().min(1, "City is required"),
        state: z.string().trim().min(1, "State is required"),
        postalCode: z.string().trim().optional().default(""),
        country: z.string().trim().optional().default("India")
    }),

    timezone: z.string().trim().optional().default("Asia/Kolkata"),

    location: z
        .object({
            type: z.enum(["Point"]).optional().default("Point"),
            coordinates: z.array(z.number()).length(2).optional().default([0, 0])
        })
        .optional()
});

const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, "Password is required")
});

const verifyEmailSchema = z.object({
    email: emailSchema,
    otp: z.string().regex(/^\d{6}$/, "OTP must be a 6-digit number")
});

const resendOtpSchema = z.object({
    email: emailSchema
});

const updateProfileSchema = z.object({
    name: z.string().trim().min(2).max(150).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    address: z
        .object({
            street: z.string().trim().optional(),
            city: z.string().trim().min(1).optional(),
            state: z.string().trim().min(1).optional(),
            postalCode: z.string().trim().optional(),
            country: z.string().trim().optional()
        })
        .optional(),
    timezone: z.string().trim().optional(),
    location: z
        .object({
            type: z.enum(["Point"]).optional(),
            coordinates: z.array(z.number()).length(2).optional()
        })
        .optional()
});

// =========================
// ADMIN CONTROL SCHEMAS
// =========================

const organizationVerificationSchema = z.object({
    organizationId: objectIdSchema,
    isVerified: z.boolean(),
    reason: z.string().trim().optional()
});

const organizationBlockSchema = z.object({
    organizationId: objectIdSchema,
    isBlocked: z.boolean(),
    reason: z.string().trim().optional()
});

module.exports = {
    emailSchema,
    registerSchema,
    loginSchema,
    verifyEmailSchema,
    resendOtpSchema,
    updateProfileSchema,
    organizationVerificationSchema,
    organizationBlockSchema
};
