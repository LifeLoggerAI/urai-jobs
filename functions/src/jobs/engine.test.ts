
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import * as admin from "firebase-admin";
import { enqueueJob, claimNextJob, completeJob, failJob, reclaimExpiredLeases, cancelJob } from "./engine";
import { startJobRun, endJobRun, updateJobStats } from "./observability";
import { Job } from "./types";

// Use a separate test project or emulator
const FIREBASE_PROJECT_ID = "urai-jobs-test";

let testJobId: string;
let testRunId: string;

// Initialize Firebase Admin SDK for testing
if (admin.apps.length === 0) {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
}

const db = admin.firestore();

describe("Job Engine", () => {

    beforeAll(async () => {
        // Clear collections before tests
        const collections = ["jobs", "jobRuns", "jobStats"];
        for (const collection of collections) {
            const snapshot = await db.collection(collection).get();
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    });

    afterAll(async () => {
        // Cleanup created jobs
        if (testJobId) {
            await db.collection("jobs").doc(testJobId).delete();
        }
    });

    it("should enqueue a new job and update stats", async () => {
        const job = await enqueueJob("test-job", { data: "some-data" });
        expect(job).toBeDefined();
        expect(job.id).toBeDefined();
        testJobId = job.id!;

        const doc = await db.collection("jobs").doc(testJobId).get();
        expect(doc.exists).toBe(true);
        expect(doc.data()?.status).toBe("PENDING");

        const today = new Date().toISOString().split('T')[0];
        const statsDoc = await db.collection("jobStats").doc("daily").collection(today).doc("test-job").get();
        expect(statsDoc.exists).toBe(true);
        expect(statsDoc.data()?.enqueued).toBe(1);
    });

    it("should claim a pending job and create a job run", async () => {
        const workerId = "worker-1";
        const job = await claimNextJob(workerId);
        expect(job).toBeDefined();
        expect(job?.id).toBe(testJobId);

        const doc = await db.collection("jobs").doc(testJobId).get();
        expect(doc.data()?.status).toBe("RUNNING");
        expect(doc.data()?.lockedBy).toBe(workerId);

        const runSnapshot = await db.collection("jobRuns").where("jobId", "==", testJobId).get();
        expect(runSnapshot.empty).toBe(false);
        testRunId = runSnapshot.docs[0].id;
        expect(runSnapshot.docs[0].data().status).toBe("STARTED");
    });

    it("should complete a running job and update stats", async () => {
        const result = { success: true };
        await completeJob(testJobId, testRunId, result, "worker-1");

        const doc = await db.collection("jobs").doc(testJobId).get();
        expect(doc.data()?.status).toBe("SUCCEEDED");
        expect(doc.data()?.result).toEqual(result);

        const runDoc = await db.collection("jobRuns").doc(testRunId).get();
        expect(runDoc.data()?.status).toBe("COMPLETED");

        const today = new Date().toISOString().split('T')[0];
        const statsDoc = await db.collection("jobStats").doc("daily").collection(today).doc("test-job").get();
        expect(statsDoc.data()?.succeeded).toBe(1);
    });

    it("should fail, retry, and eventually mark a job as DEAD", async () => {
        const error = { message: "Test failure" };
        const job = await enqueueJob("retry-job", {}, { maxAttempts: 2 });

        // First attempt
        let claimedJob = await claimNextJob("worker-2");
        expect(claimedJob?.id).toBe(job.id);
        let runSnapshot = await db.collection("jobRuns").where("jobId", "==", job.id).get();
        let runId = runSnapshot.docs[0].id;
        await failJob(job.id!, runId, error, "worker-2");
        let doc = await db.collection("jobs").doc(job.id!).get();
        expect(doc.data()?.status).toBe("PENDING");
        expect(doc.data()?.attempts).toBe(1);

        // Second attempt
        claimedJob = await claimNextJob("worker-2");
        runSnapshot = await db.collection("jobRuns").where("jobId", "==", job.id).orderBy("startedAt", "desc").limit(1).get();
        runId = runSnapshot.docs[0].id;
        await failJob(job.id!, runId, error, "worker-2");
        doc = await db.collection("jobs").doc(job.id!).get();
        expect(doc.data()?.status).toBe("DEAD");
        
        const today = new Date().toISOString().split('T')[0];
        const statsDoc = await db.collection("jobStats").doc("daily").collection(today).doc("retry-job").get();
        expect(statsDoc.data()?.failed).toBe(1);
        expect(statsDoc.data()?.dead).toBe(1);
    });

    it("should reclaim an expired lease", async () => {
        const job = await enqueueJob("lease-test", {});
        const workerId = "worker-3";

        // Manually claim with an expired lease
        const jobRef = db.collection("jobs").doc(job.id!)
        await db.runTransaction(async tx => {
            tx.update(jobRef, {
                status: "RUNNING",
                lockedBy: workerId,
                leaseExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1000)
            });
        });

        const reclaimedCount = await reclaimExpiredLeases();
        expect(reclaimedCount).toBe(1);

        const doc = await db.collection("jobs").doc(job.id!).get();
        expect(doc.data()?.status).toBe("PENDING");
    });

    it("should cancel a pending job", async () => {
        const job = await enqueueJob("cancel-test", {});
        await cancelJob(job.id!)
        const doc = await db.collection("jobs").doc(job.id!).get();
        expect(doc.data()?.status).toBe("CANCELED");
        
        const today = new Date().toISOString().split('T')[0];
        const statsDoc = await db.collection("jobStats").doc("daily").collection(today).doc("cancel-test").get();
        expect(statsDoc.data()?.canceled).toBe(1);
    });
});
