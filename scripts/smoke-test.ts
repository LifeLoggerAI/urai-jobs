import { fork } from "child_process";
import * as admin from "firebase-admin";

async function smokeTest() {
    console.log("Starting smoke test...");

    // 1. Start emulators
    const emulators = fork("../../node_modules/.bin/firebase", ["emulators:start", "--project=urai-jobs"]);

    // 2. Enqueue a job
    admin.initializeApp({ projectId: "urai-jobs" });
    const firestore = admin.firestore();
    const jobRef = await firestore.collection("jobs").add({
        type: "echo",
        payload: { message: "Hello from smoke test" },
        status: "PENDING",
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        scheduledFor: null,
        runAfter: new Date(),
        attempts: 0,
        maxAttempts: 1,
        lastError: null,
        lease: { ownerId: null, leaseId: null, leasedAt: null, expiresAt: null, heartbeatAt: null },
        idempotencyKey: `smoke-test-${Date.now()}`,
        dedupeWindowSec: 60,
    });

    // 3. Wait for the job to complete
    let job = await jobRef.get();
    let status = job.data()?.status;
    while (status === "PENDING" || status === "RUNNING") {
        console.log(`Job status: ${status}. Waiting...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        job = await jobRef.get();
        status = job.data()?.status;
    }

    // 4. Assert the result
    console.log(`Final job status: ${status}`);
    if (status !== "SUCCEEDED") {
        console.error("Smoke test failed!");
        process.exit(1);
    }

    // 5. Check metrics
    const today = new Date().toISOString().split("T")[0];
    const metrics = await firestore.collection("metrics").doc(`jobsDaily/${today}`).get();
    if (!metrics.exists || metrics.data()?.succeeded < 1) {
        console.error("Metrics not updated correctly!");
        process.exit(1);
    }

    console.log("Smoke test passed!");

    // 6. Shutdown emulators
    emulators.kill();
    process.exit(0);
}

smokeTest();
