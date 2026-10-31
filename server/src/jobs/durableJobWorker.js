const crypto = require("crypto");
const mongoose = require("mongoose");
const DurableJob = require("../models/durableJob.model");

class DurableJobWorker {
    constructor(options = {}) {
        this.workerId = options.workerId || `durable-worker-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
        this.leaseDurationMs = options.leaseDurationMs || 30000;         // 30 seconds
        this.heartbeatIntervalMs = options.heartbeatIntervalMs || 10000; // 10 seconds
        this.pollingInterval = null;
        this.isRunning = false;
        this.isTickBusy = false;
        this.activeTickPromise = null;
        this.jobHandlers = new Map();
    }

    /**
     * Registers a handler function for a specific jobType.
     *
     * @param {string} jobType
     * @param {Function} handler async (payload, job) => { done: boolean }
     */
    registerHandler(jobType, handler) {
        this.jobHandlers.set(jobType, handler);
    }

    /**
     * Idempotently enqueues a durable job.
     *
     * @param {Object} params
     * @param {string} params.jobType
     * @param {string|mongoose.Types.ObjectId} params.targetId
     * @param {Object} [params.payload]
     * @param {mongoose.ClientSession} [params.session]
     * @returns {Promise<Object>} The created or existing job
     */
    async enqueueJob({ jobType, targetId, payload = {}, session = null }) {
        if (!jobType || !targetId) {
            throw new Error("jobType and targetId are required to enqueue a durable job");
        }

        const query = {
            jobType,
            targetId,
            status: { $in: ["PENDING", "PROCESSING"] }
        };

        const existing = session
            ? await DurableJob.findOne(query).session(session)
            : await DurableJob.findOne(query);

        if (existing) {
            return existing;
        }

        try {
            const doc = {
                jobType,
                targetId,
                payload,
                status: "PENDING",
                attempts: 0
            };

            const options = session ? { session } : {};
            const [created] = await DurableJob.create([doc], options);
            return created;
        } catch (err) {
            if (err.code === 11000) {
                // Idempotent duplicate catch
                return session
                    ? await DurableJob.findOne(query).session(session)
                    : await DurableJob.findOne(query);
            }
            throw err;
        }
    }

    /**
     * Atomically claims the next eligible job for processing.
     *
     * @returns {Promise<{ job: Object|null, leaseToken: string|null }>}
     */
    async claimNextJob() {
        const leaseToken = crypto.randomUUID();
        const now = new Date();
        const lockedUntil = new Date(now.getTime() + this.leaseDurationMs);

        const job = await DurableJob.findOneAndUpdate(
            {
                $or: [
                    { status: "PENDING" },
                    { status: "PROCESSING", lockedUntil: { $lte: now } }
                ]
            },
            {
                $set: {
                    status: "PROCESSING",
                    leaseToken,
                    workerId: this.workerId,
                    lockedUntil
                },
                $inc: { attempts: 1 }
            },
            { sort: { createdAt: 1 }, returnDocument: "after" }
        );

        if (!job) {
            return { job: null, leaseToken: null };
        }

        return { job, leaseToken };
    }

    /**
     * Starts periodic heartbeat for active job lease extension.
     */
    startHeartbeat(jobId, leaseToken) {
        return setInterval(async () => {
            try {
                const now = new Date();
                const newLock = new Date(now.getTime() + this.leaseDurationMs);
                await DurableJob.updateOne(
                    {
                        _id: jobId,
                        leaseToken,
                        status: "PROCESSING",
                        lockedUntil: { $gte: now }
                    },
                    {
                        $set: { lockedUntil: newLock }
                    }
                );
            } catch (_) {}
        }, this.heartbeatIntervalMs);
    }

    /**
     * Marks a job completed.
     */
    async completeJob(jobId, leaseToken) {
        return await DurableJob.updateOne(
            { _id: jobId, leaseToken, status: "PROCESSING" },
            {
                $set: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    lockedUntil: null,
                    leaseToken: null
                }
            }
        );
    }

    /**
     * Records failure and transitions status.
     */
    async failJob(jobId, leaseToken, error) {
        const errorMsg = error?.message || String(error);
        const job = await DurableJob.findById(jobId);
        const maxAttempts = job ? job.maxAttempts : 5;
        const attempts = job ? job.attempts : 1;

        const nextStatus = attempts >= maxAttempts ? "FAILED" : "PENDING";

        return await DurableJob.updateOne(
            { _id: jobId, leaseToken },
            {
                $set: {
                    status: nextStatus,
                    lastError: errorMsg,
                    lockedUntil: null,
                    leaseToken: null
                }
            }
        );
    }

    /**
     * Executes a single processing tick.
     */
    async tick() {
        if (this.isTickBusy) return 0;
        this.isTickBusy = true;

        let processed = 0;
        try {
            while (this.isRunning) {
                const { job, leaseToken } = await this.claimNextJob();
                if (!job) break;

                processed++;
                const handler = this.jobHandlers.get(job.jobType);
                if (!handler) {
                    await this.failJob(job._id, leaseToken, new Error(`No registered handler for jobType '${job.jobType}'`));
                    continue;
                }

                const heartbeat = this.startHeartbeat(job._id, leaseToken);
                try {
                    const result = await handler(job.payload, job);
                    clearInterval(heartbeat);

                    if (result && result.done === false) {
                        // Re-queue for next tick or continuation
                        await DurableJob.updateOne(
                            { _id: job._id, leaseToken },
                            {
                                $set: {
                                    status: "PENDING",
                                    lockedUntil: null,
                                    leaseToken: null
                                }
                            }
                        );
                    } else {
                        await this.completeJob(job._id, leaseToken);
                    }
                } catch (err) {
                    clearInterval(heartbeat);
                    await this.failJob(job._id, leaseToken, err);
                }
            }
        } finally {
            this.isTickBusy = false;
        }

        return processed;
    }

    /**
     * Starts background polling.
     */
    startPolling(intervalMs = 5000) {
        if (this.isRunning) return;
        this.isRunning = true;

        this.pollingInterval = setInterval(() => {
            this.activeTickPromise = this.tick().catch(() => {});
        }, intervalMs);
    }

    /**
     * Stops polling.
     */
    stopPolling() {
        this.isRunning = false;
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Gracefully drains in-flight tick.
     */
    async shutdown(timeoutMs = 10000) {
        this.stopPolling();
        if (this.activeTickPromise) {
            const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
            await Promise.race([this.activeTickPromise, timeout]);
        }
    }
}

const defaultDurableWorker = new DurableJobWorker();

module.exports = {
    DurableJobWorker,
    defaultDurableWorker
};
