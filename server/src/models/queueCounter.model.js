const mongoose = require("mongoose");

/**
 * Daily queue-token counter. One document per (organization, doctor, local day).
 * The sequence is advanced with an atomic $inc so concurrent check-ins can never
 * receive the same queue number.
 */
const queueCounterSchema = new mongoose.Schema(
    {
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

        // Facility-local calendar date, e.g. "2026-11-12"
        dateKey: {
            type: String,
            required: true
        },

        seq: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

queueCounterSchema.index(
    { organization: 1, doctor: 1, dateKey: 1 },
    { unique: true }
);

module.exports = mongoose.model("QueueCounter", queueCounterSchema);
