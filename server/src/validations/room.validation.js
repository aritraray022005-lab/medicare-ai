const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createRoomSchema = z.object({
    roomNumber: z.string().trim().min(1, "Room number is required").max(50, "Room number too long"),
    floor: z.string().trim().max(50).optional().default(""),
    department: z.string().trim().max(100).optional().default(""),
    capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").optional().default(1),
    type: z.string().trim().max(100).optional().default("Consultation Room")
});

const updateRoomSchema = z.object({
    floor: z.string().trim().max(50).optional(),
    department: z.string().trim().max(100).optional(),
    capacity: z.coerce.number().int().min(1).optional(),
    isOperational: z.boolean().optional(),
    type: z.string().trim().max(100).optional()
});

const toggleOperationalSchema = z.object({
    isOperational: z.boolean({ required_error: "isOperational boolean is required" })
});

const createAvailabilitySchema = z.object({
    dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    startTimeStr: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be in HH:mm 24-hour format"),
    endTimeStr: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time must be in HH:mm 24-hour format"),
    clientOffsetMinutes: z.coerce.number().int().optional()
});

const requestRoomBookingSchema = z.object({
    slotId: z.string().regex(objectIdRegex, "Invalid slot ID format"),
    clientRequestId: z.string().trim().min(1).max(100).optional()
});

const cancelRoomBookingSchema = z.object({
    reason: z.string().trim().min(3, "Cancellation reason must be at least 3 characters").max(500)
});

module.exports = {
    createRoomSchema,
    updateRoomSchema,
    toggleOperationalSchema,
    createAvailabilitySchema,
    requestRoomBookingSchema,
    cancelRoomBookingSchema
};
