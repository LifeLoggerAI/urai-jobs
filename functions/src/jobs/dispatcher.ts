
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Job, JobRun, JobStatus } from "./types";
import { firestore } from "firebase-admin";
import { getJobHandlers } from "../handlers";

const MAX_CONCURRENT_JOBS = 3;
const LEASE_TIMEOUT_MS = 60 * 1000; // 1 minute

/**
 * A scheduled function that runs periodically to claim and execute pending jobs.
 * This is the core of the job queue worker.
 */
export const jobDispatcher = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    const db = admin.firestore();
    const now = firestore.Timestamp.now();

    // --- 1. Claim Jobs ---
    const jobsToClaim = await db.collection("jobs")
        .where("status", "==", "PENDING")
        .where("runAfter", "<=", now)
        .orderBy("runAfter", "asc")
        .orderBy("priority", "desc")
        .limit(MAX_CONCURRENT_JOBS)
        .get();

    if (jobsToClaim.empty) {
        functions.logger.info("No pending jobs to dispatch.");
        return;
    }

    const workerId = `dispatcher-${context.eventId}`;
    const leaseExpiresAt = firestore.Timestamp.fromMillis(now.toMillis() + LEASE_TIMEOUT_MS);

    const claimPromises = jobsToClaim.docs.map(async (doc) => {
        const jobId = doc.id;
        const jobRef = db.collection("jobs").doc(jobId);
        let claimedJob: Job | null = null;

        try {
            await db.runTransaction(async (transaction) => {
                const freshDoc = await transaction.get(jobRef);
                if (!freshDoc.exists) return;

                const job = freshDoc.data() as Job;

                // Double-check status and lease in transaction to avoid race conditions
                if (job.status === "PENDING" && (job.leaseExpiresAt === null || job.leaseExpiresAt.toMillis() < now.toMillis())) {
                    const runId = db.collection('jobs').doc().id; // Generate a new ID for the run

                    transaction.update(jobRef, {
                        status: "RUNNING" as JobStatus,
                        leaseOwner: workerId,
                        leaseExpiresAt: leaseExpiresAt,
                        attempts: firestore.FieldValue.increment(1),
                        updatedAt: now,
                        runId: runId,
                    });
                    
                    // Create a run document
                    const runRef = jobRef.collection('runs').doc(runId);
                    const runDoc: JobRun = {
                        jobId: jobId,
                        runId: runId,
                        workerId: workerId,
                        startedAt: now,
                        finishedAt: null,
                        outcome: "FAILED", // Assume failure until proven otherwise
                        durationMs: null
                    };
                    transaction.set(runRef, runDoc);

                    claimedJob = { ...job, id: jobId, runId: runId }; // Pass this to the handler
                }
            });

            if (claimedJob) {
                await handleJob(claimedJob, workerId);
            }
        } catch (error) {
            functions.logger.error(`Failed to claim or handle job ${jobId}:`, error);
        }
    });

    await Promise.all(claimPromises);
});


/**
 * Executes a single job by invoking its registered handler.
 * @param job The job object to execute.
 * @param workerId The ID of the worker processing the job.
 */
async function handleJob(job: Job, workerId: string) {
    const db = admin.firestore();
    const jobRef = db.collection("jobs").doc(job.id!);
    const runRef = jobRef.collection('runs').doc(job.runId!);
    const handlers = getJobHandlers();
    const handler = handlers[job.type];

    if (!handler) {
        functions.logger.error(`No handler found for job type: ${job.type}. Marking as FAILED.`);
        await failJob(jobRef, runRef, new Error(`No handler for type: ${job.type}`), workerId);
        return;
    }

    try {
        functions.logger.info(`Executing job ${job.id} (type: ${job.type}, attempt: ${job.attempts + 1})`);
        await handler(job.payload, { jobId: job.id, workerId });

        // --- Mark as SUCCEEDED ---
        const finishedAt = firestore.Timestamp.now();
        const durationMs = finishedAt.toMillis() - (job.createdAt.toMillis() || 0); // fallback for createdAt

        await jobRef.update({
            status: "SUCCEEDED" as JobStatus,
            updatedAt: finishedAt,
        });

        await runRef.update({
            finishedAt: finishedAt,
            outcome: "SUCCEEDED",
            durationMs: durationMs,
        });

        functions.logger.info(`Job ${job.id} SUCCEEDED.`);

    } catch (error: any) {
        functions.logger.error(`Job ${job.id} execution failed:`, error);
        await failJob(jobRef, runRef, error, workerId);
    }
}

/**
 * Marks a job as FAILED or DEAD and calculates the next retry time.
 */
async function failJob(jobRef: firestore.DocumentReference, runRef: firestore.DocumentReference, error: Error, workerId: string) {
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) return;

    const job = jobDoc.data() as Job;
    const now = firestore.Timestamp.now();

    const nextStatus: JobStatus = job.attempts >= job.maxAttempts ? "DEAD" : "FAILED";

    // --- Exponential Backoff with Jitter ---
    const backoffFactor = Math.pow(2, job.attempts - 1);
    const randomJitter = Math.random() * 1000; // Add up to 1s of jitter
    const nextRunDelayMs = backoffFactor * 15000 + randomJitter; // Base delay 15s
    const nextRunAt = firestore.Timestamp.fromMillis(now.toMillis() + nextRunDelayMs);

    const finishedAt = firestore.Timestamp.now();
    const durationMs = finishedAt.toMillis() - (job.createdAt.toMillis());

    await jobRef.update({
        status: nextStatus,
        updatedAt: now,
        lastError: { message: error.message, stack: error.stack, at: now },
        runAfter: nextRunAt, // Schedule retry
    });
    
    await runRef.update({
        finishedAt: finishedAt,
        outcome: "FAILED",
        durationMs: durationMs,
        error: { message: error.message },
    });

    functions.logger.warn(`Job ${job.id} ${nextStatus}. Scheduled to retry at ${nextRunAt.toDate().toISOString()}`);
}
