const mongoose = require("mongoose");

const roomSlotSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },

        room: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room",
            required: true
        },

        date: {
            type: Date,
            required: true // UTC midnight representing facility local calendar date
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
            enum: ["Available", "Queued", "Reserved", "Maintenance"],
            default: "Available"
        },

        timezone: {
            type: String,
            default: "Asia/Kolkata"
        },

        localStartTime: {
            type: String,
            default: ""
        },

        localEndTime: {
            type: String,
            default: ""
        },

        activeBooking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RoomBooking",
            default: null
        },

        queueGeneration: {
            type: Number,
            default: 0
        },

        queueSequenceCounter: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

// One unique slot per room and exact time interval
roomSlotSchema.index(
    {
        room: 1,
        startDateTime: 1,
        endDateTime: 1
    },
    {
        unique: true
    }
);

roomSlotSchema.index({ organization: 1, status: 1, startDateTime: 1 });
roomSlotSchema.index({ room: 1, date: 1 });

module.exports = mongoose.model("RoomSlot", roomSlotSchema);
