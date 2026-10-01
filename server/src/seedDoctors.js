const mongoose = require("mongoose");

// ================================
// MONGODB CONNECTION
// ================================

const MONGO_URI = process.env.MONGO_URI;

// ================================
// DOCTOR SCHEMA
// ================================

const doctorSchema = new mongoose.Schema(
    {
        name: String,
        email: String,

        availability: {
            sunday: {
                type: [String],
                default: () => []
            },

            monday: {
                type: [String],
                default: () => []
            },

            tuesday: {
                type: [String],
                default: () => []
            },

            wednesday: {
                type: [String],
                default: () => []
            },

            thursday: {
                type: [String],
                default: () => []
            },

            friday: {
                type: [String],
                default: () => []
            },

            saturday: {
                type: [String],
                default: () => []
            }
        }
    }
);

const Doctor = mongoose.model("Doctor", doctorSchema);


// ================================
// AVAILABILITY
// ================================

const availability = {
    sunday: [
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
        "19:00",
        "20:00",
        "21:00"
    ],

    monday: [
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
        "19:00",
        "20:00",
        "21:00"
    ],

    tuesday: [
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
        "19:00",
        "20:00",
        "21:00"
    ],

    wednesday: [
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
        "19:00",
        "20:00",
        "21:00"
    ],

    thursday: [
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
        "19:00",
        "20:00",
        "21:00"
    ],

    friday: [
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
        "19:00",
        "20:00",
        "21:00"
    ],

    saturday: [
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
        "19:00",
        "20:00",
        "21:00"
    ]
};


// ================================
// SEED FUNCTION
// ================================

const seedAvailability = async () => {

    try {

        await mongoose.connect(MONGO_URI);

        console.log("MongoDB connected");


        const doctorId = new mongoose.Types.ObjectId(
            "6abacb4019d6d367bf7e3673"
        );


        const result = await Doctor.updateOne(
            {
                _id: doctorId
            },
            {
                $set: {
                    availability: availability
                }
            }
        );


        if (result.matchedCount === 0) {

            console.log("Doctor not found");

        } else {

            console.log("Doctor availability updated successfully");

        }


    } catch (error) {

        console.error(
            "Error seeding doctor availability:",
            error
        );

    } finally {

        await mongoose.connection.close();

        console.log("MongoDB connection closed");

    }
};


seedAvailability();