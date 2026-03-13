import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();
const BASE_DELAY_MS = 60000; // 1 minute

export const retryFailedJob = functions.firestore
    .document("jobs/{jobId}")
    .onUpdate(async (change, context) => {
        const job = change.after.data();
        const previousJob = change.before.data();
        const { jobId } = context.params;

        if (job.status === "failed" && previousJob.status !== "failed") {

            if (job.retryCount < job.maxRetries) {
                const retryCount = job.retryCount || 0;
                // Exponential backoff with jitter
                const delay = BASE_DELAY_MS * Math.pow(2, retryCount) + Math.random() * 1000;
                const retryAt = admin.firestore.Timestamp.fromMillis(Date.now() + delay);

                // Schedule the job for retry
                await change.after.ref.update({
                    status: "retry_scheduled",
                    retryCount: admin.firestore.FieldValue.increment(1),
                    retryAt,
                });
                functions.logger.info(`Job scheduled for retry`, { jobId, retryAt: retryAt.toDate() });

                // Log retry scheduling
                await db.collection("jobLogs").add({
                    jobId,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    stage: "retry_scheduled",
                    message: `Job ${jobId} scheduled for retry at ${retryAt.toDate()}`,
                });
            } else {
                // Move to dead-letter queue
                await db.collection("deadLetterJobs").doc(jobId).set(job);
                await change.after.ref.delete();
                functions.logger.warn(`Job moved to dead-letter queue`, { jobId, job });

                // Log terminal failure
                await db.collection("jobLogs").add({
                    jobId,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    stage: "terminal_failure",
                    message: `Job ${jobId} moved to dead-letter queue after reaching max retries`,
                });
            }
        }
    });
