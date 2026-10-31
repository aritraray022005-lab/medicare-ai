const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const organizationSchema = new mongoose.Schema(
    {
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
            required: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        type: {
            type: String,
            required: true,
            enum: ["Hospital", "Clinic", "Medical Centre"]
        },

        registrationNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        address: {
            street: { type: String, default: "", trim: true },
            city: { type: String, required: true, trim: true },
            state: { type: String, required: true, trim: true },
            postalCode: { type: String, default: "", trim: true },
            country: { type: String, default: "India", trim: true }
        },

        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point"
            },
            coordinates: {
                type: [Number],
                default: [0, 0]
            }
        },

        timezone: {
            type: String,
            required: true,
            default: "Asia/Kolkata"
        },

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

        scheduleVersion: {
            type: Number,
            default: 0
        },

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

// Password hashing pre-save hook
organizationSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }
    this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method
organizationSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// 2dsphere index for location queries
organizationSchema.index({ "location.coordinates": "2dsphere" }, { sparse: true });

module.exports = mongoose.model("Organization", organizationSchema);
