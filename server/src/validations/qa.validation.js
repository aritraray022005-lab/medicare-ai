const { z } = require("zod");

const createQuestionSchema = z.object({
    title: z
        .string()
        .trim()
        .min(10, "Title must contain at least 10 characters")
        .max(150, "Title cannot exceed 150 characters"),
    description: z
        .string()
        .trim()
        .min(20, "Description must contain at least 20 characters")
        .max(2000, "Description cannot exceed 2000 characters"),
    category: z
        .string()
        .trim()
        .min(1, "Category is required")
});

const submitAnswerSchema = z.object({
    answer: z
        .string()
        .trim()
        .min(10, "Answer must contain at least 10 characters")
        .max(5000, "Answer cannot exceed 5000 characters")
});

module.exports = {
    createQuestionSchema,
    submitAnswerSchema
};
