const crypto = require("crypto");
const mongoose = require("mongoose");
const Appointment = require("../models/appointment.model");
const Doctor = require("../models/doctor.model");

/**
 * Historical Appointment Migration Script (Phase 1)
 *
 * Scans legacy Appointment documents:
 * 1. Identifies appointments without canonical startDateTime or timezone.
 * 2. Tags records as:
 *    - isTimezoneUnconfirmed: true
 *    - isDurationEstimated: true
 *    - migrationBatchId: generated UUID
 * 3. Supports dry-run auditing (--dry-run) and execution (--execute).
 */
async function auditAndMigrateHistoricalAppointments({ dryRun = true, connection = null }) {
    const batchId = `migration-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;
    const report = {
        batchId,
        mode: dryRun ? "DRY_RUN" : "EXECUTE",
        timestamp: new Date().toISOString(),
        totalScanned: 0,
        unconfirmedCount: 0,
        alreadyConfirmedCount: 0,
        cancelledCount: 0,
        doctorsAffected: new Set(),
        records: []
    };

    if (!connection || connection.readyState !== 1) {
        report.status = "OFFLINE_AUDIT_MODE";
        return report;
    }

    const legacyAppointments = await Appointment.find({}).lean();
    report.totalScanned = legacyAppointments.length;

    const updatesToApply = [];

    for (const appt of legacyAppointments) {
        if (appt.status === "Cancelled" || appt.status === "Expired") {
            report.cancelledCount++;
            continue;
        }

        // Check if appointment is already confirmed in UTC
        if (appt.startDateTime && appt.timezone && appt.isTimezoneUnconfirmed === false) {
            report.alreadyConfirmedCount++;
            continue;
        }

        report.unconfirmedCount++;
        report.doctorsAffected.add(appt.doctor.toString());

        const y = appt.date ? new Date(appt.date).getUTCFullYear() : "UNKNOWN";
        const m = appt.date ? String(new Date(appt.date).getUTCMonth() + 1).padStart(2, "0") : "UNKNOWN";
        const d = appt.date ? String(new Date(appt.date).getUTCDate()).padStart(2, "0") : "UNKNOWN";

        report.records.push({
            appointmentId: appt._id,
            doctorId: appt.doctor,
            legacyDate: `${y}-${m}-${d}`,
            legacyTime: appt.time,
            action: "FLAG_AS_TIER3_UNCONFIRMED"
        });

        updatesToApply.push(appt._id);
    }

    report.doctorsAffectedCount = report.doctorsAffected.size;
    report.doctorsAffected = Array.from(report.doctorsAffected);

    if (!dryRun && updatesToApply.length > 0) {
        const session = await connection.startSession();
        try {
            await session.withTransaction(async () => {
                await Appointment.updateMany(
                    { _id: { $in: updatesToApply } },
                    {
                        $set: {
                            isTimezoneUnconfirmed: true,
                            isDurationEstimated: true,
                            bookingType: "Independent",
                            migrationBatchId: batchId
                        }
                    },
                    { session }
                );
            });
            report.executionStatus = "COMMITTED_SUCCESSFULLY";
            report.updatedCount = updatesToApply.length;
        } finally {
            await session.endSession();
        }
    } else {
        report.executionStatus = dryRun ? "DRY_RUN_COMPLETED_NO_MUTATION" : "NO_RECORDS_TO_UPDATE";
    }

    return report;
}

// CLI runner
if (require.main === module) {
    (async () => {
        const isExecute = process.argv.includes("--execute");
        console.log(`=== MedCare AI Historical Appointment Migration (${isExecute ? "EXECUTE" : "DRY-RUN"}) ===`);
        const report = await auditAndMigrateHistoricalAppointments({ dryRun: !isExecute, connection: null });
        console.log("Migration Dry-Run Report Summary:", report);
    })();
}

module.exports = { auditAndMigrateHistoricalAppointments };
