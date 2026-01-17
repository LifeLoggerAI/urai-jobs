
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { JobStatus } from "./types";
import { firestore } from "firebase-admin";

const STUCK_JOB_TIMEOUT_MINUTES = 10;

/**
 * A scheduled function that runs periodically to find and requeue stuck jobs.
 * A job is considered "stuck" if it has been in the RUNNING state for too long,
 * which indicates that the worker processing it has likely crashed or failed.
 */
export const reapStuckJobs = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    const db = admin.firestore();
    const now = firestore.Timestamp.now();
    
    const stuckThreshold = firestore.Timestamp.fromMillis(now.toMillis() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);

    const stuckJobs = await db.collection("jobs")
        .where("status", "==", "RUNNING")
        .where("leaseExpiresAt", "<", stuckThreshold)
        .get();

    if (stuckJobs.empty) {
        functions.logger.info("No stuck jobs found.");
        return;
    }

    functions.logger.warn(`Found ${stuckJobs.size} stuck jobs. Reaping...`);

    const reapPromises = stuckJobs.docs.map(async (doc) => {
        const jobId = doc.id;
        const jobRef = db.collection("jobs").doc(jobId);

        try {
            await db.runTransaction(async (transaction) => {
                const freshDoc = await transaction.get(jobRef);
                if (!freshDoc.exists) return;

                const job = freshDoc.data();

                // Double-check the status and lease expiry to avoid race conditions
                if (job && job.status === "RUNNING" && job.leaseExpiresAt.toMillis() < stuckThreshold.toMillis()) {
                    functions.logger.warn(`Reaping job ${jobId}. It was leased to ${job.leaseOwner} which expired at ${job.leaseExpiresAt.toDate().toISOString()}`);
                    
                    // Reset the job to PENDING so it can be picked up again.
                    // We don't increment the attempt count here, but we could add a
                    // separate `reapCount` if this is important to track.
                    transaction.update(jobRef, {
                        status: "PENDING" as JobStatus,
                        leaseOwner: null,
                        leaseExpiresAt: null,
                        updatedAt: firestore.Timestamp.now(),
                        lastError: { message: `Job reaped as stuck. Last lease owner: ${job.leaseOwner}.`, at: firestore.Timestamp.now() }
                    });
                }
            });
        } catch (error) {
            functions.logger.error(`Failed to reap job ${jobId}:`, error);
        }
    });

    await Promise.all(reapPromises);
});
