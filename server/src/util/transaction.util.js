const mongoose = require("mongoose");

/**
 * Executes an operation within a MongoDB transaction with bounded retries for transient errors.
 *
 * Handles:
 * 1. TransientTransactionError / WriteConflict by retrying the entire transaction block.
 * 2. UnknownTransactionCommitResult by retrying the commit operation with bounded backoff.
 * 3. Bounded retry limit (default: 3) and exponential backoff.
 * 4. Safe cleanup of sessions on both success and failure.
 *
 * @param {Function} operation - Async function taking (session) => Promise<any>
 * @param {Object} [options]
 * @param {number} [options.maxRetries=3] - Maximum retry attempts
 * @param {number} [options.baseBackoffMs=50] - Initial backoff duration in milliseconds
 * @returns {Promise<any>}
 */
async function executeTransactionWithRetry(operation, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseBackoffMs = options.baseBackoffMs || 50;

    let attempt = 0;
    while (true) {
        attempt++;
        let session;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (startErr) {
            // MongoDB standalone without replica set
            throw new Error(`Database transaction unavailable: ${startErr.message}`);
        }

        try {
            const result = await operation(session);

            // Bounded commit retry loop for UnknownTransactionCommitResult
            let commitAttempt = 0;
            while (true) {
                commitAttempt++;
                try {
                    await session.commitTransaction();
                    break;
                } catch (commitErr) {
                    const isUnknownCommit =
                        (commitErr.hasErrorLabel && commitErr.hasErrorLabel("UnknownTransactionCommitResult")) ||
                        commitErr.name === "UnknownTransactionCommitResult";

                    if (isUnknownCommit && commitAttempt < maxRetries) {
                        const backoff = baseBackoffMs * Math.pow(2, commitAttempt - 1);
                        await new Promise(res => setTimeout(res, backoff));
                        continue;
                    }
                    throw commitErr;
                }
            }

            await session.endSession();
            return result;
        } catch (err) {
            try {
                await session.abortTransaction();
            } catch (_) {}
            try {
                await session.endSession();
            } catch (_) {}

            const isTransient =
                (err.hasErrorLabel && err.hasErrorLabel("TransientTransactionError")) ||
                err.name === "TransientTransactionError" ||
                err.code === 112 ||
                (err.message && err.message.includes("WriteConflict"));

            if (isTransient && attempt < maxRetries) {
                const backoff = baseBackoffMs * Math.pow(2, attempt - 1);
                await new Promise(res => setTimeout(res, backoff));
                continue;
            }

            throw err;
        }
    }
}

module.exports = { executeTransactionWithRetry };
