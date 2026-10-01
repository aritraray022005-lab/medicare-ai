const aiService = require("../services/ai.service");

const chatWithAI = async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Message is required",
            });
        }

        const reply = await aiService.generateBasicChatResponse(message, history);

        return res.status(200).json({
            success: true,
            reply: reply,
        });
    } catch (error) {
        console.error("AI Controller Error:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong while communicating with AI.",
            error: error.message,
        });
    }
};

const checkSymptoms = async (req, res) => {
    try {
        const { symptoms, age, duration } = req.body;

        if (!symptoms || !age || !duration) {
            return res.status(400).json({
                success: false,
                message: "Symptoms, age, and duration are required",
            });
        }

        const data = await aiService.checkSymptoms(symptoms, age, duration);

        return res.status(200).json({
            success: true,
            data: data,
        });
    } catch (error) {
        console.error("AI Symptom Checker Error:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong while communicating with AI.",
            error: error.message,
        });
    }
};

module.exports = {
    chatWithAI,
    checkSymptoms
};
