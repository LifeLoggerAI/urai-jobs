
import * as admin from "firebase-admin";
import { Job } from "../types";

const db = admin.firestore();

export async function completeJob(jobId: string, runId: string): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  const jobRef = db.collection("jobs").doc(jobId);
  const runRef = jobRef.collection("runs").doc(runId);

  await db.runTransaction(async (transaction) => {
    transaction.update(jobRef, {
      status: "SUCCEEDED",
      updatedAt: now,
    });
    transaction.update(runRef, {
      finishedAt: now,
      outcome: "SUCCEEDED",
    });
  });
}

export async function failJob(
  jobId: string,
  job: Job,
  runId: string,
  error: Error
): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  const jobRef = db.collection("jobs").doc(jobId);
  const runRef = jobRef.collection("runs").doc(runId);

  await db.runTransaction(async (transaction) => {
    const jobData = (await transaction.get(jobRef)).data() as Job;

    if (jobData.attempts >= jobData.maxAttempts) {
      transaction.update(jobRef, {
        status: "DEAD",
        lastError: { message: error.message, at: now },
        updatedAt: now,
      });
    } else {
      const backoff = Math.pow(2, jobData.attempts) * 1000;
      const runAfter = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + backoff
      );
      transaction.update(jobRef, {
        status: "FAILED",
        runAfter,
        lastError: { message: error.message, at: now },
        updatedAt: now,
      });
    }

    transaction.update(runRef, {
      finishedAt: now,
      outcome: "FAILED",
      error: { message: error.message },
    });
  });
}
