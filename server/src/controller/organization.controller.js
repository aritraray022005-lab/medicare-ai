const jwt = require("jsonwebtoken");
const Organization = require("../models/organization.model");
const config = require("../config/config");
const OTPutil = require("../util/otp.util");

/**
 * 1. Register a new Organization.
 * Validates uniqueness of email and registrationNumber.
 * Generates an account verification OTP, hashes password, and persists organization.
 */
const register = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            password,
            type,
            registrationNumber,
            address,
            timezone,
            location
        } = req.body;

        const normalizedEmail = email.toLowerCase().trim();

        // Duplicate checks
        const existingEmail = await Organization.findOne({ email: normalizedEmail });
        if (existingEmail) {
            return res.status(400).json({
                status: "failed",
                msg: "Organization with this email already exists."
            });
        }

        const existingReg = await Organization.findOne({
            registrationNumber: registrationNumber.trim()
        });
        if (existingReg) {
            return res.status(400).json({
                status: "failed",
                msg: "Organization with this registration number already exists."
            });
        }

        // Generate 6-digit OTP for email verification
        const otp = OTPutil.generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const newOrganization = await Organization.create({
            name: name.trim(),
            email: normalizedEmail,
            phone: phone.trim(),
            password,
            type,
            registrationNumber: registrationNumber.trim(),
            address,
            timezone: timezone || "Asia/Kolkata",
            location: location || { type: "Point", coordinates: [0, 0] },
            isEmailVerified: false,
            isVerifiedByAdmin: false,
            isBlocked: false,
            scheduleVersion: 0,
            resetOTP: otp,
            OTPExpiry: otpExpiry
        });

        // Dispatch verification email
        try {
            await OTPutil.sendAccountVerificationMail(otp, normalizedEmail);
        } catch (emailErr) {
            console.warn(`[OrganizationRegister] Email dispatch failed for ${normalizedEmail}:`, emailErr.message);
        }

        return res.status(201).json({
            status: "success",
            msg: "Organization registered successfully. Please verify your email with the OTP sent.",
            organization: {
                id: newOrganization._id,
                name: newOrganization.name,
                email: newOrganization.email,
                phone: newOrganization.phone,
                type: newOrganization.type,
                registrationNumber: newOrganization.registrationNumber,
                address: newOrganization.address,
                timezone: newOrganization.timezone,
                isEmailVerified: newOrganization.isEmailVerified,
                isVerifiedByAdmin: newOrganization.isVerifiedByAdmin
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

/**
 * 2. Verify Email via 6-digit OTP.
 * On success, marks isEmailVerified = true and sets the organizationToken cookie.
 */
const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const organization = await Organization.findOne({ email: normalizedEmail });
        if (!organization) {
            return res.status(404).json({
                status: "failed",
                msg: "Organization not found."
            });
        }

        if (organization.isEmailVerified) {
            return res.status(400).json({
                status: "failed",
                msg: "Email is already verified."
            });
        }

        if (!organization.resetOTP || organization.resetOTP !== otp) {
            return res.status(400).json({
                status: "failed",
                msg: "Invalid OTP code."
            });
        }

        if (organization.OTPExpiry && organization.OTPExpiry < Date.now()) {
            return res.status(400).json({
                status: "failed",
                msg: "OTP has expired. Please request a new one."
            });
        }

        organization.isEmailVerified = true;
        organization.resetOTP = null;
        organization.OTPExpiry = null;
        await organization.save();

        // Issue token upon successful email verification
        const token = jwt.sign(
            { id: organization._id, role: "organization" },
            config.JWT_TOKEN_SECRET,
            { expiresIn: "1d" }
        );

        res.cookie("organizationToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            status: "success",
            msg: "Email verified successfully.",
            organization: {
                id: organization._id,
                name: organization.name,
                email: organization.email,
                isEmailVerified: true,
                isVerifiedByAdmin: organization.isVerifiedByAdmin,
                isBlocked: organization.isBlocked
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

/**
 * 3. Resend Email Verification OTP.
 */
const resendVerificationOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const organization = await Organization.findOne({ email: normalizedEmail });
        if (!organization) {
            return res.status(404).json({
                status: "failed",
                msg: "Organization not found."
            });
        }

        if (organization.isEmailVerified) {
            return res.status(400).json({
                status: "failed",
                msg: "Email is already verified."
            });
        }

        const otp = OTPutil.generateOTP();
        organization.resetOTP = otp;
        organization.OTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await organization.save();

        try {
            await OTPutil.sendAccountVerificationMail(otp, normalizedEmail);
        } catch (emailErr) {
            console.warn(`[OrganizationResendOtp] Email dispatch failed for ${normalizedEmail}:`, emailErr.message);
        }

        return res.status(200).json({
            status: "success",
            msg: "Verification OTP has been resent to your email."
        });
    } catch (error) {
        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

/**
 * 4. Organization Login.
 * Rejects if:
 * - Credentials invalid (401)
 * - Blocked by Admin (403)
 * - Email not verified (403)
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const organization = await Organization.findOne({ email: normalizedEmail });
        if (!organization) {
            return res.status(401).json({
                status: "failed",
                msg: "Wrong email or password."
            });
        }

        const validPassword = await organization.comparePassword(password);
        if (!validPassword) {
            return res.status(401).json({
                status: "failed",
                msg: "Wrong email or password."
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
                msg: "Email not verified. Please verify your email before logging in.",
                needsEmailVerification: true,
                email: organization.email
            });
        }

        const token = jwt.sign(
            { id: organization._id, role: "organization" },
            config.JWT_TOKEN_SECRET,
            { expiresIn: "1d" }
        );

        res.cookie("organizationToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            status: "success",
            msg: "Login successful",
            organization: {
                id: organization._id,
                name: organization.name,
                email: organization.email,
                phone: organization.phone,
                type: organization.type,
                registrationNumber: organization.registrationNumber,
                address: organization.address,
                timezone: organization.timezone,
                isEmailVerified: organization.isEmailVerified,
                isVerifiedByAdmin: organization.isVerifiedByAdmin,
                isBlocked: organization.isBlocked
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

/**
 * 5. Organization Logout.
 */
const logout = async (req, res) => {
    try {
        res.clearCookie("organizationToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
        });

        return res.status(200).json({
            status: "success",
            msg: "Logged out successfully"
        });
    } catch (error) {
        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

/**
 * 6. Get Organization Profile.
 */
const getProfile = async (req, res) => {
    try {
        const organization = req.organization;
        if (!organization) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access."
            });
        }

        return res.status(200).json({
            status: "success",
            organization: {
                id: organization._id,
                name: organization.name,
                email: organization.email,
                phone: organization.phone,
                type: organization.type,
                registrationNumber: organization.registrationNumber,
                address: organization.address,
                timezone: organization.timezone,
                location: organization.location,
                isEmailVerified: organization.isEmailVerified,
                isVerifiedByAdmin: organization.isVerifiedByAdmin,
                isBlocked: organization.isBlocked,
                scheduleVersion: organization.scheduleVersion
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

/**
 * 7. Update Organization Profile.
 */
const updateProfile = async (req, res) => {
    try {
        const organization = req.organization;
        if (!organization) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized access."
            });
        }

        const { name, phone, address, timezone, location } = req.body;

        if (name) organization.name = name.trim();
        if (phone) organization.phone = phone.trim();
        if (address) {
            organization.address = {
                ...organization.address.toObject(),
                ...address
            };
        }
        if (timezone && timezone !== organization.timezone) {
            organization.timezone = timezone;
            organization.scheduleVersion += 1; // Timezone change increments scheduleVersion
        }
        if (location) {
            organization.location = location;
        }

        await organization.save();

        return res.status(200).json({
            status: "success",
            msg: "Profile updated successfully",
            organization: {
                id: organization._id,
                name: organization.name,
                email: organization.email,
                phone: organization.phone,
                type: organization.type,
                registrationNumber: organization.registrationNumber,
                address: organization.address,
                timezone: organization.timezone,
                isEmailVerified: organization.isEmailVerified,
                isVerifiedByAdmin: organization.isVerifiedByAdmin,
                isBlocked: organization.isBlocked,
                scheduleVersion: organization.scheduleVersion
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

/**
 * 8. Lightweight Session Probe for Frontend Navbar/Auth Guard.
 */
const getMe = async (req, res) => {
    try {
        const org = req.organization;
        return res.status(200).json({
            status: "success",
            organization: {
                _id: org._id,
                name: org.name,
                email: org.email,
                type: org.type,
                isEmailVerified: org.isEmailVerified,
                isVerifiedByAdmin: org.isVerifiedByAdmin,
                isBlocked: org.isBlocked
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: "failed",
            msg: error.message
        });
    }
};

module.exports = {
    register,
    verifyEmail,
    resendVerificationOtp,
    login,
    logout,
    getProfile,
    updateProfile,
    getMe
};
