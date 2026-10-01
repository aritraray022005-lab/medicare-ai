const express = require("express");
const { chatWithAI, checkSymptoms } = require("../controller/ai.controller");
const authPatientMiddleware = require("../middleware/patientAuth.middleware");

const router = express.Router();

router.post("/chat", chatWithAI);
router.post("/symptom-check", authPatientMiddleware, checkSymptoms);

module.exports = router;
