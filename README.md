# 🏥 Medicare AI

Medicare AI is a full-stack healthcare platform designed to connect patients, doctors, and administrators through a unified web application.

The platform provides AI-assisted health information, doctor discovery, appointment management, doctor verification, authentication, and role-based access control.

---

## 🌐 Live Application

### 🏠 Landing Page

🔗 https://medicare-ai-gules.vercel.app/

The main landing page provides access to the available Medicare AI services and user flows.

### 👨‍⚕️ Doctor Portal

🔗 https://medicare-ai-gules.vercel.app/doctor/

The Doctor Portal provides doctor registration, authentication, profile management, verification, and appointment-related functionality.

> Patient and administrator functionality is accessed through the application's internal navigation and protected routes.

---

# ✨ Key Features

Medicare AI provides functionality for three major roles:

- 👤 Patients
- 👨‍⚕️ Doctors
- 🛡️ Administrators

---

# ⚙️ Functional Features

Functional features describe **what the system does**.

## 👤 Patient Features

### Patient Registration
- Create a patient account.
- Store required patient information.
- Validate registration information.

### Patient Authentication
- Secure patient login.
- Logout functionality.
- Authentication using HTTP-only cookies.
- Protected patient routes.

### Patient Profile
- View patient profile.
- Manage patient information.
- Access authenticated patient functionality.

### Doctor Discovery
Patients can view available doctors and their information, including:

- Doctor name
- Specialization
- Qualification
- Experience
- Consultation fee
- Location
- Verification status

### Appointment Booking
Patients can:

- Select a doctor.
- Request an appointment.
- Provide preferred appointment information.
- View appointment-related information.

### AI-Assisted Health Questions
Patients can submit health-related questions through the AI-assisted question system.

The system processes questions and provides informational responses.

> The AI feature is intended for informational purposes and does not replace professional medical diagnosis or treatment.

---

# 👨‍⚕️ Doctor Features

## Doctor Registration

Doctors can register by providing:

- Name
- Email
- Phone number
- Specialization
- Experience
- Qualification
- Consultation fee
- Medical registration number
- State
- City/Town/Village
- Medical registration certificate

### Medical Registration Certificate

Doctors are required to upload their medical registration certificate.

The application supports:

- PDF uploads
- Maximum file size of 2 MB
- PDF file-type validation
- Unique uploaded filenames

---

## Doctor Authentication

Registered doctors can:

- Log in
- Log out
- Access protected doctor routes
- Maintain an authenticated session

Authentication uses secure HTTP-only cookies.

---

## Doctor Email Verification

The system provides OTP-based email verification for doctors.

The verification workflow includes:

1. Generate OTP
2. Send OTP through email
3. Store OTP temporarily
4. Validate OTP
5. Mark email as verified

---

## Doctor Profile

Doctors can access their profile information, including:

- Name
- Email
- Specialization
- Qualification
- Experience
- Consultation fee
- Location
- Verification status
- Profile information

---

## Doctor Appointments

Doctors can access appointment-related information and manage appointments associated with their account.

---

# 🛡️ Administrator Features

## Admin Authentication

Administrators have a dedicated authentication system.

Features include:

- Admin login
- Admin logout
- Protected admin routes
- Authentication verification

## Doctor Management

Administrators can:

- View registered doctors
- Review doctor information
- Verify doctor accounts
- Manage doctor verification status

The doctor verification process provides an additional layer of trust before doctors become fully verified on the platform.

---

# 📧 Email Features

The application uses the Gmail API for application email functionality.

Email functionality includes:

- OTP delivery
- Doctor email verification
- Password-related email functionality
- Account-related notifications

Google OAuth credentials are stored using environment variables.

---

# ⏱️ Appointment Expiration

The backend includes an automated appointment-expiration process.

A scheduled job periodically checks appointments and handles expired appointment records according to the application's appointment logic.

---

# 🔐 Authentication & Authorization

The application uses authentication and authorization to protect user-specific resources.

The system supports separate roles:

```text
Patient
   │
   └── Patient Protected Routes

Doctor
   │
   └── Doctor Protected Routes

Admin
   │
   └── Admin Protected Routes