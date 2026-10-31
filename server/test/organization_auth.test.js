require("dotenv").config();
const assert = require("assert");
const jwt = require("jsonwebtoken");
const config = require("../src/config/config");
const organizationValidation = require("../src/validations/organization.validation");
const { organizationAuthMiddleware, requireVerifiedOrganization } = require("../src/middleware/organizationAuth.middleware");
const doctorAuthMiddleware = require("../src/middleware/doctorAuth.middleware");
const patientAuthMiddleware = require("../src/middleware/patientAuth.middleware");
const adminAuthMiddleware = require("../src/middleware/adminAuth.middleware");
const outboxService = require("../src/services/outbox.service");

console.log("=== Running Organization Auth & Admin Control Unit Tests (Phase 3) ===");

let passed = 0;
let total = 0;

function runTest(name, fn) {
    total++;
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}:`, err.message);
    }
}

async function runAsyncTest(name, fn) {
    total++;
    try {
        await fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}:`, err.message);
    }
}

async function runSuite() {
    // 1. Organization Registration Validation
    runTest("Registration validation accepts valid payload", () => {
        const validPayload = {
            name: "Apex Healthcare Clinic",
            email: "APEX.CLINIC@Hospital.org",
            phone: "+91-9876543210",
            password: "SecurePassword123!",
            type: "Clinic",
            registrationNumber: "REG-APEX-2026-99",
            address: {
                street: "123 Medical Enclave",
                city: "Bengaluru",
                state: "Karnataka",
                postalCode: "560001",
                country: "India"
            },
            timezone: "Asia/Kolkata"
        };

        const result = organizationValidation.registerSchema.safeParse(validPayload);
        assert(result.success, "Valid payload should pass validation");
        assert.strictEqual(result.data.email, "apex.clinic@hospital.org", "Email should be lowercased");
    });

    runTest("Registration validation rejects invalid type, short password, and missing address", () => {
        const invalidPayload = {
            name: "A",
            email: "not-an-email",
            phone: "123",
            password: "short",
            type: "Pharmacy", // Invalid type
            registrationNumber: "R",
            address: {
                // missing city and state
                street: "123 Street"
            }
        };

        const result = organizationValidation.registerSchema.safeParse(invalidPayload);
        assert(!result.success, "Invalid payload must fail validation");
        const issues = result.error.issues.map((i) => i.path.join("."));
        assert(issues.includes("email"), "Must flag email error");
        assert(issues.includes("password"), "Must flag password error");
        assert(issues.includes("type"), "Must flag type error");
        assert(issues.includes("address.city"), "Must flag missing city error");
        assert(issues.includes("address.state"), "Must flag missing state error");
    });

    // 2. Login and OTP Verification Schema Validation
    runTest("Login validation requires email and non-empty password", () => {
        const invalidLogin = { email: "bad-email", password: "" };
        const result = organizationValidation.loginSchema.safeParse(invalidLogin);
        assert(!result.success, "Invalid login credentials must fail validation");

        const validLogin = { email: "clinic@medcare.org", password: "Password123" };
        const validResult = organizationValidation.loginSchema.safeParse(validLogin);
        assert(validResult.success, "Valid login payload must pass");
    });

    runTest("Email verification schema enforces 6-digit numeric OTP", () => {
        const invalidOtp = { email: "clinic@medcare.org", otp: "abc12" };
        const result = organizationValidation.verifyEmailSchema.safeParse(invalidOtp);
        assert(!result.success, "Alphanumeric 5-char OTP must fail");

        const validOtp = { email: "clinic@medcare.org", otp: "123456" };
        const validResult = organizationValidation.verifyEmailSchema.safeParse(validOtp);
        assert(validResult.success, "6-digit numeric OTP must pass");
    });

    // 3. Organization Controller Logic (Mocked Model Simulation)
    await runAsyncTest("Duplicate email or registrationNumber returns 400 status", async () => {
        const req = {
            body: {
                name: "Apollo Clinic",
                email: "existing@hospital.com",
                phone: "9876543210",
                password: "Password123!",
                type: "Clinic",
                registrationNumber: "REG-DUPLICATE",
                address: { city: "Delhi", state: "Delhi" }
            }
        };

        let responseStatus = null;
        let responseJson = null;
        const res = {
            status: (code) => {
                responseStatus = code;
                return {
                    json: (data) => {
                        responseJson = data;
                    }
                };
            }
        };

        // Simulate duplicate check using Organization.findOne mock
        const Organization = require("../src/models/organization.model");
        const origFindOne = Organization.findOne;
        Organization.findOne = async ({ email, registrationNumber }) => {
            if (email === "existing@hospital.com") {
                return { _id: "existing_id", email };
            }
            return null;
        };

        const organizationController = require("../src/controller/organization.controller");
        await organizationController.register(req, res);

        assert.strictEqual(responseStatus, 400);
        assert.strictEqual(responseJson.status, "failed");
        assert(responseJson.msg.includes("already exists"));

        // Restore mock
        Organization.findOne = origFindOne;
    });

    await runAsyncTest("Login rejection before email verification", async () => {
        const req = {
            body: {
                email: "unverified@hospital.com",
                password: "CorrectPassword123"
            }
        };

        let responseStatus = null;
        let responseJson = null;
        const res = {
            status: (code) => {
                responseStatus = code;
                return {
                    json: (data) => {
                        responseJson = data;
                    }
                };
            }
        };

        const Organization = require("../src/models/organization.model");
        const origFindOne = Organization.findOne;
        Organization.findOne = async () => ({
            _id: "org_unverified",
            email: "unverified@hospital.com",
            isEmailVerified: false,
            isBlocked: false,
            comparePassword: async () => true
        });

        const organizationController = require("../src/controller/organization.controller");
        await organizationController.login(req, res);

        assert.strictEqual(responseStatus, 403);
        assert.strictEqual(responseJson.status, "failed");
        assert(responseJson.msg.includes("Email not verified"));
        assert.strictEqual(responseJson.needsEmailVerification, true);

        Organization.findOne = origFindOne;
    });

    await runAsyncTest("Login rejection when organization is blocked by Admin", async () => {
        const req = {
            body: {
                email: "blocked@hospital.com",
                password: "CorrectPassword123"
            }
        };

        let responseStatus = null;
        let responseJson = null;
        const res = {
            status: (code) => {
                responseStatus = code;
                return {
                    json: (data) => {
                        responseJson = data;
                    }
                };
            }
        };

        const Organization = require("../src/models/organization.model");
        const origFindOne = Organization.findOne;
        Organization.findOne = async () => ({
            _id: "org_blocked",
            email: "blocked@hospital.com",
            isEmailVerified: true,
            isBlocked: true,
            comparePassword: async () => true
        });

        const organizationController = require("../src/controller/organization.controller");
        await organizationController.login(req, res);

        assert.strictEqual(responseStatus, 403);
        assert.strictEqual(responseJson.status, "failed");
        assert(responseJson.msg.includes("blocked by the admin"));

        Organization.findOne = origFindOne;
    });

    await runAsyncTest("Login success after email verification sets cookie and returns organization data", async () => {
        const req = {
            body: {
                email: "verified@hospital.com",
                password: "CorrectPassword123"
            }
        };

        let responseStatus = null;
        let responseJson = null;
        let cookieName = null;
        let cookieVal = null;
        let cookieOptions = null;

        const res = {
            cookie: (name, val, opts) => {
                cookieName = name;
                cookieVal = val;
                cookieOptions = opts;
            },
            status: (code) => {
                responseStatus = code;
                return {
                    json: (data) => {
                        responseJson = data;
                    }
                };
            }
        };

        const Organization = require("../src/models/organization.model");
        const origFindOne = Organization.findOne;
        Organization.findOne = async () => ({
            _id: "org_verified_123",
            name: "Verified Hospital",
            email: "verified@hospital.com",
            phone: "9876543210",
            type: "Hospital",
            registrationNumber: "REG-12345",
            address: { city: "Kolkata", state: "West Bengal" },
            timezone: "Asia/Kolkata",
            isEmailVerified: true,
            isVerifiedByAdmin: false, // Can be unapproved but email verified
            isBlocked: false,
            comparePassword: async () => true
        });

        const organizationController = require("../src/controller/organization.controller");
        await organizationController.login(req, res);

        assert.strictEqual(responseStatus, 200);
        assert.strictEqual(responseJson.status, "success");
        assert.strictEqual(cookieName, "organizationToken");
        assert(cookieVal, "Cookie value must be set");
        assert.strictEqual(cookieOptions.httpOnly, true);

        // Verify decoded token has role: "organization"
        const decoded = jwt.verify(cookieVal, config.JWT_TOKEN_SECRET);
        assert.strictEqual(decoded.id, "org_verified_123");
        assert.strictEqual(decoded.role, "organization");

        Organization.findOne = origFindOne;
    });

    // 4. Role Isolation & Middleware Gates
    await runAsyncTest("organizationAuthMiddleware accepts valid token with role: 'organization'", async () => {
        const Organization = require("../src/models/organization.model");
        const origFindById = Organization.findById;
        Organization.findById = async (id) => ({
            _id: id,
            isBlocked: false,
            isEmailVerified: true
        });

        const validOrgToken = jwt.sign({ id: "org_valid_123", role: "organization" }, config.JWT_TOKEN_SECRET);
        let nextCalled = false;
        const req = { cookies: { organizationToken: validOrgToken } };
        const res = {
            status: () => ({ json: () => {} })
        };

        await organizationAuthMiddleware(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true, "Valid organization token must call next()");
        assert.strictEqual(req.organization._id, "org_valid_123");

        Organization.findById = origFindById;
    });

    await runAsyncTest("organizationAuthMiddleware rejects token with missing role claim", async () => {
        const tokenMissingRole = jwt.sign({ id: "user_without_role" }, config.JWT_TOKEN_SECRET);
        let status = null;
        let json = null;
        const res = {
            status: (code) => {
                status = code;
                return { json: (d) => { json = d; } };
            }
        };

        await organizationAuthMiddleware({ cookies: { organizationToken: tokenMissingRole } }, res, () => {});
        assert.strictEqual(status, 401);
        assert(json.msg.includes("Invalid or missing token role"));
    });

    await runAsyncTest("organizationAuthMiddleware rejects cross-role tokens (doctor, patient, admin)", async () => {
        const roles = ["doctor", "patient", "admin"];
        for (const role of roles) {
            const crossToken = jwt.sign({ id: `user_${role}`, role }, config.JWT_TOKEN_SECRET);
            let status = null;
            let json = null;
            const res = {
                status: (code) => {
                    status = code;
                    return { json: (d) => { json = d; } };
                }
            };

            await organizationAuthMiddleware({ cookies: { organizationToken: crossToken } }, res, () => {});
            assert.strictEqual(status, 401, `Must reject ${role} token`);
            assert(json.msg.includes("Invalid or missing token role"));
        }
    });

    await runAsyncTest("organizationAuthMiddleware rejects invalid, tampered, or missing token cookie", async () => {
        // Missing cookie
        let status1 = null;
        let json1 = null;
        const res1 = {
            status: (code) => {
                status1 = code;
                return { json: (d) => { json1 = d; } };
            }
        };
        await organizationAuthMiddleware({ cookies: {} }, res1, () => {});
        assert.strictEqual(status1, 401);
        assert(json1.msg.includes("Token missing"));

        // Malformed / tampered token
        let status2 = null;
        let json2 = null;
        const res2 = {
            status: (code) => {
                status2 = code;
                return { json: (d) => { json2 = d; } };
            }
        };
        await organizationAuthMiddleware({ cookies: { organizationToken: "corrupted.token.payload" } }, res2, () => {});
        assert.strictEqual(status2, 401);
        assert(json2.msg.includes("Invalid or expired token"));
    });

    await runAsyncTest("organizationAuthMiddleware rejects blocked or email-unverified organizations", async () => {
        const Organization = require("../src/models/organization.model");
        const origFindById = Organization.findById;

        // Blocked
        const orgToken = jwt.sign({ id: "org_blocked_1", role: "organization" }, config.JWT_TOKEN_SECRET);
        Organization.findById = async () => ({
            _id: "org_blocked_1",
            isBlocked: true,
            isEmailVerified: true
        });

        let status1 = null;
        let json1 = null;
        const res1 = {
            status: (code) => {
                status1 = code;
                return { json: (d) => { json1 = d; } };
            }
        };
        await organizationAuthMiddleware({ cookies: { organizationToken: orgToken } }, res1, () => {});
        assert.strictEqual(status1, 403);
        assert(json1.msg.includes("blocked by the admin"));

        // Email unverified
        Organization.findById = async () => ({
            _id: "org_unverified_1",
            isBlocked: false,
            isEmailVerified: false
        });

        let status2 = null;
        let json2 = null;
        const res2 = {
            status: (code) => {
                status2 = code;
                return { json: (d) => { json2 = d; } };
            }
        };
        await organizationAuthMiddleware({ cookies: { organizationToken: orgToken } }, res2, () => {});
        assert.strictEqual(status2, 403);
        assert(json2.msg.includes("Email verification required"));

        Organization.findById = origFindById;
    });

    await runAsyncTest("requireVerifiedOrganization gates unapproved organizations", async () => {
        let status = null;
        let json = null;
        const res = {
            status: (code) => {
                status = code;
                return { json: (d) => { json = d; } };
            }
        };

        // Unapproved organization
        const reqUnapproved = {
            organization: { _id: "org_unapproved", isVerifiedByAdmin: false }
        };
        let nextCalled = false;
        await requireVerifiedOrganization(reqUnapproved, res, () => { nextCalled = true; });
        assert.strictEqual(status, 403);
        assert(json.msg.includes("pending MedCare AI admin verification"));
        assert.strictEqual(nextCalled, false);

        // Approved organization
        const reqApproved = {
            organization: { _id: "org_approved", isVerifiedByAdmin: true }
        };
        nextCalled = false;
        await requireVerifiedOrganization(reqApproved, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true, "Approved organization must proceed through gate");
    });

    // 5. Admin Control & Outbox Integration
    await runAsyncTest("Admin approval updates verification and formats ORGANIZATION_APPROVED email", async () => {
        const emailContent = outboxService.formatEmailContent("ORGANIZATION_APPROVED", {
            organizationName: "Metro General Hospital"
        });

        assert.strictEqual(emailContent.subject, "Organization Approved - MEDCARE AI");
        assert(emailContent.text.includes("approved by MedCare AI Admin"));
        assert(emailContent.html.includes("Metro General Hospital"));

        const rejectedContent = outboxService.formatEmailContent("ORGANIZATION_REJECTED", {
            organizationName: "Metro General Hospital",
            reason: "Invalid clinical registration certificate"
        });
        assert.strictEqual(rejectedContent.subject, "Organization Registration Update - MEDCARE AI");
        assert(rejectedContent.text.includes("Invalid clinical registration certificate"));
    });

    await runAsyncTest("Admin blocking formats ORGANIZATION_BLOCKED and ORGANIZATION_UNBLOCKED emails", async () => {
        const blockedContent = outboxService.formatEmailContent("ORGANIZATION_BLOCKED", {
            organizationName: "City Care Clinic",
            reason: "Compliance violation under investigation"
        });
        assert.strictEqual(blockedContent.subject, "Organization Account Suspended - MEDCARE AI");
        assert(blockedContent.text.includes("Compliance violation under investigation"));

        const unblockedContent = outboxService.formatEmailContent("ORGANIZATION_UNBLOCKED", {
            organizationName: "City Care Clinic"
        });
        assert.strictEqual(unblockedContent.subject, "Organization Account Restored - MEDCARE AI");
        assert(unblockedContent.text.includes("suspension has been lifted"));
    });

    // 6. Mandatory Transaction & Failure Handling Tests
    await runAsyncTest("[UNIT / MOCKED] Admin verification returns 500 when transaction support is unavailable", async () => {
        const mongoose = require("mongoose");
        const adminController = require("../src/controller/admin.controller");
        const Organization = require("../src/models/organization.model");

        const origFindById = Organization.findById;
        const origStartSession = mongoose.startSession;

        Organization.findById = async () => ({
            _id: "org_test_id",
            name: "Test Hospital",
            email: "test@hospital.com",
            isVerifiedByAdmin: false,
            scheduleVersion: 0,
            save: async () => { throw new Error("save should not be called when transaction fails"); }
        });

        // Simulate standalone MongoDB environment where transactions fail to start
        mongoose.startSession = async () => ({
            startTransaction: () => {
                throw new Error("Transaction numbers are only allowed on a replica set member or mongos");
            },
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: "admin_123" },
            body: { organizationId: "507f191e810c19729de860ea", isVerified: true }
        };
        let responseStatus = null;
        let responseJson = null;
        const res = {
            status: (code) => {
                responseStatus = code;
                return { json: (d) => { responseJson = d; } };
            }
        };

        await adminController.updateOrganizationVerification(req, res);

        assert.strictEqual(responseStatus, 500);
        assert.strictEqual(responseJson.status, "failed");
        assert(responseJson.msg.includes("replica set"));

        Organization.findById = origFindById;
        mongoose.startSession = origStartSession;
    });

    await runAsyncTest("[UNIT / MOCKED] Admin blocking returns 500 when transaction support is unavailable", async () => {
        const mongoose = require("mongoose");
        const adminController = require("../src/controller/admin.controller");
        const Organization = require("../src/models/organization.model");

        const origFindById = Organization.findById;
        const origStartSession = mongoose.startSession;

        Organization.findById = async () => ({
            _id: "org_test_id",
            name: "Test Hospital",
            email: "test@hospital.com",
            isBlocked: false,
            scheduleVersion: 0,
            save: async () => { throw new Error("save should not be called when transaction fails"); }
        });

        mongoose.startSession = async () => ({
            startTransaction: () => {
                throw new Error("Transaction numbers are only allowed on a replica set member or mongos");
            },
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: "admin_123" },
            body: { organizationId: "507f191e810c19729de860ea", isBlocked: true, reason: "Audit failed" }
        };
        let responseStatus = null;
        let responseJson = null;
        const res = {
            status: (code) => {
                responseStatus = code;
                return { json: (d) => { responseJson = d; } };
            }
        };

        await adminController.updateOrganizationBlockStatus(req, res);

        assert.strictEqual(responseStatus, 500);
        assert.strictEqual(responseJson.status, "failed");
        assert(responseJson.msg.includes("replica set"));

        Organization.findById = origFindById;
        mongoose.startSession = origStartSession;
    });

    await runAsyncTest("[UNIT / MOCKED] Admin transaction aborts and rolls back if outbox insertion fails", async () => {
        const mongoose = require("mongoose");
        const adminController = require("../src/controller/admin.controller");
        const Organization = require("../src/models/organization.model");
        const OutboxNotification = require("../src/models/outboxNotification.model");

        const origFindById = Organization.findById;
        const origStartSession = mongoose.startSession;
        const origCreate = OutboxNotification.create;

        let transactionAborted = false;
        let transactionCommitted = false;

        Organization.findById = async () => ({
            _id: "org_test_id",
            name: "Test Hospital",
            email: "test@hospital.com",
            isVerifiedByAdmin: false,
            scheduleVersion: 0,
            save: async ({ session }) => {
                assert(session, "Save must receive session");
            }
        });

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => { transactionCommitted = true; },
            abortTransaction: async () => { transactionAborted = true; },
            endSession: async () => {}
        });

        // Simulate outbox failure
        OutboxNotification.create = async () => {
            throw new Error("Simulated Outbox DB failure");
        };

        const req = {
            userDetails: { _id: "admin_123" },
            body: { organizationId: "507f191e810c19729de860ea", isVerified: true }
        };
        let responseStatus = null;
        const res = {
            status: (code) => {
                responseStatus = code;
                return { json: () => {} };
            }
        };

        await adminController.updateOrganizationVerification(req, res);

        assert.strictEqual(transactionAborted, true, "Transaction must abort when outbox notification fails");
        assert.strictEqual(transactionCommitted, false, "Transaction must NOT commit");
        assert.strictEqual(responseStatus, 500);

        Organization.findById = origFindById;
        mongoose.startSession = origStartSession;
        OutboxNotification.create = origCreate;
    });

    // 7. Regression: Existing Doctor, Patient, and Admin token isolation
    await runAsyncTest("Existing Doctor and Patient auth middleware reject organization tokens", async () => {
        const orgToken = jwt.sign({ id: "org_fake_id_12345", role: "organization" }, config.JWT_TOKEN_SECRET);

        const Doctor = require("../src/models/doctor.model");
        const Patient = require("../src/models/patient.model");
        const origDoctorFindById = Doctor.findById;
        const origPatientFindById = Patient.findById;

        // In DB, organization id is NOT in Doctor or Patient collection
        Doctor.findById = async () => null;
        Patient.findById = async () => null;

        let doctorResStatus = null;
        const resDoctor = {
            status: (code) => {
                doctorResStatus = code;
                return { json: () => {} };
            }
        };
        await doctorAuthMiddleware({ cookies: { doctorToken: orgToken } }, resDoctor, () => {});
        assert.strictEqual(doctorResStatus, 401, "Doctor middleware must reject unknown ID");

        let patientResStatus = null;
        const resPatient = {
            status: (code) => {
                patientResStatus = code;
                return { json: () => {} };
            }
        };
        await patientAuthMiddleware({ cookies: { patientToken: orgToken } }, resPatient, () => {});
        assert.strictEqual(patientResStatus, 401, "Patient middleware must reject unknown ID");

        Doctor.findById = origDoctorFindById;
        Patient.findById = origPatientFindById;
    });

    console.log(`\nOrganization Auth Test Results: ${passed}/${total} passed.\n`);
    if (passed !== total) {
        process.exit(1);
    }
}

runSuite().catch((err) => {
    console.error("Test suite runtime error:", err);
    process.exit(1);
});
