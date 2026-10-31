const mongoose = require("mongoose");
const DoctorOrganization = require("../models/doctorOrganization.model");
const Doctor = require("../models/doctor.model");
const Organization = require("../models/organization.model");
const { acquireScheduleLocks } = require("../util/lock.util");
const { queueNotification } = require("../services/outbox.service");

// Permitted doctor profile projection for organizations
const DOCTOR_PERMITTED_PROFILE_PROJECTION = [
    "name",
    "email",
    "phone",
    "nmrNumber",
    "specialization",
    "experience",
    "qualification",
    "consultationFee",
    "bio",
    "profilePicture",
    "clinicLocation",
    "location",
    "isEmailVerified",
    "isVerifiedByAdmin",
    "isBlocked"
].join(" ");

// ============================================================================
// DOCTOR AFFILIATION ENDPOINTS
// ============================================================================

/**
 * Lists eligible, admin-verified, unblocked healthcare organizations for doctors.
 */
const getVerifiedOrganizations = async (req, res) => {
    try {
        const { search, city, type } = req.query;

        const filter = {
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false
        };

        if (type) {
            filter.type = type;
        }

        if (city) {
            filter["address.city"] = new RegExp(city.trim(), "i");
        }

        if (search) {
            const regex = new RegExp(search.trim(), "i");
            filter.$or = [
                { name: regex },
                { registrationNumber: regex },
                { "address.city": regex }
            ];
        }

        const organizations = await Organization.find(filter)
            .select("-password -resetOTP -OTPExpiry")
            .sort({ name: 1 });

        return res.status(200).json({
            status: "success",
            count: organizations.length,
            organizations
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Submits an affiliation request from the authenticated doctor to an eligible organization.
 * Requirement: Doctor must be email-verified and unblocked. Doctor admin verification is NOT required.
 */
const requestAffiliation = async (req, res) => {
    try {
        const doctor = req.userDetails;
        if (!doctor) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        // Eligibility check 1: Doctor email verification
        if (!doctor.isEmailVerified) {
            return res.status(403).json({
                status: "failed",
                msg: "Email verification required before requesting affiliation."
            });
        }

        // Eligibility check 2: Doctor must not be blocked
        if (doctor.isBlocked) {
            return res.status(403).json({
                status: "failed",
                msg: "Your doctor account has been blocked."
            });
        }

        const { organizationId } = req.body;

        // Target organization eligibility check
        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({ status: "failed", msg: "Healthcare organization not found." });
        }

        if (!organization.isEmailVerified) {
            return res.status(400).json({
                status: "failed",
                msg: "Target organization has not completed email verification."
            });
        }

        if (!organization.isVerifiedByAdmin) {
            return res.status(400).json({
                status: "failed",
                msg: "Target organization is pending MedCare AI admin verification."
            });
        }

        if (organization.isBlocked) {
            return res.status(403).json({
                status: "failed",
                msg: "Target organization is currently suspended or blocked."
            });
        }

        // Check for existing active affiliation (Pending or Approved)
        const existingActive = await DoctorOrganization.findOne({
            doctor: doctor._id,
            organization: organization._id,
            status: { $in: ["Pending", "Approved"] }
        });

        if (existingActive) {
            return res.status(409).json({
                status: "failed",
                msg: "An active affiliation or pending request already exists for this organization."
            });
        }

        // Transaction mandatory for atomic creation and outbox notification
        let session;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            if (session) await session.endSession();
            return res.status(500).json({
                status: "failed",
                msg: "Database transaction unavailable. Atomic affiliation operations require an active MongoDB replica set."
            });
        }

        try {
            // Concurrency lock: Doctor FIRST (canonical hierarchy)
            await acquireScheduleLocks({ doctorId: doctor._id, session });

            // Re-verify uniqueness inside transaction to prevent concurrent duplicate submissions
            const concurrentCheck = await DoctorOrganization.findOne({
                doctor: doctor._id,
                organization: organization._id,
                status: { $in: ["Pending", "Approved"] }
            }).session(session);

            if (concurrentCheck) {
                await session.abortTransaction();
                return res.status(409).json({
                    status: "failed",
                    msg: "An active affiliation or pending request already exists for this organization."
                });
            }

            const [newAffiliation] = await DoctorOrganization.create(
                [
                    {
                        doctor: doctor._id,
                        organization: organization._id,
                        status: "Pending",
                        requestedBy: "Doctor"
                    }
                ],
                { session }
            );

            // Transactional Outbox: Notify Organization of new request
            await queueNotification(
                {
                    recipientEmail: organization.email,
                    type: "AFFILIATION_REQUESTED",
                    payload: {
                        doctorName: doctor.name,
                        specialization: doctor.specialization,
                        organizationName: organization.name,
                        doctorId: doctor._id,
                        affiliationId: newAffiliation._id
                    }
                },
                session
            );

            await session.commitTransaction();

            const populated = await DoctorOrganization.findById(newAffiliation._id)
                .populate("organization", "name email phone type registrationNumber address timezone");

            return res.status(201).json({
                status: "success",
                msg: "Affiliation request submitted successfully.",
                affiliation: populated
            });
        } catch (txErr) {
            await session.abortTransaction();
            if (txErr.code === 11000 || (txErr.message && txErr.message.includes("E11000"))) {
                return res.status(409).json({
                    status: "failed",
                    msg: "An active affiliation or pending request already exists for this organization."
                });
            }
            if (txErr.message && txErr.message.includes("Transaction numbers are only allowed on a replica set member or mongos")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for atomic transactions."
                });
            }
            throw txErr;
        } finally {
            await session.endSession();
        }
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Lists affiliations for the authenticated doctor, with optional status filter.
 */
const getDoctorAffiliations = async (req, res) => {
    try {
        const doctor = req.userDetails;
        if (!doctor) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const { status } = req.query;
        const filter = { doctor: doctor._id };

        if (status && status !== "all") {
            filter.status = status;
        }

        const affiliations = await DoctorOrganization.find(filter)
            .populate("organization", "name email phone type registrationNumber address timezone isVerifiedByAdmin isBlocked")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            status: "success",
            count: affiliations.length,
            affiliations
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Withdraws a pending affiliation request initiated by the doctor.
 */
const withdrawAffiliationRequest = async (req, res) => {
    try {
        const doctor = req.userDetails;
        if (!doctor) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const affiliation = await DoctorOrganization.findById(req.params.id)
            .populate("organization", "name email");

        if (!affiliation) {
            return res.status(404).json({ status: "failed", msg: "Affiliation record not found." });
        }

        // Ownership check
        if (affiliation.doctor.toString() !== doctor._id.toString()) {
            return res.status(403).json({ status: "failed", msg: "You can only withdraw your own affiliation requests." });
        }

        // Lifecycle state check: Only Pending requests can be withdrawn
        if (affiliation.status !== "Pending") {
            return res.status(400).json({
                status: "failed",
                msg: `Cannot withdraw affiliation with status '${affiliation.status}'. Only pending requests can be withdrawn.`
            });
        }

        let session;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            if (session) await session.endSession();
            return res.status(500).json({
                status: "failed",
                msg: "Database transaction unavailable. Atomic affiliation operations require an active MongoDB replica set."
            });
        }

        try {
            // Concurrency lock: Doctor FIRST -> DoctorOrganization SECOND
            await acquireScheduleLocks({
                doctorId: doctor._id,
                doctorOrganizationId: affiliation._id,
                session
            });

            // Re-read inside transaction to verify state
            const currentAffiliation = await DoctorOrganization.findById(affiliation._id).session(session);
            if (currentAffiliation.status !== "Pending") {
                await session.abortTransaction();
                return res.status(400).json({
                    status: "failed",
                    msg: `Cannot withdraw affiliation: status changed to '${currentAffiliation.status}'.`
                });
            }

            currentAffiliation.status = "Withdrawn";
            currentAffiliation.withdrawnAt = new Date();
            currentAffiliation.scheduleVersion += 1;
            await currentAffiliation.save({ session });

            // Notify Organization of withdrawal
            if (affiliation.organization && affiliation.organization.email) {
                await queueNotification(
                    {
                        recipientEmail: affiliation.organization.email,
                        type: "AFFILIATION_WITHDRAWN",
                        payload: {
                            doctorName: doctor.name,
                            organizationName: affiliation.organization.name,
                            affiliationId: affiliation._id
                        }
                    },
                    session
                );
            }

            await session.commitTransaction();

            return res.status(200).json({
                status: "success",
                msg: "Affiliation request withdrawn successfully.",
                affiliation: currentAffiliation
            });
        } catch (txErr) {
            await session.abortTransaction();
            if (txErr.message && txErr.message.includes("Transaction numbers are only allowed on a replica set member or mongos")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for atomic transactions."
                });
            }
            throw txErr;
        } finally {
            await session.endSession();
        }
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

// ============================================================================
// ORGANIZATION AFFILIATION ENDPOINTS
// ============================================================================

/**
 * Lists affiliations for the authenticated organization.
 */
const getOrganizationAffiliations = async (req, res) => {
    try {
        const organization = req.organization;
        if (!organization) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const { status } = req.query;
        const filter = { organization: organization._id };

        if (status && status !== "all") {
            filter.status = status;
        }

        const affiliations = await DoctorOrganization.find(filter)
            .populate("doctor", DOCTOR_PERMITTED_PROFILE_PROJECTION)
            .sort({ createdAt: -1 });

        return res.status(200).json({
            status: "success",
            count: affiliations.length,
            affiliations
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Returns permitted professional profile details of the doctor for an affiliation.
 */
const getAffiliationDoctorProfile = async (req, res) => {
    try {
        const organization = req.organization;
        if (!organization) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const affiliation = await DoctorOrganization.findById(req.params.id)
            .populate("doctor", DOCTOR_PERMITTED_PROFILE_PROJECTION);

        if (!affiliation) {
            return res.status(404).json({ status: "failed", msg: "Affiliation record not found." });
        }

        // Ownership verification
        if (affiliation.organization.toString() !== organization._id.toString()) {
            return res.status(403).json({ status: "failed", msg: "Unauthorized access to this affiliation profile." });
        }

        return res.status(200).json({
            status: "success",
            doctor: affiliation.doctor,
            affiliation: {
                _id: affiliation._id,
                status: affiliation.status,
                requestedBy: affiliation.requestedBy,
                createdAt: affiliation.createdAt,
                approvedAt: affiliation.approvedAt,
                rejectionReason: affiliation.rejectionReason,
                revocationReason: affiliation.revocationReason
            }
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Approves a pending doctor affiliation request.
 */
const approveAffiliation = async (req, res) => {
    try {
        const organization = req.organization;
        if (!organization) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const affiliation = await DoctorOrganization.findById(req.params.id)
            .populate("doctor", "name email isEmailVerified isBlocked");

        if (!affiliation) {
            return res.status(404).json({ status: "failed", msg: "Affiliation record not found." });
        }

        // Ownership enforcement: An organization must not approve another organization's request
        if (affiliation.organization.toString() !== organization._id.toString()) {
            return res.status(403).json({
                status: "failed",
                msg: "Forbidden: You cannot approve an affiliation request belonging to another organization."
            });
        }

        // Lifecycle check: Only Pending can be approved
        if (affiliation.status !== "Pending") {
            return res.status(400).json({
                status: "failed",
                msg: `Cannot approve affiliation with status '${affiliation.status}'. Only pending requests can be approved.`
            });
        }

        // Doctor eligibility validation: must be email verified and unblocked
        if (!affiliation.doctor || !affiliation.doctor.isEmailVerified) {
            return res.status(400).json({
                status: "failed",
                msg: "Cannot approve affiliation: Doctor email is unverified."
            });
        }

        if (affiliation.doctor.isBlocked) {
            return res.status(400).json({
                status: "failed",
                msg: "Cannot approve affiliation: Doctor is currently blocked."
            });
        }

        let session;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            if (session) await session.endSession();
            return res.status(500).json({
                status: "failed",
                msg: "Database transaction unavailable. Atomic affiliation operations require an active MongoDB replica set."
            });
        }

        try {
            // Concurrency locks: Doctor FIRST -> DoctorOrganization SECOND (canonical hierarchy)
            await acquireScheduleLocks({
                doctorId: affiliation.doctor._id,
                doctorOrganizationId: affiliation._id,
                session
            });

            // Re-read inside transaction to verify state
            const currentAffiliation = await DoctorOrganization.findById(affiliation._id).session(session);
            if (currentAffiliation.status !== "Pending") {
                await session.abortTransaction();
                return res.status(400).json({
                    status: "failed",
                    msg: `Cannot approve affiliation: status changed concurrently to '${currentAffiliation.status}'.`
                });
            }

            currentAffiliation.status = "Approved";
            currentAffiliation.approvedAt = new Date();
            currentAffiliation.scheduleVersion += 1;
            await currentAffiliation.save({ session });

            // Notify Doctor of approval
            await queueNotification(
                {
                    recipientEmail: affiliation.doctor.email,
                    type: "AFFILIATION_APPROVED",
                    payload: {
                        doctorName: affiliation.doctor.name,
                        organizationName: organization.name,
                        affiliationId: affiliation._id
                    }
                },
                session
            );

            await session.commitTransaction();

            return res.status(200).json({
                status: "success",
                msg: "Doctor affiliation approved successfully.",
                affiliation: currentAffiliation
            });
        } catch (txErr) {
            await session.abortTransaction();
            if (txErr.message && txErr.message.includes("Transaction numbers are only allowed on a replica set member or mongos")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for atomic transactions."
                });
            }
            throw txErr;
        } finally {
            await session.endSession();
        }
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Rejects a pending doctor affiliation request.
 */
const rejectAffiliation = async (req, res) => {
    try {
        const organization = req.organization;
        if (!organization) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const { reason } = req.body;

        const affiliation = await DoctorOrganization.findById(req.params.id)
            .populate("doctor", "name email");

        if (!affiliation) {
            return res.status(404).json({ status: "failed", msg: "Affiliation record not found." });
        }

        // Ownership enforcement
        if (affiliation.organization.toString() !== organization._id.toString()) {
            return res.status(403).json({
                status: "failed",
                msg: "Forbidden: You cannot reject an affiliation request belonging to another organization."
            });
        }

        // Lifecycle check: Only Pending can be rejected
        if (affiliation.status !== "Pending") {
            return res.status(400).json({
                status: "failed",
                msg: `Cannot reject affiliation with status '${affiliation.status}'. Only pending requests can be rejected.`
            });
        }

        let session;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            if (session) await session.endSession();
            return res.status(500).json({
                status: "failed",
                msg: "Database transaction unavailable. Atomic affiliation operations require an active MongoDB replica set."
            });
        }

        try {
            // Concurrency locks: Doctor FIRST -> DoctorOrganization SECOND
            await acquireScheduleLocks({
                doctorId: affiliation.doctor._id,
                doctorOrganizationId: affiliation._id,
                session
            });

            const currentAffiliation = await DoctorOrganization.findById(affiliation._id).session(session);
            if (currentAffiliation.status !== "Pending") {
                await session.abortTransaction();
                return res.status(400).json({
                    status: "failed",
                    msg: `Cannot reject affiliation: status changed concurrently to '${currentAffiliation.status}'.`
                });
            }

            const rejectionReason = reason || "Affiliation criteria not met";
            currentAffiliation.status = "Rejected";
            currentAffiliation.rejectionReason = rejectionReason;
            currentAffiliation.rejectedAt = new Date();
            currentAffiliation.scheduleVersion += 1;
            await currentAffiliation.save({ session });

            // Notify Doctor of rejection
            if (affiliation.doctor && affiliation.doctor.email) {
                await queueNotification(
                    {
                        recipientEmail: affiliation.doctor.email,
                        type: "AFFILIATION_REJECTED",
                        payload: {
                            doctorName: affiliation.doctor.name,
                            organizationName: organization.name,
                            reason: rejectionReason,
                            affiliationId: affiliation._id
                        }
                    },
                    session
                );
            }

            await session.commitTransaction();

            return res.status(200).json({
                status: "success",
                msg: "Affiliation request rejected.",
                affiliation: currentAffiliation
            });
        } catch (txErr) {
            await session.abortTransaction();
            if (txErr.message && txErr.message.includes("Transaction numbers are only allowed on a replica set member or mongos")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for atomic transactions."
                });
            }
            throw txErr;
        } finally {
            await session.endSession();
        }
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Revokes / removes an active, approved doctor affiliation.
 */
const revokeAffiliation = async (req, res) => {
    try {
        const organization = req.organization;
        if (!organization) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const { reason } = req.body;

        const affiliation = await DoctorOrganization.findById(req.params.id)
            .populate("doctor", "name email");

        if (!affiliation) {
            return res.status(404).json({ status: "failed", msg: "Affiliation record not found." });
        }

        // Ownership enforcement
        if (affiliation.organization.toString() !== organization._id.toString()) {
            return res.status(403).json({
                status: "failed",
                msg: "Forbidden: You cannot revoke an affiliation belonging to another organization."
            });
        }

        // Lifecycle check: Only Approved affiliations can be revoked
        if (affiliation.status !== "Approved") {
            return res.status(400).json({
                status: "failed",
                msg: `Cannot revoke affiliation with status '${affiliation.status}'. Only approved affiliations can be revoked.`
            });
        }

        let session;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            if (session) await session.endSession();
            return res.status(500).json({
                status: "failed",
                msg: "Database transaction unavailable. Atomic affiliation operations require an active MongoDB replica set."
            });
        }

        try {
            // Concurrency locks: Doctor FIRST -> DoctorOrganization SECOND
            await acquireScheduleLocks({
                doctorId: affiliation.doctor._id,
                doctorOrganizationId: affiliation._id,
                session
            });

            const currentAffiliation = await DoctorOrganization.findById(affiliation._id).session(session);
            if (currentAffiliation.status !== "Approved") {
                await session.abortTransaction();
                return res.status(400).json({
                    status: "failed",
                    msg: `Cannot revoke affiliation: status changed concurrently to '${currentAffiliation.status}'.`
                });
            }

            const revocationReason = reason || "Affiliation terminated by facility";
            currentAffiliation.status = "Revoked";
            currentAffiliation.revokedAt = new Date();
            currentAffiliation.revocationReason = revocationReason;
            currentAffiliation.scheduleVersion += 1;
            await currentAffiliation.save({ session });

            // Notify Doctor of revocation
            if (affiliation.doctor && affiliation.doctor.email) {
                await queueNotification(
                    {
                        recipientEmail: affiliation.doctor.email,
                        type: "AFFILIATION_REVOKED",
                        payload: {
                            doctorName: affiliation.doctor.name,
                            organizationName: organization.name,
                            reason: revocationReason,
                            affiliationId: affiliation._id
                        }
                    },
                    session
                );
            }

            await session.commitTransaction();

            return res.status(200).json({
                status: "success",
                msg: "Doctor affiliation revoked successfully.",
                affiliation: currentAffiliation
            });
        } catch (txErr) {
            await session.abortTransaction();
            if (txErr.message && txErr.message.includes("Transaction numbers are only allowed on a replica set member or mongos")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for atomic transactions."
                });
            }
            throw txErr;
        } finally {
            await session.endSession();
        }
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

// ============================================================================
// ADMINISTRATIVE RESOLUTION ENDPOINTS
// ============================================================================

/**
 * Lists all affiliation records for MedCare AI Admins with comprehensive filters.
 */
const getAdminAffiliations = async (req, res) => {
    try {
        const admin = req.userDetails;
        if (!admin) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const { status, organizationId, doctorId, search } = req.query;
        const filter = {};

        if (status && status !== "all") {
            filter.status = status;
        }

        if (organizationId) {
            filter.organization = organizationId;
        }

        if (doctorId) {
            filter.doctor = doctorId;
        }

        let affiliationsQuery = DoctorOrganization.find(filter)
            .populate("doctor", "name email phone nmrNumber specialization experience qualification isVerifiedByAdmin isBlocked")
            .populate("organization", "name email phone type registrationNumber address isVerifiedByAdmin isBlocked")
            .populate("resolvedBy", "email")
            .sort({ createdAt: -1 });

        const affiliations = await affiliationsQuery;

        // Optional search filter across doctor or organization name
        let filtered = affiliations;
        if (search) {
            const term = search.toLowerCase().trim();
            filtered = affiliations.filter((a) => {
                const docName = (a.doctor && a.doctor.name) ? a.doctor.name.toLowerCase() : "";
                const orgName = (a.organization && a.organization.name) ? a.organization.name.toLowerCase() : "";
                return docName.includes(term) || orgName.includes(term);
            });
        }

        return res.status(200).json({
            status: "success",
            count: filtered.length,
            affiliations: filtered
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Returns single affiliation audit details for MedCare AI Admins.
 */
const getAdminAffiliationById = async (req, res) => {
    try {
        const admin = req.userDetails;
        if (!admin) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const affiliation = await DoctorOrganization.findById(req.params.id)
            .populate("doctor", "name email phone nmrNumber specialization experience qualification isVerifiedByAdmin isBlocked")
            .populate("organization", "name email phone type registrationNumber address timezone isVerifiedByAdmin isBlocked")
            .populate("resolvedBy", "email");

        if (!affiliation) {
            return res.status(404).json({ status: "failed", msg: "Affiliation record not found." });
        }

        return res.status(200).json({
            status: "success",
            affiliation
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Administrative resolution action for pending, disputed, or problematic affiliations.
 * Supported actions: "approve", "reject", "revoke".
 */
const resolveAffiliation = async (req, res) => {
    try {
        const admin = req.userDetails;
        if (!admin) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const { action, reason } = req.body;

        const affiliation = await DoctorOrganization.findById(req.params.id)
            .populate("doctor", "name email isEmailVerified isBlocked")
            .populate("organization", "name email isVerifiedByAdmin isBlocked");

        if (!affiliation) {
            return res.status(404).json({ status: "failed", msg: "Affiliation record not found." });
        }

        const initialStatus = affiliation.status;

        // Validate state transitions against initial observed status
        if (action === "approve") {
            const approvableStatuses = ["Pending", "Rejected", "Withdrawn", "Revoked"];
            if (!approvableStatuses.includes(initialStatus)) {
                return res.status(400).json({
                    status: "failed",
                    msg: `Cannot approve affiliation with status '${initialStatus}'. Administrative approval is only permitted for Pending, Rejected, Withdrawn, or Revoked affiliations.`
                });
            }
            if (affiliation.doctor && affiliation.doctor.isBlocked) {
                return res.status(400).json({ status: "failed", msg: "Cannot approve affiliation for a blocked doctor." });
            }
            if (affiliation.organization && affiliation.organization.isBlocked) {
                return res.status(400).json({ status: "failed", msg: "Cannot approve affiliation for a blocked organization." });
            }
        } else if (action === "reject") {
            if (initialStatus !== "Pending") {
                return res.status(400).json({
                    status: "failed",
                    msg: `Cannot reject affiliation with status '${initialStatus}'. Administrative rejection requires a Pending status.`
                });
            }
        } else if (action === "revoke") {
            if (initialStatus !== "Approved") {
                return res.status(400).json({
                    status: "failed",
                    msg: `Cannot revoke affiliation with status '${initialStatus}'. Administrative revocation requires an Approved status.`
                });
            }
        } else {
            return res.status(400).json({
                status: "failed",
                msg: "Invalid action. Supported resolution actions: approve, reject, revoke."
            });
        }

        let session;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            if (session) await session.endSession();
            return res.status(500).json({
                status: "failed",
                msg: "Database transaction unavailable. Atomic affiliation operations require an active MongoDB replica set."
            });
        }

        try {
            // Concurrency locks: Doctor FIRST -> DoctorOrganization SECOND
            await acquireScheduleLocks({
                doctorId: affiliation.doctor._id,
                doctorOrganizationId: affiliation._id,
                session
            });

            // Re-read inside transaction after lock acquisition
            const currentAffiliation = await DoctorOrganization.findById(affiliation._id).session(session);
            if (!currentAffiliation) {
                await session.abortTransaction();
                return res.status(404).json({ status: "failed", msg: "Affiliation record not found after lock acquisition." });
            }

            // Compare re-read status with initially observed status
            if (currentAffiliation.status !== initialStatus) {
                await session.abortTransaction();
                return res.status(409).json({
                    status: "failed",
                    msg: `Affiliation status changed concurrently from '${initialStatus}' to '${currentAffiliation.status}'. Resolution aborted.`
                });
            }

            // If approving: check for active conflict (Pending or Approved) on the same doctor & organization
            if (action === "approve") {
                const docDoctorId = currentAffiliation.doctor?._id || currentAffiliation.doctor;
                const docOrgId = currentAffiliation.organization?._id || currentAffiliation.organization;

                const activeConflict = await DoctorOrganization.findOne({
                    doctor: docDoctorId,
                    organization: docOrgId,
                    status: { $in: ["Pending", "Approved"] },
                    _id: { $ne: currentAffiliation._id }
                }).session(session);

                if (activeConflict) {
                    await session.abortTransaction();
                    return res.status(409).json({
                        status: "failed",
                        msg: `Cannot approve affiliation: another active or pending affiliation (${activeConflict.status}) already exists for this doctor and organization.`
                    });
                }
            }

            const now = new Date();
            currentAffiliation.resolvedBy = admin._id;
            currentAffiliation.resolutionNotes = reason;
            currentAffiliation.resolvedAt = now;
            currentAffiliation.scheduleVersion += 1;

            if (action === "approve") {
                currentAffiliation.status = "Approved";
                currentAffiliation.approvedAt = now;
            } else if (action === "reject") {
                currentAffiliation.status = "Rejected";
                currentAffiliation.rejectionReason = `Administrative resolution: ${reason}`;
                currentAffiliation.rejectedAt = now;
            } else if (action === "revoke") {
                currentAffiliation.status = "Revoked";
                currentAffiliation.revocationReason = `Administrative resolution: ${reason}`;
                currentAffiliation.revokedAt = now;
            }

            await currentAffiliation.save({ session });

            // Notify both parties of the administrative resolution
            const notificationPayload = {
                doctorName: affiliation.doctor?.name || "Doctor",
                organizationName: affiliation.organization?.name || "Healthcare Facility",
                action: action.toUpperCase(),
                reason,
                adminEmail: admin.email
            };

            if (affiliation.doctor && affiliation.doctor.email) {
                await queueNotification(
                    {
                        recipientEmail: affiliation.doctor.email,
                        type: "AFFILIATION_ADMIN_RESOLVED",
                        payload: notificationPayload
                    },
                    session
                );
            }

            if (affiliation.organization && affiliation.organization.email) {
                await queueNotification(
                    {
                        recipientEmail: affiliation.organization.email,
                        type: "AFFILIATION_ADMIN_RESOLVED",
                        payload: notificationPayload
                    },
                    session
                );
            }

            await session.commitTransaction();

            const updatedAffiliation = await DoctorOrganization.findById(affiliation._id)
                .populate("doctor", "name email phone specialization")
                .populate("organization", "name email phone type registrationNumber")
                .populate("resolvedBy", "email");

            return res.status(200).json({
                status: "success",
                msg: `Affiliation successfully ${action}d by administrator.`,
                affiliation: updatedAffiliation
            });
        } catch (txErr) {
            try {
                await session.abortTransaction();
            } catch (_) {}

            if (txErr.code === 11000 || (txErr.message && txErr.message.includes("E11000"))) {
                return res.status(409).json({
                    status: "failed",
                    msg: "An active affiliation or pending request already exists for this doctor and organization."
                });
            }

            if (txErr.message && txErr.message.includes("Transaction numbers are only allowed on a replica set member or mongos")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for atomic transactions."
                });
            }
            throw txErr;
        } finally {
            await session.endSession();
        }
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

module.exports = {
    getVerifiedOrganizations,
    requestAffiliation,
    getDoctorAffiliations,
    withdrawAffiliationRequest,
    getOrganizationAffiliations,
    getAffiliationDoctorProfile,
    approveAffiliation,
    rejectAffiliation,
    revokeAffiliation,
    getAdminAffiliations,
    getAdminAffiliationById,
    resolveAffiliation
};
