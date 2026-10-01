const mongoose = require("mongoose");
const bcrypt = require('bcrypt');

const patientSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    dateOfBirth: {
        type: Date
    },

    gender: {
        type: String,
        enum: ["Male", "Female", "Other"]
    },

    address: {
        type: String
    },

    medicalHistory: {
        type: String
    },

    password: {
        type: String,
        required: true
    },
    isEmailVerified: {
        type: Boolean, 
        default: false 
    },
    
    isBlocked: {
        type: Boolean,
        default: false
    },

    resetOTP: String,

    OTPExpiry: Date
},{timestamps: true});

patientSchema.pre("save",async function (){
    
    if(!this.isModified("password")) return;

    const hashPassword = await bcrypt.hash(this.password,10);

    this.password = hashPassword;

})

patientSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword,this.password);
}

module.exports = mongoose.model("Patient", patientSchema);