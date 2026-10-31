const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },

        roomNumber: {
            type: String,
            required: true,
            trim: true
        },

        floor: {
            type: String,
            default: "",
            trim: true
        },

        department: {
            type: String,
            default: "",
            trim: true
        },

        capacity: {
            type: Number,
            default: 1,
            min: 1
        },

        type: {
            type: String,
            default: "Consultation Room",
            trim: true
        },

        isOperational: {
            type: Boolean,
            default: true
        },

        scheduleVersion: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

// One unique room number per organization
roomSchema.index(
    {
        organization: 1,
        roomNumber: 1
    },
    {
        unique: true
    }
);

roomSchema.index({ organization: 1, isOperational: 1 });

module.exports = mongoose.model("Room", roomSchema);
