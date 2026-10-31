const mongoose = require("mongoose");

const outboxNotificationSchema = new mongoose.Schema(
    {
        recipientEmail: {
            type: String,
            required: true,
            trim: true
        },

        type: {
            type: String,
            required: true,
            trim: true
        },

        payload: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({})
        },

        status: {
            type: String,
            enum: ["PENDING", "PROCESSING", "SENT", "FAILED", "DEAD_LETTER"],
            default: "PENDING"
        },

        retryCount: {
            type: Number,
            default: 0
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

        lastAttemptAt: {
            type: Date,
            default: null
        },

        nextAttemptAt: {
            type: Date,
            default: null
        },

        sentAt: {
            type: Date,
            default: null
        },

        deadLetteredAt: {
            type: Date,
            default: null
        },

        lastError: {
            type: String,
            default: null
        },

        // TTL cleanup field: Only populated when notification reaches SENT status.
        // PENDING, PROCESSING, FAILED, and DEAD_LETTER retain null and are never deleted by TTL.
        expireAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Worker polling and retry claim index
outboxNotificationSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });

// Expired lease recovery index
outboxNotificationSchema.index({ status: 1, lockedUntil: 1 });

// Single-field TTL index on expireAt (deletes when expireAt <= current time)
outboxNotificationSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OutboxNotification", outboxNotificationSchema);
