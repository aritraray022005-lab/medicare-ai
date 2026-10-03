const Doctor = require("../models/doctor.model");
const jwt = require('jsonwebtoken');
const appointmentModel = require("../models/appointment.model");
const config = require("../config/config");
const OTPutil = require("../util/otp.util");

// Auth
//register
const register = async (req, res) => {
    try {

        console.log("========== DOCTOR REGISTER START ==========");

        const {
            name,
            email,
            password,
            phone,
            specialization,
            experience,
            qualification,
            consultationFee,
            locationState,
            locationCity,
            nmrNumber
        } = req.body;

        console.log("1. Request body received");
        console.log("Email:", email);
        console.log("Name:", name);

        const medicalRegistrationCertificate = req.file
            ? req.file.path
            : null;

        console.log(
            "2. File received:",
            !!medicalRegistrationCertificate
        );


        if (
            !name ||
            !email ||
            !password ||
            !specialization ||
            experience === undefined ||
            !qualification ||
            consultationFee === undefined ||
            !locationState ||
            !locationCity ||
            !nmrNumber
        ) {
            console.log("3. Required field validation failed");

            return res.status(400).json({
                status: "failed",
                msg: "All required fields must be provided."
            });
        }

        if (!medicalRegistrationCertificate) {
            console.log("4. Medical certificate missing");

            return res.status(400).json({
                status: "failed",
                msg: "Medical Registration Certificate (PDF) is required."
            });
        }

        console.log("5. Required fields passed");


        const existingDoctor = await Doctor.findOne({
            email: email.toLowerCase()
        });

        console.log(
            "6. Existing doctor:",
            !!existingDoctor
        );

        if (existingDoctor) {
            return res.status(400).json({
                status: "failed",
                msg: "Doctor with this email already exists."
            });
        }


        console.log("7. Creating doctor...");

        const newDoctor = await Doctor.create({
            name,
            email: email.toLowerCase(),
            password,
            phone,
            specialization,
            experience,
            qualification,
            consultationFee,
            nmrNumber,
            medicalRegistrationCertificate,
            location: {
                state: locationState,
                cityTownVillage: locationCity
            }
        });

        console.log(
            "8. Doctor created:",
            newDoctor._id.toString()
        );


        console.log("9. Creating JWT...");

        const token = jwt.sign(
            {
                id: newDoctor._id
            },
            config.JWT_TOKEN_SECRET,
            {
                expiresIn: "1d"
            }
        );

        console.log("10. JWT created");


        res.cookie("doctorToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production"
                ? "none"
                : "lax",
            maxAge: 24 * 60 * 60 * 1000
        });

        console.log("11. Cookie set");

        console.log("========== DOCTOR REGISTER SUCCESS ==========");

        return res.status(201).json({
            status: "success",
            msg: "Doctor registered successfully.",
            user: {
                id: newDoctor._id,
                name: newDoctor.name,
                email: newDoctor.email,
                specialization: newDoctor.specialization,
                qualification: newDoctor.qualification,
                experience: newDoctor.experience,
                consultationFee: newDoctor.consultationFee,
                location: newDoctor.location,
                isEmailVerified: newDoctor.isEmailVerified,
                isVerifiedByAdmin: newDoctor.isVerifiedByAdmin
            }
        });

    } catch (error) {

        console.error("========== DOCTOR REGISTER ERROR ==========");
        console.error(error);
        console.error("===========================================");

        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

//Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(401).json({
                "status": "failed",
                "msg": "Email and password are required."
            });
        }

        const doctor = await Doctor.findOne({ email });

        if (!doctor) {
            return res.status(404).json({
                "status": "failed",
                "msg": "User not found."
            });
        }

        if (doctor.isBlocked) {
            return res.status(403).json({
                "status": "failed",
                "msg": "Your account has been blocked by the admin."
            });
        }

        const vaildPassword = await doctor.comparePassword(password);

        if (!vaildPassword) {
            return res.status(401).json({
                "status": "failed",
                "msg": "Wrong email or password."
            });
        }

        const token = await jwt.sign({
            id: doctor._id
        }, config.JWT_TOKEN_SECRET, {
            expiresIn: "1d"
        })

        res.cookie("doctorToken", token, {
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
//Auth
const logout = async (req, res) => {
    try {
        res.clearCookie("doctorToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
        });

        res.status(200).json({ msg: "Logged out Successfully " });
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

const sendMailDoctorVerifaction = async (req, res) => {
    try {


        const _id = req.userDetails?._id;
        console.log("Doctor ID:", _id);
        if (!_id) {
            return res.status(401).json({
                status: "failed",
                msg: "User not authenticated"
            });
        }

        const doctor = await Doctor.findOne({ _id });

        if (!doctor) {
            return res.status(404).json({
                status: "failed",
                msg: "User don't Exist"
            })
        }

        if (doctor.isEmailVerified === true) {
            return res.status(404).json({
                status: "failed",
                msg: "User email is Already verified"
            })
        }

        let newOTP = OTPutil.generateOTP();
        doctor.resetOTP = newOTP;
        doctor.OTPExpiry = Date.now() + 5 * 60 * 1000; // 5 min 

        await doctor.save();



        userEmail = doctor.email;
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

const verifyOTPDoctorVerifaction = async (req, res) => {
    try {
        const _id = req.userDetails?._id;

        if (!_id) {
            return res.status(401).json({
                status: "failed",
                msg: "User not authenticated"
            });
        }

        const doctor = await Doctor.findOne({ _id });


        const { OTP } = req.body;



        if (!doctor || doctor.resetOTP !== OTP) {
            return res.status(400).json({
                msg: "Invaild OTP"
            })
        }

        if (doctor.OTPExpiry < Date.now()) {
            return res.status(400).json({
                msg: "OTP expired"
            })
        }



        doctor.isEmailVerified = true;
        doctor.resetOTP = null;
        doctor.OTPExpiry = null;

        await doctor.save();




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

//profile

// get profile
const getProfile = async (req, res) => {
    try {
        const doctor = req.userDetails;

        if (!doctor) {
            return res.status(401).json({
                "status": "failed",
                "msg": "Unauthorized access."
            });
        }

        // Convert to plain object if using Mongoose, then remove password  (Ask sir)
        const doctorProfile = doctor.toObject ? doctor.toObject() : { ...doctor };
        delete doctorProfile.password;

        res.status(200).json({
            status: "success",
            user: doctorProfile
        });
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

//update profile
const updateDoctorProfile = async (req, res) => {
    try {

        const doctor = req.userDetails;

        if (!doctor) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access."
            });
        }


        const {
            name,
            phone,
            specialization,
            experience,
            qualification,
            consultationFee,
            locationState,
            locationCity,
            bio,
            clinicLocation
        } = req.body;

        const updates = {};


        // =========================
        // BASIC INFORMATION
        // =========================

        if (name !== undefined) {
            updates.name = name;
        }

        if (phone !== undefined) {
            updates.phone = phone;
        }


        // =========================
        // PROFESSIONAL INFORMATION
        // =========================

        if (specialization !== undefined) {
            updates.specialization = specialization;
        }

        if (experience !== undefined) {
            updates.experience = experience;
        }

        if (qualification !== undefined) {
            updates.qualification = qualification;
        }

        if (consultationFee !== undefined) {
            updates.consultationFee = consultationFee;
        }

        if (locationState !== undefined || locationCity !== undefined) {
            updates.location = { ...doctor.location };
            if (locationState !== undefined) updates.location.state = locationState;
            if (locationCity !== undefined) updates.location.cityTownVillage = locationCity;
        }

        if (bio !== undefined) {
            updates.bio = bio;
        }

        if (clinicLocation !== undefined) {
            updates.clinicLocation = clinicLocation;
        }


        // =========================
        // UPDATE DOCTOR
        // =========================

        const updatedDoctor = await Doctor.findByIdAndUpdate(
            doctor._id,
            {
                $set: updates
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );


        if (!updatedDoctor) {
            return res.status(404).json({
                status: "failed",
                msg: "Doctor profile not found."
            });
        }


        // =========================
        // RESPONSE
        // =========================

        return res.status(200).json({
            status: "success",
            msg: "Profile updated successfully.",
            data: {
                name: updatedDoctor.name,
                email: updatedDoctor.email,
                phone: updatedDoctor.phone,
                specialization: updatedDoctor.specialization,
                experience: updatedDoctor.experience,
                qualification: updatedDoctor.qualification,
                consultationFee: updatedDoctor.consultationFee,
                location: updatedDoctor.location,
                clinicLocation: updatedDoctor.clinicLocation,
                bio: updatedDoctor.bio,
                isEmailVerified: updatedDoctor.isEmailVerified,
                isVerifiedByAdmin: updatedDoctor.isVerifiedByAdmin
            }
        });

    } catch (error) {

        console.error("Update doctor profile error:", error);

        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

// update profile picture
const updateProfilePicture = async (req, res) => {
    try {
        const doctor = req.userDetails;

        if (!doctor) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access."
            });
        }

        const profilePicture = req.file ? req.file.path : null;

        if (!profilePicture) {
            return res.status(400).json({
                status: "failed",
                msg: "Please upload an image file."
            });
        }

        const updatedDoctor = await Doctor.findByIdAndUpdate(
            doctor._id,
            { profilePicture: profilePicture },
            { returnDocument: "after", runValidators: true }
        );

        if (!updatedDoctor) {
            return res.status(404).json({
                status: "failed",
                msg: "Doctor profile not found."
            });
        }

        return res.status(200).json({
            status: "success",
            msg: "Profile picture updated successfully.",
            data: {
                profilePicture: updatedDoctor.profilePicture
            }
        });

    } catch (error) {
        console.error("Update profile picture error:", error);
        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

// delete profile
const deleteprofile = async (req, res) => {
    try {
        const user = req.userDetails;
        if (!user) {
            return res.status(401).json({
                "status": "failed",
                "msg": "Unauthorized access."
            })
        }
        const deleteDoctor = await Doctor.findByIdAndDelete(user.id);

        if (!deleteDoctor) {
            return res.status(404).json({
                status: "failed",
                msg: "Doctor profile not found."
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

const updateAvailability = async (req, res) => {
    try {
        const doctor = req.userDetails;

        if (!doctor) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access."
            });
        }

        const {
            sunday,
            monday,
            tuesday,
            wednesday,
            thursday,
            friday,
            saturday
        } = req.body;

        const availability = {
            sunday: sunday || [],
            monday: monday || [],
            tuesday: tuesday || [],
            wednesday: wednesday || [],
            thursday: thursday || [],
            friday: friday || [],
            saturday: saturday || []
        };

        const updatedDoctor = await Doctor.findByIdAndUpdate(
            doctor._id,
            { $set: { availability } },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!updatedDoctor) {
            return res.status(404).json({
                status: "failed",
                msg: "Doctor profile not found."
            });
        }

        return res.status(200).json({
            status: "success",
            msg: "Availability updated successfully.",
            availability: updatedDoctor.availability
        });

    } catch (error) {
        console.error("Update availability error:", error);

        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

//reset password

//send reset password EMAIL Otp
const sendMailDoctorResetPass = async (req, res) => {
    try {
        const { email } = req.body;
        const doctor = await Doctor.findOne({ email: email });

        if (!doctor) {
            return res.status(404).json({
                status: "failed",
                msg: "User don't Exist"
            })
        }

        let newOTP = OTPutil.generateOTP();
        doctor.resetOTP = newOTP;
        doctor.OTPExpiry = Date.now() + 5 * 60 * 1000; // 5 min 

        await doctor.save();

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
const verifyOTDoctorResetPass = async (req, res) => {
    try {
        const { email, OTP } = req.body;

        const doctor = await Doctor.findOne({ email });

        if (!doctor || doctor.resetOTP !== OTP) {
            return res.status(400).json({
                msg: "Invaild OTP"
            })
        }

        if (doctor.OTPExpiry < Date.now()) {
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

const changePassword = async (req, res) => {
    try {
        const { email, OTP, newpassword } = req.body;

        const doctor = await Doctor.findOne({ email });

        if (!doctor || doctor.resetOTP !== OTP) {
            return res.status(400).json({ msg: "Invaild OTP." })
        }

        if (doctor.OTPExpiry < Date.now()) {
            return res.status(400).json({
                msg: "OTP expired"
            })
        }

        const isSamePassword = await doctor.comparePassword(newpassword);

        if (isSamePassword) {
            return res.status(400).json({ msg: "New password cannot be the same as the old password." });
        }

        doctor.password = newpassword;
        doctor.resetOTP = null;
        doctor.OTPExpiry = null;

        await doctor.save();

        res.status(200).json({
            status: "success",
            msg: "password reset successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}


//appointment

// view all appointments
const viewAppointment = async (req, res) => {
    try {
        const doctorId = req.userDetails?.id;

        if (!doctorId) {
            return res.status(401).json({
                "status": "failed",
                "msg": "Unauthorized access."
            })
        }

        const appointments = await appointmentModel.find({ doctor: doctorId }).populate("patient", "-password");

        if (!appointments || appointments.length === 0) {
            return res.status(404).json({
                "status": "success",
                "msg": "No appointments found for this doctor.",
                "data": []
            });
        }

        return res.status(200).json({
            "status": "success",
            "msg": "Appointments retrieved successfully.",
            "data": appointments
        });



    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}


// 

const updateAppointmentStatus = async (req, res) => {
    try {
        const doctorId = req.userDetails?.id;

        if (!doctorId) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access."
            });
        }

        const { appointmentId, status } = req.body;

        const updatedAppointment = await appointmentModel.findOneAndUpdate(
            {
                _id: appointmentId,
                doctor: doctorId
            },
            {
                status: status
            },
            {
                returnDocument: "after"
            }
        );

        if (!updatedAppointment) {
            return res.status(404).json({
                status: "failed",
                msg: "Appointment not found or you are not authorized to update it."
            });
        }

        return res.status(200).json({
            status: "success",
            msg: status === "confirmed"
                ? "Appointment confirmed successfully."
                : "Appointment cancelled successfully.",
            data: updatedAppointment
        });

    } catch (error) {
        return res.status(500).json({
            status: "failed",
            message: error.message
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    sendMailDoctorVerifaction,
    verifyOTPDoctorVerifaction,
    sendMailDoctorResetPass,
    verifyOTDoctorResetPass,
    changePassword,
    getProfile,
    updateDoctorProfile,
    updateProfilePicture,
    deleteprofile,
    updateAvailability,
    viewAppointment,
    updateAppointmentStatus
};
