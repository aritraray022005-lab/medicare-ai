const Patient = require("../models/patient.model");
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Doctor = require("../models/doctor.model");
const appointmentModel = require("../models/appointment.model");
const config = require("../config/config");

const OTPutil = require("../util/otp.util");
const { findOne } = require("../models/admin.model");

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
            sameSite: "strict",                  
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
            sameSite: "strict",                  
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
        res.clearCookie("patientToken");

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
        const mailOption = OTPutil.accountVerificationMailOptions(newOTP,userEmail);

        await OTPutil.transporter.sendMail(mailOption);

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

        const mailOption = OTPutil.resetPassMailOption(newOTP,email);

        await OTPutil.transporter.sendMail(mailOption);


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

//bookAppointment

const bookAppointment = async (req, res) => {

    try {

        // ========================================
        // GET PATIENT ID
        // ========================================

        const patientId = req.userDetails?._id;

        if (!patientId) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access."
            });
        }


        // ========================================
        // GET BOOKING DATA
        // ========================================

        const {
            doctorId,
            date,
            time,
            reason
        } = req.body;


        // ========================================
        // REQUIRED FIELDS
        // ========================================

        if (!doctorId || !date || !time) {

            return res.status(400).json({
                status: "failed",
                msg: "Doctor ID, date and time are required."
            });

        }


        // ========================================
        // CHECK DOCTOR ID FORMAT
        // ========================================

        if (!mongoose.Types.ObjectId.isValid(doctorId)) {

            return res.status(400).json({
                status: "failed",
                msg: "Invalid Doctor ID format."
            });

        }


        // ========================================
        // FIND VERIFIED DOCTOR
        // ========================================

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


        // ========================================
        // CONVERT DATE
        // ========================================

        const appointmentDate = new Date(date);


        if (isNaN(appointmentDate.getTime())) {

            return res.status(400).json({
                status: "failed",
                msg: "Invalid appointment date."
            });

        }


        // ========================================
        // GET DAY OF WEEK
        // ========================================

        const day = appointmentDate
            .toLocaleDateString("en-US", {
                weekday: "long"
            })
            .toLowerCase();


        // Example:
        // Monday -> monday
        // Tuesday -> tuesday


        // ========================================
        // GET DOCTOR'S AVAILABLE SLOTS
        // ========================================

        const availableSlots = doctor.availability[day];


        if (!availableSlots) {

            return res.status(400).json({
                status: "failed",
                msg: "Doctor availability is not configured for this day."
            });

        }


        // ========================================
        // CHECK TIME AGAINST AVAILABILITY
        // ========================================

        if (!availableSlots.includes(time)) {

            return res.status(400).json({
                status: "failed",
                msg: `Doctor is not available at ${time} on ${day}.`
            });

        }


        // ========================================
        // CHECK WHETHER SLOT IS ALREADY BOOKED
        // ========================================

        const existingAppointment = await appointmentModel.findOne({
            doctor: doctorId,
            date: appointmentDate,
            time: time,
            status: {
                $in: ["Pending", "Confirmed"]
            }
        });


        if (existingAppointment) {

            return res.status(409).json({
                status: "failed",
                msg: "This appointment slot is already booked."
            });

        }


        // ========================================
        // CREATE APPOINTMENT
        // ========================================

        const newAppointment = new appointmentModel({

            patient: patientId,

            doctor: doctorId,

            date: appointmentDate,

            time: time,

            reason: reason || "",

            status: "Pending"
        });


        await newAppointment.save();


        // ========================================
        // SUCCESS RESPONSE
        // ========================================

        return res.status(201).json({

            status: "success",

            msg: "Appointment booked successfully.",

            data: newAppointment

        });


    } catch (error) {

        // ========================================
        // DUPLICATE SLOT ERROR
        // ========================================

        if (error.code === 11000) {

            return res.status(409).json({
                status: "failed",
                msg: "This appointment slot was just booked by another patient."
            });

        }


        // ========================================
        // SERVER ERROR
        // ========================================

        console.error("Book appointment error:", error);

        return res.status(500).json({
            status: "failed",
            message: error.message
        });

    }
};

// get all Appointment
const getAllAppointment = async (req,res) => {
    try {
        const patientId =  req.userDetails?._id; 

        if(!patientId)
        {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access. Missing patient ID." 
            });
        }

        const appointments = await appointmentModel.find({ patient: patientId });
        
        return res.status(200).json({ 
            success: true, 
            data: appointments
        });
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}

// cancelAppointment
const cancelAppointment = async (req, res) => {
    try {
        const patientId = req.userDetails?._id;

        if (!patientId) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access. Missing patient ID."
            });
        }

        const { appointmentId } = req.body || {};

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

        const cancelledAppointment = await appointmentModel.findOneAndUpdate(
            {
                _id: appointmentId,
                patient: patientId
            },
            {
                status: "cancelled"
            },
            {
                returnDocument: "after"
            }
        );

        if (!cancelledAppointment) {
            return res.status(404).json({
                success: false,
                msg: "Appointment not found or you are not authorized to cancel it."
            });
        }

        return res.status(200).json({
            success: true,
            msg: "Appointment cancelled successfully",
            appointment: cancelledAppointment
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
    verifyOTPPatientResetPass ,
    changePassword,
    getprofile,
    updatePatientProfile,
    deleteprofile,
    getDoctors,
    bookAppointment,
    getAllAppointment,
    cancelAppointment 
};