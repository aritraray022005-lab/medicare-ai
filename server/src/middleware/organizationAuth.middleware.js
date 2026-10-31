const jwt = require("jsonwebtoken");
const Organization = require("../models/organization.model");
const config = require("../config/config");

/**
 * Authentication middleware for Healthcare Organizations.
 * Enforces:
 * 1. Valid organizationToken cookie.
 * 2. Role claim matches "organization" to prevent cross-role token confusion.
 * 3. Organization existence in database.
 * 4. Unblocked status (isBlocked === false).
 * 5. Email verification (isEmailVerified === true).
 */
const organizationAuthMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.organizationToken;

        if (!token) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized: Token missing"
            });
        }

        const decoded = jwt.verify(token, config.JWT_TOKEN_SECRET);

        // Strict role claim verification: role MUST explicitly equal "organization"
        if (!decoded || typeof decoded !== "object" || decoded.role !== "organization") {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized: Invalid or missing token role"
            });
        }

        const organization = await Organization.findById(decoded.id);

        if (!organization) {
            return res.status(401).json({
                status: "failed",
                msg: "Organization not found."
            });
        }

        if (organization.isBlocked) {
            return res.status(403).json({
                status: "failed",
                msg: "Your organization account has been blocked by the admin."
            });
        }

        if (!organization.isEmailVerified) {
            return res.status(403).json({
                status: "failed",
                msg: "Email verification required. Please verify your email before proceeding."
            });
        }

        req.organization = organization;
        req.userDetails = organization; // Compatible with shared helpers

        next();
    } catch (error) {
        return res.status(401).json({
            status: "failed",
            msg: "Invalid or expired token."
        });
    }
};

/**
 * Secondary gate: Ensures the organization has been approved by MedCare AI Admin.
 * Used for facility room/slot management and verified network operations.
 */
const requireVerifiedOrganization = async (req, res, next) => {
    if (!req.organization) {
        return res.status(401).json({
            status: "failed",
            msg: "Unauthorized: Authentication required."
        });
    }

    if (!req.organization.isVerifiedByAdmin) {
        return res.status(403).json({
            status: "failed",
            msg: "Organization is pending MedCare AI admin verification."
        });
    }

    next();
};

module.exports = {
    organizationAuthMiddleware,
    requireVerifiedOrganization
};
