const mongoose = require("mongoose");

const roomBookingRequestSchema = new mongoose.Schema(
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

        queueGeneration: {
            type: Number,
            required: true,
            default: 0
        },

        sequenceNumber: {
            type: Number,
            required: true
        },

        status: {
            type: String,
            enum: [
                "PENDING",
                "ALLOCATED",
                "REJECTED_CONFLICT",
                "REJECTED_SUPERSEDED",
                "REJECTED_STALE",
                "REJECTED_DOCTOR_INELIGIBLE",
                "REJECTED_ORG_SUSPENDED",
                "REJECTED_UNAFFILIATED",
                "REJECTED_INVALID",
                "REJECTED_ROOM_MAINTENANCE",
                "CANCELLED"
            ],
            default: "PENDING"
        },

        rejectionReason: {
            type: String,
            default: null
        },

        allocatedBooking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RoomBooking",
            default: null
        },

        // Client idempotency key: Only stored when provided as a string; omitted when absent
        clientRequestId: {
            type: String,
            trim: true
        },

        requestedAt: {
            type: Date,
            default: Date.now
        },

        resolvedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// One active pending request per doctor per slot per queue generation
roomBookingRequestSchema.index(
    {
        roomSlot: 1,
        doctor: 1,
        queueGeneration: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            status: "PENDING"
        }
    }
);

// Idempotency key uniqueness per doctor (indexes only valid string values)
roomBookingRequestSchema.index(
    {
        doctor: 1,
        clientRequestId: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            clientRequestId: { $type: "string" }
        }
    }
);

// Strict FIFO queue ordering index
roomBookingRequestSchema.index({
    roomSlot: 1,
    queueGeneration: 1,
    sequenceNumber: 1
});

roomBookingRequestSchema.index({ doctor: 1, status: 1 });

module.exports = mongoose.model("RoomBookingRequest", roomBookingRequestSchema);
