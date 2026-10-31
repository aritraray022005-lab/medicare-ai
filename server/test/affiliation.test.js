require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const DoctorOrganization = require("../src/models/doctorOrganization.model");
const Doctor = require("../src/models/doctor.model");
const Organization = require("../src/models/organization.model");
const OutboxNotification = require("../src/models/outboxNotification.model");
const affiliationController = require("../src/controller/affiliation.controller");
const { acquireScheduleLocks } = require("../src/util/lock.util");
const outboxService = require("../src/services/outbox.service");

// Default unit test mock for OutboxNotification.create to prevent Mongoose connection buffering
OutboxNotification.create = async (docs) => (Array.isArray(docs) ? docs : [docs]).map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));

console.log("=== Running Doctor Affiliation & Admin Resolution Unit Tests (Phase 4) ===");

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

function createMockRes() {
    const res = {
        statusCode: null,
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        }
    };
    return res;
}

function mockFindOneNull() {
    const p = Promise.resolve(null);
    p.session = () => Promise.resolve(null);
    return p;
}

async function runSuite() {
    // 1. Doctor Eligibility: Email verification required
    await runAsyncTest("[UNIT / MOCKED] Email-unverified doctor cannot request affiliation", async () => {
        const req = {
            userDetails: {
                _id: new mongoose.Types.ObjectId(),
                isEmailVerified: false,
                isBlocked: false
            },
            body: { organizationId: new mongoose.Types.ObjectId().toString() }
        };
        const res = createMockRes();

        await affiliationController.requestAffiliation(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("Email verification required"));
    });

    // 2. Doctor Eligibility: isVerifiedByAdmin is NOT required
    await runAsyncTest("[UNIT / MOCKED] Email-verified but doctor-admin-unverified doctor can request affiliation", async () => {
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();

        const req = {
            userDetails: {
                _id: doctorId,
                name: "Dr. Candidate",
                email: "candidate@doctor.com",
                specialization: "Cardiologist",
                isEmailVerified: true,
                isVerifiedByAdmin: false, // NOT admin verified
                isBlocked: false
            },
            body: { organizationId: orgId.toString() }
        };
        const res = createMockRes();

        const origFindByIdOrg = Organization.findById;
        const origFindOneDocOrg = DoctorOrganization.findOne;
        const origCreateDocOrg = DoctorOrganization.create;
        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origStartSession = mongoose.startSession;
        const origQueueNotif = outboxService.queueNotification;

        Organization.findById = async (id) => ({
            _id: id,
            name: "Apex Hospital",
            email: "admin@apex.com",
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false
        });

        function mockFindOneNull() {
            const p = Promise.resolve(null);
            p.session = () => Promise.resolve(null);
            return p;
        }

        DoctorOrganization.findOne = () => mockFindOneNull();

        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        Doctor.findOneAndUpdate = async () => ({ _id: doctorId, scheduleVersion: 1 });

        const createdAffiliation = {
            _id: new mongoose.Types.ObjectId(),
            doctor: doctorId,
            organization: orgId,
            status: "Pending",
            requestedBy: "Doctor"
        };

        DoctorOrganization.create = async () => [createdAffiliation];
        DoctorOrganization.findById = (id) => ({
            populate: async () => ({ ...createdAffiliation, organization: { name: "Apex Hospital" } })
        });

        let sessionCommitted = false;
        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => { sessionCommitted = true; },
            abortTransaction: async () => {},
            endSession: async () => {}
        });

        await affiliationController.requestAffiliation(req, res);

        assert.strictEqual(res.statusCode, 201, "Must allow email-verified doctor without doctor-admin verification");
        assert.strictEqual(res.data.status, "success");
        assert.strictEqual(sessionCommitted, true);

        Organization.findById = origFindByIdOrg;
        DoctorOrganization.findOne = origFindOneDocOrg;
        DoctorOrganization.create = origCreateDocOrg;
        DoctorOrganization.findById = origFindByIdDocOrg;
        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        mongoose.startSession = origStartSession;
        DoctorOrganization.findById = origFindByIdDocOrg;
        mongoose.startSession = origStartSession;
    });

    // 3. Doctor Eligibility: Blocked doctor cannot request affiliation
    await runAsyncTest("[UNIT / MOCKED] Blocked doctor cannot request affiliation", async () => {
        const req = {
            userDetails: {
                _id: new mongoose.Types.ObjectId(),
                isEmailVerified: true,
                isBlocked: true // BLOCKED
            },
            body: { organizationId: new mongoose.Types.ObjectId().toString() }
        };
        const res = createMockRes();

        await affiliationController.requestAffiliation(req, res);
        assert.strictEqual(res.statusCode, 403);
        assert(res.data.msg.includes("account has been blocked"));
    });

    // 4. Organization Eligibility: Unapproved or blocked organization cannot receive affiliation requests
    await runAsyncTest("[UNIT / MOCKED] Unapproved or blocked organization cannot receive affiliation requests", async () => {
        const doctor = {
            _id: new mongoose.Types.ObjectId(),
            isEmailVerified: true,
            isBlocked: false
        };

        const origFindByIdOrg = Organization.findById;

        // Sub-case A: Organization not verified by admin
        Organization.findById = async () => ({
            _id: new mongoose.Types.ObjectId(),
            isEmailVerified: true,
            isVerifiedByAdmin: false, // NOT admin verified
            isBlocked: false
        });

        const reqA = { userDetails: doctor, body: { organizationId: new mongoose.Types.ObjectId().toString() } };
        const resA = createMockRes();
        await affiliationController.requestAffiliation(reqA, resA);
        assert.strictEqual(resA.statusCode, 400);
        assert(resA.data.msg.includes("pending MedCare AI admin verification"));

        // Sub-case B: Organization blocked
        Organization.findById = async () => ({
            _id: new mongoose.Types.ObjectId(),
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: true // BLOCKED
        });

        const reqB = { userDetails: doctor, body: { organizationId: new mongoose.Types.ObjectId().toString() } };
        const resB = createMockRes();
        await affiliationController.requestAffiliation(reqB, resB);
        assert.strictEqual(resB.statusCode, 403);
        assert(resB.data.msg.includes("suspended or blocked"));

        Organization.findById = origFindByIdOrg;
    });

    // 5. Duplicate Active Request Prevention
    await runAsyncTest("[UNIT / MOCKED] Duplicate active request prevention returns 409", async () => {
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();

        const origFindByIdOrg = Organization.findById;
        const origFindOneDocOrg = DoctorOrganization.findOne;

        Organization.findById = async (id) => ({
            _id: id,
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false
        });

        // Simulate existing Pending affiliation
        DoctorOrganization.findOne = async () => ({
            _id: new mongoose.Types.ObjectId(),
            doctor: doctorId,
            organization: orgId,
            status: "Pending"
        });

        const req = {
            userDetails: { _id: doctorId, isEmailVerified: true, isBlocked: false },
            body: { organizationId: orgId.toString() }
        };
        const res = createMockRes();

        await affiliationController.requestAffiliation(req, res);
        assert.strictEqual(res.statusCode, 409);
        assert(res.data.msg.includes("already exists"));

        Organization.findById = origFindByIdOrg;
        DoctorOrganization.findOne = origFindOneDocOrg;
    });

    // 6. Reapplication after Rejection or Revocation
    await runAsyncTest("[UNIT / MOCKED] Reapplication after rejection succeeds without duplicate conflict", async () => {
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();

        const origFindByIdOrg = Organization.findById;
        const origFindOneDocOrg = DoctorOrganization.findOne;
        const origCreateDocOrg = DoctorOrganization.create;
        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origStartSession = mongoose.startSession;

        Organization.findById = async (id) => ({
            _id: id,
            name: "Metro Hospital",
            email: "admin@metro.com",
            isEmailVerified: true,
            isVerifiedByAdmin: true,
            isBlocked: false
        });

        function mockFindOneNull() {
            const p = Promise.resolve(null);
            p.session = () => Promise.resolve(null);
            return p;
        }

        DoctorOrganization.findOne = (query) => {
            assert(query.status.$in.includes("Pending"));
            assert(query.status.$in.includes("Approved"));
            return mockFindOneNull();
        };

        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        Doctor.findOneAndUpdate = async () => ({ _id: doctorId, scheduleVersion: 1 });

        const newAffiliation = {
            _id: new mongoose.Types.ObjectId(),
            doctor: doctorId,
            organization: orgId,
            status: "Pending",
            requestedBy: "Doctor"
        };

        DoctorOrganization.create = async () => [newAffiliation];
        DoctorOrganization.findById = (id) => ({
            populate: async () => ({ ...newAffiliation, organization: { name: "Metro Hospital" } })
        });

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => {},
            abortTransaction: async () => {},
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: doctorId, name: "Dr. Reapply", email: "doc@reapply.com", isEmailVerified: true, isBlocked: false },
            body: { organizationId: orgId.toString() }
        };
        const res = createMockRes();

        await affiliationController.requestAffiliation(req, res);
        assert.strictEqual(res.statusCode, 201, "Reapplication must succeed when previous relationship is not active");

        Organization.findById = origFindByIdOrg;
        DoctorOrganization.findOne = origFindOneDocOrg;
        DoctorOrganization.create = origCreateDocOrg;
        DoctorOrganization.findById = origFindByIdDocOrg;
        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        mongoose.startSession = origStartSession;
    });

    // 7. Multiple Organization Affiliations for One Doctor
    await runAsyncTest("[UNIT / MOCKED] Doctor may affiliate with multiple distinct organizations", async () => {
        const doctorId = new mongoose.Types.ObjectId();
        const orgIdA = new mongoose.Types.ObjectId();
        const orgIdB = new mongoose.Types.ObjectId();

        const origFindDocOrg = DoctorOrganization.find;

        DoctorOrganization.find = (filter) => {
            assert.strictEqual(filter.doctor.toString(), doctorId.toString());
            return {
                populate: () => ({
                    sort: async () => [
                        { _id: new mongoose.Types.ObjectId(), doctor: doctorId, organization: { _id: orgIdA, name: "Hospital A" }, status: "Approved" },
                        { _id: new mongoose.Types.ObjectId(), doctor: doctorId, organization: { _id: orgIdB, name: "Clinic B" }, status: "Pending" }
                    ]
                })
            };
        };

        const req = { userDetails: { _id: doctorId }, query: { status: "all" } };
        const res = createMockRes();

        await affiliationController.getDoctorAffiliations(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.count, 2);
        assert.strictEqual(res.data.affiliations[0].organization.name, "Hospital A");
        assert.strictEqual(res.data.affiliations[1].organization.name, "Clinic B");

        DoctorOrganization.find = origFindDocOrg;
    });

    // 8. Organization Isolation: Cannot approve another organization's request
    await runAsyncTest("[UNIT / MOCKED] Organization cannot approve an affiliation request belonging to another organization", async () => {
        const orgAId = new mongoose.Types.ObjectId();
        const orgBId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;

        // Affiliation belongs to Org B
        DoctorOrganization.findById = (id) => ({
            populate: async () => ({
                _id: id,
                organization: orgBId, // Belongs to Org B
                doctor: { _id: new mongoose.Types.ObjectId(), isEmailVerified: true, isBlocked: false },
                status: "Pending"
            })
        });

        // Authenticated as Org A
        const req = {
            organization: { _id: orgAId, name: "Organization A" },
            params: { id: new mongoose.Types.ObjectId().toString() }
        };
        const res = createMockRes();

        await affiliationController.approveAffiliation(req, res);
        assert.strictEqual(res.statusCode, 403, "Must return 403 when trying to approve foreign organization request");
        assert(res.data.msg.includes("belonging to another organization"));

        DoctorOrganization.findById = origFindByIdDocOrg;
    });

    // 9. Unauthorized access rejection
    await runAsyncTest("[UNIT / MOCKED] Unauthorized access without authenticated entity returns 401", async () => {
        const res1 = createMockRes();
        await affiliationController.requestAffiliation({ userDetails: null, body: {} }, res1);
        assert.strictEqual(res1.statusCode, 401);

        const res2 = createMockRes();
        await affiliationController.approveAffiliation({ organization: null, params: {} }, res2);
        assert.strictEqual(res2.statusCode, 401);

        const res3 = createMockRes();
        await affiliationController.getAdminAffiliations({ userDetails: null, query: {} }, res3);
        assert.strictEqual(res3.statusCode, 401);
    });

    // 10. Lifecycle State Transition Integrity
    await runAsyncTest("[UNIT / MOCKED] State transition guards reject invalid lifecycle mutations", async () => {
        const origFindByIdDocOrg = DoctorOrganization.findById;

        // Guard 1: Withdrawing non-pending request
        DoctorOrganization.findById = () => ({
            populate: async () => ({
                _id: "aff_1",
                doctor: "doc_1",
                status: "Approved", // Already approved
                organization: { name: "Org" }
            })
        });

        const reqWithdraw = {
            userDetails: { _id: "doc_1" },
            params: { id: "aff_1" }
        };
        const resWithdraw = createMockRes();
        await affiliationController.withdrawAffiliationRequest(reqWithdraw, resWithdraw);
        assert.strictEqual(resWithdraw.statusCode, 400);
        assert(resWithdraw.data.msg.includes("Only pending requests can be withdrawn"));

        // Guard 2: Approving non-pending request
        DoctorOrganization.findById = () => ({
            populate: async () => ({
                _id: "aff_2",
                organization: "org_1",
                doctor: { isEmailVerified: true, isBlocked: false },
                status: "Rejected" // Already rejected
            })
        });

        const reqApprove = {
            organization: { _id: "org_1" },
            params: { id: "aff_2" }
        };
        const resApprove = createMockRes();
        await affiliationController.approveAffiliation(reqApprove, resApprove);
        assert.strictEqual(resApprove.statusCode, 400);
        assert(resApprove.data.msg.includes("Only pending requests can be approved"));

        // Guard 3: Revoking non-approved request
        DoctorOrganization.findById = () => ({
            populate: async () => ({
                _id: "aff_3",
                organization: "org_1",
                doctor: { isEmailVerified: true, isBlocked: false },
                status: "Pending" // Still pending, cannot revoke
            })
        });

        const reqRevoke = {
            organization: { _id: "org_1" },
            params: { id: "aff_3" },
            body: {}
        };
        const resRevoke = createMockRes();
        await affiliationController.revokeAffiliation(reqRevoke, resRevoke);
        assert.strictEqual(resRevoke.statusCode, 400);
        assert(resRevoke.data.msg.includes("Only approved affiliations can be revoked"));

        DoctorOrganization.findById = origFindByIdDocOrg;
    });

    // 11. Transaction failure aborts mutation when Outbox insertion fails
    await runAsyncTest("[UNIT / MOCKED] Outbox insertion failure aborts the affiliation transaction", async () => {
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();
        const affiliationId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origStartSession = mongoose.startSession;
        const origQueueNotif = outboxService.queueNotification;

        let transactionAborted = false;
        let transactionCommitted = false;

        const mockAffiliationDoc = {
            _id: affiliationId,
            organization: orgId,
            doctor: { _id: doctorId, name: "Dr. Smith", email: "smith@doc.com", isEmailVerified: true, isBlocked: false },
            status: "Pending",
            scheduleVersion: 0,
            save: async () => {}
        };

        DoctorOrganization.findById = (id) => {
            return {
                populate: async () => mockAffiliationDoc,
                session: () => mockAffiliationDoc
            };
        };

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => { transactionCommitted = true; },
            abortTransaction: async () => { transactionAborted = true; },
            endSession: async () => {}
        });

        // Simulate outbox failure
        const OutboxNotification = require("../src/models/outboxNotification.model");
        const origCreateNotif = OutboxNotification.create;
        OutboxNotification.create = async () => {
            throw new Error("Simulated Outbox DB connection failure");
        };

        const req = {
            organization: { _id: orgId, name: "City Clinic" },
            params: { id: affiliationId.toString() }
        };
        const res = createMockRes();

        await affiliationController.approveAffiliation(req, res);

        assert.strictEqual(transactionAborted, true, "Transaction must abort when outbox notification fails");
        assert.strictEqual(transactionCommitted, false, "Transaction must NOT commit");
        assert.strictEqual(res.statusCode, 500);

        DoctorOrganization.findById = origFindByIdDocOrg;
        mongoose.startSession = origStartSession;
        OutboxNotification.create = origCreateNotif;
    });

    // 12. Transaction unavailability returns 500 operational error (no non-transactional fallback)
    await runAsyncTest("[UNIT / MOCKED] Transaction unavailability does not trigger non-transactional fallback", async () => {
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();
        const affiliationId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origStartSession = mongoose.startSession;

        DoctorOrganization.findById = (id) => ({
            populate: async () => ({
                _id: affiliationId,
                organization: orgId,
                doctor: { _id: doctorId, isEmailVerified: true, isBlocked: false },
                status: "Pending"
            })
        });

        // Simulate standalone MongoDB without replica set
        mongoose.startSession = async () => ({
            startTransaction: () => {
                throw new Error("Transaction numbers are only allowed on a replica set member or mongos");
            },
            endSession: async () => {}
        });

        const req = {
            organization: { _id: orgId, name: "General Hospital" },
            params: { id: affiliationId.toString() }
        };
        const res = createMockRes();

        await affiliationController.approveAffiliation(req, res);

        assert.strictEqual(res.statusCode, 500);
        assert(res.data.msg.includes("replica set"));

        DoctorOrganization.findById = origFindByIdDocOrg;
        mongoose.startSession = origStartSession;
    });

    // 13. Administrative Resolution: Complete Lifecycle Handling
    await runAsyncTest("[UNIT / MOCKED] Administrative resolution records admin, updates state, and queues notifications", async () => {
        const adminId = new mongoose.Types.ObjectId();
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();
        const affiliationId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origStartSession = mongoose.startSession;

        let savedStatus = null;
        let savedResolvedBy = null;
        let savedResolutionNotes = null;

        const mockAffiliationDoc = {
            _id: affiliationId,
            organization: { _id: orgId, name: "Metro Care", email: "org@metro.com", isVerifiedByAdmin: true, isBlocked: false },
            doctor: { _id: doctorId, name: "Dr. Dave", email: "dave@doc.com", isEmailVerified: true, isBlocked: false },
            status: "Pending",
            scheduleVersion: 1,
            save: async function () {
                savedStatus = this.status;
                savedResolvedBy = this.resolvedBy;
                savedResolutionNotes = this.resolutionNotes;
            }
        };

        const mockQuery = {
            populate() { return this; },
            session() { return mockAffiliationDoc; },
            then(resolve) { resolve(mockAffiliationDoc); }
        };
        DoctorOrganization.findById = () => mockQuery;

        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        const origDocOrgFindOneAndUpdate = DoctorOrganization.findOneAndUpdate;
        const origFindOneDocOrg = DoctorOrganization.findOne;
        Doctor.findOneAndUpdate = async () => ({ _id: doctorId, scheduleVersion: 1 });
        DoctorOrganization.findOneAndUpdate = async () => ({ _id: affiliationId, scheduleVersion: 1 });
        DoctorOrganization.findOne = () => mockFindOneNull();

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => {},
            abortTransaction: async () => {},
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: adminId, email: "admin@medcare.ai" },
            params: { id: affiliationId.toString() },
            body: { action: "approve", reason: "Administrative compliance audit verified" }
        };
        const res = createMockRes();

        await affiliationController.resolveAffiliation(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(savedStatus, "Approved");
        assert.strictEqual(savedResolvedBy.toString(), adminId.toString());
        assert.strictEqual(savedResolutionNotes, "Administrative compliance audit verified");

        DoctorOrganization.findById = origFindByIdDocOrg;
        DoctorOrganization.findOne = origFindOneDocOrg;
        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        DoctorOrganization.findOneAndUpdate = origDocOrgFindOneAndUpdate;
        mongoose.startSession = origStartSession;
    });

    // 14. Canonical Lock Hierarchy Verification: Doctor FIRST -> DoctorOrganization SECOND
    await runAsyncTest("[UNIT / MOCKED] acquireScheduleLocks acquires Doctor then DoctorOrganization locks in order", async () => {
        const doctorId = new mongoose.Types.ObjectId();
        const doctorOrgId = new mongoose.Types.ObjectId();

        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        const origDocOrgFindOneAndUpdate = DoctorOrganization.findOneAndUpdate;

        const lockOrder = [];

        Doctor.findOneAndUpdate = async (query, update, opts) => {
            lockOrder.push("Doctor");
            assert(opts.session, "Must pass session");
            return { _id: doctorId, scheduleVersion: 1 };
        };

        DoctorOrganization.findOneAndUpdate = async (query, update, opts) => {
            lockOrder.push("DoctorOrganization");
            assert(opts.session, "Must pass session");
            return { _id: doctorOrgId, scheduleVersion: 1 };
        };

        const mockSession = {};
        const locks = await acquireScheduleLocks({
            doctorId,
            doctorOrganizationId: doctorOrgId,
            session: mockSession
        });

        assert.deepStrictEqual(lockOrder, ["Doctor", "DoctorOrganization"], "Lock acquisition must strictly follow Doctor -> DoctorOrganization");
        assert(locks.doctorLock);
        assert(locks.doctorOrgLock);
        assert.strictEqual(locks.roomLock, null, "No Room lock when roomId is null");

        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        DoctorOrganization.findOneAndUpdate = origDocOrgFindOneAndUpdate;
    });

    // 15. Safe Administrative Reapproval: Admin approval of a Rejected affiliation when no active record exists
    await runAsyncTest("[UNIT / MOCKED] Admin approval of a Rejected affiliation when no active record exists", async () => {
        const adminId = new mongoose.Types.ObjectId();
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();
        const affiliationId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origFindOneDocOrg = DoctorOrganization.findOne;
        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        const origDocOrgFindOneAndUpdate = DoctorOrganization.findOneAndUpdate;
        const origStartSession = mongoose.startSession;

        let savedStatus = null;
        const mockAffiliationDoc = {
            _id: affiliationId,
            organization: { _id: orgId, name: "Care Hospital", email: "care@org.com", isVerifiedByAdmin: true, isBlocked: false },
            doctor: { _id: doctorId, name: "Dr. Alice", email: "alice@doc.com", isEmailVerified: true, isBlocked: false },
            status: "Rejected",
            scheduleVersion: 2,
            save: async function () {
                savedStatus = this.status;
            }
        };

        const mockQuery = {
            populate() { return this; },
            session() { return mockAffiliationDoc; },
            then(resolve) { resolve(mockAffiliationDoc); }
        };
        DoctorOrganization.findById = () => mockQuery;
        DoctorOrganization.findOne = () => mockFindOneNull();

        Doctor.findOneAndUpdate = async () => ({ _id: doctorId, scheduleVersion: 1 });
        DoctorOrganization.findOneAndUpdate = async () => ({ _id: affiliationId, scheduleVersion: 1 });

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => {},
            abortTransaction: async () => {},
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: adminId, email: "admin@medcare.ai" },
            params: { id: affiliationId.toString() },
            body: { action: "approve", reason: "Administrative dispute resolved in doctor favor" }
        };
        const res = createMockRes();

        await affiliationController.resolveAffiliation(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(savedStatus, "Approved");
        assert.strictEqual(res.data.status, "success");

        DoctorOrganization.findById = origFindByIdDocOrg;
        DoctorOrganization.findOne = origFindOneDocOrg;
        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        DoctorOrganization.findOneAndUpdate = origDocOrgFindOneAndUpdate;
        mongoose.startSession = origStartSession;
    });

    // 16. Safe Administrative Reapproval: Admin approval of a Withdrawn affiliation when no active record exists
    await runAsyncTest("[UNIT / MOCKED] Admin approval of a Withdrawn affiliation when no active record exists", async () => {
        const adminId = new mongoose.Types.ObjectId();
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();
        const affiliationId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origFindOneDocOrg = DoctorOrganization.findOne;
        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        const origDocOrgFindOneAndUpdate = DoctorOrganization.findOneAndUpdate;
        const origStartSession = mongoose.startSession;

        let savedStatus = null;
        const mockAffiliationDoc = {
            _id: affiliationId,
            organization: { _id: orgId, name: "City Care", email: "city@care.com", isVerifiedByAdmin: true, isBlocked: false },
            doctor: { _id: doctorId, name: "Dr. Bob", email: "bob@doc.com", isEmailVerified: true, isBlocked: false },
            status: "Withdrawn",
            scheduleVersion: 1,
            save: async function () {
                savedStatus = this.status;
            }
        };

        const mockQuery = {
            populate() { return this; },
            session() { return mockAffiliationDoc; },
            then(resolve) { resolve(mockAffiliationDoc); }
        };
        DoctorOrganization.findById = () => mockQuery;
        DoctorOrganization.findOne = () => mockFindOneNull();

        Doctor.findOneAndUpdate = async () => ({ _id: doctorId, scheduleVersion: 1 });
        DoctorOrganization.findOneAndUpdate = async () => ({ _id: affiliationId, scheduleVersion: 1 });

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => {},
            abortTransaction: async () => {},
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: adminId, email: "admin@medcare.ai" },
            params: { id: affiliationId.toString() },
            body: { action: "approve", reason: "Re-instated after misunderstanding" }
        };
        const res = createMockRes();

        await affiliationController.resolveAffiliation(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(savedStatus, "Approved");

        DoctorOrganization.findById = origFindByIdDocOrg;
        DoctorOrganization.findOne = origFindOneDocOrg;
        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        DoctorOrganization.findOneAndUpdate = origDocOrgFindOneAndUpdate;
        mongoose.startSession = origStartSession;
    });

    // 17. Safe Administrative Reapproval: Admin approval of a Revoked affiliation when no active record exists
    await runAsyncTest("[UNIT / MOCKED] Admin approval of a Revoked affiliation when no active record exists", async () => {
        const adminId = new mongoose.Types.ObjectId();
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();
        const affiliationId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origFindOneDocOrg = DoctorOrganization.findOne;
        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        const origDocOrgFindOneAndUpdate = DoctorOrganization.findOneAndUpdate;
        const origStartSession = mongoose.startSession;

        let savedStatus = null;
        const mockAffiliationDoc = {
            _id: affiliationId,
            organization: { _id: orgId, name: "Metro General", email: "metro@org.com", isVerifiedByAdmin: true, isBlocked: false },
            doctor: { _id: doctorId, name: "Dr. Charlie", email: "charlie@doc.com", isEmailVerified: true, isBlocked: false },
            status: "Revoked",
            scheduleVersion: 3,
            save: async function () {
                savedStatus = this.status;
            }
        };

        const mockQuery = {
            populate() { return this; },
            session() { return mockAffiliationDoc; },
            then(resolve) { resolve(mockAffiliationDoc); }
        };
        DoctorOrganization.findById = () => mockQuery;
        DoctorOrganization.findOne = () => mockFindOneNull();

        Doctor.findOneAndUpdate = async () => ({ _id: doctorId, scheduleVersion: 1 });
        DoctorOrganization.findOneAndUpdate = async () => ({ _id: affiliationId, scheduleVersion: 1 });

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => {},
            abortTransaction: async () => {},
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: adminId, email: "admin@medcare.ai" },
            params: { id: affiliationId.toString() },
            body: { action: "approve", reason: "Administrative reinstatement after audit clearance" }
        };
        const res = createMockRes();

        await affiliationController.resolveAffiliation(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(savedStatus, "Approved");

        DoctorOrganization.findById = origFindByIdDocOrg;
        DoctorOrganization.findOne = origFindOneDocOrg;
        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        DoctorOrganization.findOneAndUpdate = origDocOrgFindOneAndUpdate;
        mongoose.startSession = origStartSession;
    });

    // 18. Conflict Detection: Admin approval rejected with HTTP 409 when another active affiliation exists
    await runAsyncTest("[UNIT / MOCKED] Admin approval rejected with HTTP 409 when another active affiliation exists", async () => {
        const adminId = new mongoose.Types.ObjectId();
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();
        const affiliationId = new mongoose.Types.ObjectId();
        const existingActiveId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origFindOneDocOrg = DoctorOrganization.findOne;
        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        const origDocOrgFindOneAndUpdate = DoctorOrganization.findOneAndUpdate;
        const origStartSession = mongoose.startSession;

        let txAborted = false;
        const mockAffiliationDoc = {
            _id: affiliationId,
            organization: { _id: orgId, name: "City Care", email: "city@care.com", isVerifiedByAdmin: true, isBlocked: false },
            doctor: { _id: doctorId, name: "Dr. Dan", email: "dan@doc.com", isEmailVerified: true, isBlocked: false },
            status: "Rejected",
            scheduleVersion: 1,
            save: async function () {}
        };

        const mockQuery = {
            populate() { return this; },
            session() { return mockAffiliationDoc; },
            then(resolve) { resolve(mockAffiliationDoc); }
        };
        DoctorOrganization.findById = () => mockQuery;

        function mockFindOneActiveConflict() {
            const conflictDoc = { _id: existingActiveId, doctor: doctorId, organization: orgId, status: "Approved" };
            const p = Promise.resolve(conflictDoc);
            p.session = () => Promise.resolve(conflictDoc);
            return p;
        }
        DoctorOrganization.findOne = () => mockFindOneActiveConflict();

        Doctor.findOneAndUpdate = async () => ({ _id: doctorId, scheduleVersion: 1 });
        DoctorOrganization.findOneAndUpdate = async () => ({ _id: affiliationId, scheduleVersion: 1 });

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => {},
            abortTransaction: async () => { txAborted = true; },
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: adminId, email: "admin@medcare.ai" },
            params: { id: affiliationId.toString() },
            body: { action: "approve", reason: "Attempting reapproval despite active record" }
        };
        const res = createMockRes();

        await affiliationController.resolveAffiliation(req, res);

        assert.strictEqual(res.statusCode, 409, "Must return 409 when an active affiliation already exists");
        assert(res.data.msg.includes("another active or pending affiliation"));
        assert.strictEqual(txAborted, true, "Transaction must abort on conflict");

        DoctorOrganization.findById = origFindByIdDocOrg;
        DoctorOrganization.findOne = origFindOneDocOrg;
        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        DoctorOrganization.findOneAndUpdate = origDocOrgFindOneAndUpdate;
        mongoose.startSession = origStartSession;
    });

    // 19. Concurrency Protection: Status changed between initial read and post-lock re-read returns HTTP 409
    await runAsyncTest("[UNIT / MOCKED] Status changed between initial read and post-lock re-read returns HTTP 409", async () => {
        const adminId = new mongoose.Types.ObjectId();
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();
        const affiliationId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        const origDocOrgFindOneAndUpdate = DoctorOrganization.findOneAndUpdate;
        const origStartSession = mongoose.startSession;

        let txAborted = false;

        const initialDoc = {
            _id: affiliationId,
            organization: { _id: orgId, name: "City Care", email: "city@care.com", isVerifiedByAdmin: true, isBlocked: false },
            doctor: { _id: doctorId, name: "Dr. Eve", email: "eve@doc.com", isEmailVerified: true, isBlocked: false },
            status: "Pending",
            scheduleVersion: 1
        };

        const concurrentDoc = {
            ...initialDoc,
            status: "Withdrawn",
            scheduleVersion: 2,
            save: async () => {}
        };

        DoctorOrganization.findById = (id) => ({
            populate() { return this; },
            session() { return concurrentDoc; },
            then(resolve) { resolve(initialDoc); }
        });

        Doctor.findOneAndUpdate = async () => ({ _id: doctorId, scheduleVersion: 1 });
        DoctorOrganization.findOneAndUpdate = async () => ({ _id: affiliationId, scheduleVersion: 1 });

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => {},
            abortTransaction: async () => { txAborted = true; },
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: adminId, email: "admin@medcare.ai" },
            params: { id: affiliationId.toString() },
            body: { action: "approve", reason: "Attempt approve while doctor withdrew" }
        };
        const res = createMockRes();

        await affiliationController.resolveAffiliation(req, res);

        assert.strictEqual(res.statusCode, 409, "Must return 409 when status changed concurrently");
        assert(res.data.msg.includes("changed concurrently from 'Pending' to 'Withdrawn'"));
        assert.strictEqual(txAborted, true, "Transaction must abort on concurrent change");

        DoctorOrganization.findById = origFindByIdDocOrg;
        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        DoctorOrganization.findOneAndUpdate = origDocOrgFindOneAndUpdate;
        mongoose.startSession = origStartSession;
    });

    // 20. Database Constraint Protection: Duplicate-key error during admin approval returns HTTP 409
    await runAsyncTest("[UNIT / MOCKED] Duplicate-key error during admin approval returns HTTP 409", async () => {
        const adminId = new mongoose.Types.ObjectId();
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();
        const affiliationId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origFindOneDocOrg = DoctorOrganization.findOne;
        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        const origDocOrgFindOneAndUpdate = DoctorOrganization.findOneAndUpdate;
        const origStartSession = mongoose.startSession;

        let txAborted = false;
        const mockAffiliationDoc = {
            _id: affiliationId,
            organization: { _id: orgId, name: "City Care", email: "city@care.com", isVerifiedByAdmin: true, isBlocked: false },
            doctor: { _id: doctorId, name: "Dr. Frank", email: "frank@doc.com", isEmailVerified: true, isBlocked: false },
            status: "Rejected",
            scheduleVersion: 1,
            save: async function () {
                const err = new Error("E11000 duplicate key error collection: doctororganizations index: doctor_1_organization_1 dup key");
                err.code = 11000;
                throw err;
            }
        };

        const mockQuery = {
            populate() { return this; },
            session() { return mockAffiliationDoc; },
            then(resolve) { resolve(mockAffiliationDoc); }
        };
        DoctorOrganization.findById = () => mockQuery;
        DoctorOrganization.findOne = () => mockFindOneNull();

        Doctor.findOneAndUpdate = async () => ({ _id: doctorId, scheduleVersion: 1 });
        DoctorOrganization.findOneAndUpdate = async () => ({ _id: affiliationId, scheduleVersion: 1 });

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => {},
            abortTransaction: async () => { txAborted = true; },
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: adminId, email: "admin@medcare.ai" },
            params: { id: affiliationId.toString() },
            body: { action: "approve", reason: "Attempt approve with DB conflict" }
        };
        const res = createMockRes();

        await affiliationController.resolveAffiliation(req, res);

        assert.strictEqual(res.statusCode, 409, "Duplicate-key error must be translated to HTTP 409");
        assert(res.data.msg.includes("already exists"));
        assert.strictEqual(txAborted, true);

        DoctorOrganization.findById = origFindByIdDocOrg;
        DoctorOrganization.findOne = origFindOneDocOrg;
        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        DoctorOrganization.findOneAndUpdate = origDocOrgFindOneAndUpdate;
        mongoose.startSession = origStartSession;
    });

    // 21. Notification Dual Dispatch: Admin resolution queues two separate notifications
    await runAsyncTest("[UNIT / MOCKED] Admin resolution queues two separate notifications: one to doctor and one to organization", async () => {
        const adminId = new mongoose.Types.ObjectId();
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();
        const affiliationId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origFindOneDocOrg = DoctorOrganization.findOne;
        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        const origDocOrgFindOneAndUpdate = DoctorOrganization.findOneAndUpdate;
        const origStartSession = mongoose.startSession;
        const origOutboxCreate = OutboxNotification.create;

        const queuedNotifications = [];
        OutboxNotification.create = async (docs, opts) => {
            const arr = Array.isArray(docs) ? docs : [docs];
            arr.forEach(d => queuedNotifications.push({ doc: d, session: opts?.session }));
            return arr.map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));
        };

        const mockAffiliationDoc = {
            _id: affiliationId,
            organization: { _id: orgId, name: "City Hospital", email: "org@hospital.com", isVerifiedByAdmin: true, isBlocked: false },
            doctor: { _id: doctorId, name: "Dr. Grace", email: "grace@doc.com", isEmailVerified: true, isBlocked: false },
            status: "Pending",
            scheduleVersion: 1,
            save: async function () {}
        };

        const mockQuery = {
            populate() { return this; },
            session() { return mockAffiliationDoc; },
            then(resolve) { resolve(mockAffiliationDoc); }
        };
        DoctorOrganization.findById = () => mockQuery;
        DoctorOrganization.findOne = () => mockFindOneNull();

        Doctor.findOneAndUpdate = async () => ({ _id: doctorId, scheduleVersion: 1 });
        DoctorOrganization.findOneAndUpdate = async () => ({ _id: affiliationId, scheduleVersion: 1 });

        const mockSession = {
            startTransaction: () => {},
            commitTransaction: async () => {},
            abortTransaction: async () => {},
            endSession: async () => {}
        };
        mongoose.startSession = async () => mockSession;

        const req = {
            userDetails: { _id: adminId, email: "admin@medcare.ai" },
            params: { id: affiliationId.toString() },
            body: { action: "approve", reason: "Dual notification verification" }
        };
        const res = createMockRes();

        await affiliationController.resolveAffiliation(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(queuedNotifications.length, 2, "Must queue exactly 2 notifications");

        const doctorNotif = queuedNotifications.find(n => n.doc.recipientEmail === "grace@doc.com");
        const orgNotif = queuedNotifications.find(n => n.doc.recipientEmail === "org@hospital.com");

        assert(doctorNotif, "Must have notification addressed to doctor");
        assert.strictEqual(doctorNotif.doc.type, "AFFILIATION_ADMIN_RESOLVED");
        assert.strictEqual(doctorNotif.session, mockSession, "Must pass session to doctor notification");

        assert(orgNotif, "Must have notification addressed to organization");
        assert.strictEqual(orgNotif.doc.type, "AFFILIATION_ADMIN_RESOLVED");
        assert.strictEqual(orgNotif.session, mockSession, "Must pass session to organization notification");

        DoctorOrganization.findById = origFindByIdDocOrg;
        DoctorOrganization.findOne = origFindOneDocOrg;
        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        DoctorOrganization.findOneAndUpdate = origDocOrgFindOneAndUpdate;
        mongoose.startSession = origStartSession;
        OutboxNotification.create = origOutboxCreate;
    });

    // 22. Transaction Rollback: Failure to insert the second notification aborts transaction and does not commit
    await runAsyncTest("[UNIT / MOCKED] Failure to insert the second notification aborts the transaction and does not commit the affiliation change", async () => {
        const adminId = new mongoose.Types.ObjectId();
        const doctorId = new mongoose.Types.ObjectId();
        const orgId = new mongoose.Types.ObjectId();
        const affiliationId = new mongoose.Types.ObjectId();

        const origFindByIdDocOrg = DoctorOrganization.findById;
        const origFindOneDocOrg = DoctorOrganization.findOne;
        const origDocFindOneAndUpdate = Doctor.findOneAndUpdate;
        const origDocOrgFindOneAndUpdate = DoctorOrganization.findOneAndUpdate;
        const origStartSession = mongoose.startSession;
        const origOutboxCreate = OutboxNotification.create;

        let txCommitted = false;
        let txAborted = false;

        let callCount = 0;
        OutboxNotification.create = async (docs, opts) => {
            callCount++;
            if (callCount === 1) {
                const arr = Array.isArray(docs) ? docs : [docs];
                return arr.map(d => ({ ...d, _id: new mongoose.Types.ObjectId() }));
            }
            throw new Error("Simulated network failure on second outbox notification insertion");
        };

        const mockAffiliationDoc = {
            _id: affiliationId,
            organization: { _id: orgId, name: "City Care", email: "city@care.com", isVerifiedByAdmin: true, isBlocked: false },
            doctor: { _id: doctorId, name: "Dr. Henry", email: "henry@doc.com", isEmailVerified: true, isBlocked: false },
            status: "Pending",
            scheduleVersion: 1,
            save: async function () {}
        };

        const mockQuery = {
            populate() { return this; },
            session() { return mockAffiliationDoc; },
            then(resolve) { resolve(mockAffiliationDoc); }
        };
        DoctorOrganization.findById = () => mockQuery;
        DoctorOrganization.findOne = () => mockFindOneNull();

        Doctor.findOneAndUpdate = async () => ({ _id: doctorId, scheduleVersion: 1 });
        DoctorOrganization.findOneAndUpdate = async () => ({ _id: affiliationId, scheduleVersion: 1 });

        mongoose.startSession = async () => ({
            startTransaction: () => {},
            commitTransaction: async () => { txCommitted = true; },
            abortTransaction: async () => { txAborted = true; },
            endSession: async () => {}
        });

        const req = {
            userDetails: { _id: adminId, email: "admin@medcare.ai" },
            params: { id: affiliationId.toString() },
            body: { action: "approve", reason: "Testing failure on second notification" }
        };
        const res = createMockRes();

        await affiliationController.resolveAffiliation(req, res);

        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(txAborted, true, "Transaction must abort when second notification fails");
        assert.strictEqual(txCommitted, false, "Transaction must NOT commit when any notification fails");

        DoctorOrganization.findById = origFindByIdDocOrg;
        DoctorOrganization.findOne = origFindOneDocOrg;
        Doctor.findOneAndUpdate = origDocFindOneAndUpdate;
        DoctorOrganization.findOneAndUpdate = origDocOrgFindOneAndUpdate;
        mongoose.startSession = origStartSession;
        OutboxNotification.create = origOutboxCreate;
    });

    console.log(`\nDoctor Affiliation Test Results: ${passed}/${total} passed.\n`);
    if (passed !== total) process.exit(1);
}

runSuite().catch((err) => {
    console.error("Affiliation test suite error:", err);
    process.exit(1);
});
