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

// Doctor Register
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
        .max(100, "Password cannot exceed 100 characters"),

    phone: z
        .string()
        .trim()
        .regex(
            /^[6-9]\d{9}$/,
            "Invalid Indian phone number"
        )
        .optional(),

    nmrNumber: z
        .string()
        .trim()
        .min(1, "NMR Number is required"),

    specialization: z
        .string()
        .trim()
        .min(2, "Specialization is required")
        .max(100, "Specialization cannot exceed 100 characters"),

    experience: z
        .coerce
        .number()
        .int("Experience must be a whole number")
        .min(0, "Experience cannot be negative")
        .max(70, "Invalid experience"),

    qualification: z
        .string()
        .trim()
        .min(2, "Qualification is required")
        .max(100, "Qualification cannot exceed 100 characters"),

    consultationFee: z
        .coerce
        .number()
        .min(0, "Consultation fee cannot be negative"),

    locationState: z
        .string()
        .trim()
        .min(2, "State is required"),
        
    locationCity: z
        .string()
        .trim()
        .min(2, "City/Town/Village is required")

});


// Doctor Login
const loginSchema = z.object({

    email: emailSchema,

    password: z
        .string()
        .min(1, "Password is required")

});


// =========================
// EMAIL VERIFICATION OTP
// =========================

const verifyEmailOTPSchema = z.object({

    OTP: z
        .string()
        .regex(
            /^\d{6}$/,
            "OTP must be a 6-digit number"
        )

});


// =========================
// UPDATE PROFILE
// =========================

const updateDoctorProfileSchema = z.object({

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

        specialization: z
            .string()
            .trim()
            .min(2, "Specialization must contain at least 2 characters")
            .max(100)
            .optional(),

        experience: z
            .coerce
            .number()
            .int("Experience must be a whole number")
            .min(0, "Experience cannot be negative")
            .max(70, "Invalid experience")
            .optional(),

        qualification: z
            .string()
            .trim()
            .min(2, "Qualification must contain at least 2 characters")
            .max(100)
            .optional(),

        consultationFee: z
            .coerce
            .number()
            .min(0, "Consultation fee cannot be negative")
            .optional(),

        locationState: z
            .string()
            .trim()
            .min(2, "State must contain at least 2 characters")
            .optional(),
            
        locationCity: z
            .string()
            .trim()
            .min(2, "City/Town/Village must contain at least 2 characters")
            .optional(),

        bio: z
            .string()
            .trim()
            .max(1000, "Bio cannot exceed 1000 characters")
            .optional(),
            
        clinicLocation: z
            .object({
                address: z.string().trim().min(5, "Address is too short"),
                latitude: z.number().min(-90).max(90),
                longitude: z.number().min(-180).max(180)
            })
            .optional()

            })
            .refine(
                (data) => Object.keys(data).length > 0,
                {
                    message: "At least one field is required to update the profile"
                }
            );


// =========================
// AVAILABILITY
// =========================

const timeSlotSchema = z.enum([
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00"
]);


const availabilitySchema = z.object({

    sunday: z.array(timeSlotSchema).optional(),

    monday: z.array(timeSlotSchema).optional(),

    tuesday: z.array(timeSlotSchema).optional(),

    wednesday: z.array(timeSlotSchema).optional(),

    thursday: z.array(timeSlotSchema).optional(),

    friday: z.array(timeSlotSchema).optional(),

    saturday: z.array(timeSlotSchema).optional()

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
// APPOINTMENT
// =========================

// Appointment ID
const appointmentStatusSchema = z.object({

    appointmentId: z
        .string()
        .regex(
            /^[0-9a-fA-F]{24}$/,
            "Invalid appointment ID"
        ),

    status: z.enum(
        ["confirmed", "cancelled"],
        "Status must be confirmed or cancelled"
    )

});


// =========================
// EXPORT
// =========================

module.exports = {

    registerSchema,
    loginSchema,

    verifyEmailOTPSchema,

    updateDoctorProfileSchema,
    availabilitySchema,

    sendResetOTPSchema,
    verifyResetOTPSchema,
    changePasswordSchema,

    appointmentStatusSchema

};