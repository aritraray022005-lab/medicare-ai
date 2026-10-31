const mongoose = require("mongoose");
const path = require("path");

// Load all 13 models
const Admin = require("../models/admin.model");
const Doctor = require("../models/doctor.model");
const Patient = require("../models/patient.model");
const Appointment = require("../models/appointment.model");
const { Question, Answer } = require("../models/qa.model");
const Organization = require("../models/organization.model");
const DoctorOrganization = require("../models/doctorOrganization.model");
const Room = require("../models/room.model");
const RoomSlot = require("../models/roomSlot.model");
const RoomBookingRequest = require("../models/roomBookingRequest.model");
const RoomBooking = require("../models/roomBooking.model");
const OutboxNotification = require("../models/outboxNotification.model");

const MASTER_MODELS = [
    { name: "admins", model: Admin },
    { name: "doctors", model: Doctor },
    { name: "patients", model: Patient },
    { name: "appointments", model: Appointment },
    { name: "questions", model: Question },
    { name: "answers", model: Answer },
    { name: "organizations", model: Organization },
    { name: "doctororganizations", model: DoctorOrganization },
    { name: "rooms", model: Room },
    { name: "roomslots", model: RoomSlot },
    { name: "roombookingrequests", model: RoomBookingRequest },
    { name: "roombookings", model: RoomBooking },
    { name: "outboxnotifications", model: OutboxNotification }
];

/**
 * Normalizes BSON and query objects recursively.
 * - Sorts object keys alphabetically for stable JSON comparison.
 * - Selectively sorts arrays ONLY for order-independent operators ($in, $nin, $all).
 * - Converts ObjectId to hex string, Date to ISO string, RegExp to { $regex, $options }.
 */
function normalizeBsonValue(val, parentKey = null) {
    if (val === null || val === undefined) return val;

    if (val instanceof mongoose.Types.ObjectId || (typeof val === "object" && val._bsontype === "ObjectID")) {
        return val.toHexString ? val.toHexString() : val.toString();
    }

    if (val instanceof Date) {
        return val.toISOString();
    }

    if (val instanceof RegExp) {
        return { $regex: val.source, $options: val.flags };
    }

    if (Array.isArray(val)) {
        const normalizedItems = val.map(item => normalizeBsonValue(item, parentKey));
        // Only sort array if the parent operator is order-independent ($in, $nin, $all)
        if (["$in", "$nin", "$all"].includes(parentKey)) {
            return normalizedItems.slice().sort((a, b) => {
                const sa = typeof a === "object" ? JSON.stringify(a) : String(a);
                const sb = typeof b === "object" ? JSON.stringify(b) : String(b);
                return sa.localeCompare(sb);
            });
        }
        return normalizedItems;
    }

    if (typeof val === "object") {
        const sortedObj = {};
        const keys = Object.keys(val).sort();
        for (const k of keys) {
            sortedObj[k] = normalizeBsonValue(val[k], k);
        }
        return sortedObj;
    }

    return val;
}

/**
 * Canonicalizes a compound index key specification.
 * Preserves exact declaration order and directional signs.
 */
function canonicalizeKeySpec(keys) {
    if (!keys || typeof keys !== "object") return [];
    // Convert to array of [field, direction] preserving order
    return Object.entries(keys).map(([field, dir]) => [field, dir]);
}

/**
 * Serializes normalized index options.
 */
function canonicalizeOptions(opts = {}) {
    return {
        unique: Boolean(opts.unique),
        sparse: Boolean(opts.sparse),
        expireAfterSeconds: typeof opts.expireAfterSeconds === "number" ? opts.expireAfterSeconds : null,
        partialFilterExpression: opts.partialFilterExpression
            ? normalizeBsonValue(opts.partialFilterExpression)
            : null,
        collation: opts.collation
            ? {
                  locale: opts.collation.locale,
                  strength: opts.collation.strength,
                  caseLevel: Boolean(opts.collation.caseLevel),
                  numericOrdering: Boolean(opts.collation.numericOrdering)
              }
            : null
    };
}

/**
 * Compares two canonical key specifications for equality.
 */
function areKeysEqual(keysA, keysB) {
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
        if (keysA[i][0] !== keysB[i][0] || keysA[i][1] !== keysB[i][1]) {
            return false;
        }
    }
    return true;
}

/**
 * Compares schema declared indexes with live database indexes.
 */
async function auditDatabaseIndexes(connection) {
    const report = {
        timestamp: new Date().toISOString(),
        totalCollections: MASTER_MODELS.length,
        collections: {}
    };

    for (const { name, model } of MASTER_MODELS) {
        const collectionReport = {
            collectionName: name,
            matched: [],
            mismatched: [],
            missing: [],
            extra: [],
            status: "OK"
        };

        // 1. Extract Schema Declared Indexes
        const schemaRawIndexes = model.schema.indexes();
        const declaredIndexes = schemaRawIndexes.map(([keys, opts]) => ({
            keys: canonicalizeKeySpec(keys),
            options: canonicalizeOptions(opts || {})
        }));

        // 2. Fetch Live Indexes from MongoDB (if connected)
        let liveIndexes = [];
        if (connection && connection.readyState === 1) {
            try {
                const liveRaw = await connection.db.collection(name).indexes();
                // Filter out system _id_ index
                liveIndexes = liveRaw
                    .filter(idx => idx.name !== "_id_")
                    .map(idx => ({
                        keys: canonicalizeKeySpec(idx.key),
                        options: canonicalizeOptions(idx)
                    }));
            } catch (err) {
                if (err.code === 26 || err.message.includes("ns not found")) {
                    collectionReport.status = "COLLECTION_NOT_CREATED";
                } else {
                    collectionReport.status = `ERROR: ${err.message}`;
                }
            }
        } else {
            collectionReport.status = "OFFLINE_SCHEMA_AUDIT";
        }

        // 3. Compare Declared vs Live
        if (liveIndexes.length > 0) {
            const liveMatched = new Set();

            for (const declared of declaredIndexes) {
                const matchIndex = liveIndexes.findIndex(live => areKeysEqual(declared.keys, live.keys));
                if (matchIndex === -1) {
                    collectionReport.missing.push(declared);
                } else {
                    const live = liveIndexes[matchIndex];
                    liveMatched.add(matchIndex);

                    // Compare options
                    const optionsMatch =
                        JSON.stringify(declared.options) === JSON.stringify(live.options);

                    if (optionsMatch) {
                        collectionReport.matched.push({ keys: declared.keys, options: declared.options });
                    } else {
                        collectionReport.mismatched.push({
                            keys: declared.keys,
                            expectedOptions: declared.options,
                            actualOptions: live.options
                        });
                    }
                }
            }

            // Find extra indexes in live db
            liveIndexes.forEach((live, idx) => {
                if (!liveMatched.has(idx)) {
                    collectionReport.extra.push(live);
                }
            });
        } else if (collectionReport.status === "OFFLINE_SCHEMA_AUDIT") {
            // In offline mode, list all declared indexes for schema verification
            collectionReport.matched = declaredIndexes;
        }

        report.collections[name] = collectionReport;
    }

    return report;
}

// CLI runner
if (require.main === module) {
    (async () => {
        console.log("=== MedCare AI Index Audit Tool v3.9 ===");
        const report = await auditDatabaseIndexes(null);
        console.log(`Audited ${report.totalCollections} collections in offline schema mode:`);
        for (const [col, res] of Object.entries(report.collections)) {
            console.log(`  - [${col}]: ${res.matched.length} indexes declared (${res.status})`);
        }
    })();
}

module.exports = { auditDatabaseIndexes, canonicalizeKeySpec, canonicalizeOptions, normalizeBsonValue, areKeysEqual };
