const adminModel = require("../models/admin.model")
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const doctorModel = require("../models/doctor.model");
const patientModel = require("../models/patient.model");
const config = require("../config/config");
const OTPutil = require("../util/otp.util")

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
            sameSite: "strict",                  
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
}

//logout
const logout = async (req,res) =>{
    try {
        res.clearCookie("adminToken");

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

module.exports = {
    register,
    login,
    logout,
    sendMailAdminResetPass ,
    verifyOTAdminResetPass,
    changePassword ,
    getDoctors,
    updateDoctorVerification,
    getPatients,
    updateDoctorBlockStatus,
    updatePatientBlockStatus
}