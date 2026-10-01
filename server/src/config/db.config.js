const mongoose = require('mongoose');
const config = require('./config');

const connectDb = async ()=>{
    try {
        await mongoose.connect(config.MONGO_URI);
        console.log('Db connected successfully');
    } catch (error) {
        console.log('connection failed',error.message);
        process.exit(1);
    }
}

module.exports = connectDb;