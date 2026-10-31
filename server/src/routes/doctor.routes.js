const express = require("express");

const router = express.Router();

const doctorController = require("../controller/doctor.controller");
const doctorAuthMiddleware = require("../middleware/doctorAuth.middleware");

const ValidationMiddleware = require("../middleware/validate.middleware");
const doctorValidation = require("../validations/doctor.validation");
const pdfupload = require("../middleware/multer/upload.middleware");
const imageUpload = require("../middleware/multer/imageUpload.middleware");


// Auth

router.post(
    "/auth/register",
    pdfupload.single("medicalRegistrationCertificate"),
    (req, res, next) => {
        // Validation expects body.locationState etc. If we sent JSON it'd be there, but with FormData they're strings.
        // Wait, Zod will validate the strings.
        next();
    },
    ValidationMiddleware(doctorValidation.registerSchema),
    doctorController.register
);

router.post(
    "/auth/login",
    ValidationMiddleware(doctorValidation.loginSchema),
    doctorController.login
);

router.post(
    "/auth/logout",
    doctorController.logout
);

router.post(
    "/auth/send-otp",
    doctorAuthMiddleware,
    doctorController.sendMailDoctorVerifaction
);

router.post(
    "/auth/verify-otp",
    doctorAuthMiddleware,
    ValidationMiddleware(doctorValidation.verifyEmailOTPSchema),
    doctorController.verifyOTPDoctorVerifaction
);


router.get(
    "/profile",
    doctorAuthMiddleware,
    doctorController.getProfile
);

router.patch(
    "/profile",
    doctorAuthMiddleware,
    ValidationMiddleware(doctorValidation.updateDoctorProfileSchema),
    doctorController.updateDoctorProfile
);

router.patch(
    "/profile/picture",
    doctorAuthMiddleware,
    imageUpload.single("profilePicture"),
    doctorController.updateProfilePicture
);

router.delete(
    "/profile",
    doctorAuthMiddleware,
    doctorController.deleteprofile
);

router.patch(
    "/profile/availability",
    doctorAuthMiddleware,
    ValidationMiddleware(doctorValidation.availabilitySchema),
    doctorController.updateAvailability
);



router.post(
    "/change-password/send-otp",
    ValidationMiddleware(doctorValidation.sendResetOTPSchema),
    doctorController.sendMailDoctorResetPass
);

router.post(
    "/change-password/verify-otp",
    ValidationMiddleware(doctorValidation.verifyResetOTPSchema),
    doctorController.verifyOTDoctorResetPass
);

router.post(
    "/change-password",
    ValidationMiddleware(doctorValidation.changePasswordSchema),
    doctorController.changePassword
);


router.get(
    "/appointment",
    doctorAuthMiddleware,
    doctorController.viewAppointment
);

router.patch(
    "/appointment/status",
    doctorAuthMiddleware,
    ValidationMiddleware(doctorValidation.appointmentStatusSchema),
    doctorController.updateAppointmentStatus
);

// ==================== AFFILIATION (PHASE 4) ====================

const affiliationController = require("../controller/affiliation.controller");
const affiliationValidation = require("../validations/affiliation.validation");

router.get(
    "/organizations",
    doctorAuthMiddleware,
    affiliationController.getVerifiedOrganizations
);

router.post(
    "/affiliations",
    doctorAuthMiddleware,
    ValidationMiddleware(affiliationValidation.requestAffiliationSchema),
    affiliationController.requestAffiliation
);

router.get(
    "/affiliations",
    doctorAuthMiddleware,
    affiliationController.getDoctorAffiliations
);

router.patch(
    "/affiliations/:id/withdraw",
    doctorAuthMiddleware,
    affiliationController.withdrawAffiliationRequest
);

// ==================== ROOM BOOKINGS & FCFS ALLOCATION (PHASE 5) ====================

const roomController = require("../controller/room.controller");
const roomValidation = require("../validations/room.validation");

router.get(
    "/rooms/available",
    doctorAuthMiddleware,
    roomController.getAvailableRoomsForDoctor
);

router.get(
    "/rooms/slots",
    doctorAuthMiddleware,
    roomController.getAvailableSlotsForDoctor
);

router.post(
    "/rooms/requests",
    doctorAuthMiddleware,
    ValidationMiddleware(roomValidation.requestRoomBookingSchema),
    roomController.requestRoomBooking
);

router.get(
    "/rooms/requests",
    doctorAuthMiddleware,
    roomController.getDoctorRoomRequests
);

router.patch(
    "/rooms/requests/:id/withdraw",
    doctorAuthMiddleware,
    roomController.withdrawRoomBookingRequest
);

router.get(
    "/rooms/bookings",
    doctorAuthMiddleware,
    roomController.getDoctorRoomBookings
);

router.patch(
    "/rooms/bookings/:id/cancel",
    doctorAuthMiddleware,
    ValidationMiddleware(roomValidation.cancelRoomBookingSchema),
    roomController.cancelRoomBooking
);

module.exports = router;