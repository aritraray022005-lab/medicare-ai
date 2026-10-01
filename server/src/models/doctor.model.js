const mongoose = require("mongoose");
const bcrypt = require("bcrypt");




// ========================================
// DOCTOR SCHEMA
// ========================================

const doctorSchema = new mongoose.Schema(
    {
        // =========================
        // BASIC INFORMATION
        // =========================

        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        phone: {
            type: String,
            trim: true
        },


        // =========================
        // PROFESSIONAL INFORMATION
        // =========================

        nmrNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        profilePicture: {
            type: String,
            default: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" // Default user icon
        },

        medicalRegistrationCertificate: {
            type: String, // Will store path to the uploaded PDF
            // required: true
        },

        specialization: {
            type: String,
            required: true,
            trim: true,
            enum: [
                "General Physician",
                "Cardiologist",
                "Dermatologist",
                "Neurologist",
                "Orthopedic",
                "Pediatrician",
                "Gynecologist",
                "Psychiatrist",
                "ENT Specialist",
                "Ophthalmologist",
                "Dentist",
                "Gastroenterologist",
                "Pulmonologist",
                "Nephrologist",
                "Urologist",
                "Endocrinologist",
                "Oncologist",
                "Radiologist",
                "Anesthesiologist",
                "General Surgeon"
            ]
        },

        experience: {
            type: Number,
            required: true,
            min: 0
        },

        qualification: {
            type: String,
            required: true,
            trim: true,
            enum: [
                "MBBS",
                "BDS",
                "BAMS",
                "BHMS",
                "BUMS",
                "BSMS",
                "MD",
                "MS",
                "DNB",
                "MDS",
                "DM",
                "MCh",
                "Others"
            ]
        },

        consultationFee: {
            type: Number,
            required: true,
            min: 0
        },

        location: {
            state: {
                type: String,
                required: true,
                trim: true
            },
            cityTownVillage: {
                type: String,
                required: true,
                trim: true
            }
        },

        bio: {
            type: String,
            trim: true,
            default: ""
        },

        clinicLocation: {
            address: {
                type: String,
                trim: true
            },
            latitude: {
                type: Number
            },
            longitude: {
                type: Number
            }
        },


        // =========================
        // DOCTOR AVAILABILITY
        // =========================

        availability: {
            sunday: {
                type: [String],
                default: () => []
            },

            monday: {
                type: [String],
                default: () => []
            },

            tuesday: {
                type: [String],
                default: () => []
            },

            wednesday: {
                type: [String],
                default: () => []
            },

            thursday: {
                type: [String],
                default: () => []
            },

            friday: {
                type: [String],
                default: () => []
            },

            saturday: {
                type: [String],
                default: () => []
            }
        },


        // =========================
        // RATING
        // =========================

        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },

        reviewCount: {
            type: Number,
            default: 0,
            min: 0
        },


        // =========================
        // AUTHENTICATION
        // =========================

        password: {
            type: String,
            required: true
        },


        // =========================
        // VERIFICATION
        // =========================

        isEmailVerified: {
            type: Boolean,
            default: false
        },

        isVerifiedByAdmin: {
            type: Boolean,
            default: false
        },

        isBlocked: {
            type: Boolean,
            default: false
        },

        // =========================
        // PASSWORD RESET
        // =========================

        resetOTP: {
            type: String
        },

        OTPExpiry: {
            type: Date
        }
    },

    {
        timestamps: true
    }
);


// ========================================
// HASH PASSWORD BEFORE SAVING
// ========================================

doctorSchema.pre("save", async function () {

    if (!this.isModified("password")) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 10);
});


// ========================================
// COMPARE PASSWORD DURING LOGIN
// ========================================

doctorSchema.methods.comparePassword = async function (enteredPassword) {

    return await bcrypt.compare(
        enteredPassword,
        this.password
    );
};


module.exports = mongoose.model("Doctor", doctorSchema);