const mongoose = require("mongoose");

const durableJobSchema = new mongoose.Schema(
    {
        jobType: {
            type: String,
            required: true,
            enum: [
                "FCFS_SLOT_ALLOCATION",
                "APPOINTMENT_CANCELLATION_CASCADE"
            ]
        },

        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        payload: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({})
        },

        status: {
            type: String,
            enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
            default: "PENDING"
        },

        workerId: {
            type: String,
            default: null
        },

        leaseToken: {
            type: String,
            default: null
        },

        lockedUntil: {
            type: Date,
            default: null
        },

        attempts: {
            type: Number,
            default: 0
        },

        maxAttempts: {
            type: Number,
            default: 5
        },

        lastError: {
            type: String,
            default: null
        },

        completedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Idempotency: At most one active (PENDING or PROCESSING) job per (jobType, targetId)
durableJobSchema.index(
    {
        jobType: 1,
        targetId: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            status: { $in: ["PENDING", "PROCESSING"] }
        }
    }
);

// Worker polling index: find eligible jobs by status and expiration
durableJobSchema.index({
    status: 1,
    lockedUntil: 1,
    createdAt: 1
});

module.exports = mongoose.model("DurableJob", durableJobSchema);
