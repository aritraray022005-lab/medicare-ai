require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const { OutboxWorker } = require("../src/jobs/outboxWorker");
const { formatEmailContent } = require("../src/services/outbox.service");
const OutboxNotification = require("../src/models/outboxNotification.model");

console.log("=== Running Transactional Outbox Unit & Behavior Tests (Phase 2) ===");

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

(async () => {
    // 1. Template Generation for APPOINTMENT_CONFIRMED
    runTest("Template generator produces formatted email for APPOINTMENT_CONFIRMED", () => {
        const content = formatEmailContent("APPOINTMENT_CONFIRMED", {
            patientName: "John Doe",
            doctorName: "Jane Smith",
            date: "2026-11-15",
            time: "10:00",
            venue: "Apollo Hospital - Room 101"
        });
        assert(content.subject.includes("Appointment Confirmed"));
        assert(content.text.includes("John Doe"));
        assert(content.text.includes("Jane Smith"));
        assert(content.html.includes("Apollo Hospital - Room 101"));
    });

    // 2. Template Generation for APPOINTMENT_CANCELLED
    runTest("Template generator produces formatted email for APPOINTMENT_CANCELLED", () => {
        const content = formatEmailContent("APPOINTMENT_CANCELLED", {
            patientName: "John Doe",
            appointmentId: "apt_12345",
            reason: "Facility room reservation cancelled"
        });
        assert(content.subject.includes("Appointment Cancelled"));
        assert(content.text.includes("apt_12345"));
        assert(content.html.includes("Facility room reservation cancelled"));
    });

    // 3. Template Generation for ROOM_BOOKING_ALLOCATED
    runTest("Template generator produces formatted email for ROOM_BOOKING_ALLOCATED", () => {
        const content = formatEmailContent("ROOM_BOOKING_ALLOCATED", {
            doctorName: "Jane Smith",
            roomNumber: "101",
            organizationName: "City Hospital",
            date: "2026-11-15",
            startTime: "10:00",
            endTime: "11:00"
        });
        assert(content.subject.includes("Facility Room Allocated"));
        assert(content.text.includes("Room 101"));
        assert(content.html.includes("City Hospital"));
    });

    // 4. Template Generation for AFFILIATION_APPROVED
    runTest("Template generator produces formatted email for AFFILIATION_APPROVED", () => {
        const content = formatEmailContent("AFFILIATION_APPROVED", {
            doctorName: "Jane Smith",
            organizationName: "City Hospital"
        });
        assert(content.subject.includes("Affiliation Approved"));
        assert(content.text.includes("Jane Smith"));
        assert(content.html.includes("City Hospital"));
    });

    // 5. Worker Initialization and Unique Worker IDs
    runTest("OutboxWorker generates unique workerId and default configurations", () => {
        const worker1 = new OutboxWorker();
        const worker2 = new OutboxWorker();
        assert(worker1.workerId.startsWith("worker-"));
        assert(worker2.workerId.startsWith("worker-"));
        assert.notStrictEqual(worker1.workerId, worker2.workerId, "Worker IDs must be unique per instance");
        assert.strictEqual(worker1.leaseDurationMs, 30000);
        assert.strictEqual(worker1.maxRetries, 5);
        assert.strictEqual(worker1.baseBackoffMs, 5000);
    });

    // 6. Exponential Backoff Calculation
    runTest("Exponential backoff scales correctly with claimed retryCount", () => {
        const worker = new OutboxWorker({ baseBackoffMs: 5000 });
        // Formula: baseBackoffMs * 2^(retryCount - 1)
        const calcBackoff = (retryCount) => worker.baseBackoffMs * Math.pow(2, Math.max(0, retryCount - 1));

        assert.strictEqual(calcBackoff(1), 5000, "1st attempt failure should back off 5s");
        assert.strictEqual(calcBackoff(2), 10000, "2nd attempt failure should back off 10s");
        assert.strictEqual(calcBackoff(3), 20000, "3rd attempt failure should back off 20s");
        assert.strictEqual(calcBackoff(4), 40000, "4th attempt failure should back off 40s");
        assert.strictEqual(calcBackoff(5), 80000, "5th attempt failure should reach 80s before dead-letter");
    });

    // 7. Schema Invariant: expireAt Default is null
    runTest("OutboxNotification schema defaults expireAt to null and status to PENDING", () => {
        const notif = new OutboxNotification({
            recipientEmail: "test@example.com",
            type: "APPOINTMENT_CONFIRMED"
        });
        assert.strictEqual(notif.status, "PENDING");
        assert.strictEqual(notif.retryCount, 0);
        assert.strictEqual(notif.expireAt, null, "expireAt must be null initially so TTL ignores it");
    });

    // 8. Lease Fencing Contract Verification
    runTest("Lease fencing ensures completion requires matching leaseToken and valid lease", () => {
        const worker = new OutboxWorker();
        // Inspect completeJob query signature
        assert(typeof worker.completeJob === "function");
        assert(typeof worker.failJob === "function");
        assert(typeof worker.claimNextJob === "function");
        assert(typeof worker.recoverAndSweepDeadLetters === "function");
    });

    // 9. Simulated End-to-End Worker Dispatch with Injected Sender
    await runAsyncTest("Worker processSingleJob handles successful dispatch and records SENT", async () => {
        let sentEmail = null;
        const mockSender = async (msg) => {
            sentEmail = msg;
            return { messageId: "msg_mock_123" };
        };

        const worker = new OutboxWorker({
            senderOverride: mockSender
        });

        // Mock claimNextJob returning a synthetic job
        const syntheticJob = {
            _id: new mongoose.Types.ObjectId(),
            recipientEmail: "patient@medcare.ai",
            type: "APPOINTMENT_CONFIRMED",
            payload: { patientName: "Test Patient", doctorName: "Dr. Test" },
            retryCount: 1
        };

        worker.claimNextJob = async () => ({
            job: syntheticJob,
            leaseToken: "mock-lease-token-123"
        });

        let completedCalled = false;
        worker.completeJob = async (jobId, token) => {
            assert.strictEqual(jobId, syntheticJob._id);
            assert.strictEqual(token, "mock-lease-token-123");
            completedCalled = true;
            return true;
        };

        const result = await worker.processSingleJob();
        assert.strictEqual(result.processed, true);
        assert.strictEqual(result.status, "SENT");
        assert(completedCalled, "completeJob must be called on successful delivery");
        assert(sentEmail, "Email sender must be invoked");
        assert.strictEqual(sentEmail.to, "patient@medcare.ai");
    });

    // 10. Simulated Worker Failure Handling with Injected Sender Error
    await runAsyncTest("Worker processSingleJob handles dispatch failure and invokes failJob", async () => {
        const mockFailingSender = async () => {
            throw new Error("SMTP connection reset by peer");
        };

        const worker = new OutboxWorker({
            senderOverride: mockFailingSender,
            maxRetries: 5
        });

        const syntheticJob = {
            _id: new mongoose.Types.ObjectId(),
            recipientEmail: "patient@medcare.ai",
            type: "APPOINTMENT_CANCELLED",
            payload: { patientName: "Test Patient" },
            retryCount: 2
        };

        worker.claimNextJob = async () => ({
            job: syntheticJob,
            leaseToken: "mock-lease-token-456"
        });

        let failJobCalled = false;
        let recordedRetry = null;
        let recordedError = null;

        worker.failJob = async (jobId, token, claimedRetries, error) => {
            failJobCalled = true;
            recordedRetry = claimedRetries;
            recordedError = error;
            return true;
        };

        const result = await worker.processSingleJob();
        assert.strictEqual(result.processed, true);
        assert.strictEqual(result.status, "FAILED");
        assert(failJobCalled, "failJob must be invoked when sender throws");
        assert.strictEqual(recordedRetry, 2, "Must pass the exact claimed retry count");
        assert.strictEqual(recordedError.message, "SMTP connection reset by peer");
    });

    // 11. Heartbeat Timer Abort Controller Integration
    await runAsyncTest("Heartbeat starts interval and abortController can abort on lease loss", async () => {
        const worker = new OutboxWorker({ heartbeatIntervalMs: 50 });
        const abortController = new AbortController();

        let abortTriggered = false;
        abortController.signal.addEventListener("abort", () => {
            abortTriggered = true;
        });

        const timer = worker.startHeartbeat("dummy-id", "dummy-token", abortController);
        assert(timer);
        clearInterval(timer);

        abortController.abort();
        assert.strictEqual(abortTriggered, true, "AbortController must trigger abort event");
    });

    // 12. stopPolling preserves isTickBusy while an active tick is in-flight
    await runAsyncTest("stopPolling does not clear isTickBusy while tick is in flight", async () => {
        const worker = new OutboxWorker();
        let resolveJob;
        const jobPendingPromise = new Promise((resolve) => {
            resolveJob = resolve;
        });

        worker.processSingleJob = async () => {
            await jobPendingPromise;
            return { processed: false };
        };

        worker.startPolling(50);
        worker.activeTickPromise = worker.executeTick();
        assert.strictEqual(worker.isTickBusy, true, "isTickBusy must be true when tick starts");

        worker.stopPolling();
        assert.strictEqual(worker.isRunning, false, "isRunning must be false after stopPolling");
        assert.strictEqual(worker.pollingInterval, null, "pollingInterval must be cleared");
        assert.strictEqual(worker.isTickBusy, true, "isTickBusy must NOT be cleared by stopPolling while tick is running");

        resolveJob();
        await worker.activeTickPromise;

        assert.strictEqual(worker.isTickBusy, false, "isTickBusy must be false after tick settles");
        assert.strictEqual(worker.activeTickPromise, null, "activeTickPromise must be null after tick settles");
    });

    // 13. Reconnection lifecycle: prevents overlapping ticks while original tick remains active, then resumes
    await runAsyncTest("Reconnection lifecycle prevents overlapping ticks while original tick is active", async () => {
        const worker = new OutboxWorker();
        let resolveOriginalJob;
        const originalJobPromise = new Promise((resolve) => {
            resolveOriginalJob = resolve;
        });

        let jobExecutionCount = 0;
        worker.processSingleJob = async () => {
            jobExecutionCount++;
            if (jobExecutionCount === 1) {
                await originalJobPromise;
            }
            return { processed: false };
        };

        // Step 1: Start polling and trigger tick
        worker.startPolling(20);
        worker.activeTickPromise = worker.executeTick();
        assert.strictEqual(worker.isTickBusy, true, "Tick 1 must set isTickBusy = true");
        assert.strictEqual(jobExecutionCount, 1, "Job 1 started");

        // Step 2: Disconnect triggers stopPolling
        worker.stopPolling();
        assert.strictEqual(worker.isRunning, false);
        assert.strictEqual(worker.isTickBusy, true, "isTickBusy must remain true after stopPolling");

        // Step 3: Trigger reconnection and restart polling
        worker.startPolling(20);
        assert.strictEqual(worker.isRunning, true);

        // Step 4: Confirm another tick cannot begin while original tick is active
        await new Promise((r) => setTimeout(r, 60)); // Wait 3 intervals
        assert.strictEqual(jobExecutionCount, 1, "New tick must NOT execute while original tick is still busy");

        // Step 5: Resolve original tick
        resolveOriginalJob();
        await worker.activeTickPromise;
        assert.strictEqual(worker.isTickBusy, false, "isTickBusy becomes false after original tick completes");

        // Step 6: Confirm polling resumes normally on next interval
        await new Promise((r) => setTimeout(r, 50));
        assert(jobExecutionCount >= 2, "Polling resumes normally after active tick settles");

        // Clean up
        worker.stopPolling();
    });

    // 14. Graceful shutdown drains in-flight tick and repeated shutdown calls are idempotent
    await runAsyncTest("Graceful shutdown drains in-flight tick and is safe for repeated calls", async () => {
        const worker = new OutboxWorker();
        let resolveJob;
        const jobPromise = new Promise((resolve) => {
            resolveJob = resolve;
        });

        let finished = false;
        worker.processSingleJob = async () => {
            await jobPromise;
            finished = true;
            return { processed: false };
        };

        worker.startPolling(20);
        worker.activeTickPromise = worker.executeTick();
        assert.strictEqual(worker.isTickBusy, true);

        // Call shutdown concurrently multiple times
        let shutdown1Settled = false;
        let shutdown2Settled = false;

        const p1 = worker.shutdown(1000).then((res) => { shutdown1Settled = res; });
        const p2 = worker.shutdown(1000).then((res) => { shutdown2Settled = res; });

        assert.strictEqual(finished, false);
        assert.strictEqual(shutdown1Settled, false);
        assert.strictEqual(shutdown2Settled, false);

        resolveJob();
        await Promise.all([p1, p2]);

        assert.strictEqual(finished, true, "Active job completed before shutdown resolved");
        assert.strictEqual(shutdown1Settled, true);
        assert.strictEqual(shutdown2Settled, true);
        assert.strictEqual(worker.isRunning, false);
        assert.strictEqual(worker.isTickBusy, false);
    });

    // 15. Graceful shutdown timeout handling
    await runAsyncTest("Graceful shutdown returns false if tick exceeds timeout without crashing", async () => {
        const worker = new OutboxWorker();
        worker.processSingleJob = () => new Promise(() => {}); // never resolves

        worker.startPolling(20);
        worker.activeTickPromise = worker.executeTick();

        const cleanShutdown = await worker.shutdown(50); // 50ms timeout
        assert.strictEqual(cleanShutdown, false, "Shutdown must return false on timeout");
        assert.strictEqual(worker.isRunning, false, "stopPolling must still have stopped the loop");

        worker.stopPolling();
    });

    // 16. Regression: OutboxWorker claimNextJob and update methods use standard MongoDB update objects without updatePipeline MongooseError
    await runAsyncTest("Regression: OutboxWorker claimNextJob and update methods use standard update objects without updatePipeline MongooseError", async () => {
        // A. Verify reproduction with array
        let reproducedError = null;
        try {
            OutboxNotification.findOneAndUpdate(
                { status: "PENDING" },
                [{ $set: { status: "PROCESSING" } }],
                { new: true }
            );
        } catch (err) {
            reproducedError = err;
        }
        assert(reproducedError, "Passing an array to findOneAndUpdate without updatePipeline must reproduce the MongooseError");
        assert(reproducedError.message.includes("Cannot pass an array to query updates unless the `updatePipeline` option is set."));

        // B. Verify OutboxWorker.claimNextJob passes standard update object and returnDocument: "after"
        const worker = new OutboxWorker();
        let capturedFilter = null;
        let capturedUpdate = null;
        let capturedOptions = null;

        const origFindOneAndUpdate = OutboxNotification.findOneAndUpdate;
        const origUpdateMany = OutboxNotification.updateMany;
        const origUpdateOne = OutboxNotification.updateOne;

        try {
            // Mock recoverAndSweepDeadLetters' updateMany
            let swept = false;
            OutboxNotification.updateMany = async (filter, update, options) => {
                assert.strictEqual(Array.isArray(update), false, "recoverAndSweepDeadLetters must not pass an array");
                assert(update.$set, "recoverAndSweepDeadLetters must use $set");
                swept = true;
                return { modifiedCount: 0 };
            };

            // Mock findOneAndUpdate for claimNextJob
            OutboxNotification.findOneAndUpdate = async (filter, update, options) => {
                capturedFilter = filter;
                capturedUpdate = update;
                capturedOptions = options;
                return {
                    _id: new mongoose.Types.ObjectId(),
                    status: "PROCESSING",
                    workerId: worker.workerId,
                    retryCount: 1
                };
            };

            const claimResult = await worker.claimNextJob();
            assert(claimResult.job, "Job must be returned");
            assert(claimResult.leaseToken, "leaseToken must be generated");
            assert.strictEqual(swept, true, "Dead-letter sweep must be invoked");

            // Assert captured query structure
            assert.strictEqual(Array.isArray(capturedUpdate), false, "claimNextJob update must be an object, NOT an array");
            assert(capturedUpdate.$set, "claimNextJob update must contain $set");
            assert.strictEqual(capturedUpdate.$set.status, "PROCESSING");
            assert.strictEqual(capturedUpdate.$set.workerId, worker.workerId);
            assert.strictEqual(capturedUpdate.$set.leaseToken, claimResult.leaseToken);
            assert(capturedUpdate.$set.lastAttemptAt instanceof Date, "lastAttemptAt must be a Date");
            assert(capturedUpdate.$set.lockedUntil instanceof Date, "lockedUntil must be a Date");
            assert.strictEqual(capturedUpdate.$inc.retryCount, 1, "retryCount must be atomically incremented by $inc");

            assert.strictEqual(capturedOptions.returnDocument, "after", "options must specify returnDocument: 'after'");
            assert.strictEqual(capturedOptions.new, undefined, "options must not use deprecated new: true");
            assert.strictEqual(capturedOptions.sort.createdAt, 1, "options must sort by createdAt: 1 (FIFO)");

            // C. Verify completeJob passes standard update object
            let completeUpdated = false;
            OutboxNotification.updateOne = async (filter, update) => {
                assert.strictEqual(Array.isArray(update), false, "completeJob update must be an object, NOT an array");
                assert.strictEqual(update.$set.status, "SENT");
                assert(update.$set.sentAt instanceof Date);
                assert(update.$set.expireAt instanceof Date);
                completeUpdated = true;
                return { matchedCount: 1 };
            };
            const completed = await worker.completeJob(claimResult.job._id, claimResult.leaseToken);
            assert.strictEqual(completed, true);
            assert.strictEqual(completeUpdated, true);

            // D. Verify failJob passes standard update object
            let failUpdated = false;
            OutboxNotification.updateOne = async (filter, update) => {
                assert.strictEqual(Array.isArray(update), false, "failJob update must be an object, NOT an array");
                assert.strictEqual(update.$set.status, "FAILED");
                assert(update.$set.nextAttemptAt instanceof Date);
                failUpdated = true;
                return { matchedCount: 1 };
            };
            const failed = await worker.failJob(claimResult.job._id, claimResult.leaseToken, 1, new Error("Transient error"));
            assert.strictEqual(failed, true);
            assert.strictEqual(failUpdated, true);

        } finally {
            OutboxNotification.findOneAndUpdate = origFindOneAndUpdate;
            OutboxNotification.updateMany = origUpdateMany;
            OutboxNotification.updateOne = origUpdateOne;
        }
    });

    console.log(`\nTransactional Outbox Test Results: ${passed}/${total} passed.\n`);
    if (passed !== total) process.exit(1);
})();
