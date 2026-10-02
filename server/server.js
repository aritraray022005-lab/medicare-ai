const dotenv = require("dotenv");

dotenv.config();

const express = require("express");
const app = express();

const cookieParser = require("cookie-parser");
const config = require("./src/config/config");
const connectDb = require("./src/config/db.config");

require("./src/jobs/appointmentCron"); // Initialize cron jobs

const patientRoutes = require("./src/routes/patient.routes");
const doctorRoutes = require("./src/routes/doctor.routes");
const adminRoutes = require("./src/routes/admin.routes");
const aiRoutes = require("./src/routes/ai.routes");
const qaRoutes = require("./src/routes/qa.routes");

const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");

// ======================================================
// GLOBAL MIDDLEWARE
// ======================================================

app.use(morgan("dev"));

// ======================================================
// CORS CONFIGURATION
// ======================================================

const allowedOrigins = [
  // Local development
  "http://localhost:5173",
  "http://localhost:5174",

  // Vercel production domain
  "https://medicare-ai-gules.vercel.app",

  // Current Vercel deployment
  "https://medicare-ja3pelnud-aritra-rays-projects-c43f7a18.vercel.app",

  // Previous Vercel deployment
  "https://medicare-ai-git-main-aritra-rays-projects-c43f7a18.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an Origin header
      // Example: curl, Postman, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked CORS origin:", origin);

      return callback(new Error("Not allowed by CORS"));
    },

    // Required for cookies/JWT authentication
    credentials: true
  })
);

// ======================================================
// REQUEST ORIGIN DEBUGGING
// ======================================================

app.use((req, res, next) => {
  console.log("Request Origin:", req.headers.origin);
  next();
});

// ======================================================
// SECURITY
// ======================================================

app.use(helmet());

// ======================================================
// BODY PARSERS
// ======================================================

app.use(express.json());

app.use(cookieParser());

app.use(express.urlencoded({ extended: true }));

// ======================================================
// STATIC FILES
// ======================================================

app.use("/uploads", express.static("uploads"));

// ======================================================
// ROOT ROUTE
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MEDICARE AI is running successfully!"
  });
});

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    service: "medicare-server",
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// API ROUTES
// ======================================================

app.use("/api/patients", patientRoutes);

app.use("/api/doctors", doctorRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/ai", aiRoutes);

app.use("/api/questions", qaRoutes);

// ======================================================
// TEST ROUTE
// ======================================================

app.get("/check/:status", (req, res) => {
  console.log(req.params);

  res.send("hii");
});

// ======================================================
// DATABASE CONNECTION + SERVER START
// ======================================================

connectDb()
  .then(() => {
    app.listen(config.PORT, () => {
      console.log(`Server Running on port ${config.PORT}`);
    });
  })
  .catch((error) => {
    console.error(
      "Database connection failed:",
      error.message
    );
  });