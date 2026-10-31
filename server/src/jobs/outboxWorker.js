const crypto = require("crypto");
const mongoose = require("mongoose");
const OutboxNotification = require("../models/outboxNotification.model");
const outboxService = require("../services/outbox.service");

class OutboxWorker {
    constructor(options = {}) {
        this.workerId = options.workerId || `worker-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
        this.leaseDurationMs = options.leaseDurationMs || 30000;       // 30 seconds
        this.heartbeatIntervalMs = options.heartbeatIntervalMs || 10000; // 10 seconds
        this.baseBackoffMs = options.baseBackoffMs || 5000;             // 5 seconds base backoff
        this.maxRetries = options.maxRetries || 5;                      // Max 5 attempts
        this.retentionMs = options.retentionMs || 7 * 24 * 60 * 60 * 1000; // 7 days retention for SENT records
        this.senderOverride = options.senderOverride || null;
        this.pollingInterval = null;
        this.isRunning = false;
        this.isTickBusy = false;
        this.activeTickPromise = null;
        this.shutdownPromise = null;
    }

    /**
     * Sweeps and transitions exhausted jobs to DEAD_LETTER status.
     * Transitions:
     * 1. Jobs with retryCount >= maxRetries in FAILED status.
     * 2. Jobs with retryCount >= maxRetries in PROCESSING status where lease expired (lockedUntil <= $$NOW).
     *
     * @returns {Promise<number>} Number of swept records
     */
    async recoverAndSweepDeadLetters() {
        const result = await OutboxNotification.updateMany(
            {
                retryCount: { $gte: this.maxRetries },
                $or: [
                    { status: "FAILED" },
                    { status: "PROCESSING", $expr: { $lte: ["$lockedUntil", "$$NOW"] } }
                ]
            },
            [
                {
                    $set: {
                        status: "DEAD_LETTER",
                        lockedUntil: null,
                        leaseToken: null,
                        deadLetteredAt: "$$NOW",
                        lastError: {
                            $concat: [
                                "Max retries exhausted (",
                                { $toString: "$retryCount" },
                                "). Transitioned by dead-letter sweep."
                            ]
                        }
                    }
                }
            ]
        );

        return result.modifiedCount || 0;
    }

    /**
     * Atomically claims the next eligible job for processing.
     * Evaluates cluster time via $$NOW and increments retryCount upon claim.
     *
     * @returns {Promise<{ job: Object|null, leaseToken: string|null }>}
     */
    async claimNextJob() {
        // Run dead-letter sweep prior to claiming
        await this.recoverAndSweepDeadLetters();

        const leaseToken = crypto.randomUUID();

        const job = await OutboxNotification.findOneAndUpdate(
            {
                retryCount: { $lt: this.maxRetries },
                $or: [
                    { status: "PENDING" },
                    { status: "FAILED", $expr: { $lte: ["$nextAttemptAt", "$$NOW"] } },
                    { status: "PROCESSING", $expr: { $lte: ["$lockedUntil", "$$NOW"] } } // Expired lease recovery
                ]
            },
            [
                {
                    $set: {
                        status: "PROCESSING",
                        leaseToken: leaseToken,
                        workerId: this.workerId,
                        lastAttemptAt: "$$NOW",
                        lockedUntil: { $add: ["$$NOW", this.leaseDurationMs] },
                        retryCount: { $add: ["$retryCount", 1] }
                    }
                }
            ],
            { sort: { createdAt: 1 }, new: true }
        );

        if (!job) {
            return { job: null, leaseToken: null };
        }

        return { job, leaseToken };
    }

    /**
     * Starts a periodic heartbeat to renew the lease for long-running email dispatches.
     * If the lease is stolen or expired, calls abortController.abort().
     *
     * @param {string|mongoose.Types.ObjectId} jobId
     * @param {string} leaseToken
     * @param {AbortController} abortController
     * @returns {NodeJS.Timeout} Timer handle
     */
    startHeartbeat(jobId, leaseToken, abortController) {
        return setInterval(async () => {
            try {
                const renewed = await OutboxNotification.updateOne(
                    {
                        _id: jobId,
                        leaseToken: leaseToken,
                        status: "PROCESSING",
                        $expr: { $gte: ["$lockedUntil", "$$NOW"] }
                    },
                    [
                        {
                            $set: {
                                lockedUntil: { $add: ["$$NOW", this.leaseDurationMs] }
                            }
                        }
                    ]
                );

                if (renewed.matchedCount === 0) {
                    // Lease lost or expired!
                    if (abortController && typeof abortController.abort === "function") {
                        abortController.abort();
                    }
                }
            } catch (err) {
                if (abortController && typeof abortController.abort === "function") {
                    abortController.abort();
                }
            }
        }, this.heartbeatIntervalMs);
    }

    /**
     * Marks a job successfully SENT.
     * Uses MongoDB cluster time to set sentAt and calculates expireAt retention.
     * Requires matching leaseToken, status: "PROCESSING", and valid lease.
     *
     * @param {string|mongoose.Types.ObjectId} jobId
     * @param {string} leaseToken
     * @returns {Promise<boolean>} True if completed successfully
     */
    async completeJob(jobId, leaseToken) {
        const result = await OutboxNotification.updateOne(
            {
                _id: jobId,
                leaseToken: leaseToken,
                status: "PROCESSING",
                $expr: { $gte: ["$lockedUntil", "$$NOW"] }
            },
            [
                {
                    $set: {
                        status: "SENT",
                        sentAt: "$$NOW",
                        expireAt: { $add: ["$$NOW", this.retentionMs] },
                        lockedUntil: null,
                        leaseToken: null,
                        lastError: null
                    }
                }
            ]
        );

        return result.matchedCount === 1;
    }

    /**
     * Records failure with exponential backoff or immediate dead-letter transition.
     * Uses claimed retryCount from the database document.
     *
     * @param {string|mongoose.Types.ObjectId} jobId
     * @param {string} leaseToken
     * @param {number} claimedRetryCount
     * @param {Error|Object} error
     * @returns {Promise<boolean>} True if updated successfully
     */
    async failJob(jobId, leaseToken, claimedRetryCount, error) {
        const errorMessage = error && error.message ? error.message : String(error);

        if (claimedRetryCount >= this.maxRetries) {
            const deadLetterResult = await OutboxNotification.updateOne(
                {
                    _id: jobId,
                    leaseToken: leaseToken,
                    status: "PROCESSING",
                    $expr: { $gte: ["$lockedUntil", "$$NOW"] }
                },
                [
                    {
                        $set: {
                            status: "DEAD_LETTER",
                            lockedUntil: null,
                            leaseToken: null,
                            deadLetteredAt: "$$NOW",
                            lastError: `Max retries exhausted (${claimedRetryCount}): ${errorMessage}`
                        }
                    }
                ]
            );
            return deadLetterResult.matchedCount === 1;
        }

        // Exponential backoff: 5s * 2^(retryCount - 1)
        const backoffMs = this.baseBackoffMs * Math.pow(2, Math.max(0, claimedRetryCount - 1));

        const failResult = await OutboxNotification.updateOne(
            {
                _id: jobId,
                leaseToken: leaseToken,
                status: "PROCESSING",
                $expr: { $gte: ["$lockedUntil", "$$NOW"] }
            },
            [
                {
                    $set: {
                        status: "FAILED",
                        nextAttemptAt: { $add: ["$$NOW", backoffMs] },
                        lockedUntil: null,
                        leaseToken: null,
                        lastError: errorMessage
                    }
                }
            ]
        );

        return failResult.matchedCount === 1;
    }

    /**
     * Claims and processes a single job end-to-end.
     *
     * @returns {Promise<{ processed: boolean, status?: string, error?: string }>}
     */
    async processSingleJob() {
        const { job, leaseToken } = await this.claimNextJob();
        if (!job) {
            return { processed: false, reason: "NO_CLAIMABLE_JOB" };
        }

        const abortController = new AbortController();
        const heartbeatTimer = this.startHeartbeat(job._id, leaseToken, abortController);

        try {
            // Dispatch notification
            await outboxService.dispatchNotification(job, {
                senderOverride: this.senderOverride
            });

            // Stop heartbeat before completion update
            clearInterval(heartbeatTimer);

            // Complete job
            const completed = await this.completeJob(job._id, leaseToken);
            if (!completed) {
                console.warn(`[OutboxWorker] Worker ${this.workerId} lost lease for job ${job._id} before completion.`);
                return { processed: true, status: "COMPLETED_AFTER_LEASE_LOSS", jobId: job._id };
            }

            return { processed: true, status: "SENT", jobId: job._id };
        } catch (err) {
            clearInterval(heartbeatTimer);

            await this.failJob(job._id, leaseToken, job.retryCount, err);
            return { processed: true, status: "FAILED", jobId: job._id, error: err.message };
        }
    }

    /**
     * Executes a single polling tick.
     * Processes jobs in a loop while jobs are available and isRunning is true.
     * Ensures isTickBusy remains true until all asynchronous operations in the tick complete.
     *
     * @returns {Promise<void>}
     */
    async executeTick() {
        if (this.isTickBusy || !this.isRunning) return;
        this.isTickBusy = true;
        try {
            let processedAny = false;
            do {
                const result = await this.processSingleJob();
                processedAny = result && result.processed;
            } while (processedAny && this.isRunning);
        } catch (err) {
            console.error(`[OutboxWorker ${this.workerId}] Polling error:`, err.message);
        } finally {
            this.isTickBusy = false;
            this.activeTickPromise = null;
        }
    }

    /**
     * Starts continuous polling loop.
     * Guarded against duplicate timers: if already running, does nothing.
     * Does NOT reset isTickBusy so that any in-flight tick from a previous session
     * completes safely before new ticks are executed.
     *
     * @param {number} [intervalMs=5000]
     */
    startPolling(intervalMs = 5000) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.shutdownPromise = null;

        this.pollingInterval = setInterval(() => {
            if (this.isTickBusy || !this.isRunning) return;
            this.activeTickPromise = this.executeTick();
        }, intervalMs);

        console.log(`[OutboxWorker ${this.workerId}] Started polling every ${intervalMs}ms`);
    }

    /**
     * Stops scheduling new polling ticks.
     * Clears interval timer and sets isRunning = false.
     *
     * IMPORTANT: Does NOT blindly clear or reset isTickBusy.
     * If an asynchronous tick is currently in flight, isTickBusy remains true
     * until that tick's finally block completes, preventing overlapping ticks
     * if polling is quickly restarted on reconnection.
     */
    stopPolling() {
        this.isRunning = false;
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        console.log(`[OutboxWorker ${this.workerId}] Stopped polling.`);
    }

    /**
     * Gracefully drains and stops the worker.
     * 1. Stops scheduling future ticks via stopPolling().
     * 2. Waits for any active in-flight tick to settle, up to timeoutMs.
     * 3. Idempotent: safe to call multiple times concurrently.
     *
     * Note: In-flight external email dispatches (e.g. Gmail API / SMTP) cannot be cancelled
     * mid-flight by Node.js once sent to the network. Lease-fencing ensures that if the process terminates
     * or loses its lease, at-least-once delivery semantics remain intact.
     *
     * @param {number} [timeoutMs=10000] Maximum wait time in milliseconds
     * @returns {Promise<boolean>} True if drained cleanly without timing out
     */
    async shutdown(timeoutMs = 10000) {
        if (this.shutdownPromise) {
            return this.shutdownPromise;
        }

        this.shutdownPromise = (async () => {
            this.stopPolling();

            if (!this.activeTickPromise) {
                return true;
            }

            let timeoutHandle;
            const timeoutPromise = new Promise((resolve) => {
                timeoutHandle = setTimeout(() => {
                    console.warn(`[OutboxWorker ${this.workerId}] Graceful shutdown timed out after ${timeoutMs}ms with tick still active.`);
                    resolve(false);
                }, timeoutMs);
            });

            try {
                const completedInTime = await Promise.race([
                    this.activeTickPromise.then(() => true).catch(() => true),
                    timeoutPromise
                ]);
                return completedInTime;
            } finally {
                clearTimeout(timeoutHandle);
            }
        })();

        return this.shutdownPromise;
    }
}

// Export default singleton instance and class
const defaultWorker = new OutboxWorker();

module.exports = {
    OutboxWorker,
    defaultWorker
};
