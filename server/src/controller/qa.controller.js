const { Question, Answer } = require("../models/qa.model");
const mongoose = require("mongoose");
const doctorModel = require("../models/doctor.model");

// ==================== PATIENT LOGIC ====================

const createQuestion = async (req, res) => {
    try {
        const patientId = req.userDetails._id;
        const { title, description, category } = req.body;

        const question = await Question.create({
            patient: patientId,
            title,
            description,
            category
        });

        res.status(201).json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getPublicQuestions = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;
        
        const filter = {};
        if (req.query.category) filter.category = req.query.category;
        if (req.query.status) filter.status = req.query.status;
        if (req.query.search) {
            filter.$or = [
                { title: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const questions = await Question.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("patient", "name") // only populate name for privacy
            .populate({
                path: "answers",
                populate: { path: "doctor", select: "name profilePicture specialization isVerifiedByAdmin" }
            });
            
        const total = await Question.countDocuments(filter);

        res.status(200).json({ success: true, questions, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getQuestionDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await Question.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true })
            .populate("patient", "name")
            .populate({
                path: "answers",
                populate: { path: "doctor", select: "name profilePicture specialization experience isVerifiedByAdmin" }
            });

        if (!question) {
            return res.status(404).json({ success: false, message: "Question not found" });
        }

        res.status(200).json({ success: true, question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getMyQuestions = async (req, res) => {
    try {
        const patientId = req.userDetails._id;
        const questions = await Question.find({ patient: patientId })
            .sort({ createdAt: -1 })
            .populate({
                path: "answers",
                populate: { path: "doctor", select: "name profilePicture specialization" }
            });

        res.status(200).json({ success: true, questions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteMyQuestion = async (req, res) => {
    try {
        const patientId = req.userDetails._id;
        const { id } = req.params;

        const question = await Question.findOne({ _id: id, patient: patientId });
        if (!question) {
            return res.status(404).json({ success: false, message: "Question not found or unauthorized" });
        }

        await Answer.deleteMany({ question: id });
        await Question.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: "Question deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// ==================== DOCTOR LOGIC ====================

const submitAnswer = async (req, res) => {
    try {
        const doctorId = req.userDetails._id;
        const { id: questionId } = req.params;
        const { answer } = req.body;

        // Verify doctor
        const doctor = await doctorModel.findById(doctorId);
        if (!doctor || !doctor.isEmailVerified || !doctor.isVerifiedByAdmin || doctor.isBlocked) {
            return res.status(403).json({ success: false, message: "Unauthorized. Doctor must be verified and active to answer." });
        }

        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({ success: false, message: "Question not found" });
        }

        const newAnswer = await Answer.create({
            question: questionId,
            doctor: doctorId,
            answer
        });

        // Update question status if it was Open
        if (question.status === "Open") {
            question.status = "Answered";
            await question.save();
        }

        res.status(201).json({ success: true, answer: newAnswer });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getDoctorAnswers = async (req, res) => {
    try {
        const doctorId = req.userDetails._id;
        const answers = await Answer.find({ doctor: doctorId })
            .sort({ createdAt: -1 })
            .populate("question", "title category status createdAt");

        res.status(200).json({ success: true, answers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// ==================== ADMIN LOGIC ====================

const deleteQuestionAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        await Answer.deleteMany({ question: id });
        await Question.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Question deleted successfully by admin" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteAnswerAdmin = async (req, res) => {
    try {
        const { answerId } = req.params;
        
        const answer = await Answer.findById(answerId);
        if (!answer) {
            return res.status(404).json({ success: false, message: "Answer not found" });
        }
        
        const questionId = answer.question;
        await Answer.findByIdAndDelete(answerId);
        
        // Check if question still has answers
        const remainingAnswers = await Answer.countDocuments({ question: questionId });
        if (remainingAnswers === 0) {
            await Question.findByIdAndUpdate(questionId, { status: "Open" });
        }

        res.status(200).json({ success: true, message: "Answer deleted successfully by admin" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createQuestion,
    getPublicQuestions,
    getQuestionDetails,
    getMyQuestions,
    deleteMyQuestion,
    submitAnswer,
    getDoctorAnswers,
    deleteQuestionAdmin,
    deleteAnswerAdmin
};
