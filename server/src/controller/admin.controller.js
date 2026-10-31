const mongoose = require("mongoose");
const adminModel = require("../models/admin.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const doctorModel = require("../models/doctor.model");
const patientModel = require("../models/patient.model");
const organizationModel = require("../models/organization.model");
const roomModel = require("../models/room.model");
const roomSlotModel = require("../models/roomSlot.model");
const roomBookingRequestModel = require("../models/roomBookingRequest.model");
const roomBookingModel = require("../models/roomBooking.model");
const appointmentModel = require("../models/appointment.model");
const doctorOrganizationModel = require("../models/doctorOrganization.model");
const config = require("../config/config");
const OTPutil = require("../util/otp.util");
const { queueNotification } = require("../services/outbox.service");
const { acquireScheduleLocks } = require("../util/lock.util");
const { executeTransactionWithRetry } = require("../util/transaction.util");
const { checkDoctorScheduleConflicts } = require("../util/conflict.util");
const { resolveLocalToUtc } = require("../util/time.util");

//Auth

//register
const register = async (req,res)=>{
    try {
        const {email,password} = req.body;

        if(!email|| !password)
        {
            return res.status(400).json({
                "status": "failed",
                "msg": "All fields (email, password) are required."
            });
        }

        const existingAdmin = await adminModel.findOne({email});

        if(existingAdmin)
        {
            return res.status(400).json({
                "status": "failed",
                "msg": "Admin with this email already exists."
            })
        }
        
        const newAdmin = await adminModel.create({email, password});

        const token = jwt.sign({
            id: newAdmin._id
        },config.JWT_TOKEN_SECRET,{
            expiresIn: "1d"
        });

        res.cookie("adminToken",token,{
            httpOnly: true,                     
            secure: process.env.NODE_ENV === "production", 
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",                  
            maxAge: 24 * 60 * 60 * 1000   
        })

        res.status(201).json({
            "status": "success",
            "user": {
                name: newAdmin.name,
                email: newAdmin.email
            }
        })

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

//Login
const login = async (req,res)=>{
    try {
        const {email,password}= req.body; 

        if(!email || !password)
        {
            return res.status(401).json({
                "status": "failed",
                "msg":"Email and password are required."
            });
        }

        const admin = await adminModel.findOne({email});

        if(!admin)
        {
            return res.status(404).json({
                "status": "failed",
                "msg":"User not found."
            });
        }

        const vaildPassword = await admin.comparePassword(password);

        if(!vaildPassword)
        {
            return res.status(401).json({
                "status": "failed",
                "msg":"Wrong email or password."
            });
        }

        const token = await jwt.sign({
            id:  admin._id 
        },config.JWT_TOKEN_SECRET,{
            expiresIn: "1d"
        })

        res.cookie("adminToken", token, {
            httpOnly: true,                     
            secure: process.env.NODE_ENV === "production", 
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",                  
            maxAge: 24 * 60 * 60 * 1000          
        });

        return res.status(200).json({
            "status": "success",
            "msg": "Login successful"
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

//logout
const logout = async (req,res) =>{
    try {
        res.clearCookie("adminToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
        });

        res.status(200).json({msg : "Logged out Successfully "});
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

//send reset password EMAIL Otp
const sendMailAdminResetPass = async (req,res) =>{
    try {
        const {email} = req.body;
        const admin = await adminModel.findOne({email:email});

        if(!admin)
        {
            return res.status(404).json({
                status: "failed",
                msg: "User don't Exist"
            })
        }

        let newOTP = OTPutil.generateOTP();
        admin.resetOTP = newOTP;
        admin.OTPExpiry = Date.now() + 5 * 60 * 1000; // 5 min 
        
        await admin.save();

        await OTPutil.sendResetPassMail(newOTP, email);


        res.status(200).json({
            status: "success",
            mdg: "OTP has been send to your Email."
        })

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

//verify-opt
const verifyOTAdminResetPass = async (req,res) => {
    try {
        const {email , OTP} = req.body;

        const admin = await adminModel.findOne({email});

        if(!admin || admin.resetOTP !== OTP)
        {
            return res.status(400).json({
                msg: "Invaild OTP"
            })
        }

        if(admin.OTPExpiry < Date.now())
        {
            return res.status(400).json({
                msg: "OTP expired"
            })
        }

        res.status(200).json({
            msg: "OTP verifed"
        })

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

//change password

const changePassword = async (req,res) => {
    try {
        const {email , OTP , newpassword} = req.body;

        const admin = await adminModel.findOne({email});

        if(!admin || admin.resetOTP !== OTP)
        {
            return res.status(400).json({msg: "Invaild OTP."})
        }

        if(admin.OTPExpiry < Date.now())
        {
            return res.status(400).json({
                msg: "OTP expired"
            })
        }

        const isSamePassword = await admin.comparePassword(newpassword);
        
        if (isSamePassword) {
        return res.status(400).json({ msg: "New password cannot be the same as the old password." });
        }

        admin.password = newpassword;
        admin.resetOTP = null;
        admin.OTPExpiry = null;

        await admin.save();

        res.status(200).json({
            status: "success",
            msg : "password reset successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}


//admin powers

//veiw all doctors 
const getDoctors = async (req,res) =>{
    try {
        const admin = req.userDetails;

        if(!admin)
        {
            return res.status(401).json({
                "status": "failed",
                "msg": "Unauthorized access."
            })
        }
        
        const doctors = await doctorModel.find({}).select("-password");

        res.status(200).json({ 
            status: 'success', 
            count: doctors.length, 
            doctors 
        });

        
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

const updateDoctorVerification = async (req, res) => {
    try {
        const admin = req.userDetails;

        if (!admin) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access."
            });
        }

        const { doctorId, isVerified } = req.body;

        const updatedDoctor = await doctorModel.findByIdAndUpdate(
            doctorId,
            {
                isVerifiedByAdmin: isVerified
            },
            {
                returnDocument: "after"
            }
        ).select("-password");

        if (!updatedDoctor) {
            return res.status(404).json({
                status: "failed",
                msg: "Doctor not found."
            });
        }

        return res.status(200).json({
            status: "success",
            msg: isVerified
                ? "Doctor verified successfully."
                : "Doctor unverified successfully.",
            data: updatedDoctor
        });

    } catch (error) {
        return res.status(500).json({
            status: "failed",
            message: error.message
        });
    }
};

const getPatients = async (req,res) =>{
    try {
        const admin = req.userDetails;

        if(!admin) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }
        
        const patients = await patientModel.find({}).select("-password");

        res.status(200).json({ status: 'success', count: patients.length, patients });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const updateDoctorBlockStatus = async (req, res) => {
    try {
        const admin = req.userDetails;
        if (!admin) return res.status(401).json({ status: "failed", msg: "Unauthorized access." });

        const { doctorId, isBlocked } = req.body;
        const updatedDoctor = await doctorModel.findByIdAndUpdate(
            doctorId, { isBlocked }, { returnDocument: "after" }
        ).select("-password");

        if (!updatedDoctor) return res.status(404).json({ status: "failed", msg: "Doctor not found." });

        return res.status(200).json({
            status: "success",
            msg: isBlocked ? "Doctor blocked successfully." : "Doctor unblocked successfully.",
            data: updatedDoctor
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

const updatePatientBlockStatus = async (req, res) => {
    try {
        const admin = req.userDetails;
        if (!admin) return res.status(401).json({ status: "failed", msg: "Unauthorized access." });

        const { patientId, isBlocked } = req.body;
        const updatedPatient = await patientModel.findByIdAndUpdate(
            patientId, { isBlocked }, { returnDocument: "after" }
        ).select("-password");

        if (!updatedPatient) return res.status(404).json({ status: "failed", msg: "Patient not found." });

        return res.status(200).json({
            status: "success",
            msg: isBlocked ? "Patient blocked successfully." : "Patient unblocked successfully.",
            data: updatedPatient
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

// ==================== ORGANIZATION MANAGEMENT ====================

const getOrganizations = async (req, res) => {
    try {
        const admin = req.userDetails;
        if (!admin) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const { search, type, verificationStatus, blockStatus } = req.query;
        const filter = {};

        if (type) {
            filter.type = type;
        }

        if (verificationStatus === "verified") {
            filter.isVerifiedByAdmin = true;
        } else if (verificationStatus === "unverified") {
            filter.isVerifiedByAdmin = false;
        }

        if (blockStatus === "blocked") {
            filter.isBlocked = true;
        } else if (blockStatus === "unblocked") {
            filter.isBlocked = false;
        }

        if (search) {
            const regex = new RegExp(search.trim(), "i");
            filter.$or = [
                { name: regex },
                { email: regex },
                { registrationNumber: regex },
                { "address.city": regex }
            ];
        }

        const organizations = await organizationModel
            .find(filter)
            .select("-password -resetOTP -OTPExpiry")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            status: "success",
            count: organizations.length,
            organizations
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

const getOrganizationById = async (req, res) => {
    try {
        const admin = req.userDetails;
        if (!admin) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const organization = await organizationModel
            .findById(req.params.id)
            .select("-password -resetOTP -OTPExpiry");

        if (!organization) {
            return res.status(404).json({ status: "failed", msg: "Organization not found." });
        }

        return res.status(200).json({
            status: "success",
            organization
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

const updateOrganizationVerification = async (req, res) => {
    try {
        const admin = req.userDetails;
        if (!admin) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const { organizationId, isVerified, reason } = req.body;

        const organization = await organizationModel.findById(organizationId);
        if (!organization) {
            return res.status(404).json({ status: "failed", msg: "Organization not found." });
        }

        // Atomic transaction mandatory for state change and outbox notification
        let session;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            if (session) {
                await session.endSession();
            }
            return res.status(500).json({
                status: "failed",
                msg: "Database transaction unavailable. Atomic organization state changes require an active MongoDB replica set."
            });
        }

        try {
            organization.isVerifiedByAdmin = isVerified;
            organization.scheduleVersion += 1;
            await organization.save({ session });

            await queueNotification(
                {
                    recipientEmail: organization.email,
                    type: isVerified ? "ORGANIZATION_APPROVED" : "ORGANIZATION_REJECTED",
                    payload: {
                        organizationName: organization.name,
                        reason: reason || (isVerified ? "Verification approved by MedCare AI Admin" : "Verification requirements not met")
                    }
                },
                session
            );

            await session.commitTransaction();
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

        const updatedOrganization = await organizationModel
            .findById(organizationId)
            .select("-password -resetOTP -OTPExpiry");

        return res.status(200).json({
            status: "success",
            msg: isVerified ? "Organization verified successfully." : "Organization unverified successfully.",
            data: updatedOrganization
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

const updateOrganizationBlockStatus = async (req, res) => {
    try {
        const admin = req.userDetails;
        if (!admin) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const { organizationId, isBlocked, reason } = req.body;

        const organization = await organizationModel.findById(organizationId);
        if (!organization) {
            return res.status(404).json({ status: "failed", msg: "Organization not found." });
        }

        // Atomic transaction mandatory for state change and outbox notification
        let session;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            if (session) {
                await session.endSession();
            }
            return res.status(500).json({
                status: "failed",
                msg: "Database transaction unavailable. Atomic organization state changes require an active MongoDB replica set."
            });
        }

        try {
            // 1. Acquire Organization Eligibility Lock FIRST (Tier 0)
            await acquireScheduleLocks({ organizationId, session });

            // 2. Re-read organization inside transaction
            const org = await organizationModel.findById(organizationId).session(session);
            if (!org) {
                await session.abortTransaction();
                return res.status(404).json({ status: "failed", msg: "Organization not found." });
            }

            org.isBlocked = isBlocked;
            await org.save({ session });

            // 3. If blocking, lock affected rooms in deterministic order and update operational state
            if (isBlocked) {
                const rooms = await roomModel.find({ organization: organizationId }).sort({ _id: 1 }).session(session);
                for (const r of rooms) {
                    await acquireScheduleLocks({ roomId: r._id, session });
                    r.isOperational = false;
                    await r.save({ session });
                }

                // Move all available or queued slots to Maintenance
                await roomSlotModel.updateMany(
                    { organization: organizationId, status: { $in: ["Available", "Queued"] } },
                    { $set: { status: "Maintenance" } },
                    { session }
                );

                // Explicitly reject pending allocation requests from affected organization
                await roomBookingRequestModel.updateMany(
                    { organization: organizationId, status: "PENDING" },
                    {
                        $set: {
                            status: "REJECTED_ORG_SUSPENDED",
                            rejectionReason: reason || "Organization account suspended by MedCare AI Admin",
                            resolvedAt: new Date()
                        }
                    },
                    { session }
                );
            }

            await queueNotification(
                {
                    recipientEmail: organization.email,
                    type: isBlocked ? "ORGANIZATION_BLOCKED" : "ORGANIZATION_UNBLOCKED",
                    payload: {
                        organizationName: organization.name,
                        reason: reason || (isBlocked ? "Administrative suspension" : "Suspension lifted")
                    }
                },
                session
            );

            await session.commitTransaction();
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

        const updatedOrganization = await organizationModel
            .findById(organizationId)
            .select("-password -resetOTP -OTPExpiry");

        return res.status(200).json({
            status: "success",
            msg: isBlocked ? "Organization blocked successfully." : "Organization unblocked successfully.",
            data: updatedOrganization
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Administratively resolves a historical unconfirmed appointment by linking it to a verified RoomBooking.
 * Strictly complies with Phase 1/6 audit requirements:
 * - Uses MongoDB transaction with canonical lock ordering: Organization -> Room -> Doctor -> DoctorOrganization
 * - Re-reads the appointment inside the transaction
 * - Compares its current RoomBooking reference with the reference originally selected for resolution
 * - Verifies that the referenced RoomBooking belongs to the expected doctor and room
 * - Verifies that the room belongs to the expected organization
 * - Revalidates all required statuses and interval relationships
 */
const resolveHistoricalAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const { roomBookingId, reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            return res.status(400).json({ status: "failed", msg: "Invalid Appointment ID format." });
        }
        if (!mongoose.Types.ObjectId.isValid(roomBookingId)) {
            return res.status(400).json({ status: "failed", msg: "Invalid Room Booking ID format." });
        }

        // Initial pre-check (must be re-verified inside transaction after locks)
        const initialAppt = await appointmentModel.findById(appointmentId);
        if (!initialAppt) {
            return res.status(404).json({ status: "failed", msg: "Appointment not found." });
        }
        if (initialAppt.status === "Cancelled" || initialAppt.status === "Expired") {
            return res.status(400).json({ status: "failed", msg: `Cannot resolve appointment in '${initialAppt.status}' state.` });
        }

        const initialBooking = await roomBookingModel.findById(roomBookingId);
        if (!initialBooking) {
            return res.status(404).json({ status: "failed", msg: "Room booking not found." });
        }

        const initialAff = await doctorOrganizationModel.findOne({
            doctor: initialBooking.doctor,
            organization: initialBooking.organization
        });

        let resolvedAppointment;

        try {
            await executeTransactionWithRetry(async (session) => {
                // 1. Acquire locks in canonical hierarchy: Org (0) -> Room (1) -> Doctor (2) -> DoctorOrganization (3)
                await acquireScheduleLocks({
                    organizationId: initialBooking.organization,
                    roomId: initialBooking.room,
                    doctorId: initialBooking.doctor,
                    doctorOrganizationId: initialAff ? initialAff._id : null,
                    session
                });

                // 2. Re-read the appointment inside transaction after locks
                const appt = await appointmentModel.findById(appointmentId).session(session);
                if (!appt) {
                    const err = new Error("Appointment not found inside transaction.");
                    err.statusCode = 404;
                    throw err;
                }
                if (appt.status === "Cancelled" || appt.status === "Expired") {
                    const err = new Error(`Cannot resolve appointment in '${appt.status}' state.`);
                    err.statusCode = 409;
                    throw err;
                }

                // 3. Stale reference check: compare current roomBooking with reference selected for resolution
                if (appt.roomBooking && appt.roomBooking.toString() !== roomBookingId.toString()) {
                    const err = new Error("Stale reference detected: Appointment has already been linked to a different RoomBooking.");
                    err.statusCode = 409;
                    throw err;
                }

                // 4. Re-read the RoomBooking inside transaction
                const booking = await roomBookingModel.findById(roomBookingId).session(session);
                if (!booking) {
                    const err = new Error("Room booking not found inside transaction.");
                    err.statusCode = 404;
                    throw err;
                }
                if (booking.status !== "Active") {
                    const err = new Error(`Referenced RoomBooking is not active (current status: ${booking.status}).`);
                    err.statusCode = 409;
                    throw err;
                }

                // 5. Verify RoomBooking belongs to expected doctor and room
                if (booking.doctor.toString() !== appt.doctor.toString()) {
                    const err = new Error("RoomBooking doctor does not match the appointment doctor.");
                    err.statusCode = 409;
                    throw err;
                }
                if (appt.room && booking.room.toString() !== appt.room.toString()) {
                    const err = new Error("RoomBooking room does not match the appointment room.");
                    err.statusCode = 409;
                    throw err;
                }
                if (booking.room.toString() !== initialBooking.room.toString()) {
                    const err = new Error("RoomBooking room does not match expected room.");
                    err.statusCode = 409;
                    throw err;
                }

                // 6. Re-read Room and verify it belongs to the expected organization
                const room = await roomModel.findById(booking.room).session(session);
                if (!room) {
                    const err = new Error("Room not found.");
                    err.statusCode = 404;
                    throw err;
                }
                if (!room.isOperational) {
                    const err = new Error("Room is not operational.");
                    err.statusCode = 409;
                    throw err;
                }
                if (room.organization.toString() !== booking.organization.toString()) {
                    const err = new Error("Room belongs to another organization.");
                    err.statusCode = 409;
                    throw err;
                }

                // 7. Re-read Organization and verify status
                const org = await organizationModel.findById(booking.organization).session(session);
                if (!org || org.isBlocked || !org.isVerifiedByAdmin || !org.isEmailVerified) {
                    const err = new Error("Organization is suspended, unverified, or not found.");
                    err.statusCode = 409;
                    throw err;
                }

                // 8. Re-read Doctor and verify status
                const doctor = await doctorModel.findById(appt.doctor).session(session);
                if (!doctor || doctor.isBlocked || !doctor.isEmailVerified) {
                    const err = new Error("Doctor is suspended or email unverified.");
                    err.statusCode = 409;
                    throw err;
                }

                // 9. Re-read DoctorOrganization affiliation and verify Approved
                const affiliation = await doctorOrganizationModel.findOne({
                    doctor: appt.doctor,
                    organization: booking.organization,
                    status: "Approved"
                }).session(session);
                if (!affiliation) {
                    const err = new Error("Doctor does not have an Approved affiliation with this organization.");
                    err.statusCode = 409;
                    throw err;
                }

                // 10. Revalidate interval relationships
                const dateStr = appt.date instanceof Date ? appt.date.toISOString().split("T")[0] : String(appt.date).split("T")[0];
                const timeStr = appt.time;
                const orgTimezone = org.timezone || "Asia/Kolkata";

                let resolvedTime;
                try {
                    resolvedTime = resolveLocalToUtc({
                        dateStr,
                        timeStr,
                        timezone: orgTimezone,
                        durationMinutes: 30
                    });
                } catch (tzErr) {
                    const err = new Error(`Timezone resolution failed: ${tzErr.message}`);
                    err.statusCode = 400;
                    throw err;
                }

                const { startDateTime, endDateTime } = resolvedTime;

                // Verify appointment interval falls completely inside doctor's active RoomBooking
                if (startDateTime < booking.startDateTime || endDateTime > booking.endDateTime) {
                    const err = new Error(`Appointment interval (${startDateTime.toISOString()} - ${endDateTime.toISOString()}) is not contained within the RoomBooking (${booking.startDateTime.toISOString()} - ${booking.endDateTime.toISOString()}).`);
                    err.statusCode = 409;
                    throw err;
                }

                // Check for overlapping appointments for this doctor (excluding this appointment)
                const conflict = await checkDoctorScheduleConflicts(appt.doctor, startDateTime, endDateTime, session, {
                    excludeAppointmentId: appt._id,
                    excludeRoomBookingId: booking._id
                });
                if (conflict && conflict.hasConflict) {
                    const err = new Error(`Schedule conflict detected: ${conflict.reason}`);
                    err.statusCode = 409;
                    throw err;
                }

                // Check room appointment conflict
                const roomConflict = await appointmentModel.findOne({
                    room: booking.room,
                    status: { $in: ["Pending", "Confirmed"] },
                    startDateTime: { $lt: endDateTime },
                    endDateTime: { $gt: startDateTime },
                    _id: { $ne: appt._id }
                }).session(session);
                if (roomConflict) {
                    const err = new Error("Room already has an overlapping appointment during this interval.");
                    err.statusCode = 409;
                    throw err;
                }

                // 11. Mutate appointment atomically
                appt.bookingType = "Organization";
                appt.organization = booking.organization;
                appt.room = booking.room;
                appt.roomSlot = booking.roomSlot;
                appt.roomBooking = booking._id;
                appt.startDateTime = startDateTime;
                appt.endDateTime = endDateTime;
                appt.timezone = orgTimezone;
                appt.isTimezoneUnconfirmed = false;
                appt.isDurationEstimated = false;
                await appt.save({ session });

                resolvedAppointment = appt;

                // 12. Queue transactional outbox notification
                const patient = await patientModel.findById(appt.patient).session(session);
                if (patient) {
                    await queueNotification(
                        {
                            recipientEmail: patient.email,
                            type: "APPOINTMENT_CONFIRMED",
                            payload: {
                                patientName: patient.name,
                                doctorName: doctor.name,
                                date: dateStr,
                                time: timeStr,
                                venue: `${org.name}, Room ${room.roomNumber}`
                            }
                        },
                        session
                    );
                }
            });
        } catch (txErr) {
            if (txErr.statusCode) {
                return res.status(txErr.statusCode).json({ status: "failed", msg: txErr.message });
            }
            if (txErr.message && txErr.message.includes("Database transaction unavailable")) {
                return res.status(500).json({
                    status: "failed",
                    msg: "Database transaction failed: MongoDB replica set is required for safe resolution."
                });
            }
            throw txErr;
        }

        return res.status(200).json({
            status: "success",
            msg: "Historical appointment successfully resolved and linked to facility RoomBooking.",
            data: resolvedAppointment
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

module.exports = {
    register,
    login,
    logout,
    sendMailAdminResetPass,
    verifyOTAdminResetPass,
    changePassword,
    getDoctors,
    updateDoctorVerification,
    getPatients,
    updateDoctorBlockStatus,
    updatePatientBlockStatus,
    getOrganizations,
    getOrganizationById,
    updateOrganizationVerification,
    updateOrganizationBlockStatus,
    resolveHistoricalAppointment
};