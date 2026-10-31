const express = require("express");
const router = express.Router();

const organizationController = require("../controller/organization.controller");
const { organizationAuthMiddleware, requireVerifiedOrganization } = require("../middleware/organizationAuth.middleware");
const ValidationMiddleware = require("../middleware/validate.middleware");
const organizationValidation = require("../validations/organization.validation");
const affiliationController = require("../controller/affiliation.controller");
const affiliationValidation = require("../validations/affiliation.validation");

// ==================== AUTHENTICATION ====================

router.post(
    "/auth/register",
    ValidationMiddleware(organizationValidation.registerSchema),
    organizationController.register
);

router.post(
    "/auth/verify-email",
    ValidationMiddleware(organizationValidation.verifyEmailSchema),
    organizationController.verifyEmail
);

router.post(
    "/auth/resend-verification-otp",
    ValidationMiddleware(organizationValidation.resendOtpSchema),
    organizationController.resendVerificationOtp
);

router.post(
    "/auth/login",
    ValidationMiddleware(organizationValidation.loginSchema),
    organizationController.login
);

router.post(
    "/auth/logout",
    organizationController.logout
);

// Lightweight session probe used by client to verify session state
router.get(
    "/auth/me",
    organizationAuthMiddleware,
    organizationController.getMe
);

// ==================== PROFILE ====================

router.get(
    "/profile",
    organizationAuthMiddleware,
    organizationController.getProfile
);

router.patch(
    "/profile",
    organizationAuthMiddleware,
    ValidationMiddleware(organizationValidation.updateProfileSchema),
    organizationController.updateProfile
);

// ==================== AFFILIATIONS (PHASE 4) ====================

router.get(
    "/affiliations",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    affiliationController.getOrganizationAffiliations
);

router.get(
    "/affiliations/:id/doctor",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    affiliationController.getAffiliationDoctorProfile
);

router.patch(
    "/affiliations/:id/approve",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    affiliationController.approveAffiliation
);

router.patch(
    "/affiliations/:id/reject",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    ValidationMiddleware(affiliationValidation.rejectAffiliationSchema),
    affiliationController.rejectAffiliation
);

router.patch(
    "/affiliations/:id/revoke",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    ValidationMiddleware(affiliationValidation.revokeAffiliationSchema),
    affiliationController.revokeAffiliation
);

// ==================== ROOM & AVAILABILITY MANAGEMENT (PHASE 5) ====================

const roomController = require("../controller/room.controller");
const roomValidation = require("../validations/room.validation");

// Rooms CRUD
router.post(
    "/rooms",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    ValidationMiddleware(roomValidation.createRoomSchema),
    roomController.createRoom
);

router.get(
    "/rooms",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    roomController.getOrganizationRooms
);

router.get(
    "/rooms/:id",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    roomController.getRoomById
);

router.patch(
    "/rooms/:id",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    ValidationMiddleware(roomValidation.updateRoomSchema),
    roomController.updateRoom
);

router.patch(
    "/rooms/:id/toggle-operational",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    ValidationMiddleware(roomValidation.toggleOperationalSchema),
    roomController.toggleRoomOperational
);

// Availability & Slots
router.post(
    "/rooms/:id/availability",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    ValidationMiddleware(roomValidation.createAvailabilitySchema),
    roomController.createRoomAvailability
);

router.get(
    "/slots",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    roomController.getOrganizationSlots
);

router.patch(
    "/slots/:slotId/cancel",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    roomController.cancelRoomSlot
);

// Bookings & Queue Requests
router.get(
    "/bookings",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    roomController.getOrganizationRoomBookings
);

router.get(
    "/requests",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    roomController.getOrganizationRoomRequests
);

router.patch(
    "/bookings/:id/cancel",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    ValidationMiddleware(roomValidation.cancelRoomBookingSchema),
    roomController.cancelRoomBooking
);

router.get(
    "/appointments",
    organizationAuthMiddleware,
    requireVerifiedOrganization,
    roomController.getOrganizationAppointments
);

module.exports = router;
