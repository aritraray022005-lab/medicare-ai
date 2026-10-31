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
        },


        // =========================
        // ORGANIZATION MANAGEMENT & VENUE
        // =========================

        bookingType: {
            type: String,
            enum: ["Independent", "Organization"],
            default: "Independent"
        },

        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            default: null
        },

        room: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room",
            default: null
        },

        roomSlot: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RoomSlot",
            default: null
        },

        roomBooking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RoomBooking",
            default: null
        },


        // =========================
        // CANONICAL UTC SCHEDULE INTERVAL
        // =========================

        startDateTime: {
            type: Date,
            default: null
        },

        endDateTime: {
            type: Date,
            default: null
        },

        timezone: {
            type: String,
            default: null
        },

        isTimezoneUnconfirmed: {
            type: Boolean,
            default: false
        },

        isDurationEstimated: {
            type: Boolean,
            default: false
        },


        // =========================
        // CANCELLATION AUDIT
        // =========================

        cancellationReason: {
            type: String,
            default: null
        },

        cancelledBy: {
            type: String,
            enum: ["Patient", "Doctor", "Admin", "System"],
            default: null
        },

        cancelledAt: {
            type: Date,
            default: null
        },


        // =========================
        // MIGRATION TRACKING
        // =========================

        migrationBatchId: {
            type: String,
            default: null
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


// ========================================
// CANONICAL UTC SCHEDULE INTERVAL INDEX
// ========================================

appointmentSchema.index(
    {
        doctor: 1,
        startDateTime: 1,
        endDateTime: 1
    },
    {
        partialFilterExpression: {
            startDateTime: { $exists: true },
            status: {
                $in: ["Pending", "Confirmed"]
            }
        }
    }
);


// ========================================
// ROOM BOOKING LOOKUP INDEX
// ========================================

appointmentSchema.index(
    {
        roomBooking: 1
    },
    {
        sparse: true
    }
);


// ========================================
// PATIENT APPOINTMENTS INDEX
// ========================================

appointmentSchema.index(
    {
        patient: 1,
        status: 1
    }
);


// ========================================
// ORGANIZATION APPOINTMENTS INDEX
// ========================================

appointmentSchema.index(
    {
        organization: 1,
        status: 1
    }
);


module.exports = mongoose.model(
    "Appointment",
    appointmentSchema
);