const { default: mongoose } = require("mongoose");
const bcrypt = require('bcrypt');

const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    password:{
        type: String,
        required: true
    },
    isEmailVerified: {
        type: Boolean, 
        default: false 
    },
    resetOTP: String,

    OTPExpiry: Date
})
adminSchema.pre("save",async function (){
    
    if(!this.isModified("password")) return;

    const hashPassword = await bcrypt.hash(this.password,10);

    this.password = hashPassword;

})

adminSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword,this.password);
}


module.exports = mongoose.model("Admin", adminSchema );