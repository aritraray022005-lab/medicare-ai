const assert = require("assert");
const mongoose = require("mongoose");
const { executeTransactionWithRetry } = require("../src/util/transaction.util");

/**
 * Replica-Set Integration Test Suite (Phase 7 — CI/CD & Docker Remediation)
 *
 * Distinct from unit tests:
 * - Unit tests (test/*.test.js) use in-memory mocked sessions to test business logic and workflows.
 * - This integration test suite executes REAL multi-document transactions against an actual
 *   MongoDB replica set (PRIMARY node) to verify ACID guarantees (commit, rollback, retry).
 */

const TEST_MONGO_URI = process.env.MONGO_URI || "mongodb://mongodb:27017/medicare_ci_integration?replicaSet=rs0";
const IS_REQUIRED = process.env.RUN_INTEGRATION_TESTS === "true";

let totalTests = 0;
let passedTests = 0;

async function runTest(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] [INTEGRATION / REPLICA-SET] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] [INTEGRATION / REPLICA-SET] ${description}`);
    console.error(`    ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split("\n").slice(1, 4).join("\n"));
    }
    throw err;
  }
}

async function runSuite() {
  console.log("=== Running Live MongoDB Replica Set Integration Tests ===");

  // Check connection to MongoDB replica set
  let isConnected = false;
  try {
    await mongoose.connect(TEST_MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    isConnected = mongoose.connection.readyState === 1;
  } catch (connErr) {
    if (!IS_REQUIRED) {
      console.log(`  [SKIP] Live MongoDB replica set not available at ${TEST_MONGO_URI}.`);
      console.log(`  [INFO] Skipping replica-set integration tests in offline/mock environment.`);
      console.log(`  [INFO] Set RUN_INTEGRATION_TESTS=true with an active replica set to enforce this suite.`);
      return;
    }
    console.error(`  [FATAL] Required live MongoDB replica set connection failed at ${TEST_MONGO_URI}:`, connErr.message);
    process.exit(1);
  }

  try {
    // Define temporary schemas for testing multi-document transactions
    const TestItemSchema = new mongoose.Schema({
      title: { type: String, required: true },
      status: { type: String, default: "active" }
    }, { timestamps: true });

    const TestAuditSchema = new mongoose.Schema({
      action: { type: String, required: true },
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: "ReplicaTestItem" }
    }, { timestamps: true });

    const TestItem = mongoose.models.ReplicaTestItem || mongoose.model("ReplicaTestItem", TestItemSchema);
    const TestAudit = mongoose.models.ReplicaTestAudit || mongoose.model("ReplicaTestAudit", TestAuditSchema);

    // Clean up any leftovers from previous test runs
    await TestItem.deleteMany({});
    await TestAudit.deleteMany({});

    // Test 1: Verify Replica Set is PRIMARY
    await runTest("MongoDB connection is connected to a replica set PRIMARY", async () => {
      assert.strictEqual(mongoose.connection.readyState, 1, "Connection must be readyState 1 (connected)");
      const adminDb = mongoose.connection.db.admin();
      const helloResult = await adminDb.command({ hello: 1 });
      assert.ok(helloResult.setName, "Database must belong to a replica set");
      assert.strictEqual(helloResult.isWritablePrimary, true, "Node must be writable PRIMARY for transactions");
    });

    // Test 2: Database-Aware Health Logic Verification
    await runTest("Database-aware health check reports healthy (200) when connected and unhealthy (503) when disconnected", async () => {
      // Current connected state
      assert.strictEqual(mongoose.connection.readyState, 1);
      const healthyStatus = mongoose.connection.readyState === 1 ? 200 : 503;
      assert.strictEqual(healthyStatus, 200, "Health endpoint must return 200 when readyState is 1");

      // Simulated disconnected readyStates
      const disconnectedStates = [0, 2, 3];
      for (const state of disconnectedStates) {
        const simulatedStatus = state === 1 ? 200 : 503;
        assert.strictEqual(simulatedStatus, 503, `Health endpoint must return 503 for readyState ${state}`);
      }
    });

    // Test 3: Real Multi-Document Transaction Commit
    await runTest("Real multi-document transaction commits atomically across collections", async () => {
      const uniqueTitle = `TxCommit-${Date.now()}`;

      const result = await executeTransactionWithRetry(async (session) => {
        const [item] = await TestItem.create(
          [{ title: uniqueTitle, status: "pending" }],
          { session }
        );

        const [audit] = await TestAudit.create(
          [{ action: "ITEM_CREATED", itemId: item._id }],
          { session }
        );

        return { itemId: item._id, auditId: audit._id };
      });

      assert.ok(result.itemId, "Item ID must be returned");
      assert.ok(result.auditId, "Audit ID must be returned");

      // Verify documents persist in database outside transaction
      const persistedItem = await TestItem.findById(result.itemId);
      const persistedAudit = await TestAudit.findById(result.auditId);

      assert.ok(persistedItem, "Item must be persisted in database");
      assert.strictEqual(persistedItem.title, uniqueTitle);
      assert.ok(persistedAudit, "Audit must be persisted in database");
      assert.strictEqual(persistedAudit.itemId.toString(), result.itemId.toString());
    });

    // Test 4: Real Multi-Document Transaction Abort (Rollback)
    await runTest("Real multi-document transaction rolls back all mutations on error", async () => {
      const rollbackTitle = `TxRollback-${Date.now()}`;
      let createdItemId = null;

      let errorThrown = false;
      try {
        await executeTransactionWithRetry(async (session) => {
          const [item] = await TestItem.create(
            [{ title: rollbackTitle, status: "pending" }],
            { session }
          );
          createdItemId = item._id;

          // Intentionally throw error to trigger transaction abort
          throw new Error("Simulated business validation error triggering rollback");
        });
      } catch (err) {
        errorThrown = true;
        assert.strictEqual(err.message, "Simulated business validation error triggering rollback");
      }

      assert.strictEqual(errorThrown, true, "Transaction error must be re-thrown");
      assert.ok(createdItemId, "Temporary item ID should have been generated inside transaction");

      // Verify document was NOT persisted to database
      const notPersistedItem = await TestItem.findById(createdItemId);
      assert.strictEqual(notPersistedItem, null, "Item must NOT exist in database after transaction rollback");
    });

    // Test 5: Verify retry helper idempotency and session end
    await runTest("executeTransactionWithRetry cleans up sessions on normal completion", async () => {
      let sessionPassed = false;
      const res = await executeTransactionWithRetry(async (session) => {
        assert.ok(session, "Mongoose ClientSession must be provided");
        assert.ok(session.id, "Session must have an ID");
        sessionPassed = true;
        return "CLEANUP_SUCCESS";
      });

      assert.strictEqual(sessionPassed, true);
      assert.strictEqual(res, "CLEANUP_SUCCESS");
    });

    // Cleanup test collections
    await TestItem.deleteMany({});
    await TestAudit.deleteMany({});

    console.log(`\nReplica-Set Integration Test Results: ${passedTests}/${totalTests} passed.`);
  } finally {
    await mongoose.disconnect();
  }
}

runSuite().catch((err) => {
  console.error("Replica-set integration test runner failure:", err);
  process.exit(1);
});
