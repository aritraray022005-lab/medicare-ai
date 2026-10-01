const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
    question: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        required: true
    },
    answer: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 5000
    }
}, { timestamps: true });

const questionSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patient",
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 150
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minlength: 20,
        maxlength: 2000
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ["Open", "Answered", "Closed"],
        default: "Open"
    },
    views: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Virtual to populate answers easily
questionSchema.virtual('answers', {
    ref: 'Answer',
    localField: '_id',
    foreignField: 'question'
});

questionSchema.set('toObject', { virtuals: true });
questionSchema.set('toJSON', { virtuals: true });

const Question = mongoose.model("Question", questionSchema);
const Answer = mongoose.model("Answer", answerSchema);

module.exports = { Question, Answer };
