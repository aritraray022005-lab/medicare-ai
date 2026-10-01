const jwt = require('jsonwebtoken');
const doctorModel = require('../models/doctor.model');
const config = require('../config/config');

const doctorAuthMiddleware = async (req, res, next) =>{
    try {
        const token = req.cookies.doctorToken;

        if(!token)
        {
            return res.status(401).json({
                status: "failed",
                msg: "Unauthorized: Token missing"
            });
        }

        const decode = jwt.verify(
            token,
            config.JWT_TOKEN_SECRET
        );

        const doctor = await doctorModel.findById(decode.id);

        if(!doctor)
        {
            return res.status(401).json({
                status: "failed",
                msg: "Doctor not found."
            });
        }

        req.userDetails = doctor;

        next();

    } catch (error) {
        return res.status(401).json({
            status: "failed",
            msg: "Invalid or expired token."
        });
    }
}

module.exports = doctorAuthMiddleware;