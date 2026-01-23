
import { expect } from "chai";
import * as admin from "firebase-admin";

describe("Smoke Test", () => {
  let db: admin.firestore.Firestore;

  before(() => {
    // Initialize admin if not already initialized
    if (!admin.apps.length) {
        // This will use the emulator host if FIRESTORE_EMULATOR_HOST is set,
        // which is done automatically by `firebase emulators:exec`
        admin.initializeApp();
    }
    db = admin.firestore();
  });

  it("should create a job, which is then processed by a background function", async () => {
    const jobId = `smoke-test-${Date.now()}`;
    const jobRef = db.collection("jobs").doc(jobId);
    
    // 1. Create a document to trigger the background function
    await jobRef.set({
        jobType: "render",
        payload: { asset: "test.mp4" },
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date()
    });

    // 2. Wait for a moment to allow the background function to trigger and complete
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 3. Fetch the document again to see if it was processed
    const jobDoc = await jobRef.get();
    const job = jobDoc.data();

    // 4. Assert the final state
    if (!job) {
      throw new Error(`Job document '${jobId}' not found after execution.`);
    }

    // The function should have updated the status to 'completed'
    expect(job.status).to.equal("completed");

    // The function should have created audit logs
    const auditLogs = await jobRef.collection("auditLogs").get();
    expect(auditLogs.empty).to.be.false;
    expect(auditLogs.docs.length).to.be.greaterThan(1);

  }).timeout(10000);
});
