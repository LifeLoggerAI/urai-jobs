
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { Job, JobRun } from "./types";
import { v4 as uuidv4 } from "uuid";

const LEASE_TIMEOUT_MS = 60 * 1000; // 60 seconds

/**
 * Claims a batch of pending jobs and marks them as "RUNNING".
 * This function is designed to be called by a trusted worker/dispatcher.
 * It uses a transaction to ensure atomicity.
 *
 * @param workerId A unique identifier for the worker instance claiming the jobs.
 * @param limit The maximum number of jobs to claim.
 * @returns A list of the jobs that were successfully claimed.
 */
export async function claimJobs(workerId: string, limit: number): Promise<Job[]> {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const leaseExpiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + LEASE_TIMEOUT_MS);

    const jobsRef = db.collection("jobs");
    const claimedJobs: Job[] = [];

    try {
        await db.runTransaction(async (transaction) => {
            // Query for available jobs: PENDING, not leased (or lease expired), and ready to run.
            // Note: Firestore does not support OR queries in this way, so we query for PENDING
            // and rely on the runAfter timestamp. A separate "reaper" function will handle expired leases.
            const pendingJobsQuery = jobsRef
                .where("status", "==", "PENDING")
                .where("runAfter", "<=", now)
                .orderBy("priority", "desc")
                .orderBy("createdAt", "asc")
                .limit(limit);

            const snapshot = await transaction.get(pendingJobsQuery);

            if (snapshot.empty) {
                functions.logger.info("No pending jobs to claim.");
                return;
            }

            for (const doc of snapshot.docs) {
                const job = doc.data() as Job;
                const jobId = doc.id;
                const runId = uuidv4();

                // 1. Update the Job: Mark as RUNNING and set lease
                const jobUpdate: Partial<Job> = {
                    status: "RUNNING",
                    leaseOwner: workerId,
                    leaseExpiresAt,
                    updatedAt: now,
                    attempts: admin.firestore.FieldValue.increment(1) as any,
                };
                transaction.update(doc.ref, jobUpdate);

                // 2. Create a JobRun document to track this execution
                const runRef = db.collection("jobs").doc(jobId).collection("runs").doc(runId);
                const newRun: JobRun = {
                    jobId,
                    runId,
                    workerId,
                    startedAt: now,
                    finishedAt: null,
                    outcome: "SUCCEEDED", // Default to SUCCEEDED, will be updated on failure
                    durationMs: null,
                };
                transaction.set(runRef, newRun);
                
                // Add the full job data to the return list
                claimedJobs.push({ ...job, ...jobUpdate, id: jobId, runId });
                 functions.logger.log(`Claimed job ${jobId} for worker ${workerId}.`);
            }
        });

        return claimedJobs;

    } catch (error) {
        functions.logger.error("Error claiming jobs:", error);
        // If the transaction fails, claimedJobs will be empty, and the caller will know nothing was claimed.
        return [];
    }
}
