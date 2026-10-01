const express = require("express");

const router = express.Router();

const patientcontroller = require("../controller/patient.controller");

const authPatientMiddleware = require("../middleware/patientAuth.middleware");

const ValidationMiddleware = require("../middleware/validate.middleware");

const patientValidation = require("../validations/patient.validation");


// ==================== AUTH ====================

// Register
router.post(
    "/auth/register",
    ValidationMiddleware(patientValidation.registerSchema),
    patientcontroller.register
);

// Login
router.post(
    "/auth/login",
    ValidationMiddleware(patientValidation.loginSchema),
    patientcontroller.login
);

// Logout
router.post(
    "/auth/logout",
    patientcontroller.logout
);

// Send email verification OTP
router.post(
    "/auth/send-otp",
    authPatientMiddleware,
    patientcontroller.sendMailPatientVerifaction
);

// Verify email OTP
router.post(
    "/auth/verify-otp",
    authPatientMiddleware,
    ValidationMiddleware(patientValidation.verifyEmailOTPSchema),
    patientcontroller.verifyOTPPatientVerifaction
);


// ==================== PROFILE ====================

// Get profile
router.get(
    "/profile",
    authPatientMiddleware,
    patientcontroller.getprofile
);

// Update profile
router.patch(
    "/profile",
    authPatientMiddleware,
    ValidationMiddleware(patientValidation.updatePatientProfileSchema),
    patientcontroller.updatePatientProfile
);

// Delete profile
router.delete(
    "/profile",
    authPatientMiddleware,
    patientcontroller.deleteprofile
);


// ==================== PASSWORD RESET ====================

// Send reset password OTP
router.post(
    "/change-password/send-otp",
    ValidationMiddleware(patientValidation.sendResetOTPSchema),
    patientcontroller.sendMailPatientResetPass
);

// Verify reset password OTP
router.post(
    "/change-password/verify-otp",
    ValidationMiddleware(patientValidation.verifyResetOTPSchema),
    patientcontroller.verifyOTPPatientResetPass
);

// Change password
router.post(
    "/change-password",
    ValidationMiddleware(patientValidation.changePasswordSchema),
    patientcontroller.changePassword
);


// ==================== APPOINTMENTS ====================

// Get verified doctors
router.get(
    "/appointment/doctors",
    authPatientMiddleware,
    patientcontroller.getDoctors
);

// Book appointment
router.post(
    "/appointment",
    authPatientMiddleware,
    ValidationMiddleware(patientValidation.bookAppointmentSchema),
    patientcontroller.bookAppointment
);

// Get patient's appointments
router.get(
    "/appointment",
    authPatientMiddleware,
    patientcontroller.getAllAppointment
);

// Cancel appointment
router.delete(
    "/appointment",
    authPatientMiddleware,
    ValidationMiddleware(patientValidation.cancelAppointmentSchema),
    patientcontroller.cancelAppointment
);


module.exports = router;