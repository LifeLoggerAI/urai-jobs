
import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { handlers } from "../handlers";
import { Job, JobRun } from "../types";
import { completeJob, failJob } from "../engine/lifecycle";

const WORKER_ID = `worker-${process.env.K_REVISION || 'local'}`;

// --- Scheduled Worker --- //

export const jobWorker = onSchedule("every 1 minutes", async () => {
  console.log("Job worker running...");
  await claimAndRunJobs();
});

async function claimAndRunJobs() {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const eligibleJobsQuery = db
    .collection("jobs")
    .where("status", "==", "PENDING")
    .where("runAfter", "<=", now)
    .orderBy("runAfter")
    .orderBy("priority", "desc")
    .orderBy("createdAt", "asc")
    .limit(3);

  const snapshot = await eligibleJobsQuery.get();

  if (snapshot.empty) {
    return;
  }

  const promises = snapshot.docs.map(doc => {
    const job = doc.data() as Job;
    const jobId = doc.id;
    return db.runTransaction(async (tx) => {
        const jobRef = db.collection("jobs").doc(jobId)
        const freshDoc = await tx.get(jobRef)
        if (freshDoc.data()?.status !== 'PENDING') return;

        const runId = db.collection("jobs").doc().id;
        const runRef = jobRef.collection('runs').doc(runId)

        const leaseExpiresAt = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + 60 * 1000 // 60 second lease
        );

        tx.update(jobRef, {
            status: 'RUNNING',
            leaseOwner: WORKER_ID,
            leaseExpiresAt,
            attempts: admin.firestore.FieldValue.increment(1),
            updatedAt: now,
        })

        const run: JobRun = {
            startedAt: now,
            finishedAt: null,
            workerId: WORKER_ID,
            outcome: "FAILED",
            durationMs: null
        }
        tx.set(runRef, run)

        return { job, runId, jobId };
    }).then(result => {
        if(result) {
            executeJob(result.jobId, result.job, result.runId)
        }
    });
  });

  await Promise.all(promises);
}

async function executeJob(jobId: string, job: Job, runId: string) {
  const handler = handlers[job.type as keyof typeof handlers];

  if (!handler) {
    console.error(`No handler for job type: ${job.type}`);
    await failJob(jobId, job, runId, new Error(`No handler for job type: ${job.type}`));
    return;
  }

  try {
    await handler(job.payload);
    await completeJob(jobId, runId);
  } catch (e: any) {
    console.error(`Job ${jobId} failed`, e);
    await failJob(jobId, job, runId, e);
  }
}
