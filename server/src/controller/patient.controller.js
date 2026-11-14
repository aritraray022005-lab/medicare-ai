const Patient = require("../models/patient.model");
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Doctor = require("../models/doctor.model");
const appointmentModel = require("../models/appointment.model");
const Organization = require("../models/organization.model");
const DoctorOrganization = require("../models/doctorOrganization.model");
const Room = require("../models/room.model");
const RoomSlot = require("../models/roomSlot.model");
const RoomBooking = require("../models/roomBooking.model");
const config = require("../config/config");

const OTPutil = require("../util/otp.util");
const { executeTransactionWithRetry } = require("../util/transaction.util");
const { acquireScheduleLocks } = require("../util/lock.util");
const { checkDoctorScheduleConflicts } = require("../util/conflict.util");
const { resolveLocalToUtc } = require("../util/time.util");
const { queueNotification } = require("../services/outbox.service");
const {
    APPOINTMENT_STATUS,
    SLOT_HOLDING_STATUSES,
    resolveTimezone,
    localDateKey,
    formatLocal
} = require("../util/appointmentLifecycle.util");
const { toPatientAppointmentView, toPatientDoctorView } = require("../util/appointmentView.util");

// Auth 
// Register
const register = async (req, res) => {
    try {
        const {name,email,password} = req.body;

        if(!name || !email || !password)
        {
            return res.status(400).json({
                "status": "failed",
                "msg": "All fields (name, email, password) are required."
            })
        }
        
        const existingPatient = await Patient.findOne({ email });
        
        if(existingPatient)
        {
            return res.status(400).json({
                "status": "failed",
                "msg": "Patient with this email already exists."
            })
        }
        
        const newPatient = await Patient.create({name,email,password });

        const token = jwt.sign({
            id: newPatient._id
        },config.JWT_TOKEN_SECRET,
        {
            expiresIn: "1d"
        });

        res.cookie("patientToken", token, {
            httpOnly: true,                     
            secure: process.env.NODE_ENV === "production", 
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",                  
            maxAge: 24 * 60 * 60 * 1000          
        });


        res.status(201).json({
            "status": "success",
            "user": {
                name: newPatient.name,
                email: newPatient.email
            }
        })
        
        
        
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

//Login
const login = async (req, res) => {
    try {
       const {email,password} = req.body;

       if(!email || !password)
       {
        return res.status(401).json({
            "status": "failed",
            "msg":"Email and password are required."
        });
       }

       const patient = await Patient.findOne({email});

       if(!patient)
       {
        return res.status(404).json({
            "status": "failed",
            "msg":"User not found."
        });
       }

       if(patient.isBlocked)
       {
           return res.status(403).json({
               "status": "failed",
               "msg": "Your account has been blocked by the admin."
           });
       }

        const vaildPassword = await patient.comparePassword(password) ;

        if(!vaildPassword)
        {
            return res.status(401).json({
                "status": "failed",
                "msg":"Wrong email or password."
            });
        }

        const token = jwt.sign({
                id: patient._id
            },config.JWT_TOKEN_SECRET,{
                expiresIn: "1d"
        });
        
        res.cookie("patientToken", token, {
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
};

//logout
const logout = async (req,res) => {
    try {
        res.clearCookie("patientToken", {
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

// otp validation for user email verifaction
const sendMailPatientVerifaction = async (req,res) =>{
    try {
        const _id = req.userDetails?._id;

        if (!_id) {
            return res.status(401).json({
                status: "failed",
                msg: "User not authenticated"
            });
        }
        
        const patient = await Patient.findOne({_id});

        
        if(!patient)
        {
            return res.status(404).json({
                status: "failed",
                msg: "User don't Exist"
            })
        }

        if(patient.isEmailVerified === true)
        {
            return res.status(404).json({
                status: "failed",
                msg: "User email is Already verified"
            })
        }

        let newOTP = OTPutil.generateOTP();
        patient.resetOTP = newOTP;
        patient.OTPExpiry = Date.now() + 5 * 60 * 1000; // 5 min 
        
        await patient.save();

        userEmail = patient.email;
        await OTPutil.sendAccountVerificationMail(newOTP, userEmail);
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

const verifyOTPPatientVerifaction = async (req,res) => {
    try {
        const _id = req.userDetails?._id;

        if (!_id) {
            return res.status(401).json({
                status: "failed",
                msg: "User not authenticated"
            });
        }
        
        const patient = await Patient.findOne({_id});


        const {OTP} = req.body;

        if(!patient || patient.resetOTP !== OTP)
        {
            return res.status(400).json({
                msg: "Invaild OTP"
            })
        }

        if(patient.OTPExpiry < Date.now())
        {
            return res.status(400).json({
                msg: "OTP expired"
            })
        }

        patient.isEmailVerified = true;
        patient.resetOTP = null;
        patient.OTPExpiry = null;

        await patient.save();

        res.status(200).json({
            status: "success",
            msg: "Email verifed Successfully"
        })

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}


// otp validation for reset password

//send reset password EMAIL Otp
const sendMailPatientResetPass = async (req,res) =>{
    try {
        const {email} = req.body;
        const patient = await Patient.findOne({email:email});

        if(!patient)
        {
            return res.status(404).json({
                status: "failed",
                msg: "User don't Exist"
            })
        }


        let newOTP = OTPutil.generateOTP();
        patient.resetOTP = newOTP;
        patient.OTPExpiry = Date.now() + 5 * 60 * 1000; // 5 min 
        
        await patient.save();

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
const verifyOTPPatientResetPass = async (req,res) => {
    try {
        const {email , OTP} = req.body;

        const patient = await Patient.findOne({email});

        if(!patient || patient.resetOTP !== OTP)
        {
            return res.status(400).json({
                msg: "Invaild OTP"
            })
        }

        if(patient.OTPExpiry < Date.now())
        {
            return res.status(400).json({
                msg: "OTP expired"
            })
        }

        res.status(200).json({
            msg: "OTP verifed "
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

        const patient = await Patient.findOne({email});

        if(!patient || patient.resetOTP !== OTP)
        {
            return res.status(400).json({msg: "Invaild OTP."})
        }

        if(patient.OTPExpiry < Date.now())
        {
            return res.status(400).json({
                msg: "OTP expired"
            })
        }

        const isSamePassword = await patient.comparePassword(newpassword);
        
        if (isSamePassword) {
        return res.status(400).json({ msg: "New password cannot be the same as the old password." });
        }

        patient.password = newpassword;
        patient.resetOTP = null;
        patient.OTPExpiry = null;

        await patient.save();

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



// Profile

//getprofile 
const getprofile = async(req,res) => {
    try {
        const patient = req.userDetails;
        if (!patient) {
            return res.status(401).json({
                "status": "failed",
                "msg": "Unauthorized access."
            });
        }

        // Convert to plain object if using Mongoose, then remove password (Ask sir)
        const patientProfile = patient.toObject ? patient.toObject() : { ...patient };
        delete patientProfile.password;

        return res.status(200).json({
            status: "success",
            user: patientProfile 
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

//update profile
const updatePatientProfile = async (req, res) => {
    try {
        const user = req.userDetails;

        if (!user) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access."
            });
        }

        const { name,phone,age,gender,address } = req.body;

        const updates = {};

        if (name !== undefined) updates.name = name;
        if (phone !== undefined) updates.phone = phone;
        if (age !== undefined) updates.age = age;
        if (gender !== undefined) updates.gender = gender;
        if (address !== undefined) updates.address = address;

        const updatedPatient = await Patient.findByIdAndUpdate(
            user._id,
            { $set: updates },
            {
                returnDocument: 'after',
                runValidators: true
            }
        );

        if (!updatedPatient) {
            return res.status(404).json({
                status: "failed",
                msg: "Patient profile not found."
            });
        }

        return res.status(200).json({
            status: "success",
            msg: "Profile updated successfully.",
            data: {
                name: updatedPatient.name,
                email: updatedPatient.email,
                phone: updatedPatient.phone,
                age: updatedPatient.age,
                gender: updatedPatient.gender,
                address: updatedPatient.address
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: "error",
            msg: "An error occurred while updating the profile.",
            error: error.message
        });
    }
};

// delete profile
const deleteprofile = async (req,res) =>{
    try {
        const user = req.userDetails;
        if(!user)
        {
            return res.status(401).json({
                "status": "failed",
                "msg": "Unauthorized access."
            })
        }
        const deletePatient = await Patient.findByIdAndDelete(user.id);

        if(!deletePatient)
        {
            return res.status(404).json({
                status: "failed",
                msg: "Patient profile not found."
            });
        }

        return res.status(200).json({
            status: "success",
            msg: "Profile deleted successfully."
        });


    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }

}

 
// Appointments

//get all doctors
const getDoctors = async (req,res) => {
    try {

        const patient = req.userDetails;
        if (!patient) {
            return res.status(401).json({
                "status": "failed",
                "msg": "Unauthorized access."
            });
        }

        const doctors = await Doctor.find({"isVerifiedByAdmin": true ,"isEmailVerified": true}).select("-password");


        return res.status(200).json({
        "status": "success",
        "data": doctors
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

// ========================================
// PHASE 6: ORGANIZATION DISCOVERY & AVAILABILITY
// ========================================

/**
 * Patient views all approved, verified, and unblocked organizations.
 */
const getApprovedOrganizations = async (req, res) => {
    try {
        const organizations = await Organization.find({
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false
        })
        .select("name email phone address timezone createdAt")
        .sort({ name: 1 })
        .lean();

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
 * Patient views doctors affiliated with an approved organization who have upcoming room reservations.
 */
const getOrganizationDoctors = async (req, res) => {
    try {
        const { organizationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(organizationId)) {
            return res.status(400).json({ status: "failed", msg: "Invalid Organization ID." });
        }

        const org = await Organization.findById(organizationId);
        if (!org || org.isBlocked || !org.isVerifiedByAdmin || !org.isEmailVerified) {
            return res.status(404).json({ status: "failed", msg: "Organization not found, unverified, or suspended." });
        }

        // Find approved affiliations
        const approvedAffiliations = await DoctorOrganization.find({
            organization: organizationId,
            status: "Approved"
        }).lean();

        const doctorIds = approvedAffiliations.map(a => a.doctor);

        // Fetch doctors who are email verified and not blocked (admin verification not required for affiliated consults)
        const doctorDocs = await Doctor.find({
            _id: { $in: doctorIds },
            isEmailVerified: true,
            isBlocked: false
        })
        .select("name specialization qualification experience bio profilePicture consultationFee rating reviewCount")
        .lean();

        // Public doctor profile only (no credentials, contact or verification data)
        const doctors = doctorDocs.map(d => toPatientDoctorView(d));

        // Upcoming doctor schedules. Expired schedules (end time already passed) are excluded.
        // Room / floor / internal booking IDs are intentionally NOT returned to patients.
        const now = new Date();
        const activeBookings = await RoomBooking.find({
            organization: organizationId,
            doctor: { $in: doctorIds },
            status: "Active",
            endDateTime: { $gt: now }
        })
        .populate("roomSlot", "date localStartTime localEndTime")
        .sort({ startDateTime: 1 })
        .lean();

        const schedules = activeBookings.map(b => ({
            doctor: b.doctor,
            date: b.roomSlot?.date || null,
            localStartTime: b.roomSlot?.localStartTime || null,
            localEndTime: b.roomSlot?.localEndTime || null,
            startDateTime: b.startDateTime,
            endDateTime: b.endDateTime
        }));

        return res.status(200).json({
            status: "success",
            organization: {
                _id: org._id,
                name: org.name,
                address: org.address,
                phone: org.phone,
                timezone: org.timezone
            },
            doctors,
            activeBookings: schedules
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

/**
 * Patient views available consultation slots within active RoomBookings.
 */
const getOrganizationAppointmentAvailability = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const { doctorId, dateStr } = req.query;

        if (!organizationId || !doctorId) {
            return res.status(400).json({ status: "failed", msg: "organizationId and doctorId are required." });
        }
        if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(doctorId)) {
            return res.status(400).json({ status: "failed", msg: "Invalid organizationId or doctorId." });
        }
        if (dateStr !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
            return res.status(400).json({ status: "failed", msg: "dateStr must be in YYYY-MM-DD format." });
        }

        const org = await Organization.findById(organizationId);
        if (!org || org.isBlocked || !org.isVerifiedByAdmin || !org.isEmailVerified) {
            return res.status(404).json({ status: "failed", msg: "Organization not found or inactive." });
        }

        const orgTimezone = resolveTimezone(org.timezone);
        const now = new Date();
        const nowMs = now.getTime();

        // Only schedules that have not ended yet. Historical doctor schedules are never returned.
        // (Patients can no longer filter by room: rooms are internal to the facility.)
        const activeBookings = await RoomBooking.find({
            organization: organizationId,
            doctor: doctorId,
            status: "Active",
            endDateTime: { $gt: now }
        })
            .populate("room", "isOperational")
            .populate("roomSlot", "date")
            .sort({ startDateTime: 1 })
            .lean();

        const filteredBookings = activeBookings
            .filter(b => !b.room || b.room.isOperational !== false)
            .filter(b => {
                if (!dateStr) return true;
                const slotDateKey = b.roomSlot?.date ? new Date(b.roomSlot.date).toISOString().split("T")[0] : "";
                return slotDateKey === dateStr || localDateKey(b.startDateTime, orgTimezone) === dateStr;
            });

        const bookingSlots = [];
        for (const booking of filteredBookings) {
            const startMs = new Date(booking.startDateTime).getTime();
            const endMs = new Date(booking.endDateTime).getTime();
            const slotDurationMs = 30 * 60 * 1000;
            const roomRef = booking.room && booking.room._id ? booking.room._id : booking.room;

            const existingAppts = await appointmentModel.find({
                status: { $in: SLOT_HOLDING_STATUSES },
                $or: [
                    { doctor: doctorId, startDateTime: { $lt: new Date(endMs) }, endDateTime: { $gt: new Date(startMs) } },
                    { room: roomRef, startDateTime: { $lt: new Date(endMs) }, endDateTime: { $gt: new Date(startMs) } }
                ]
            }).lean();

            const availableTimes = [];
            for (let t = startMs; t + slotDurationMs <= endMs; t += slotDurationMs) {
                const candStart = new Date(t);
                const candEnd = new Date(t + slotDurationMs);

                // Today's slots whose scheduled end time has passed are hidden
                if (candEnd.getTime() <= nowMs) continue;

                const isOccupied = existingAppts.some(a => {
                    const aStart = new Date(a.startDateTime).getTime();
                    const aEnd = new Date(a.endDateTime).getTime();
                    return aStart < candEnd.getTime() && aEnd > candStart.getTime();
                });

                availableTimes.push({
                    startUtc: candStart.toISOString(),
                    endUtc: candEnd.toISOString(),
                    date: localDateKey(candStart, orgTimezone),
                    time: formatLocal(candStart, orgTimezone, "HH:mm"),
                    isAvailable: !isOccupied
                });
            }

            if (availableTimes.length === 0) continue;

            // No room, floor, roomSlot or roomBooking identifiers are exposed to patients.
            bookingSlots.push({
                startDateTime: booking.startDateTime,
                endDateTime: booking.endDateTime,
                availableTimes
            });
        }

        return res.status(200).json({
            status: "success",
            timezone: orgTimezone,
            slots: bookingSlots
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", message: error.message });
    }
};

// ========================================
// BOOK APPOINTMENT (INDEPENDENT & ORGANIZATION)
// ========================================

// Attaches already-loaded doctor / organization documents to a plain copy of the
// appointment so it can be projected with toPatientAppointmentView().
const withRefs = (appointment, refs) => {
    const plain = typeof appointment.toObject === "function" ? appointment.toObject() : { ...appointment };
    return { ...plain, ...refs };
};

const bookAppointment = async (req, res) => {
    try {
        const patientId = req.userDetails?._id;
        if (!patientId) {
            return res.status(401).json({ status: "failed", msg: "Unauthorized access." });
        }

        const {
            doctorId,
            date,
            time,
            reason,
            bookingType = "Independent",
            organizationId,
            roomId: requestedRoomId,
            roomBookingId: requestedRoomBookingId,
            durationMinutes = 30,
            clientOffsetMinutes
        } = req.body;

        // Room allocation is resolved on the server. Any room identifiers sent by the
        // client (deprecated) are only cross-checked, never trusted.
        let roomId = requestedRoomId;
        let roomBookingId = requestedRoomBookingId;

        if (!doctorId || !date || !time) {
            return res.status(400).json({ status: "failed", msg: "Doctor ID, date and time are required." });
        }

        if (!mongoose.Types.ObjectId.isValid(doctorId)) {
            return res.status(400).json({ status: "failed", msg: "Invalid Doctor ID format." });
        }

        const isOrgBooking = bookingType === "Organization" || !!organizationId;

        if (isOrgBooking) {
            // ========================================================
            // ORGANIZATION-BASED APPOINTMENT WORKFLOW (PHASE 6)
            // ========================================================
            if (!organizationId) {
                return res.status(400).json({
                    status: "failed",
                    msg: "organizationId is required for organization appointments."
                });
            }

            if (!mongoose.Types.ObjectId.isValid(organizationId) ||
                (roomId && !mongoose.Types.ObjectId.isValid(roomId)) ||
                (roomBookingId && !mongoose.Types.ObjectId.isValid(roomBookingId))) {
                return res.status(400).json({
                    status: "failed",
                    msg: "Invalid ID format for organization, room, or roomBooking."
                });
            }

            // Initial verification of entities (pre-check before locks)
            const preDoctor = await Doctor.findById(doctorId);
            if (!preDoctor) {
                return res.status(404).json({ status: "failed", msg: "Doctor not found." });
            }
            if (!preDoctor.isEmailVerified) {
                return res.status(403).json({ status: "failed", msg: "Doctor email is not verified." });
            }
            if (preDoctor.isBlocked) {
                return res.status(403).json({ status: "failed", msg: "Doctor account is suspended." });
            }

            const preOrg = await Organization.findById(organizationId);
            if (!preOrg || preOrg.isBlocked || !preOrg.isVerifiedByAdmin || !preOrg.isEmailVerified) {
                return res.status(403).json({
                    status: "failed",
                    msg: "Organization is unverified, suspended, or not found."
                });
            }

            const preAff = await DoctorOrganization.findOne({
                doctor: doctorId,
                organization: organizationId,
                status: "Approved"
            });
            if (!preAff) {
                return res.status(403).json({
                    status: "failed",
                    msg: "Doctor does not have an approved affiliation with this organization."
                });
            }

            // Time resolution via Luxon in organization's timezone
            const orgTimezone = preOrg.timezone || "Asia/Kolkata";
            let resolvedTime;
            try {
                resolvedTime = resolveLocalToUtc({
                    dateStr: date,
                    timeStr: time,
                    timezone: orgTimezone,
                    durationMinutes: Number(durationMinutes) || 30,
                    clientOffsetMinutes
                });
            } catch (tzErr) {
                return res.status(400).json({
                    status: "failed",
                    msg: `Timezone resolution failed: ${tzErr.message}`
                });
            }

            const { startDateTime, endDateTime } = resolvedTime;

            // Expired slots can never be booked, even by calling the API directly.
            if (endDateTime.getTime() <= Date.now()) {
                return res.status(409).json({
                    status: "failed",
                    msg: "This consultation slot has already ended and can no longer be booked."
                });
            }

            // Legacy clients may still send roomId: validate it exactly as before.
            let preRoom = null;
            if (roomId) {
                preRoom = await Room.findById(roomId);
                if (!preRoom || !preRoom.isOperational) {
                    return res.status(403).json({
                        status: "failed",
                        msg: "Requested room is non-operational or not found."
                    });
                }
                if (preRoom.organization.toString() !== organizationId.toString()) {
                    return res.status(400).json({
                        status: "failed",
                        msg: "Room does not belong to the specified organization."
                    });
                }
            }

            // Resolve the doctor's active room reservation on the server.
            let preBooking;
            if (roomBookingId) {
                preBooking = await RoomBooking.findById(roomBookingId);
            } else {
                preBooking = await RoomBooking.findOne({
                    organization: organizationId,
                    doctor: doctorId,
                    status: "Active",
                    startDateTime: { $lte: startDateTime },
                    endDateTime: { $gte: endDateTime }
                });
            }
            if (!preBooking || preBooking.status !== "Active") {
                return res.status(409).json({
                    status: "failed",
                    msg: "Room booking is not active or not found."
                });
            }
            if (preBooking.doctor.toString() !== doctorId.toString()) {
                return res.status(400).json({
                    status: "failed",
                    msg: "Room booking doctor does not match the requested doctor."
                });
            }
            if (roomId && preBooking.room.toString() !== roomId.toString()) {
                return res.status(400).json({
                    status: "failed",
                    msg: "Room booking room does not match the requested room."
                });
            }
            if (preBooking.organization.toString() !== organizationId.toString()) {
                return res.status(400).json({
                    status: "failed",
                    msg: "Room booking organization does not match the requested organization."
                });
            }

            // The room always comes from the reservation, never from the request.
            roomId = preBooking.room.toString();
            roomBookingId = preBooking._id.toString();

            if (!preRoom) {
                preRoom = await Room.findById(roomId);
                if (!preRoom || !preRoom.isOperational) {
                    return res.status(403).json({
                        status: "failed",
                        msg: "Requested room is non-operational or not found."
                    });
                }
                if (preRoom.organization.toString() !== organizationId.toString()) {
                    return res.status(400).json({
                        status: "failed",
                        msg: "Room does not belong to the specified organization."
                    });
                }
            }

            // Verify requested appointment interval falls completely inside RoomBooking
            if (startDateTime < preBooking.startDateTime || endDateTime > preBooking.endDateTime) {
                return res.status(409).json({
                    status: "failed",
                    msg: `Requested consultation time (${startDateTime.toISOString()} - ${endDateTime.toISOString()}) is outside the doctor's room reservation (${preBooking.startDateTime.toISOString()} - ${preBooking.endDateTime.toISOString()}).`
                });
            }

            let newAppointment;

            try {
                await executeTransactionWithRetry(async (session) => {
                    // 1. Acquire locks in canonical hierarchy: Org (0) -> Room (1) -> Doctor (2) -> DoctorOrganization (3)
                    await acquireScheduleLocks({
                        organizationId,
                        roomId,
                        doctorId,
                        doctorOrganizationId: preAff._id,
                        session
                    });

                    // 2. Re-read Organization inside transaction
                    const lockedOrg = await Organization.findById(organizationId).session(session);
                    if (!lockedOrg || lockedOrg.isBlocked || !lockedOrg.isVerifiedByAdmin || !lockedOrg.isEmailVerified) {
                        const err = new Error("Organization is suspended, unverified, or not found.");
                        err.statusCode = 403;
                        throw err;
                    }

                    // 2b. Re-validate expiry inside the transaction (booking must not slip past slot end)
                    if (endDateTime.getTime() <= Date.now()) {
                        const err = new Error("This consultation slot has already ended and can no longer be booked.");
                        err.statusCode = 409;
                        throw err;
                    }

                    // 3. Re-read Room inside transaction
                    const lockedRoom = await Room.findById(roomId).session(session);
                    if (!lockedRoom || !lockedRoom.isOperational) {
                        const err = new Error("Room is currently non-operational.");
                        err.statusCode = 409;
                        throw err;
                    }

                    // 4. Re-read Doctor inside transaction
                    const lockedDoctor = await Doctor.findById(doctorId).session(session);
                    if (!lockedDoctor || lockedDoctor.isBlocked || !lockedDoctor.isEmailVerified) {
                        const err = new Error("Doctor is suspended or unverified.");
                        err.statusCode = 403;
                        throw err;
                    }

                    // 5. Re-read DoctorOrganization inside transaction
                    const lockedAff = await DoctorOrganization.findById(preAff._id).session(session);
                    if (!lockedAff || lockedAff.status !== "Approved") {
                        const err = new Error("Doctor does not have an approved affiliation with this organization.");
                        err.statusCode = 403;
                        throw err;
                    }

                    // 6. Re-read RoomBooking inside transaction
                    const lockedBooking = await RoomBooking.findById(roomBookingId).session(session);
                    if (!lockedBooking || lockedBooking.status !== "Active") {
                        const err = new Error("Room booking is no longer active.");
                        err.statusCode = 409;
                        throw err;
                    }

                    // Re-verify interval containment
                    if (startDateTime < lockedBooking.startDateTime || endDateTime > lockedBooking.endDateTime) {
                        const err = new Error("Requested appointment interval is outside the active RoomBooking.");
                        err.statusCode = 409;
                        throw err;
                    }

                    // 7. Check Doctor Schedule Conflicts (cross-tier)
                    const doctorConflict = await checkDoctorScheduleConflicts(doctorId, startDateTime, endDateTime, session, {
                        excludeRoomBookingId: lockedBooking._id
                    });
                    if (doctorConflict && doctorConflict.hasConflict) {
                        const err = new Error(`Doctor schedule conflict: ${doctorConflict.reason}`);
                        err.statusCode = 409;
                        throw err;
                    }

                    // 8. Check Room Schedule Conflicts
                    const roomConflict = await appointmentModel.findOne({
                        room: roomId,
                        status: { $in: SLOT_HOLDING_STATUSES },
                        startDateTime: { $lt: endDateTime },
                        endDateTime: { $gt: startDateTime }
                    }).session(session);

                    if (roomConflict) {
                        const err = new Error("This room is already reserved for another appointment at this time.");
                        err.statusCode = 409;
                        throw err;
                    }

                    // 9. Create Appointment inside session
                    const [createdAppt] = await appointmentModel.create(
                        [
                            {
                                patient: patientId,
                                doctor: doctorId,
                                date: new Date(date),
                                time: time,
                                reason: reason || "",
                                status: "Pending",
                                bookingType: "Organization",
                                organization: organizationId,
                                room: roomId,
                                roomSlot: lockedBooking.roomSlot,
                                roomBooking: lockedBooking._id,
                                startDateTime,
                                endDateTime,
                                timezone: orgTimezone,
                                isTimezoneUnconfirmed: false,
                                isDurationEstimated: false
                            }
                        ],
                        { session }
                    );

                    newAppointment = createdAppt;

                    // 10. Queue transactional outbox notifications
                    const patient = await Patient.findById(patientId).session(session);

                    // Notify patient
                    if (patient) {
                        await queueNotification(
                            {
                                recipientEmail: patient.email,
                                type: "APPOINTMENT_CREATED",
                                payload: {
                                    recipientName: patient.name,
                                    patientName: patient.name,
                                    doctorName: lockedDoctor.name,
                                    date: date,
                                    time: time,
                                    // Room details are internal and must never be sent to patients.
                                    venue: lockedOrg.name
                                }
                            },
                            session
                        );
                    }

                    // Notify doctor
                    if (lockedDoctor) {
                        await queueNotification(
                            {
                                recipientEmail: lockedDoctor.email,
                                type: "APPOINTMENT_CREATED",
                                payload: {
                                    recipientName: `Dr. ${lockedDoctor.name}`,
                                    patientName: patient ? patient.name : "Patient",
                                    doctorName: lockedDoctor.name,
                                    date: date,
                                    time: time,
                                    venue: `${lockedOrg.name}, Room ${lockedRoom.roomNumber}`
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
                if (txErr.code === 11000) {
                    return res.status(409).json({
                        status: "failed",
                        msg: "This appointment slot was just booked by another patient."
                    });
                }
                if (txErr.message && txErr.message.includes("Database transaction unavailable")) {
                    return res.status(500).json({
                        status: "failed",
                        msg: "Database transaction failed: MongoDB replica set is required."
                    });
                }
                throw txErr;
            }

            return res.status(201).json({
                status: "success",
                msg: "Organization appointment booked successfully.",
                data: toPatientAppointmentView(withRefs(newAppointment, { doctor: preDoctor, organization: preOrg }))
            });
        }

        // ========================================================
        // INDEPENDENT APPOINTMENT WORKFLOW (LEGACY PRESERVED)
        // ========================================================
        const doctor = await Doctor.findOne({
            _id: doctorId,
            isEmailVerified: true,
            isVerifiedByAdmin: true
        });

        if (!doctor) {
            return res.status(404).json({
                status: "failed",
                msg: "Doctor not found or doctor is not verified."
            });
        }

        if (doctor.isBlocked) {
            return res.status(403).json({
                status: "failed",
                msg: "Doctor account is suspended."
            });
        }

        const appointmentDate = new Date(date);
        if (isNaN(appointmentDate.getTime())) {
            return res.status(400).json({
                status: "failed",
                msg: "Invalid appointment date."
            });
        }

        const day = appointmentDate
            .toLocaleDateString("en-US", { weekday: "long" })
            .toLowerCase();

        const availableSlots = doctor.availability[day];
        if (!availableSlots) {
            return res.status(400).json({
                status: "failed",
                msg: "Doctor availability is not configured for this day."
            });
        }

        if (!availableSlots.includes(time)) {
            return res.status(400).json({
                status: "failed",
                msg: `Doctor is not available at ${time} on ${day}.`
            });
        }

        let newAppointment;

        try {
            await executeTransactionWithRetry(async (session) => {
                await acquireScheduleLocks({
                    doctorId,
                    session
                });

                const existingAppointment = await appointmentModel.findOne({
                    doctor: doctorId,
                    date: appointmentDate,
                    time: time,
                    status: { $in: SLOT_HOLDING_STATUSES }
                }).session(session);

                if (existingAppointment) {
                    const err = new Error("This appointment slot is already booked.");
                    err.statusCode = 409;
                    throw err;
                }

                const [createdAppt] = await appointmentModel.create(
                    [
                        {
                            patient: patientId,
                            doctor: doctorId,
                            date: appointmentDate,
                            time: time,
                            reason: reason || "",
                            status: "Pending",
                            bookingType: "Independent"
                        }
                    ],
                    { session }
                );

                newAppointment = createdAppt;

                const patient = await Patient.findById(patientId).session(session);
                if (patient) {
                    await queueNotification(
                        {
                            recipientEmail: patient.email,
                            type: "APPOINTMENT_CREATED",
                            payload: {
                                recipientName: patient.name,
                                patientName: patient.name,
                                doctorName: doctor.name,
                                date: date,
                                time: time
                            }
                        },
                        session
                    );
                }
                if (doctor) {
                    await queueNotification(
                        {
                            recipientEmail: doctor.email,
                            type: "APPOINTMENT_CREATED",
                            payload: {
                                recipientName: `Dr. ${doctor.name}`,
                                patientName: patient ? patient.name : "Patient",
                                doctorName: doctor.name,
                                date: date,
                                time: time
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
            if (txErr.code === 11000) {
                return res.status(409).json({
                    status: "failed",
                    msg: "This appointment slot was just booked by another patient."
                });
            }
            throw txErr;
        }

        return res.status(201).json({
            status: "success",
            msg: "Appointment booked successfully.",
            data: toPatientAppointmentView(withRefs(newAppointment, { doctor }))
        });
    } catch (error) {
        console.error("Book appointment error:", error);
        return res.status(500).json({
            status: "failed",
            message: error.message
        });
    }
};

// ========================================
// GET ALL APPOINTMENTS FOR PATIENT
// ========================================

const getAllAppointment = async (req, res) => {
    try {
        const patientId = req.userDetails?._id;
        if (!patientId) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access. Missing patient ID."
            });
        }

        // Room / floor / roomSlot / roomBooking are internal and are never populated or returned
        // to patients. The response is an allow-listed projection.
        const appointments = await appointmentModel.find({ patient: patientId })
            .populate("doctor", "name specialization qualification experience bio profilePicture consultationFee rating reviewCount location clinicLocation")
            .populate("organization", "name phone address timezone")
            .sort({ date: -1, time: -1 });

        const now = new Date();

        return res.status(200).json({
            success: true,
            data: appointments.map((appt) => toPatientAppointmentView(appt, now))
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

// ========================================
// CANCEL APPOINTMENT
// ========================================

const cancelAppointment = async (req, res) => {
    try {
        const patientId = req.userDetails?._id;
        if (!patientId) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access. Missing patient ID."
            });
        }

        const { appointmentId, reason = "Cancelled by patient" } = req.body || {};

        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                msg: "Appointment ID is missing"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            return res.status(400).json({
                success: false,
                msg: "Invalid Appointment ID format."
            });
        }

        const existingAppt = await appointmentModel.findOne({
            _id: appointmentId,
            patient: patientId
        });

        if (!existingAppt) {
            return res.status(404).json({
                success: false,
                msg: "Appointment not found or you are not authorized to cancel it."
            });
        }

        if (existingAppt.status === "Cancelled" || existingAppt.status === "Expired") {
            return res.status(400).json({
                success: false,
                msg: `Appointment is already ${existingAppt.status}.`
            });
        }

        // Once the patient has checked in (or the visit is finished) it can no longer be cancelled.
        if (existingAppt.status !== APPOINTMENT_STATUS.PENDING && existingAppt.status !== APPOINTMENT_STATUS.CONFIRMED) {
            return res.status(400).json({
                success: false,
                msg: `Appointment is ${existingAppt.status} and can no longer be cancelled.`
            });
        }

        let cancelledAppointment;

        try {
            await executeTransactionWithRetry(async (session) => {
                await acquireScheduleLocks({
                    organizationId: existingAppt.organization || null,
                    roomId: existingAppt.room || null,
                    doctorId: existingAppt.doctor,
                    session
                });

                const appt = await appointmentModel.findOne({
                    _id: appointmentId,
                    patient: patientId
                }).session(session);

                if (!appt) {
                    const err = new Error("Appointment not found inside transaction.");
                    err.statusCode = 404;
                    throw err;
                }

                // Re-check inside the transaction: the patient may have been checked in meanwhile.
                if (appt.status !== APPOINTMENT_STATUS.PENDING && appt.status !== APPOINTMENT_STATUS.CONFIRMED) {
                    const err = new Error(`Appointment is ${appt.status} and can no longer be cancelled.`);
                    err.statusCode = 409;
                    throw err;
                }

                appt.status = "Cancelled";
                appt.cancelledBy = "Patient";
                appt.cancelledAt = new Date();
                appt.cancellationReason = reason.trim();
                await appt.save({ session });

                cancelledAppointment = appt;

                // Notify doctor
                const doctor = await Doctor.findById(appt.doctor).session(session);
                const patient = await Patient.findById(patientId).session(session);
                if (doctor) {
                    await queueNotification(
                        {
                            recipientEmail: doctor.email,
                            type: "APPOINTMENT_CANCELLED",
                            payload: {
                                patientName: patient ? patient.name : "Patient",
                                appointmentId: appt._id.toString(),
                                reason: reason.trim()
                            }
                        },
                        session
                    );
                }
            });
        } catch (txErr) {
            if (txErr.statusCode) {
                return res.status(txErr.statusCode).json({ success: false, msg: txErr.message });
            }
            if (txErr.message && txErr.message.includes("Database transaction unavailable")) {
                return res.status(500).json({
                    success: false,
                    msg: "Database transaction failed: MongoDB replica set is required."
                });
            }
            throw txErr;
        }

        return res.status(200).json({
            success: true,
            msg: "Appointment cancelled successfully",
            appointment: toPatientAppointmentView(cancelledAppointment)
        });

    } catch (error) {
        console.error("Cancel Appointment Error:", error);
        return res.status(500).json({
            success: false,
            msg: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    sendMailPatientVerifaction,
    verifyOTPPatientVerifaction,
    sendMailPatientResetPass,
    verifyOTPPatientResetPass,
    changePassword,
    getprofile,
    updatePatientProfile,
    deleteprofile,
    getDoctors,
    bookAppointment,
    getAllAppointment,
    cancelAppointment,
    getApprovedOrganizations,
    getOrganizationDoctors,
    getOrganizationAppointmentAvailability
};