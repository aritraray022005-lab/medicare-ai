const mongoose = require("mongoose");

const roomBookingSchema = new mongoose.Schema(
    {
        roomSlot: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RoomSlot",
            required: true
        },

        room: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room",
            required: true
        },

        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },

        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Doctor",
            required: true
        },

        startDateTime: {
            type: Date,
            required: true // Canonical UTC start timestamp
        },

        endDateTime: {
            type: Date,
            required: true // Canonical UTC end timestamp
        },

        status: {
            type: String,
            enum: ["Active", "Completed", "Cancelled"],
            default: "Active"
        },

        cancellationReason: {
            type: String,
            default: null
        },

        timezone: {
            type: String,
            default: "UTC"
        },

        request: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RoomBookingRequest",
            default: null
        },

        allocatedAt: {
            type: Date,
            default: Date.now
        },

        cancelledBy: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        cancelledByType: {
            type: String,
            enum: ["Doctor", "Organization", "Admin", null],
            default: null
        },

        cancelledAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Only one active reservation per slot
roomBookingSchema.index(
    {
        roomSlot: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            status: "Active"
        }
    }
);

// Doctor active bookings schedule interval index
roomBookingSchema.index(
    {
        doctor: 1,
        startDateTime: 1,
        endDateTime: 1
    },
    {
        partialFilterExpression: {
            status: "Active"
        }
    }
);

roomBookingSchema.index({ organization: 1, status: 1 });

module.exports = mongoose.model("RoomBooking", roomBookingSchema);
