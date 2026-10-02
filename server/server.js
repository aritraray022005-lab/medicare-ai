const dotenv = require("dotenv");

dotenv.config();

const express = require("express");

const app = express();

const mongoose = require("mongoose");
const cookieParser = require('cookie-parser');
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







//Golbal MiddleWare
app.use(morgan("dev"));
// app.use(cors());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://medicare-ai-gules.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("Blocked CORS origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));


app.use((req, res, next) => {
  console.log("Request Origin:", req.headers.origin);
  next();
});

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));



app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MEDICARE AI is running successfully!"
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    service: "medicare-server",
    timestamp: new Date().toISOString()
  });
});

//Routes

app.use("/api/patients", patientRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/questions", qaRoutes);


// 
app.get("/check/:status", (req, res) => {
  console.log(req.params);


  res.send("hii")
})




connectDb()
  .then(() => {
    app.listen(config.PORT, () => {
      console.log(`Server Running on port ${config.PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
  });