const validate = (schema) => {

    return (req, res, next) => {

        const result = schema.safeParse(req.body);

        if (!result.success) {

            return res.status(400).json({
                status: "failed",
                errors: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message
                }))
            });

        }

        // Replace body with validated/transformed data
        req.body = result.data;

        next();
    };
};


module.exports = validate;