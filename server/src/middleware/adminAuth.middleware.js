const jwt = require('jsonwebtoken');
const adminModel = require('../models/admin.model');
const config = require('../config/config');

const adminAuthMiddleware = async (req, res, next) =>{
    try {
        const token = req.cookies.adminToken;

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

        const admin = await adminModel.findById(decode.id);

        if(!admin)
        {
            return res.status(401).json({
                status: "failed",
                msg: "admin not found."
            });
        }

        req.userDetails = admin;

        next();

    } catch (error) {
        return res.status(401).json({
            status: "failed",
            msg: "Invalid or expired token."
        });
    }
}

module.exports = adminAuthMiddleware;