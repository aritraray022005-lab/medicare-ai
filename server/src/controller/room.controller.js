const mongoose = require("mongoose");
const Room = require("../models/room.model");
const RoomSlot = require("../models/roomSlot.model");
const RoomBooking = require("../models/roomBooking.model");
const RoomBookingRequest = require("../models/roomBookingRequest.model");
const Organization = require("../models/organization.model");
const Doctor = require("../models/doctor.model");
const Patient = require("../models/patient.model");
const Appointment = require("../models/appointment.model");
const DoctorOrganization = require("../models/doctorOrganization.model");
const { acquireScheduleLocks } = require("../util/lock.util");
const { checkDoctorScheduleConflicts } = require("../util/conflict.util");
const { resolveLocalToUtc } = require("../util/time.util");
const { queueNotification } = require("../services/outbox.service");
const { executeTransactionWithRetry } = require("../util/transaction.util");
const { defaultDurableWorker } = require("../jobs/durableJobWorker");

// ========================================================
// 1. ORGANIZATION ROOM MANAGEMENT
// ========================================================

/**
 * Creates a new room for the authenticated organization.
 */
const createRoom = async (req, res) => {
    try {
        const organizationId = req.organization._id || req.organization.id;
        const { roomNumber, floor, department, capacity, type } = req.body;

        const existingRoom = await Room.findOne({
            organization: organizationId,
            roomNumber: roomNumber.trim()
        });

        if (existingRoom) {
            return res.status(409).json({
                status: "failed",
                msg: `Room '${roomNumber.trim()}' already exists in your facility.`
            });
        }

        const room = await Room.create({
            organization: organizationId,
            roomNumber: roomNumber.trim(),
            floor: floor || "",
            department: department || "",
            capacity: capacity || 1,
            type: type || "Consultation Room",
            isOperational: true,
            scheduleVersion: 0
        });

        return res.status(201).json({
            status: "success",
            msg: "Room created successfully.",
            room
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                status: "failed",
                msg: "A room with this number already exists in your organization."
            });
        }
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Lists all rooms belonging to the authenticated organization.
 */
const getOrganizationRooms = async (req, res) => {
    try {
        const organizationId = req.organization._id || req.organization.id;
        const { isOperational, search } = req.query;

        const filter = { organization: organizationId };
        if (isOperational !== undefined) {
            filter.isOperational = isOperational === "true";
        }
        if (search) {
            const regex = new RegExp(search.trim(), "i");
            filter.$or = [
                { roomNumber: regex },
                { department: regex },
                { floor: regex }
            ];
        }

        const rooms = await Room.find(filter).sort({ roomNumber: 1 });

        return res.status(200).json({
            status: "success",
            count: rooms.length,
            rooms
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Gets details of a single room.
 */
const getRoomById = async (req, res) => {
    try {
        const organizationId = req.organization._id || req.organization.id;
        const room = await Room.findOne({ _id: req.params.id, organization: organizationId });

        if (!room) {
            return res.status(404).json({ status: "failed", msg: "Room not found." });
        }

        return res.status(200).json({ status: "success", room });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Updates room details.
 */
const updateRoom = async (req, res) => {
    try {
        const organizationId = req.organization._id || req.organization.id;
        const { floor, department, capacity, isOperational, type } = req.body;

        const updateData = {};
        if (floor !== undefined) updateData.floor = floor;
        if (department !== undefined) updateData.department = department;
        if (capacity !== undefined) updateData.capacity = capacity;
        if (isOperational !== undefined) updateData.isOperational = isOperational;
        if (type !== undefined) updateData.type = type;

        const room = await Room.findOneAndUpdate(
            { _id: req.params.id, organization: organizationId },
            { $set: updateData },
            { returnDocument: "after" }
        );

        if (!room) {
            return res.status(404).json({ status: "failed", msg: "Room not found." });
        }

        return res.status(200).json({
            status: "success",
            msg: "Room updated successfully.",
            room
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Toggles room operational status.
 */
const toggleRoomOperational = async (req, res) => {
    try {
        const organizationId = req.organization._id || req.organization.id;
        const roomId = req.params.id;
        const { isOperational } = req.body;

        let updatedRoom;
        try {
            updatedRoom = await executeTransactionWithRetry(async (session) => {
                await acquireScheduleLocks({
                    organizationId,
                    roomId,
                    session
                });

                const room = await Room.findOne({ _id: roomId, organization: organizationId }).session(session);
                if (!room) {
                    const err = new Error("Room not found.");
                    err.statusCode = 404;
                    throw err;
                }

                room.isOperational = Boolean(isOperational);
                await room.save({ session });

                if (!room.isOperational) {
                    // Mark available or queued slots for this room as Maintenance
                    await RoomSlot.updateMany(
                        { room: room._id, status: { $in: ["Available", "Queued"] } },
                        { $set: { status: "Maintenance" } },
                        { session }
                    );

                    // Transition pending requests for this room to REJECTED_ROOM_MAINTENANCE
                    await RoomBookingRequest.updateMany(
                        { room: room._id, status: "PENDING" },
                        {
                            $set: {
                                status: "REJECTED_ROOM_MAINTENANCE",
                                rejectionReason: "Room marked non-operational or placed under maintenance",
                                resolvedAt: new Date()
                            }
                        },
                        { session }
                    );
                }

                return room;
            });
        } catch (txErr) {
            if (txErr.statusCode) {
                return res.status(txErr.statusCode).json({ status: "failed", msg: txErr.message });
            }
            if (txErr.message && txErr.message.includes("Database transaction unavailable")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for operational toggle."
                });
            }
            throw txErr;
        }

        return res.status(200).json({
            status: "success",
            msg: `Room marked as ${isOperational ? "operational" : "under maintenance"}.`,
            room: updatedRoom
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

// ========================================================
// 2. ROOM AVAILABILITY & SLOT GENERATION
// ========================================================

/**
 * Creates availability interval slot for a room.
 */
const createRoomAvailability = async (req, res) => {
    try {
        const organizationId = req.organization._id || req.organization.id;
        const roomId = req.params.id;
        const { dateStr, startTimeStr, endTimeStr, clientOffsetMinutes } = req.body;

        const room = await Room.findOne({ _id: roomId, organization: organizationId });
        if (!room) {
            return res.status(404).json({ status: "failed", msg: "Room not found." });
        }
        if (!room.isOperational) {
            return res.status(400).json({
                status: "failed",
                msg: "Cannot create availability for a room currently under maintenance or non-operational."
            });
        }

        const org = await Organization.findById(organizationId);
        const facilityTz = org.timezone || "Asia/Kolkata";

        // Calculate duration in minutes between start and end
        const [sH, sM] = startTimeStr.split(":").map(Number);
        const [eH, eM] = endTimeStr.split(":").map(Number);
        const startMinutes = sH * 60 + sM;
        const endMinutes = eH * 60 + eM;
        const durationMinutes = endMinutes - startMinutes;

        if (durationMinutes <= 0) {
            return res.status(400).json({
                status: "failed",
                msg: "End time must be strictly after start time."
            });
        }
        if (durationMinutes < 15 || durationMinutes > 480) {
            return res.status(400).json({
                status: "failed",
                msg: "Availability slot duration must be between 15 and 480 minutes."
            });
        }

        // Convert local date/time to canonical UTC timestamps using existing time.util
        let resolvedTime;
        try {
            resolvedTime = resolveLocalToUtc({
                dateStr,
                timeStr: startTimeStr,
                timezone: facilityTz,
                clientOffsetMinutes,
                durationMinutes
            });
        } catch (tzErr) {
            return res.status(400).json({
                status: "failed",
                code: tzErr.code || "INVALID_TIME",
                msg: tzErr.message
            });
        }

        const { startDateTime, endDateTime } = resolvedTime;

        // Calendar date representation (UTC midnight)
        const [year, month, day] = dateStr.split("-").map(Number);
        const dateUtcMidnight = new Date(Date.UTC(year, month - 1, day));

        let createdSlot;
        try {
            createdSlot = await executeTransactionWithRetry(async (session) => {
                // Acquire Organization -> Room locks in canonical order
                await acquireScheduleLocks({
                    organizationId,
                    roomId,
                    session
                });

                // Re-read organization inside transaction
                const lockedOrg = await Organization.findById(organizationId).session(session);
                if (!lockedOrg || lockedOrg.isBlocked || !lockedOrg.isVerifiedByAdmin || !lockedOrg.isEmailVerified) {
                    const err = new Error("Organization is not approved, unverified, or blocked.");
                    err.statusCode = 403;
                    throw err;
                }

                // Re-read room inside transaction
                const lockedRoom = await Room.findById(roomId).session(session);
                if (!lockedRoom || !lockedRoom.isOperational) {
                    const err = new Error("Room is not operational or under maintenance.");
                    err.statusCode = 400;
                    throw err;
                }

                // 1. Prevent overlapping availability for the same room inside transaction
                const overlappingSlot = await RoomSlot.findOne({
                    room: roomId,
                    status: { $ne: "Maintenance" },
                    startDateTime: { $lt: endDateTime },
                    endDateTime: { $gt: startDateTime }
                }).session(session);

                if (overlappingSlot) {
                    const err = new Error("Proposed availability interval overlaps with an existing room slot.");
                    err.statusCode = 409;
                    throw err;
                }

                // 2. Prevent availability while conflicting active room booking exists inside transaction
                const conflictingBooking = await RoomBooking.findOne({
                    room: roomId,
                    status: "Active",
                    startDateTime: { $lt: endDateTime },
                    endDateTime: { $gt: startDateTime }
                }).session(session);

                if (conflictingBooking) {
                    const err = new Error("An active room booking already exists during this interval.");
                    err.statusCode = 409;
                    throw err;
                }

                const [newSlot] = await RoomSlot.create([
                    {
                        organization: organizationId,
                        room: roomId,
                        date: dateUtcMidnight,
                        startDateTime,
                        endDateTime,
                        timezone: facilityTz,
                        localStartTime: startTimeStr,
                        localEndTime: endTimeStr,
                        status: "Available",
                        queueGeneration: 0,
                        queueSequenceCounter: 0
                    }
                ], { session });

                return newSlot;
            });
        } catch (txErr) {
            if (txErr.statusCode) {
                return res.status(txErr.statusCode).json({ status: "failed", msg: txErr.message });
            }
            if (txErr.code === 11000) {
                return res.status(409).json({
                    status: "failed",
                    msg: "An exact identical room slot already exists."
                });
            }
            if (txErr.message && txErr.message.includes("Database transaction unavailable")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for atomic availability generation."
                });
            }
            throw txErr;
        }

        return res.status(201).json({
            status: "success",
            msg: "Room availability created successfully.",
            slot: createdSlot
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                status: "failed",
                msg: "An exact identical room slot already exists."
            });
        }
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Lists availability slots for a specific room or entire organization.
 */
const getOrganizationSlots = async (req, res) => {
    try {
        const organizationId = req.organization._id || req.organization.id;
        const { roomId, status, date } = req.query;

        const filter = { organization: organizationId };
        if (roomId) filter.room = roomId;
        if (status) filter.status = status;
        if (date) {
            const [y, m, d] = date.split("-").map(Number);
            filter.date = new Date(Date.UTC(y, m - 1, d));
        }

        const slots = await RoomSlot.find(filter)
            .populate("room", "roomNumber floor department capacity isOperational type")
            .populate("activeBooking")
            .sort({ startDateTime: 1 });

        return res.status(200).json({
            status: "success",
            count: slots.length,
            slots
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Cancels or deactivates an availability slot.
 */
const cancelRoomSlot = async (req, res) => {
    try {
        const organizationId = req.organization._id || req.organization.id;
        const { slotId } = req.params;

        let cancelledSlot;
        try {
            cancelledSlot = await executeTransactionWithRetry(async (session) => {
                const initialSlot = await RoomSlot.findOne({ _id: slotId, organization: organizationId }).session(session);
                if (!initialSlot) {
                    const err = new Error("Room slot not found.");
                    err.statusCode = 404;
                    throw err;
                }

                // Acquire locks in canonical hierarchy: Organization -> Room
                await acquireScheduleLocks({
                    organizationId,
                    roomId: initialSlot.room,
                    session
                });

                const slot = await RoomSlot.findOne({ _id: slotId, organization: organizationId }).session(session);
                if (!slot) {
                    const err = new Error("Room slot not found.");
                    err.statusCode = 404;
                    throw err;
                }

                if (slot.activeBooking || slot.status === "Reserved") {
                    const err = new Error("Cannot cancel an availability slot with an active room reservation. Cancel the booking first.");
                    err.statusCode = 409;
                    throw err;
                }

                slot.status = "Maintenance";
                await slot.save({ session });

                // Transition all pending requests in current generation to REJECTED_ROOM_MAINTENANCE
                await RoomBookingRequest.updateMany(
                    { roomSlot: slot._id, queueGeneration: slot.queueGeneration, status: "PENDING" },
                    {
                        $set: {
                            status: "REJECTED_ROOM_MAINTENANCE",
                            rejectionReason: "Slot marked unavailable by facility administration",
                            resolvedAt: new Date()
                        }
                    },
                    { session }
                );

                return slot;
            });
        } catch (txErr) {
            if (txErr.statusCode) {
                return res.status(txErr.statusCode).json({ status: "failed", msg: txErr.message });
            }
            if (txErr.message && txErr.message.includes("Database transaction unavailable")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for slot cancellation."
                });
            }
            throw txErr;
        }

        return res.status(200).json({
            status: "success",
            msg: "Room slot cancelled and marked unavailable.",
            slot: cancelledSlot
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

// ========================================================
// 3. DOCTOR ROOM DISCOVERY
// ========================================================

/**
 * Returns available rooms from organizations where the doctor has an Approved affiliation.
 */
const getAvailableRoomsForDoctor = async (req, res) => {
    try {
        const doctorId = req.userDetails._id || req.userDetails.id;

        // 1. Find all approved affiliations for this doctor
        const affiliations = await DoctorOrganization.find({
            doctor: doctorId,
            status: "Approved"
        }).select("organization");

        const orgIds = affiliations.map(a => a.organization);

        // 2. Find eligible verified, non-blocked organizations
        const verifiedOrgs = await Organization.find({
            _id: { $in: orgIds },
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false
        }).select("_id name email phone type timezone address");

        const verifiedOrgIds = verifiedOrgs.map(o => o._id);

        // 3. Find operational rooms for these organizations
        const rooms = await Room.find({
            organization: { $in: verifiedOrgIds },
            isOperational: true
        }).populate("organization", "name email phone type timezone address").sort({ roomNumber: 1 });

        return res.status(200).json({
            status: "success",
            count: rooms.length,
            rooms,
            affiliatedOrganizations: verifiedOrgs
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Returns available slots for doctor browsing across affiliated organizations.
 */
const getAvailableSlotsForDoctor = async (req, res) => {
    try {
        const doctorId = req.userDetails._id || req.userDetails.id;
        const { organizationId, roomId, date } = req.query;

        // 1. Check approved affiliations
        const affFilter = { doctor: doctorId, status: "Approved" };
        if (organizationId) affFilter.organization = organizationId;

        const affiliations = await DoctorOrganization.find(affFilter).select("organization");
        const orgIds = affiliations.map(a => a.organization);

        const slotFilter = {
            organization: { $in: orgIds },
            status: { $in: ["Available", "Queued"] }
        };
        if (roomId) slotFilter.room = roomId;
        if (date) {
            const [y, m, d] = date.split("-").map(Number);
            slotFilter.date = new Date(Date.UTC(y, m - 1, d));
        }

        const slots = await RoomSlot.find(slotFilter)
            .populate("room", "roomNumber floor department capacity isOperational type")
            .populate("organization", "name timezone address")
            .sort({ startDateTime: 1 });

        return res.status(200).json({
            status: "success",
            count: slots.length,
            slots
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

// ========================================================
// 4. STRICT FCFS ALLOCATION PROCESSOR (ENGINE)
// ========================================================

/**
 * Evaluates and processes a single candidate in its own dedicated transaction.
 * Acquires locks in canonical order: Organization -> Room -> Doctor -> DoctorOrganization.
 * Re-reads and validates slot, organization, room, doctor, affiliation, candidate request.
 * Transitions candidate to terminal state (REJECTED_* or ALLOCATED) inside the transaction.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.slotId
 * @param {string|mongoose.Types.ObjectId} params.candidateId
 * @param {number} params.targetGeneration
 * @returns {Promise<{ processed: boolean, allocated: boolean, candidateId?: string, bookingId?: string, terminalSlotState?: boolean, reason?: string }>}
 */
async function evaluateAndProcessCandidate({ slotId, candidateId, targetGeneration }) {
    return await executeTransactionWithRetry(async (session) => {
        // 1. Re-read slot inside transaction
        const slot = await RoomSlot.findById(slotId).session(session);
        if (!slot) {
            return { processed: false, allocated: false, terminalSlotState: true, reason: "Slot not found" };
        }
        if (slot.queueGeneration !== targetGeneration) {
            return { processed: false, allocated: false, terminalSlotState: true, reason: "Queue generation changed" };
        }
        if (slot.status === "Reserved") {
            return { processed: false, allocated: false, terminalSlotState: true, reason: "Slot already reserved" };
        }
        if (slot.status === "Maintenance") {
            return { processed: false, allocated: false, terminalSlotState: true, reason: "Slot under maintenance" };
        }

        // 2. Re-read Candidate Request inside transaction
        const candidate = await RoomBookingRequest.findById(candidateId).session(session);
        if (!candidate || candidate.status !== "PENDING" || candidate.queueGeneration !== targetGeneration) {
            // Request is no longer pending or belonging to this generation
            return { processed: true, allocated: false };
        }

        // 3. Find Doctor Affiliation with Organization
        const aff = await DoctorOrganization.findOne({
            doctor: candidate.doctor,
            organization: slot.organization
        }).session(session);

        // 4. Acquire Schedule Locks in Strict Canonical Hierarchy:
        // Organization (Tier 0) -> Room (Tier 1) -> Doctor (Tier 2) -> DoctorOrganization (Tier 3)
        await acquireScheduleLocks({
            organizationId: slot.organization,
            roomId: slot.room,
            doctorId: candidate.doctor,
            doctorOrganizationId: aff?._id || null,
            session
        });

        // 5. Re-read Organization inside transaction
        const org = await Organization.findById(slot.organization).session(session);
        if (!org || org.isBlocked || !org.isVerifiedByAdmin || !org.isEmailVerified) {
            // Organization is ineligible: reject pending requests and mark slot Maintenance
            await RoomBookingRequest.updateMany(
                { roomSlot: slot._id, queueGeneration: slot.queueGeneration, status: "PENDING" },
                {
                    $set: {
                        status: "REJECTED_ORG_SUSPENDED",
                        rejectionReason: "Organization is blocked, unverified, or suspended",
                        resolvedAt: new Date()
                    }
                },
                { session }
            );
            slot.status = "Maintenance";
            await slot.save({ session });
            return { processed: true, allocated: false, terminalSlotState: true, reason: "Organization ineligible" };
        }

        // 6. Re-read Room inside transaction
        const room = await Room.findById(slot.room).session(session);
        if (!room || !room.isOperational) {
            // Room is non-operational: reject pending requests and mark slot Maintenance
            await RoomBookingRequest.updateMany(
                { roomSlot: slot._id, queueGeneration: slot.queueGeneration, status: "PENDING" },
                {
                    $set: {
                        status: "REJECTED_ROOM_MAINTENANCE",
                        rejectionReason: "Room is non-operational or placed under maintenance",
                        resolvedAt: new Date()
                    }
                },
                { session }
            );
            slot.status = "Maintenance";
            await slot.save({ session });
            return { processed: true, allocated: false, terminalSlotState: true, reason: "Room not operational" };
        }

        // 7. Check room interval conflict with active booking
        const roomConflict = await RoomBooking.findOne({
            room: slot.room,
            status: "Active",
            startDateTime: { $lt: slot.endDateTime },
            endDateTime: { $gt: slot.startDateTime }
        }).session(session);

        if (roomConflict) {
            slot.status = "Reserved";
            slot.activeBooking = roomConflict._id;
            await slot.save({ session });
            return { processed: true, allocated: false, terminalSlotState: true, reason: "Active room booking conflict" };
        }

        // 8. Validate Candidate Doctor Eligibility
        const candDoc = await Doctor.findById(candidate.doctor).session(session);
        if (!candDoc || candDoc.isBlocked || !candDoc.isEmailVerified) {
            candidate.status = "REJECTED_DOCTOR_INELIGIBLE";
            candidate.rejectionReason = "Doctor is blocked or email is unverified";
            candidate.resolvedAt = new Date();
            await candidate.save({ session });
            return { processed: true, allocated: false };
        }

        // 9. Validate Doctor Affiliation Status
        if (!aff || aff.status !== "Approved") {
            candidate.status = "REJECTED_UNAFFILIATED";
            candidate.rejectionReason = "Doctor does not have an approved affiliation with this facility";
            candidate.resolvedAt = new Date();
            await candidate.save({ session });
            return { processed: true, allocated: false };
        }

        // 10. Check Doctor Schedule Conflicts across Tiers 1, 2, and 3
        const scheduleConflict = await checkDoctorScheduleConflicts(
            candidate.doctor,
            slot.startDateTime,
            slot.endDateTime,
            session
        );

        if (scheduleConflict && scheduleConflict.hasConflict) {
            candidate.status = "REJECTED_CONFLICT";
            candidate.rejectionReason = scheduleConflict.reason;
            candidate.resolvedAt = new Date();
            await candidate.save({ session });
            return { processed: true, allocated: false };
        }

        // 11. Candidate is WINNER: Allocate
        const [booking] = await RoomBooking.create([
            {
                roomSlot: slot._id,
                room: slot.room,
                organization: slot.organization,
                doctor: candidate.doctor,
                startDateTime: slot.startDateTime,
                endDateTime: slot.endDateTime,
                timezone: org.timezone || "Asia/Kolkata",
                status: "Active",
                request: candidate._id,
                allocatedAt: new Date()
            }
        ], { session });

        // Mark winning request as ALLOCATED
        candidate.status = "ALLOCATED";
        candidate.allocatedBooking = booking._id;
        candidate.resolvedAt = new Date();
        await candidate.save({ session });

        // Update room slot
        slot.status = "Reserved";
        slot.activeBooking = booking._id;
        await slot.save({ session });

        // Mark superseded candidates in this generation
        await RoomBookingRequest.updateMany(
            {
                roomSlot: slot._id,
                queueGeneration: slot.queueGeneration,
                status: "PENDING"
            },
            {
                $set: {
                    status: "REJECTED_SUPERSEDED",
                    rejectionReason: "Room slot allocated to earlier queue sequence",
                    resolvedAt: new Date()
                }
            },
            { session }
        );

        // Queue outbox notification to allocated doctor
        await queueNotification(
            {
                recipientEmail: candDoc.email,
                type: "ROOM_BOOKING_ALLOCATED",
                payload: {
                    doctorName: candDoc.name,
                    organizationName: org.name,
                    roomNumber: room.roomNumber,
                    date: slot.date ? slot.date.toISOString().split("T")[0] : "",
                    startTime: slot.localStartTime || "",
                    endTime: slot.localEndTime || ""
                }
            },
            session
        );

        return {
            processed: true,
            allocated: true,
            candidateId: candidate._id,
            bookingId: booking._id
        };
    });
}

/**
 * Strict First-Come-First-Served allocation engine for a room slot.
 * Ensures server-controlled monotonic sequence ordering across multi-batch queues,
 * evaluates each candidate in its own dedicated transaction, revalidates candidate
 * eligibility, executes schedule conflict detection, and commits allocation.
 *
 * @param {string|mongoose.Types.ObjectId} slotId
 * @returns {Promise<{ allocated: boolean, candidateId: string|null, reason?: string, error?: string }>}
 */
async function processSlotAllocation(slotId, options = {}) {
    const { allowUnbounded = false, maxCandidates = 1000 } = options;

    // Initial pre-check on slot state
    const initialSlot = await RoomSlot.findById(slotId);
    if (!initialSlot) {
        return { allocated: false, reason: "Slot not found" };
    }

    if (initialSlot.status === "Reserved" || initialSlot.status === "Maintenance") {
        return { allocated: false, reason: `Slot is in ${initialSlot.status} state` };
    }

    const targetGeneration = initialSlot.queueGeneration;
    const BATCH_SIZE = 50;
    let totalProcessed = 0;

    while (allowUnbounded || totalProcessed < maxCandidates) {
        // Query pending requests strictly ordered by server sequenceNumber ascending
        const candidates = await RoomBookingRequest.find({
            roomSlot: slotId,
            queueGeneration: targetGeneration,
            status: "PENDING"
        })
            .sort({ sequenceNumber: 1 })
            .limit(BATCH_SIZE);

        if (!candidates || candidates.length === 0) {
            break;
        }

        let batchProgress = false;

        for (const candSummary of candidates) {
            totalProcessed++;
            let evalResult;
            try {
                evalResult = await evaluateAndProcessCandidate({
                    slotId,
                    candidateId: candSummary._id,
                    targetGeneration
                });
            } catch (err) {
                // If transactions are unavailable (standalone mongo)
                if (err.message && err.message.includes("Database transaction unavailable")) {
                    return { allocated: false, error: err.message };
                }
                throw err;
            }

            if (evalResult.allocated) {
                return {
                    allocated: true,
                    candidateId: evalResult.candidateId,
                    bookingId: evalResult.bookingId
                };
            }

            if (evalResult.terminalSlotState) {
                return {
                    allocated: false,
                    reason: evalResult.reason
                };
            }

            if (evalResult.processed) {
                batchProgress = true;
            }
        }

        if (!batchProgress) {
            break;
        }
    }

    // Check if queue is now empty of pending requests
    const remainingCount = await RoomBookingRequest.countDocuments({
        roomSlot: slotId,
        queueGeneration: targetGeneration,
        status: "PENDING"
    });

    if (remainingCount === 0) {
        // If slot is still in Queued status, reset back to Available
        try {
            await executeTransactionWithRetry(async (session) => {
                const currentSlot = await RoomSlot.findById(slotId).session(session);
                if (currentSlot && currentSlot.status === "Queued" && currentSlot.queueGeneration === targetGeneration) {
                    await acquireScheduleLocks({
                        organizationId: currentSlot.organization,
                        roomId: currentSlot.room,
                        session
                    });
                    currentSlot.status = "Available";
                    await currentSlot.save({ session });
                }
            });
        } catch (_) {}
    } else if (!allowUnbounded && remainingCount > 0) {
        // Enqueue durable continuation job so background worker picks up remaining candidates
        try {
            await defaultDurableWorker.enqueueJob({
                jobType: "FCFS_SLOT_ALLOCATION",
                targetId: slotId,
                payload: {
                    slotId: slotId.toString(),
                    targetGeneration
                }
            });
        } catch (_) {}
    }

    return { allocated: false, reason: remainingCount === 0 ? "No eligible pending requests in queue" : "Batch limit reached; continuation queued" };
}

// ========================================================
// 5. DOCTOR ROOM BOOKING REQUESTS
// ========================================================

/**
 * Doctor submits a room reservation request for a specific availability slot.
 * The server assigns a monotonically increasing sequenceNumber inside an atomic transaction.
 */
const requestRoomBooking = async (req, res) => {
    try {
        const doctorId = req.userDetails._id || req.userDetails.id;
        const { slotId, clientRequestId } = req.body;

        // 1. Initial Doctor Eligibility Check
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ status: "failed", msg: "Doctor profile not found." });
        }
        if (!doctor.isEmailVerified) {
            return res.status(403).json({ status: "failed", msg: "Email verification required before requesting rooms." });
        }
        if (doctor.isBlocked) {
            return res.status(403).json({ status: "failed", msg: "Doctor account is suspended." });
        }

        // 2. Initial Slot & Organization Eligibility Check
        const slot = await RoomSlot.findById(slotId);
        if (!slot) {
            return res.status(404).json({ status: "failed", msg: "Room availability slot not found." });
        }
        if (slot.status !== "Available" && slot.status !== "Queued") {
            return res.status(409).json({
                status: "failed",
                msg: `Slot is not open for requests (currently ${slot.status}).`
            });
        }

        const org = await Organization.findById(slot.organization);
        if (!org || org.isBlocked || !org.isVerifiedByAdmin || !org.isEmailVerified) {
            return res.status(403).json({
                status: "failed",
                msg: "The facility organization is not approved, unverified, or suspended."
            });
        }

        const room = await Room.findById(slot.room);
        if (!room || !room.isOperational) {
            return res.status(403).json({
                status: "failed",
                msg: "The requested room is currently non-operational or under maintenance."
            });
        }

        // 3. Affiliation check
        const affiliation = await DoctorOrganization.findOne({
            doctor: doctorId,
            organization: slot.organization,
            status: "Approved"
        });
        if (!affiliation) {
            return res.status(403).json({
                status: "failed",
                msg: "You must have an Approved affiliation with this facility to request room time."
            });
        }

        // 4. Idempotency check: if clientRequestId provided, check existing request
        if (clientRequestId && typeof clientRequestId === "string") {
            const existing = await RoomBookingRequest.findOne({
                doctor: doctorId,
                clientRequestId: clientRequestId.trim()
            });
            if (existing) {
                if (existing.roomSlot.toString() !== slotId.toString()) {
                    return res.status(409).json({
                        status: "failed",
                        msg: "Idempotency key reuse across different room slots is not permitted."
                    });
                }
                return res.status(200).json({
                    status: "success",
                    msg: "Request already processed (idempotent response).",
                    request: existing
                });
            }
        }

        // 5. Atomic Enqueue Transaction
        let newRequest;
        let assignedSeq;

        try {
            await executeTransactionWithRetry(async (session) => {
                // Acquire locks in canonical hierarchy
                await acquireScheduleLocks({
                    organizationId: slot.organization,
                    roomId: slot.room,
                    doctorId,
                    doctorOrganizationId: affiliation._id,
                    session
                });

                // Re-read slot inside transaction
                const lockedSlot = await RoomSlot.findById(slotId).session(session);
                if (!lockedSlot || (lockedSlot.status !== "Available" && lockedSlot.status !== "Queued")) {
                    const err = new Error("Room slot is no longer open for requests.");
                    err.statusCode = 409;
                    throw err;
                }

                // Check if doctor already has a pending request in this generation
                const existingPending = await RoomBookingRequest.findOne({
                    roomSlot: lockedSlot._id,
                    doctor: doctorId,
                    queueGeneration: lockedSlot.queueGeneration,
                    status: "PENDING"
                }).session(session);

                if (existingPending) {
                    const err = new Error("You already have an active pending request in the queue for this slot.");
                    err.statusCode = 409;
                    throw err;
                }

                // Server monotonically increases queueSequenceCounter
                lockedSlot.queueSequenceCounter += 1;
                assignedSeq = lockedSlot.queueSequenceCounter;
                if (lockedSlot.status === "Available") {
                    lockedSlot.status = "Queued";
                }
                await lockedSlot.save({ session });

                const [createdReq] = await RoomBookingRequest.create([
                    {
                        roomSlot: lockedSlot._id,
                        room: lockedSlot.room,
                        organization: lockedSlot.organization,
                        doctor: doctorId,
                        queueGeneration: lockedSlot.queueGeneration,
                        sequenceNumber: assignedSeq,
                        status: "PENDING",
                        clientRequestId: clientRequestId ? clientRequestId.trim() : undefined,
                        requestedAt: new Date()
                    }
                ], { session });

                newRequest = createdReq;

                // Queue transactional outbox notification
                await queueNotification(
                    {
                        recipientEmail: doctor.email,
                        type: "ROOM_BOOKING_REQUESTED",
                        payload: {
                            doctorName: doctor.name,
                            organizationName: org.name,
                            roomNumber: room.roomNumber,
                            date: lockedSlot.date ? lockedSlot.date.toISOString().split("T")[0] : "",
                            startTime: lockedSlot.localStartTime || "",
                            endTime: lockedSlot.localEndTime || "",
                            sequenceNumber: assignedSeq
                        }
                    },
                    session
                );
            });
        } catch (txErr) {
            if (txErr.statusCode) {
                return res.status(txErr.statusCode).json({ status: "failed", msg: txErr.message });
            }
            if (txErr.code === 11000) {
                return res.status(409).json({
                    status: "failed",
                    msg: "Duplicate pending request detected for this slot."
                });
            }
            if (txErr.message && txErr.message.includes("Database transaction unavailable")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for atomic requests."
                });
            }
            throw txErr;
        }

        // Trigger immediate allocation attempt for this slot
        try {
            await processSlotAllocation(slotId);
        } catch (allocErr) {
            console.error("Immediate slot allocation attempt logged:", allocErr.message);
        }

        // Fetch fresh request state after allocation run
        const finalRequest = await RoomBookingRequest.findById(newRequest._id)
            .populate("allocatedBooking");

        return res.status(201).json({
            status: "success",
            msg: finalRequest.status === "ALLOCATED"
                ? "Room booking request allocated successfully."
                : `Room request placed in queue (Sequence #${assignedSeq}).`,
            request: finalRequest
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Doctor views their own room requests.
 */
const getDoctorRoomRequests = async (req, res) => {
    try {
        const doctorId = req.userDetails._id || req.userDetails.id;
        const requests = await RoomBookingRequest.find({ doctor: doctorId })
            .populate("room", "roomNumber floor department")
            .populate("roomSlot", "date startDateTime endDateTime localStartTime localEndTime status")
            .populate("organization", "name email timezone")
            .populate("allocatedBooking")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            status: "success",
            count: requests.length,
            requests
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Doctor withdraws a pending room request.
 */
const withdrawRoomBookingRequest = async (req, res) => {
    try {
        const doctorId = req.userDetails._id || req.userDetails.id;
        const { id } = req.params;

        let request;
        try {
            await executeTransactionWithRetry(async (session) => {
                request = await RoomBookingRequest.findOne({ _id: id, doctor: doctorId }).session(session);
                if (!request) {
                    const err = new Error("Room booking request not found.");
                    err.statusCode = 404;
                    throw err;
                }
                if (request.status !== "PENDING") {
                    const err = new Error(`Cannot withdraw request with status '${request.status}'.`);
                    err.statusCode = 400;
                    throw err;
                }

                // Acquire locks
                await acquireScheduleLocks({
                    organizationId: request.organization,
                    roomId: request.room,
                    doctorId,
                    session
                });

                request.status = "CANCELLED";
                request.rejectionReason = "Withdrawn by doctor";
                request.resolvedAt = new Date();
                await request.save({ session });
            });
        } catch (txErr) {
            if (txErr.statusCode) {
                return res.status(txErr.statusCode).json({ status: "failed", msg: txErr.message });
            }
            if (txErr.message && txErr.message.includes("Database transaction unavailable")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for request withdrawal."
                });
            }
            throw txErr;
        }

        // Trigger allocation so next candidate in sequence can be processed
        try {
            await processSlotAllocation(request.roomSlot);
        } catch (allocErr) {
            console.error("Post-withdraw allocation attempt logged:", allocErr.message);
        }

        return res.status(200).json({
            status: "success",
            msg: "Room request withdrawn successfully.",
            request
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

// ========================================================
// 6. ROOM BOOKING LIFECYCLE & CANCELLATION
// ========================================================

/**
 * Views doctor's allocated room bookings across organizations.
 */
const getDoctorRoomBookings = async (req, res) => {
    try {
        const doctorId = req.userDetails._id || req.userDetails.id;
        const { status } = req.query;

        const filter = { doctor: doctorId };
        if (status) filter.status = status;

        const bookings = await RoomBooking.find(filter)
            .populate("room", "roomNumber floor department")
            .populate("roomSlot", "date localStartTime localEndTime")
            .populate("organization", "name email phone timezone address")
            .sort({ startDateTime: -1 });

        return res.status(200).json({
            status: "success",
            count: bookings.length,
            bookings
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Organization views all room bookings for its facility.
 */
const getOrganizationRoomBookings = async (req, res) => {
    try {
        const organizationId = req.organization._id || req.organization.id;
        const { status, roomId } = req.query;

        const filter = { organization: organizationId };
        if (status) filter.status = status;
        if (roomId) filter.room = roomId;

        const bookings = await RoomBooking.find(filter)
            .populate("room", "roomNumber floor department")
            .populate("doctor", "name email specialization qualification phone")
            .populate("roomSlot", "date localStartTime localEndTime")
            .sort({ startDateTime: -1 });

        return res.status(200).json({
            status: "success",
            count: bookings.length,
            bookings
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Cancels an active room booking with explicit audit record and safe slot reopening.
 */
const cancelRoomBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Determine caller identity
        const isDoctor = !!req.userDetails;
        const isOrg = !!req.organization;
        const callerId = isDoctor ? req.userDetails._id : req.organization._id;
        const callerType = isDoctor ? "Doctor" : "Organization";

        const initialBooking = await RoomBooking.findById(id);
        if (!initialBooking) {
            return res.status(404).json({ status: "failed", msg: "Room booking not found." });
        }

        // Pre-check ownership authorization
        if (isDoctor && initialBooking.doctor.toString() !== callerId.toString()) {
            return res.status(403).json({ status: "failed", msg: "Unauthorized: You do not own this booking." });
        }
        if (isOrg && initialBooking.organization.toString() !== callerId.toString()) {
            return res.status(403).json({ status: "failed", msg: "Unauthorized: This booking belongs to another facility." });
        }

        if (initialBooking.status !== "Active") {
            return res.status(400).json({
                status: "failed",
                msg: `Cannot cancel booking with status '${initialBooking.status}'.`
            });
        }

        let cancelledBookingDoc;

        try {
            await executeTransactionWithRetry(async (session) => {
                // 1. Acquire locks in canonical hierarchy using initial IDs
                await acquireScheduleLocks({
                    organizationId: initialBooking.organization,
                    roomId: initialBooking.room,
                    doctorId: initialBooking.doctor,
                    session
                });

                // 2. Re-fetch RoomBooking freshly inside transaction
                const lockedBooking = await RoomBooking.findById(id).session(session);
                if (!lockedBooking) {
                    const err = new Error("Room booking not found inside transaction.");
                    err.statusCode = 404;
                    throw err;
                }

                // 3. Revalidate ownership and references post-lock
                if (
                    lockedBooking.organization.toString() !== initialBooking.organization.toString() ||
                    lockedBooking.room.toString() !== initialBooking.room.toString() ||
                    lockedBooking.doctor.toString() !== initialBooking.doctor.toString()
                ) {
                    const err = new Error("Room booking reference or ownership changed while acquiring locks.");
                    err.statusCode = 409;
                    throw err;
                }

                if (isDoctor && lockedBooking.doctor.toString() !== callerId.toString()) {
                    const err = new Error("Unauthorized: You do not own this booking.");
                    err.statusCode = 403;
                    throw err;
                }
                if (isOrg && lockedBooking.organization.toString() !== callerId.toString()) {
                    const err = new Error("Unauthorized: This booking belongs to another facility.");
                    err.statusCode = 403;
                    throw err;
                }

                // 4. Revalidate that status is still Active post-lock
                if (lockedBooking.status !== "Active") {
                    const err = new Error(`Room booking is no longer active (current status: '${lockedBooking.status}').`);
                    err.statusCode = 409;
                    throw err;
                }

                // 5. Update freshly read Booking state and cancellation metadata (NEVER save initialBooking)
                lockedBooking.status = "Cancelled";
                lockedBooking.cancellationReason = reason ? reason.trim() : "Cancelled";
                lockedBooking.cancelledBy = callerId;
                lockedBooking.cancelledByType = callerType;
                lockedBooking.cancelledAt = new Date();
                await lockedBooking.save({ session });

                cancelledBookingDoc = lockedBooking;

                // 6. Safely reopen room slot with bumped queueGeneration
                const slot = await RoomSlot.findById(lockedBooking.roomSlot).session(session);
                if (slot) {
                    slot.activeBooking = null;
                    slot.queueGeneration += 1; // prevents revived stale requests
                    slot.queueSequenceCounter = 0;
                    slot.status = "Available"; // slot is safely reopened
                    await slot.save({ session });
                }

                // 7. Enqueue durable cancellation job inside the same transaction session
                await defaultDurableWorker.enqueueJob({
                    jobType: "APPOINTMENT_CANCELLATION_CASCADE",
                    targetId: lockedBooking._id,
                    payload: {
                        bookingId: lockedBooking._id.toString(),
                        reason: reason ? reason.trim() : "Cancelled",
                        cancelledBy: callerId.toString(),
                        cancelledByType: callerType
                    },
                    session
                });

                // 8. Atomically cancel immediate bounded batch of patient appointments (up to 25)
                const immediateAppointments = await Appointment.find({
                    roomBooking: lockedBooking._id,
                    status: { $in: ["Pending", "Confirmed"] }
                })
                    .sort({ _id: 1 })
                    .limit(25)
                    .session(session);

                for (const appt of immediateAppointments) {
                    appt.status = "Cancelled";
                    appt.cancellationReason = `Facility room reservation was cancelled: ${reason ? reason.trim() : "Cancelled"}`;
                    appt.cancelledBy = isDoctor ? "Doctor" : "Organization";
                    appt.cancelledAt = new Date();
                    await appt.save({ session });

                    // Queue cancellation notification for each patient
                    const apptPatient = await Patient.findById(appt.patient).session(session);
                    if (apptPatient) {
                        await queueNotification(
                            {
                                recipientEmail: apptPatient.email,
                                type: "APPOINTMENT_CANCELLED",
                                payload: {
                                    patientName: apptPatient.name,
                                    appointmentId: appt._id.toString(),
                                    reason: `Facility room reservation was cancelled: ${reason ? reason.trim() : "Cancelled"}`
                                }
                            },
                            session
                        );
                    }
                }

                // 9. Look up entities for email notifications
                const doctor = await Doctor.findById(lockedBooking.doctor).session(session);
                const org = await Organization.findById(lockedBooking.organization).session(session);
                const room = await Room.findById(lockedBooking.room).session(session);

                // Queue notification to doctor
                if (doctor) {
                    await queueNotification(
                        {
                            recipientEmail: doctor.email,
                            type: "ROOM_BOOKING_CANCELLED",
                            payload: {
                                doctorName: doctor.name,
                                roomNumber: room ? room.roomNumber : "N/A",
                                date: slot?.date ? slot.date.toISOString().split("T")[0] : "",
                                startTime: slot?.localStartTime || "",
                                endTime: slot?.localEndTime || "",
                                reason: reason ? reason.trim() : "Cancelled"
                            }
                        },
                        session
                    );
                }

                // If cancelled by doctor, also notify organization
                if (isDoctor && org) {
                    await queueNotification(
                        {
                            recipientEmail: org.email,
                            type: "ROOM_BOOKING_CANCELLED",
                            payload: {
                                doctorName: doctor ? doctor.name : "Affiliated Doctor",
                                roomNumber: room ? room.roomNumber : "N/A",
                                date: slot?.date ? slot.date.toISOString().split("T")[0] : "",
                                startTime: slot?.localStartTime || "",
                                endTime: slot?.localEndTime || "",
                                reason: `Cancelled by doctor: ${reason ? reason.trim() : "Cancelled"}`
                            }
                        },
                        session
                    );
                }
            });
        } catch (txErr) {
            const statusCode = txErr.statusCode || txErr.status;
            if (statusCode) {
                return res.status(statusCode).json({ status: "failed", msg: txErr.message });
            }
            if (txErr.message && txErr.message.includes("Database transaction unavailable")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for safe booking cancellations."
                });
            }
            throw txErr;
        }

        return res.status(200).json({
            status: "success",
            msg: "Room booking cancelled successfully and slot reopened for booking.",
            booking: cancelledBookingDoc
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

const CANCELLATION_BATCH_SIZE = 25;

/**
 * Bounded batch processor for cancelling appointments associated with a cancelled RoomBooking.
 * Processes in bounded batches inside transaction sessions with Outbox notifications.
 */
async function processAppointmentCancellationBatch(bookingId, payload = {}) {
    const reasonText = payload.reason || "Room reservation cancelled";
    const cancelledBy = payload.cancelledByType === "Doctor" ? "Doctor" : "Organization";

    let hasMore = true;
    while (hasMore) {
        let countThisBatch = 0;
        await executeTransactionWithRetry(async (session) => {
            const appointments = await Appointment.find({
                roomBooking: bookingId,
                status: { $in: ["Pending", "Confirmed"] }
            })
                .sort({ _id: 1 })
                .limit(CANCELLATION_BATCH_SIZE)
                .session(session);

            if (!appointments || appointments.length === 0) {
                hasMore = false;
                return;
            }

            for (const appt of appointments) {
                appt.status = "Cancelled";
                appt.cancellationReason = `Facility room reservation was cancelled: ${reasonText}`;
                appt.cancelledBy = cancelledBy;
                appt.cancelledAt = new Date();
                await appt.save({ session });

                const apptPatient = await Patient.findById(appt.patient).session(session);
                if (apptPatient) {
                    await queueNotification(
                        {
                            recipientEmail: apptPatient.email,
                            type: "APPOINTMENT_CANCELLED",
                            payload: {
                                patientName: apptPatient.name,
                                appointmentId: appt._id.toString(),
                                reason: `Facility room reservation was cancelled: ${reasonText}`
                            }
                        },
                        session
                    );
                }
            }

            countThisBatch = appointments.length;
        });

        if (countThisBatch < CANCELLATION_BATCH_SIZE) {
            hasMore = false;
        }
    }

    return { done: true };
}

// Register DurableJobWorker handlers
defaultDurableWorker.registerHandler("APPOINTMENT_CANCELLATION_CASCADE", async (payload, job) => {
    return await processAppointmentCancellationBatch(job.targetId || payload.bookingId, payload);
});

defaultDurableWorker.registerHandler("FCFS_SLOT_ALLOCATION", async (payload, job) => {
    const slotId = job.targetId || payload.slotId;
    const result = await processSlotAllocation(slotId, { allowUnbounded: true });
    return { done: true, result };
});

/**
 * Organization views queue requests for its facility rooms.
 */
const getOrganizationRoomRequests = async (req, res) => {
    try {
        const organizationId = req.organization._id || req.organization.id;
        const requests = await RoomBookingRequest.find({ organization: organizationId })
            .populate("room", "roomNumber floor department")
            .populate("doctor", "name email specialization")
            .populate("roomSlot", "date localStartTime localEndTime status")
            .populate("allocatedBooking")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            status: "success",
            count: requests.length,
            requests
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Organization views patient appointments booked across its facility rooms.
 */
const getOrganizationAppointments = async (req, res) => {
    try {
        const organizationId = req.organization._id || req.organization.id;
        const appointments = await Appointment.find({ organization: organizationId })
            .populate("doctor", "name email specialization phone")
            .populate("patient", "name email phone")
            .populate("room", "roomNumber floor department")
            .populate("roomSlot", "date localStartTime localEndTime status")
            .populate("roomBooking", "startDateTime endDateTime status")
            .sort({ date: -1, time: -1 });

        return res.status(200).json({
            status: "success",
            count: appointments.length,
            appointments
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

module.exports = {
    // Organization Room Management
    createRoom,
    getOrganizationRooms,
    getRoomById,
    updateRoom,
    toggleRoomOperational,

    // Availability
    createRoomAvailability,
    getOrganizationSlots,
    cancelRoomSlot,

    // Doctor Discovery
    getAvailableRoomsForDoctor,
    getAvailableSlotsForDoctor,

    // FCFS Allocation & Requests
    requestRoomBooking,
    getDoctorRoomRequests,
    withdrawRoomBookingRequest,
    processSlotAllocation,

    // Booking Lifecycle
    getDoctorRoomBookings,
    getOrganizationRoomBookings,
    getOrganizationRoomRequests,
    cancelRoomBooking,
    getOrganizationAppointments,
    processAppointmentCancellationBatch
};
