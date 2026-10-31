const { z } = require("zod");

const requestAffiliationSchema = z.object({
    organizationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid organization ID")
});

const rejectAffiliationSchema = z.object({
    reason: z.string().trim().min(3, "Reason must be at least 3 characters").max(500, "Reason cannot exceed 500 characters").optional()
});

const revokeAffiliationSchema = z.object({
    reason: z.string().trim().min(3, "Reason must be at least 3 characters").max(500, "Reason cannot exceed 500 characters").optional()
});

const adminResolveAffiliationSchema = z.object({
    action: z.enum(["approve", "reject", "revoke"], {
        errorMap: () => ({ message: "Action must be one of: approve, reject, revoke" })
    }),
    reason: z.string().trim().min(3, "Resolution reason must be at least 3 characters").max(500, "Reason cannot exceed 500 characters")
});

module.exports = {
    requestAffiliationSchema,
    rejectAffiliationSchema,
    revokeAffiliationSchema,
    adminResolveAffiliationSchema
};
