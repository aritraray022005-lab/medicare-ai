const express = require("express");

const router = express.Router();

const admincontroller = require("../controller/admin.controller");
const adminAuthMiddleware = require("../middleware/adminAuth.middleware");


const ValidationMiddleware = require("../middleware/validate.middleware");
const adminValidation = require("../validations/admin.validation");


// ==================== AUTH ====================

router.post(
    "/auth/register",
    ValidationMiddleware(adminValidation.registerSchema),
    admincontroller.register
);

router.post(
    "/auth/login",
    ValidationMiddleware(adminValidation.loginSchema),
    admincontroller.login
);

router.post(
    "/auth/logout",
    admincontroller.logout
);

// Lightweight session check used by the client to decide which nav links to show
router.get(
    "/auth/me",
    adminAuthMiddleware,
    (req, res) => res.status(200).json({
        status: "success",
        admin: { _id: req.userDetails._id, email: req.userDetails.email }
    })
);


// ==================== ADMIN POWERS ====================

router.get(
    "/get-doctors",
    adminAuthMiddleware,
    admincontroller.getDoctors
);

router.patch(
    "/doctor/verification",
    adminAuthMiddleware,
    ValidationMiddleware(adminValidation.doctorVerificationSchema),
    admincontroller.updateDoctorVerification
);

router.get(
    "/get-patients",
    adminAuthMiddleware,
    admincontroller.getPatients
);

router.patch(
    "/doctor/block",
    adminAuthMiddleware,
    ValidationMiddleware(adminValidation.doctorBlockSchema),
    admincontroller.updateDoctorBlockStatus
);

router.patch(
    "/patient/block",
    adminAuthMiddleware,
    ValidationMiddleware(adminValidation.patientBlockSchema),
    admincontroller.updatePatientBlockStatus
);

// ==================== ORGANIZATION POWERS ====================

router.get(
    "/organizations",
    adminAuthMiddleware,
    admincontroller.getOrganizations
);

router.get(
    "/organizations/:id",
    adminAuthMiddleware,
    admincontroller.getOrganizationById
);

router.patch(
    "/organization/verification",
    adminAuthMiddleware,
    ValidationMiddleware(adminValidation.organizationVerificationSchema),
    admincontroller.updateOrganizationVerification
);

router.patch(
    "/organization/block",
    adminAuthMiddleware,
    ValidationMiddleware(adminValidation.organizationBlockSchema),
    admincontroller.updateOrganizationBlockStatus
);


// ==================== PASSWORD RESET ====================

router.post(
    "/change-password/send-otp",
    ValidationMiddleware(adminValidation.sendResetOTPSchema),
    admincontroller.sendMailAdminResetPass
);

router.post(
    "/change-password/verify-otp",
    ValidationMiddleware(adminValidation.verifyResetOTPSchema),
    admincontroller.verifyOTAdminResetPass
);

router.post(
    "/change-password",
    ValidationMiddleware(adminValidation.changePasswordSchema),
    admincontroller.changePassword
);

// ==================== AFFILIATION RESOLUTION (PHASE 4) ====================

const affiliationController = require("../controller/affiliation.controller");
const affiliationValidation = require("../validations/affiliation.validation");

router.get(
    "/affiliations",
    adminAuthMiddleware,
    affiliationController.getAdminAffiliations
);

router.get(
    "/affiliations/:id",
    adminAuthMiddleware,
    affiliationController.getAdminAffiliationById
);

router.patch(
    "/affiliations/:id/resolve",
    adminAuthMiddleware,
    ValidationMiddleware(affiliationValidation.adminResolveAffiliationSchema),
    affiliationController.resolveAffiliation
);

// ==================== HISTORICAL APPOINTMENT RESOLUTION (PHASE 6) ====================

router.patch(
    "/appointments/:id/resolve-historical",
    adminAuthMiddleware,
    ValidationMiddleware(adminValidation.resolveHistoricalAppointmentSchema),
    admincontroller.resolveHistoricalAppointment
);

module.exports = router;