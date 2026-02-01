import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { JobRun } from "../models";

const db = admin.firestore();

// This is a placeholder for a more robust queueing system like Cloud Tasks.
export const onJobRunCreated = functions.firestore
  .document("jobRuns/{runId}")
  .onCreate(async (snap, context) => {
    const run = snap.data() as JobRun;
    const { runId } = context.params;

    // In a real system, this would trigger a worker, e.g., by creating a Cloud Task.
    // For this example, we'll directly update the status to simulate execution.

    console.log(`Job run ${runId} created for job ${run.jobId}.`);

    // Simulate leasing the job
    await db.collection("jobRuns").doc(runId).update({
      status: "leased",
      leaseExpiresAt: admin.firestore.Timestamp.fromMillis(
        Date.now() + 60 * 1000
      ),
      workerId: "local-simulator",
    });
  });
