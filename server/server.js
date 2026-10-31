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
const organizationRoutes = require("./src/routes/organization.routes");
const aiRoutes = require("./src/routes/ai.routes");
const qaRoutes = require("./src/routes/qa.routes");
const { defaultWorker } = require("./src/jobs/outboxWorker");
const { defaultDurableWorker } = require("./src/jobs/durableJobWorker");
const mongoose = require("mongoose");

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
  const isDbConnected = mongoose.connection.readyState === 1;
  const dbStatusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };
  const databaseStatus = dbStatusMap[mongoose.connection.readyState] || "unknown";

  const statusCode = isDbConnected ? 200 : 503;
  return res.status(statusCode).json({
    success: isDbConnected,
    status: isDbConnected ? "healthy" : "unhealthy",
    database: databaseStatus,
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

app.use("/api/organizations", organizationRoutes);

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

let server = null;

connectDb()
  .then(() => {
    server = app.listen(config.PORT, () => {
      console.log(`Server Running on port ${config.PORT}`);

      // Start background workers with isTickBusy protection
      defaultWorker.startPolling(5000);
      defaultDurableWorker.startPolling(5000);
    });

    // Handle MongoDB disconnection and reconnection for workers
    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Pausing workers...");
      defaultWorker.stopPolling();
      defaultDurableWorker.stopPolling();
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected. Resuming workers...");
      defaultWorker.startPolling(5000);
      defaultDurableWorker.startPolling(5000);
    });
  })
  .catch((error) => {
    console.error(
      "Database connection failed:",
      error.message
    );
  });

// Graceful shutdown handling
let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}. Gracefully stopping background workers and HTTP server...`);
  try {
    // Wait for in-flight ticks to settle (up to 10 seconds)
    await Promise.allSettled([
      defaultWorker.shutdown(10000),
      defaultDurableWorker.shutdown(10000)
    ]);
  } catch (err) {
    console.error("Error during background workers graceful shutdown:", err.message);
  }

  if (server) {
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));