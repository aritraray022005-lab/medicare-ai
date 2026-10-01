const express = require("express");
const router = express.Router();

const qaController = require("../controller/qa.controller");
const authPatientMiddleware = require("../middleware/patientAuth.middleware");
const authDoctorMiddleware = require("../middleware/doctorAuth.middleware");
const authAdminMiddleware = require("../middleware/adminAuth.middleware");
const ValidationMiddleware = require("../middleware/validate.middleware");
const qaValidation = require("../validations/qa.validation");

// ==================== PUBLIC / PATIENT ====================
// Get all public questions
router.get("/", qaController.getPublicQuestions);

// Get question details
router.get("/:id", qaController.getQuestionDetails);

// Create question (Patient only)
router.post(
    "/",
    authPatientMiddleware,
    ValidationMiddleware(qaValidation.createQuestionSchema),
    qaController.createQuestion
);

// Get my questions (Patient only)
router.get(
    "/patient/my-questions",
    authPatientMiddleware,
    qaController.getMyQuestions
);

// Delete my question (Patient only)
router.delete(
    "/patient/my-questions/:id",
    authPatientMiddleware,
    qaController.deleteMyQuestion
);

// ==================== DOCTOR ====================
// Submit answer (Doctor only)
router.post(
    "/:id/answers",
    authDoctorMiddleware,
    ValidationMiddleware(qaValidation.submitAnswerSchema),
    qaController.submitAnswer
);

// Get doctor's answers
router.get(
    "/doctor/my-answers",
    authDoctorMiddleware,
    qaController.getDoctorAnswers
);


// ==================== ADMIN ====================
router.delete(
    "/admin/:id",
    authAdminMiddleware,
    qaController.deleteQuestionAdmin
);

router.delete(
    "/admin/answers/:answerId",
    authAdminMiddleware,
    qaController.deleteAnswerAdmin
);

module.exports = router;
