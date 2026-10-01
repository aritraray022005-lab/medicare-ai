const jwt = require("jsonwebtoken");
const Patient = require("../models/patient.model");
const config = require("../config/config");

const patientAuthMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.patientToken;

        if (!token) {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized: Token missing"
            });
        }

        const decoded = jwt.verify(
            token,
            config.JWT_TOKEN_SECRET
        );

        const patient = await Patient.findById(decoded.id);

        if (!patient) {
            return res.status(401).json({
                status: "failed",
                msg: "Patient not found."
            });
        }

        req.userDetails = patient;

        next();

    } catch (error) {
        return res.status(401).json({
            status: "failed",
            msg: "Invalid or expired token."
        });
    }
};

module.exports = patientAuthMiddleware;