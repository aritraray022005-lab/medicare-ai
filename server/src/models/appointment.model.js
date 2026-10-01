const mongoose = require("mongoose");


// ========================================
// APPOINTMENT SCHEMA
// ========================================

const appointmentSchema = new mongoose.Schema(
    {
        // =========================
        // PATIENT
        // =========================

        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true
        },


        // =========================
        // DOCTOR
        // =========================

        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Doctor",
            required: true
        },


        // =========================
        // APPOINTMENT DATE
        // =========================

        date: {
            type: Date,
            required: true
        },


        // =========================
        // APPOINTMENT TIME
        // =========================

        time: {
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):([0-5]\d)$/
        },


        // =========================
        // REASON
        // =========================

        reason: {
            type: String,
            trim: true,
            default: ""
        },


        // =========================
        // STATUS
        // =========================

        status: {
            type: String,
            enum: [
                "Pending",
                "Confirmed",
                "Cancelled",
                "Expired"
            ],
            default: "Pending"
        }
    },

    {
        timestamps: true
    }
);


// ========================================
// ONE ACTIVE BOOKING PER DOCTOR + DATE + TIME
// ========================================

appointmentSchema.index(
    {
        doctor: 1,
        date: 1,
        time: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            status: {
                $in: ["Pending", "Confirmed"]
            }
        }
    }
);


module.exports = mongoose.model(
    "Appointment",
    appointmentSchema
);