const mongoose = require("mongoose");

const doctorOrganizationSchema = new mongoose.Schema(
    {
        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Doctor",
            required: true
        },

        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },

        status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected", "Revoked", "Withdrawn"],
            default: "Pending"
        },

        requestedBy: {
            type: String,
            enum: ["Doctor", "Organization"],
            default: "Doctor"
        },

        rejectionReason: {
            type: String,
            default: null
        },

        revocationReason: {
            type: String,
            default: null
        },

        approvedAt: {
            type: Date,
            default: null
        },

        rejectedAt: {
            type: Date,
            default: null
        },

        revokedAt: {
            type: Date,
            default: null
        },

        withdrawnAt: {
            type: Date,
            default: null
        },

        // Administrative resolution tracking
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            default: null
        },

        resolutionNotes: {
            type: String,
            default: null
        },

        resolvedAt: {
            type: Date,
            default: null
        },

        // Schedule / state version for concurrency locking
        scheduleVersion: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

// One active affiliation (Pending or Approved) per doctor-organization pair
doctorOrganizationSchema.index(
    {
        doctor: 1,
        organization: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            status: {
                $in: ["Pending", "Approved"]
            }
        }
    }
);

doctorOrganizationSchema.index({ organization: 1, status: 1 });
doctorOrganizationSchema.index({ doctor: 1, status: 1 });
doctorOrganizationSchema.index({ status: 1 });

module.exports = mongoose.model("DoctorOrganization", doctorOrganizationSchema);
