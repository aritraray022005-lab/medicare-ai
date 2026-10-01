const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

const Doctor = require("./models/doctor.model");

// ========================================
// LOAD ENVIRONMENT VARIABLES
// ========================================

dotenv.config({ path: "../.env" });

// ========================================
// DEFAULT SLOTS
// ========================================

const defaultSlots = [
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
    "20:00"
];

// ========================================
// DEFAULT AVAILABILITY
// ========================================

const defaultAvailability = {
    sunday: [...defaultSlots],
    monday: [...defaultSlots],
    tuesday: [...defaultSlots],
    wednesday: [...defaultSlots],
    thursday: [...defaultSlots],
    friday: [...defaultSlots],
    saturday: [...defaultSlots]
};

// ========================================
// 30 DOCTORS
// ========================================

const doctors = [
    {
        name: "Dr. Arjun Sharma",
        email: "arjun.sharma@medcare.com",
        phone: "9000000001",
        nmrNumber: "NMR100001",
        profilePicture: "https://i.pravatar.cc/300?img=11",
        specialization: "Cardiologist",
        experience: 12,
        qualification: "MBBS",
        consultationFee: 800,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "Experienced cardiologist specializing in heart health and cardiovascular care."
    },

    {
        name: "Dr. Priya Sen",
        email: "priya.sen@medcare.com",
        phone: "9000000002",
        nmrNumber: "NMR100002",
        profilePicture: "https://i.pravatar.cc/300?img=12",
        specialization: "Dermatologist",
        experience: 9,
        qualification: "MD",
        consultationFee: 700,
        location: {
            state: "West Bengal",
            cityTownVillage: "Salt Lake"
        },
        bio: "Dermatologist specializing in skin, hair and cosmetic treatments."
    },

    {
        name: "Dr. Rahul Das",
        email: "rahul.das@medcare.com",
        phone: "9000000003",
        nmrNumber: "NMR100003",
        profilePicture: "https://i.pravatar.cc/300?img=13",
        specialization: "Neurologist",
        experience: 10,
        qualification: "MD",
        consultationFee: 900,
        location: {
            state: "West Bengal",
            cityTownVillage: "New Town"
        },
        bio: "Neurologist specializing in neurological disorders and brain health."
    },

    {
        name: "Dr. Sneha Roy",
        email: "sneha.roy@medcare.com",
        phone: "9000000004",
        nmrNumber: "NMR100004",
        profilePicture: "https://i.pravatar.cc/300?img=14",
        specialization: "Pediatrician",
        experience: 8,
        qualification: "MD",
        consultationFee: 600,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "Pediatrician providing comprehensive healthcare for children."
    },

    {
        name: "Dr. Ankit Mukherjee",
        email: "ankit.mukherjee@medcare.com",
        phone: "9000000005",
        nmrNumber: "NMR100005",
        profilePicture: "https://i.pravatar.cc/300?img=15",
        specialization: "Orthopedic",
        experience: 11,
        qualification: "MS",
        consultationFee: 850,
        location: {
            state: "West Bengal",
            cityTownVillage: "Salt Lake"
        },
        bio: "Orthopedic specialist focused on bones, joints and musculoskeletal care."
    },

    {
        name: "Dr. Riya Banerjee",
        email: "riya.banerjee@medcare.com",
        phone: "9000000006",
        nmrNumber: "NMR100006",
        profilePicture: "https://i.pravatar.cc/300?img=16",
        specialization: "Gynecologist",
        experience: 9,
        qualification: "MD",
        consultationFee: 750,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "Gynecologist providing women's health and reproductive care."
    },

    {
        name: "Dr. Sayan Ghosh",
        email: "sayan.ghosh@medcare.com",
        phone: "9000000007",
        nmrNumber: "NMR100007",
        profilePicture: "https://i.pravatar.cc/300?img=17",
        specialization: "Psychiatrist",
        experience: 7,
        qualification: "MD",
        consultationFee: 800,
        location: {
            state: "West Bengal",
            cityTownVillage: "New Town"
        },
        bio: "Psychiatrist specializing in mental health and behavioral care."
    },

    {
        name: "Dr. Neha Kapoor",
        email: "neha.kapoor@medcare.com",
        phone: "9000000008",
        nmrNumber: "NMR100008",
        profilePicture: "https://i.pravatar.cc/300?img=18",
        specialization: "Ophthalmologist",
        experience: 10,
        qualification: "MS",
        consultationFee: 700,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "Ophthalmologist specializing in eye care and vision problems."
    },

    {
        name: "Dr. Amit Chatterjee",
        email: "amit.chatterjee@medcare.com",
        phone: "9000000009",
        nmrNumber: "NMR100009",
        profilePicture: "https://i.pravatar.cc/300?img=19",
        specialization: "ENT Specialist",
        experience: 8,
        qualification: "MS",
        consultationFee: 650,
        location: {
            state: "West Bengal",
            cityTownVillage: "Salt Lake"
        },
        bio: "ENT specialist treating ear, nose and throat conditions."
    },

    {
        name: "Dr. Moumita Dutta",
        email: "moumita.dutta@medcare.com",
        phone: "9000000010",
        nmrNumber: "NMR100010",
        profilePicture: "https://i.pravatar.cc/300?img=20",
        specialization: "General Physician",
        experience: 6,
        qualification: "MBBS",
        consultationFee: 500,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "General physician providing primary healthcare and medical consultation."
    },

    {
        name: "Dr. Abhishek Paul",
        email: "abhishek.paul@medcare.com",
        phone: "9000000011",
        nmrNumber: "NMR100011",
        profilePicture: "https://i.pravatar.cc/300?img=21",
        specialization: "Gastroenterologist",
        experience: 13,
        qualification: "DM",
        consultationFee: 1000,
        location: {
            state: "West Bengal",
            cityTownVillage: "New Town"
        },
        bio: "Gastroenterologist specializing in digestive system disorders."
    },

    {
        name: "Dr. Ishita Bose",
        email: "ishita.bose@medcare.com",
        phone: "9000000012",
        nmrNumber: "NMR100012",
        profilePicture: "https://i.pravatar.cc/300?img=22",
        specialization: "Endocrinologist",
        experience: 11,
        qualification: "DM",
        consultationFee: 900,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "Endocrinologist specializing in diabetes and hormonal disorders."
    },

    {
        name: "Dr. Kunal Mitra",
        email: "kunal.mitra@medcare.com",
        phone: "9000000013",
        nmrNumber: "NMR100013",
        profilePicture: "https://i.pravatar.cc/300?img=23",
        specialization: "Pulmonologist",
        experience: 10,
        qualification: "MD",
        consultationFee: 850,
        location: {
            state: "West Bengal",
            cityTownVillage: "Salt Lake"
        },
        bio: "Pulmonologist specializing in respiratory and lung diseases."
    },

    {
        name: "Dr. Tania Saha",
        email: "tania.saha@medcare.com",
        phone: "9000000014",
        nmrNumber: "NMR100014",
        profilePicture: "https://i.pravatar.cc/300?img=24",
        specialization: "Dentist",
        experience: 7,
        qualification: "BDS",
        consultationFee: 500,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "Dentist providing preventive and restorative dental care."
    },

    {
        name: "Dr. Soumya Nandi",
        email: "soumya.nandi@medcare.com",
        phone: "9000000015",
        nmrNumber: "NMR100015",
        profilePicture: "https://i.pravatar.cc/300?img=25",
        specialization: "Urologist",
        experience: 12,
        qualification: "MCh",
        consultationFee: 950,
        location: {
            state: "West Bengal",
            cityTownVillage: "New Town"
        },
        bio: "Urologist specializing in urinary and male reproductive health."
    },

    {
        name: "Dr. Debanjan Roy",
        email: "debanjan.roy@medcare.com",
        phone: "9000000016",
        nmrNumber: "NMR100016",
        profilePicture: "https://i.pravatar.cc/300?img=26",
        specialization: "Nephrologist",
        experience: 14,
        qualification: "DM",
        consultationFee: 1000,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "Nephrologist specializing in kidney diseases and renal care."
    },

    {
        name: "Dr. Ananya Sen",
        email: "ananya.sen@medcare.com",
        phone: "9000000017",
        nmrNumber: "NMR100017",
        profilePicture: "https://i.pravatar.cc/300?img=27",
        specialization: "Oncologist",
        experience: 15,
        qualification: "MD",
        consultationFee: 1200,
        location: {
            state: "West Bengal",
            cityTownVillage: "Salt Lake"
        },
        bio: "Oncologist specializing in cancer diagnosis and treatment."
    },

    {
        name: "Dr. Vivek Agarwal",
        email: "vivek.agarwal@medcare.com",
        phone: "9000000018",
        nmrNumber: "NMR100018",
        profilePicture: "https://i.pravatar.cc/300?img=28",
        specialization: "General Physician",
        experience: 8,
        qualification: "MBBS",
        consultationFee: 500,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "General physician providing comprehensive primary healthcare."
    },

    {
        name: "Dr. Pooja Mehta",
        email: "pooja.mehta@medcare.com",
        phone: "9000000019",
        nmrNumber: "NMR100019",
        profilePicture: "https://i.pravatar.cc/300?img=29",
        specialization: "General Physician",
        experience: 6,
        qualification: "MBBS",
        consultationFee: 500,
        location: {
            state: "West Bengal",
            cityTownVillage: "New Town"
        },
        bio: "General physician focused on preventive and primary healthcare."
    },

    {
        name: "Dr. Soumita Ghosh",
        email: "soumita.ghosh@medcare.com",
        phone: "9000000020",
        nmrNumber: "NMR100020",
        profilePicture: "https://i.pravatar.cc/300?img=30",
        specialization: "General Physician",
        experience: 7,
        qualification: "MBBS",
        consultationFee: 500,
        location: {
            state: "West Bengal",
            cityTownVillage: "Salt Lake"
        },
        bio: "General physician providing routine medical consultation."
    },

    {
        name: "Dr. Rajiv Malhotra",
        email: "rajiv.malhotra@medcare.com",
        phone: "9000000021",
        nmrNumber: "NMR100021",
        profilePicture: "https://i.pravatar.cc/300?img=31",
        specialization: "Cardiologist",
        experience: 16,
        qualification: "MD",
        consultationFee: 1100,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "Senior cardiologist specializing in cardiovascular medicine."
    },

    {
        name: "Dr. Nandini Mukherjee",
        email: "nandini.mukherjee@medcare.com",
        phone: "9000000022",
        nmrNumber: "NMR100022",
        profilePicture: "https://i.pravatar.cc/300?img=32",
        specialization: "Pediatrician",
        experience: 9,
        qualification: "MD",
        consultationFee: 650,
        location: {
            state: "West Bengal",
            cityTownVillage: "New Town"
        },
        bio: "Pediatrician specializing in child development and healthcare."
    },

    {
        name: "Dr. Sourav Basu",
        email: "sourav.basu@medcare.com",
        phone: "9000000023",
        nmrNumber: "NMR100023",
        profilePicture: "https://i.pravatar.cc/300?img=33",
        specialization: "Orthopedic",
        experience: 12,
        qualification: "MS",
        consultationFee: 850,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "Orthopedic specialist focused on joint and bone health."
    },

    {
        name: "Dr. Roshni Chakraborty",
        email: "roshni.chakraborty@medcare.com",
        phone: "9000000024",
        nmrNumber: "NMR100024",
        profilePicture: "https://i.pravatar.cc/300?img=34",
        specialization: "Gynecologist",
        experience: 10,
        qualification: "MD",
        consultationFee: 750,
        location: {
            state: "West Bengal",
            cityTownVillage: "Salt Lake"
        },
        bio: "Gynecologist specializing in women's health and maternity care."
    },

    {
        name: "Dr. Aditya Kapoor",
        email: "aditya.kapoor@medcare.com",
        phone: "9000000025",
        nmrNumber: "NMR100025",
        profilePicture: "https://i.pravatar.cc/300?img=35",
        specialization: "Neurologist",
        experience: 13,
        qualification: "MD",
        consultationFee: 950,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "Neurologist specializing in neurological diagnosis and treatment."
    },

    {
        name: "Dr. Shreya Paul",
        email: "shreya.paul@medcare.com",
        phone: "9000000026",
        nmrNumber: "NMR100026",
        profilePicture: "https://i.pravatar.cc/300?img=36",
        specialization: "Dermatologist",
        experience: 8,
        qualification: "MD",
        consultationFee: 700,
        location: {
            state: "West Bengal",
            cityTownVillage: "New Town"
        },
        bio: "Dermatologist specializing in clinical and cosmetic dermatology."
    },

    {
        name: "Dr. Manish Verma",
        email: "manish.verma@medcare.com",
        phone: "9000000027",
        nmrNumber: "NMR100027",
        profilePicture: "https://i.pravatar.cc/300?img=37",
        specialization: "Gastroenterologist",
        experience: 14,
        qualification: "DM",
        consultationFee: 1000,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "Gastroenterologist specializing in digestive health."
    },

    {
        name: "Dr. Diya Chatterjee",
        email: "diya.chatterjee@medcare.com",
        phone: "9000000028",
        nmrNumber: "NMR100028",
        profilePicture: "https://i.pravatar.cc/300?img=38",
        specialization: "Ophthalmologist",
        experience: 9,
        qualification: "MS",
        consultationFee: 700,
        location: {
            state: "West Bengal",
            cityTownVillage: "Salt Lake"
        },
        bio: "Ophthalmologist providing comprehensive eye care."
    },

    {
        name: "Dr. Karthik Iyer",
        email: "karthik.iyer@medcare.com",
        phone: "9000000029",
        nmrNumber: "NMR100029",
        profilePicture: "https://i.pravatar.cc/300?img=39",
        specialization: "Pulmonologist",
        experience: 11,
        qualification: "MD",
        consultationFee: 850,
        location: {
            state: "West Bengal",
            cityTownVillage: "New Town"
        },
        bio: "Pulmonologist specializing in respiratory diseases."
    },

    {
        name: "Dr. Meera Roy",
        email: "meera.roy@medcare.com",
        phone: "9000000030",
        nmrNumber: "NMR100030",
        profilePicture: "https://i.pravatar.cc/300?img=40",
        specialization: "General Physician",
        experience: 7,
        qualification: "MBBS",
        consultationFee: 500,
        location: {
            state: "West Bengal",
            cityTownVillage: "Kolkata"
        },
        bio: "General physician providing primary medical care."
    }
];

// ========================================
// SEED FUNCTION
// ========================================

const seedDoctors = async () => {
    try {
        // ========================================
        // CONNECT TO MONGODB
        // ========================================

        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected");

        // ========================================
        // DELETE ALL EXISTING DOCTORS
        // ========================================

        const deleteResult = await Doctor.deleteMany({});

        console.log(
            `${deleteResult.deletedCount} doctors deleted successfully`
        );

        // ========================================
        // HASH COMMON PASSWORD
        // ========================================

        const hashedPassword = await bcrypt.hash(
            "Doctor@123",
            10
        );

        // ========================================
        // PREPARE DOCTORS
        // ========================================

        const doctorsWithDetails = doctors.map((doctor) => ({
            ...doctor,

            // Authentication
            password: hashedPassword,

            // Verification
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false,

            // Availability
            availability: {
                sunday: [...defaultAvailability.sunday],
                monday: [...defaultAvailability.monday],
                tuesday: [...defaultAvailability.tuesday],
                wednesday: [...defaultAvailability.wednesday],
                thursday: [...defaultAvailability.thursday],
                friday: [...defaultAvailability.friday],
                saturday: [...defaultAvailability.saturday]
            },

            // Rating
            rating: 0,
            reviewCount: 0
        }));

        // ========================================
        // INSERT ALL 30 DOCTORS
        // ========================================

        const insertedDoctors = await Doctor.insertMany(
            doctorsWithDetails
        );

        // ========================================
        // SUCCESS MESSAGE
        // ========================================

        console.log("\n=================================");
        console.log("SEED COMPLETED SUCCESSFULLY");
        console.log("=================================");

        console.log(
            `Total doctors inserted: ${insertedDoctors.length}`
        );

        console.log("Email verified: 30");
        console.log("Admin verified: 30");
        console.log("Blocked: 0");

        console.log(
            "Availability: Sunday - Saturday"
        );

        console.log(
            "Slots: 10:00 - 20:00"
        );

        console.log(
            "Common password: Doctor@123"
        );

        console.log("=================================\n");

    } catch (error) {
        console.error("\nSEEDING FAILED:");
        console.error(error);
    } finally {
        // ========================================
        // CLOSE DATABASE CONNECTION
        // ========================================

        await mongoose.connection.close();

        console.log("MongoDB connection closed");
    }
};

// ========================================
// RUN SEED
// ========================================

seedDoctors();