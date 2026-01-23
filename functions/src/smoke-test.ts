
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

// Initialize Firebase Admin SDK
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? JSON.parse(Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS, "base64").toString("ascii"))
  : require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runSmokeTest() {
  console.log("🔥 Starting smoke test...");

  const jobId = `smoke-test-${uuidv4()}`;
  const idempotencyKey = `smoke-test-idem-${uuidv4()}`;
  const jobData = {
    jobType: "notify",
    status: "pending",
    payload: {
      userId: "smoke-tester",
      message: "This is a smoke test notification.",
    },
    idempotencyKey: idempotencyKey,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    retries: 0,
  };

  const jobRef = db.collection("jobs").doc(jobId);

  try {
    // 1. Create a new job
    console.log(`[1/6] Creating job: ${jobId} with idempotency key: ${idempotencyKey}`);
    await jobRef.set(jobData);

    // 2. Wait for processing
    console.log("[2/6] Waiting for 15 seconds for planner and executor to run...");
    await wait(15000);

    // 3. Verify job is completed
    const completedJobDoc = await jobRef.get();
    const completedJob = completedJobDoc.data();

    if (!completedJob || completedJob.status !== "completed") {
      throw new Error(`[FAIL] Job ${jobId} did not complete. Final status: ${completedJob?.status}`);
    }
    console.log(`[3/6] ✅ Job ${jobId} completed successfully.`);

    // 4. Verify audit logs
    const auditLogsSnapshot = await jobRef.collection("audit_logs").orderBy("timestamp").get();
    const auditLogs = auditLogsSnapshot.docs.map(doc => doc.data());

    const hasPendingToProcessing = auditLogs.some(log => log.statusChange?.from === "pending" && log.statusChange?.to === "processing");
    const hasProcessingToCompleted = auditLogs.some(log => log.statusChange?.from === "processing" && log.statusChange?.to === "completed");

    if (!hasPendingToProcessing || !hasProcessingToCompleted) {
        console.log(auditLogs);
        throw new Error(`[FAIL] Job ${jobId} has incomplete audit logs.`);
    }
    console.log(`[4/6] ✅ Job ${jobId} has correct audit logs.`);

    // 5. Test Idempotency: Create a duplicate job
    const duplicateJobId = `smoke-test-duplicate-${uuidv4()}`;
    const duplicateJobRef = db.collection("jobs").doc(duplicateJobId);
    console.log(`[5/6] Creating duplicate job: ${duplicateJobId} with same idempotency key.`);
    await duplicateJobRef.set({
        ...jobData, // Use same data and idempotency key
        status: "pending", // Start it in pending
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log("...waiting 10 seconds for duplicate to be processed...");
    await wait(10000);

    const duplicateJobDoc = await duplicateJobRef.get();
    const duplicateJob = duplicateJobDoc.data();

    if (!duplicateJob || duplicateJob.status !== "completed" || !duplicateJob.notes?.includes("Duplicate of job")) {
        console.log(duplicateJob)
        throw new Error(`[FAIL] Duplicate job ${duplicateJobId} was not handled correctly.`);
    }
    console.log("[5/6] ✅ Duplicate job handled correctly by idempotency check.");

    // 6. Cleanup
    console.log("[6/6] Cleaning up test data...");
    await jobRef.delete();
    await duplicateJobRef.delete();
    const idemKeyRef = db.collection("idempotency_keys").doc(idempotencyKey);
    await idemKeyRef.delete();

    console.log("\n🎉 Smoke test PASSED!\n");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Smoke test FAILED!\n", error);
    // Clean up on failure as well
    await jobRef.delete();
    process.exit(1);
  }
}

runSmokeTest();

