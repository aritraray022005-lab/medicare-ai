# MEDCARE AI — Backend

Backend API for **MEDCARE AI**, a healthcare/doctor appointment management platform built with **Node.js, Express.js, MongoDB and Mongoose**.

The backend provides separate functionality for **Patients, Doctors and Administrators**, including authentication, email verification, OTP-based password reset, profile management, doctor verification, doctor availability management and appointment management.

---

## 🚀 Tech Stack

| Technology    | Purpose                           |
| ------------- | --------------------------------- |
| Node.js       | JavaScript runtime                |
| Express.js    | Backend/API framework             |
| MongoDB       | Database                          |
| Mongoose      | MongoDB ODM                       |
| JWT           | Authentication                    |
| Cookie Parser | HTTP cookie handling              |
| bcrypt        | Password hashing                  |
| Zod           | Request validation                |
| Nodemailer    | Email and OTP delivery            |
| Morgan        | HTTP request logging              |
| CORS          | Cross-origin requests             |
| Helmet        | HTTP security headers             |
| Multer        | Planned file/image upload support |

---

# 📁 Backend Folder Structure

```text
backend/
│
├── server.js
├── package.json
├── .env
│
└── src/
    │
    ├── config/
    │   ├── config.js
    │   └── db.config.js
    │
    ├── controller/
    │   ├── admin.controller.js
    │   ├── doctor.controller.js
    │   └── patient.controller.js
    │
    ├── middleware/
    │   ├── adminAuth.middleware.js
    │   ├── doctorAuth.middleware.js
    │   ├── patientAuth.middleware.js
    │   └── validate.middleware.js
    │
    ├── models/
    │   ├── admin.model.js
    │   ├── appointment.model.js
    │   ├── doctor.model.js
    │   └── patient.model.js
    │
    ├── routes/
    │   ├── admin.routes.js
    │   ├── doctor.routes.js
    │   └── patient.routes.js
    │
    ├── util/
    │   └── otp.util.js
    │
    └── validations/
        ├── admin.validation.js
        ├── doctor.validation.js
        └── patient.validation.js
```

---

# 📂 Folder Responsibilities

## `server.js`

Main entry point of the backend.

It:

* Creates the Express application
* Loads environment variables
* Configures global middleware
* Enables CORS
* Enables Helmet
* Enables JSON request parsing
* Enables cookies
* Registers API routes
* Connects to MongoDB
* Starts the Express server

Global middleware currently includes:

```js
app.use(morgan("dev"));
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
```

The main API prefixes are:

```text
/api/patients
/api/doctors
/api/admin
```

The server also exposes:

```http
GET /
```

which returns the backend running status.

---

# 📂 `config/`

Contains application configuration and database connection logic.

### `config.js`

Loads environment variables such as:

```env
MONGO_URI=
PORT=5000
JWT_TOKEN_SECRET=
EMAIL_ID=
EMAIL_PASSWORD=
```

The configuration module also checks that required environment variables are available.

### `db.config.js`

Responsible for connecting the application to MongoDB using Mongoose.

---

# 📂 `controller/`

Contains the application's business logic.

### `admin.controller.js`

Handles:

* Admin registration
* Admin login
* Admin logout
* Password reset
* OTP verification
* Viewing doctors
* Verifying doctors
* Unverifying doctors

### `doctor.controller.js`

Handles:

* Doctor registration
* Doctor login/logout
* Email verification
* Profile management
* Password reset
* Availability management
* Viewing appointments
* Confirming appointments
* Cancelling appointments

### `patient.controller.js`

Handles:

* Patient registration
* Patient login/logout
* Email verification
* Profile management
* Password reset
* Finding verified doctors
* Booking appointments
* Viewing appointments
* Cancelling appointments

---

# 📂 `middleware/`

Middleware responsible for authentication and request validation.

## Authentication Middleware

There are three separate authentication middlewares:

```text
adminAuth.middleware.js
doctorAuth.middleware.js
patientAuth.middleware.js
```

They read the authentication token from an HTTP-only cookie, verify the JWT and retrieve the corresponding user from MongoDB.

For example, the doctor authentication flow is:

```text
Request
   ↓
doctorToken cookie
   ↓
JWT verification
   ↓
Find Doctor in MongoDB
   ↓
req.userDetails
   ↓
Controller
```

The same architecture is used for patients and administrators.

---

## `validate.middleware.js`

The project uses **Zod** for request validation.

The validation middleware:

1. Receives a Zod schema.
2. Validates `req.body`.
3. Returns validation errors if the request is invalid.
4. Replaces `req.body` with validated data.
5. Passes control to the controller.

Example:

```js
ValidationMiddleware(
    doctorValidation.registerSchema
)
```

This separates **input validation** from **business logic**.

---

# 📂 `models/`

Contains Mongoose database schemas.

## `admin.model.js`

Stores administrator information.

Main fields:

```text
email
password
isEmailVerified
resetOTP
OTPExpiry
```

Passwords are hashed using `bcrypt` before being saved.

---

## `doctor.model.js`

Stores doctor information.

Main fields include:

```text
name
email
phone
specialization
experience
qualification
consultationFee
location
bio
availability
rating
reviewCount
password
isEmailVerified
isVerifiedByAdmin
resetOTP
OTPExpiry
```

Doctor passwords are hashed before storage using bcrypt.

Doctors also have an availability structure containing slots for:

```text
Sunday
Monday
Tuesday
Wednesday
Thursday
Friday
Saturday
```

The default appointment slots are:

```text
10:00
11:00
12:00
13:00
14:00
15:00
16:00
17:00
18:00
19:00
20:00
```

The doctor model also supports administrator verification through:

```text
isVerifiedByAdmin
```

---

## `patient.model.js`

Stores patient information.

Main fields:

```text
name
email
dateOfBirth
gender
address
medicalHistory
password
isEmailVerified
resetOTP
OTPExpiry
```

Passwords are hashed using bcrypt before being stored.

---

## `appointment.model.js`

Stores patient-doctor appointments.

Main fields:

```text
patient
doctor
date
time
reason
status
```

Appointment status values are:

```text
Pending
Confirmed
Cancelled
```

The `patient` and `doctor` fields reference their respective MongoDB documents.

The appointment model also contains a unique index to prevent multiple active bookings for the same:

```text
Doctor + Date + Time
```

Active appointments are:

```text
Pending
Confirmed
```

---

# 📂 `routes/`

Contains all API endpoint definitions.

---

# 👨‍⚕️ Doctor API

Base URL:

```text
/api/doctors
```

## Authentication

| Method | Endpoint                       | Authentication | Purpose                     |
| ------ | ------------------------------ | -------------- | --------------------------- |
| POST   | `/api/doctors/auth/register`   | Public         | Register doctor             |
| POST   | `/api/doctors/auth/login`      | Public         | Login doctor                |
| POST   | `/api/doctors/auth/logout`     | Public         | Logout doctor               |
| POST   | `/api/doctors/auth/send-otp`   | Doctor         | Send email verification OTP |
| POST   | `/api/doctors/auth/verify-otp` | Doctor         | Verify email OTP            |

Doctor registration and login requests use Zod validation. Email verification OTP also uses validation.

---

## Doctor Profile

| Method | Endpoint                            | Authentication | Purpose               |
| ------ | ----------------------------------- | -------------- | --------------------- |
| GET    | `/api/doctors/profile`              | Doctor         | Get doctor profile    |
| PATCH  | `/api/doctors/profile`              | Doctor         | Update doctor profile |
| DELETE | `/api/doctors/profile`              | Doctor         | Delete doctor profile |
| PATCH  | `/api/doctors/profile/availability` | Doctor         | Update availability   |

The profile update and availability update requests are validated before reaching the controller.

---

## Doctor Password Reset

| Method | Endpoint                                  | Authentication | Purpose                 |
| ------ | ----------------------------------------- | -------------- | ----------------------- |
| POST   | `/api/doctors/change-password/send-otp`   | Public         | Send password reset OTP |
| POST   | `/api/doctors/change-password/verify-otp` | Public         | Verify reset OTP        |
| POST   | `/api/doctors/change-password`            | Public         | Change password         |

All password reset requests use Zod validation.

---

## Doctor Appointments

| Method | Endpoint                            | Authentication | Purpose             |
| ------ | ----------------------------------- | -------------- | ------------------- |
| GET    | `/api/doctors/appointment`          | Doctor         | View appointments   |
| PATCH  | `/api/doctors/confirm-appointment`  | Doctor         | Confirm appointment |
| PATCH  | `/api/doctors/cancelle-appointment` | Doctor         | Cancel appointment  |

The appointment ID is validated before confirmation/cancellation.

---

# 🧑‍🦽 Patient API

Base URL:

```text
/api/patients
```

## Authentication

| Method | Endpoint                        | Authentication | Purpose                     |
| ------ | ------------------------------- | -------------- | --------------------------- |
| POST   | `/api/patients/auth/register`   | Public         | Register patient            |
| POST   | `/api/patients/auth/login`      | Public         | Login patient               |
| POST   | `/api/patients/auth/logout`     | Public         | Logout patient              |
| POST   | `/api/patients/auth/send-otp`   | Patient        | Send email verification OTP |
| POST   | `/api/patients/auth/verify-otp` | Patient        | Verify email OTP            |

Patient registration and login use Zod validation. Email OTP verification is also validated.

---

## Patient Profile

| Method | Endpoint                | Authentication | Purpose                |
| ------ | ----------------------- | -------------- | ---------------------- |
| GET    | `/api/patients/profile` | Patient        | Get patient profile    |
| PATCH  | `/api/patients/profile` | Patient        | Update patient profile |
| DELETE | `/api/patients/profile` | Patient        | Delete patient profile |

The profile update endpoint uses Zod validation.

---

## Patient Password Reset

| Method | Endpoint                                   | Authentication | Purpose          |
| ------ | ------------------------------------------ | -------------- | ---------------- |
| POST   | `/api/patients/change-password/send-otp`   | Public         | Send reset OTP   |
| POST   | `/api/patients/change-password/verify-otp` | Public         | Verify reset OTP |
| POST   | `/api/patients/change-password`            | Public         | Change password  |

These endpoints use Zod validation before controller execution.

---

## Patient Appointments

| Method | Endpoint                            | Authentication | Purpose              |
| ------ | ----------------------------------- | -------------- | -------------------- |
| GET    | `/api/patients/appointment/doctors` | Patient        | Get verified doctors |
| POST   | `/api/patients/appointment`         | Patient        | Book appointment     |
| GET    | `/api/patients/appointment`         | Patient        | View appointments    |
| DELETE | `/api/patients/appointment`         | Patient        | Cancel appointment   |

The booking and cancellation endpoints use Zod validation.

---

# 👑 Admin API

Base URL:

```text
/api/admin
```

## Authentication

| Method | Endpoint                   | Authentication | Purpose        |
| ------ | -------------------------- | -------------- | -------------- |
| POST   | `/api/admin/auth/register` | Public         | Register admin |
| POST   | `/api/admin/auth/login`    | Public         | Login admin    |
| POST   | `/api/admin/auth/logout`   | Public         | Logout admin   |

Registration and login requests use Zod validation.

---

## Doctor Management

| Method | Endpoint                      | Authentication | Purpose                    |
| ------ | ----------------------------- | -------------- | -------------------------- |
| GET    | `/api/admin/get-doctors`      | Admin          | View all doctors           |
| POST   | `/api/admin/verify-doctors`   | Admin          | Verify doctor              |
| POST   | `/api/admin/unverify-doctors` | Admin          | Remove doctor verification |

Doctor verification and unverification require an authenticated administrator and a validated doctor ID.

---

## Admin Password Reset

| Method | Endpoint                                | Authentication | Purpose         |
| ------ | --------------------------------------- | -------------- | --------------- |
| POST   | `/api/admin/change-password/send-otp`   | Public         | Send reset OTP  |
| POST   | `/api/admin/change-password/verify-otp` | Public         | Verify OTP      |
| POST   | `/api/admin/change-password`            | Public         | Change password |

All three endpoints use validation middleware.

---

# 🔐 Authentication Architecture

MEDCARE AI uses **JWT-based authentication with HTTP-only cookies**.

There are three authentication cookies:

```text
adminToken
doctorToken
patientToken
```

After successful login, the backend creates a JWT and stores it in the appropriate cookie.

Example:

```text
Doctor Login
     ↓
Validate email/password
     ↓
Find doctor
     ↓
Compare bcrypt password
     ↓
Generate JWT
     ↓
Set doctorToken cookie
     ↓
Return successful response
```

Protected requests then use the cookie automatically.

The authentication middleware verifies the JWT and retrieves the user from MongoDB before allowing access to protected controllers.

---

# 🔒 Password Security

Passwords are never stored directly in the database.

Before saving an Admin, Doctor or Patient:

```text
Plain Password
      ↓
bcrypt
      ↓
Hashed Password
      ↓
MongoDB
```

During login:

```text
Entered Password
      ↓
bcrypt.compare()
      ↓
Stored Hash
      ↓
Valid / Invalid
```

The models implement password comparison methods using bcrypt.

---

# 📧 OTP System

The backend uses **Nodemailer** for email communication.

OTP functionality is implemented in:

```text
src/util/otp.util.js
```

The utility provides:

```text
generateOTP()
transporter
resetPassMailOption()
accountVerificationMailOptions()
doctorRegistrationVerificationMailOptions()
```

The OTP system is used for:

* Patient email verification
* Doctor email verification
* Password reset
* Admin password reset
* Doctor password reset
* Patient password reset

OTP information is temporarily stored in the relevant user document:

```text
resetOTP
OTPExpiry
```

The project uses a time-limited OTP flow.

---

# 🧪 Request Validation

The backend uses **Zod** to validate incoming request bodies.

Validation files are located at:

```text
src/validations/
```

```text
admin.validation.js
doctor.validation.js
patient.validation.js
```

Example validation flow:

```text
Client Request
      ↓
Express Route
      ↓
Zod Validation Middleware
      ↓
Valid?
   ↙     ↘
 No       Yes
 ↓         ↓
400       Controller
Response     ↓
          Database
```

The validation middleware uses:

```js
schema.safeParse(req.body)
```

and returns field-specific validation errors when validation fails.

---

# 🗄️ Database Relationships

The main database relationships are:

```text
Patient
   │
   │ books
   ↓
Appointment
   ↑
   │ belongs to
   │
Doctor
```

An appointment contains references to:

```text
patient → Patient
doctor  → Doctor
```

This allows appointment information to be populated with patient and doctor information.

---

# 📅 Appointment Flow

A typical appointment workflow is:

```text
Patient
   ↓
View Verified Doctors
   ↓
Select Doctor
   ↓
Select Date & Time
   ↓
Book Appointment
   ↓
Pending
   ↓
Doctor Reviews Appointment
   ↓
 ┌───────────────┐
 ↓               ↓
Confirm        Cancel
 ↓               ↓
Confirmed      Cancelled
```

The appointment model prevents multiple active appointments for the same doctor, date and time using a MongoDB unique partial index.

---

# 👨‍⚕️ Doctor Verification Flow

Doctors are subject to two different verification states:

```text
isEmailVerified
isVerifiedByAdmin
```

The process is:

```text
Doctor Registration
       ↓
Email Verification
       ↓
isEmailVerified = true
       ↓
Admin Reviews Doctor
       ↓
Admin Verification
       ↓
isVerifiedByAdmin = true
```

Patients can retrieve verified doctors through the patient appointment API.

---

# 🛡️ Security Middleware

The backend currently uses:

### Helmet

```js
app.use(helmet());
```

Used to add security-related HTTP headers.

### CORS

```js
app.use(cors());
```

Used to allow cross-origin requests.

### HTTP-only Cookies

Authentication tokens are stored in HTTP-only cookies so that normal client-side JavaScript cannot directly access the token.

### bcrypt

Used for password hashing.

### JWT

Used for authenticated sessions.

### Zod

Used to validate incoming request data.

---

# 📝 HTTP Methods Used

The API uses standard REST-style HTTP methods.

| Method | Main Usage                         |
| ------ | ---------------------------------- |
| GET    | Retrieve resources                 |
| POST   | Create resources / perform actions |
| PATCH  | Partially update resources         |
| DELETE | Delete resources                   |

Examples:

```http
GET     /api/doctors/profile
POST    /api/doctors/auth/register
PATCH   /api/doctors/profile
DELETE  /api/doctors/profile
```

---

# 🌐 API Base Structure

```text
/api
│
├── /patients
│   ├── /auth
│   ├── /profile
│   ├── /change-password
│   └── /appointment
│
├── /doctors
│   ├── /auth
│   ├── /profile
│   ├── /change-password
│   └── /appointment
│
└── /admin
    ├── /auth
    ├── /get-doctors
    ├── /verify-doctors
    ├── /unverify-doctors
    └── /change-password
```

---

# ⚙️ Environment Variables

Create a `.env` file in the backend root:

```env
MONGO_URI=your_mongodb_connection_string

PORT=5000

JWT_TOKEN_SECRET=your_jwt_secret

EMAIL_ID=your_email

EMAIL_PASSWORD=your_email_password
```

### Important

Do not commit `.env` to GitHub.

Add it to `.gitignore`:

```text
.env
node_modules/
```

---

# ▶️ Running the Backend

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Create:

```text
.env
```

and add the required variables.

## 3. Start the server

For development:

```bash
npm run dev
```

or, depending on the configured npm scripts:

```bash
node server.js
```

The server runs on:

```text
http://localhost:5000
```

---

# ❤️ Health Check

To check whether the API is running:

```http
GET /
```

Response:

```json
{
  "success": true,
  "message": "MEDICARE AI is running successfully!"
}
```

---

# 🔄 Backend Request Architecture

The overall architecture follows:

```text
Client / Frontend
        │
        ▼
      Route
        │
        ▼
   Middleware
   ┌────┴─────┐
   │          │
 Auth      Zod Validation
   │          │
   └────┬─────┘
        ▼
    Controller
        │
        ▼
      Model
        │
        ▼
     MongoDB
        │
        ▼
     Response
        │
        ▼
      Client
```

This separation keeps routing, authentication, validation, business logic and database operations organized.

---

# 📌 API Summary

### Patient

```text
Authentication
POST   /api/patients/auth/register
POST   /api/patients/auth/login
POST   /api/patients/auth/logout
POST   /api/patients/auth/send-otp
POST   /api/patients/auth/verify-otp

Profile
GET    /api/patients/profile
PATCH  /api/patients/profile
DELETE /api/patients/profile

Password
POST   /api/patients/change-password/send-otp
POST   /api/patients/change-password/verify-otp
POST   /api/patients/change-password

Appointments
GET    /api/patients/appointment/doctors
POST   /api/patients/appointment
GET    /api/patients/appointment
DELETE /api/patients/appointment
```

### Doctor

```text
Authentication
POST   /api/doctors/auth/register
POST   /api/doctors/auth/login
POST   /api/doctors/auth/logout
POST   /api/doctors/auth/send-otp
POST   /api/doctors/auth/verify-otp

Profile
GET    /api/doctors/profile
PATCH  /api/doctors/profile
DELETE /api/doctors/profile
PATCH  /api/doctors/profile/availability

Password
POST   /api/doctors/change-password/send-otp
POST   /api/doctors/change-password/verify-otp
POST   /api/doctors/change-password

Appointments
GET    /api/doctors/appointment
PATCH  /api/doctors/confirm-appointment
PATCH  /api/doctors/cancelle-appointment
```

### Admin

```text
Authentication
POST   /api/admin/auth/register
POST   /api/admin/auth/login
POST   /api/admin/auth/logout

Doctor Management
GET    /api/admin/get-doctors
POST   /api/admin/verify-doctors
POST   /api/admin/unverify-doctors

Password
POST   /api/admin/change-password/send-otp
POST   /api/admin/change-password/verify-otp
POST   /api/admin/change-password
```

---

# 🏗️ Architecture Summary

MEDCARE AI follows a modular backend architecture:

```text
Express Server
     │
     ├── Routes
     │
     ├── Middleware
     │     ├── Authentication
     │     └── Validation
     │
     ├── Controllers
     │     └── Business Logic
     │
     ├── Models
     │     └── MongoDB/Mongoose
     │
     ├── Utilities
     │     └── OTP / Email
     │
     └── Configuration
           ├── Environment
           └── Database
```

The backend is designed to provide separate role-based functionality for **Patients, Doctors and Administrators**, while using JWT authentication, HTTP-only cookies, bcrypt password hashing, Zod validation, OTP-based verification and MongoDB for persistence.

---

## 👥 User Roles

| Role    | Main Responsibilities                                                             |
| ------- | --------------------------------------------------------------------------------- |
| Patient | Register, login, manage profile, find doctors, book/cancel appointments           |
| Doctor  | Register, verify email, manage profile/availability, view and manage appointments |
| Admin   | Manage doctors, verify/unverify doctors and manage admin account                  |

---

# 📄 License

This project is developed as part of the MEDCARE AI application.
