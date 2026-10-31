const Organization = require("../models/organization.model");
const Room = require("../models/room.model");
const Doctor = require("../models/doctor.model");
const DoctorOrganization = require("../models/doctorOrganization.model");

class LockAcquisitionError extends Error {
    constructor(message, target, id) {
        super(message);
        this.name = "LockAcquisitionError";
        this.target = target;
        this.id = id;
        this.status = 404;
        this.statusCode = 404;
    }
}

/**
 * Acquires schedule concurrency locks in strict canonical hierarchy:
 * Organization eligibility lock FIRST (Tier 0), Room SECOND (Tier 1),
 * Doctor THIRD (Tier 2), DoctorOrganization FOURTH (Tier 3/Affiliation).
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} [params.organizationId]
 * @param {string|mongoose.Types.ObjectId} [params.roomId]
 * @param {string|mongoose.Types.ObjectId} [params.doctorId]
 * @param {string|mongoose.Types.ObjectId} [params.doctorOrganizationId]
 * @param {mongoose.ClientSession} params.session
 * @returns {Promise<{ organizationLock: Object|null, roomLock: Object|null, doctorLock: Object|null, doctorOrgLock: Object|null }>}
 */
async function acquireScheduleLocks({ organizationId = null, roomId = null, doctorId = null, doctorOrganizationId = null, session }) {
    if (!session) {
        throw new Error("A database session is required for acquireScheduleLocks");
    }

    let organizationLock = null;
    let roomLock = null;
    let doctorLock = null;
    let doctorOrgLock = null;

    // 0. Acquire Organization Eligibility Lock FIRST (if organizationId provided)
    if (organizationId) {
        organizationLock = await Organization.findOneAndUpdate(
            { _id: organizationId },
            { $inc: { scheduleVersion: 1 } },
            { session, returnDocument: "after" }
        );
        if (!organizationLock) {
            throw new LockAcquisitionError(`Organization document ${organizationId} not found during lock acquisition`, "Organization", organizationId);
        }
    }

    // 1. Acquire Room Lock SECOND (if roomId provided)
    if (roomId) {
        roomLock = await Room.findOneAndUpdate(
            { _id: roomId },
            { $inc: { scheduleVersion: 1 } },
            { session, returnDocument: "after" }
        );
        if (!roomLock) {
            throw new LockAcquisitionError(`Room document ${roomId} not found during lock acquisition`, "Room", roomId);
        }
    }

    // 2. Acquire Doctor Lock THIRD (if doctorId provided)
    if (doctorId) {
        doctorLock = await Doctor.findOneAndUpdate(
            { _id: doctorId },
            { $inc: { scheduleVersion: 1 } },
            { session, returnDocument: "after" }
        );
        if (!doctorLock) {
            throw new LockAcquisitionError(`Doctor document ${doctorId} not found during lock acquisition`, "Doctor", doctorId);
        }
    }

    // 3. Acquire DoctorOrganization Lock FOURTH (if doctorOrganizationId provided)
    if (doctorOrganizationId) {
        doctorOrgLock = await DoctorOrganization.findOneAndUpdate(
            { _id: doctorOrganizationId },
            { $inc: { scheduleVersion: 1 } },
            { session, returnDocument: "after" }
        );
        if (!doctorOrgLock) {
            throw new LockAcquisitionError(`DoctorOrganization document ${doctorOrganizationId} not found during lock acquisition`, "DoctorOrganization", doctorOrganizationId);
        }
    }

    return { organizationLock, roomLock, doctorLock, doctorOrgLock };
}

module.exports = { acquireScheduleLocks, LockAcquisitionError };
