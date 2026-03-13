import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

export const scheduledRetry = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const query = db.collection("jobs")
        .where("status", "==", "retry_scheduled")
        .where("retryAt", "<=", now);

    const jobsToRetry = await query.get();
    if (jobsToRetry.empty) {
        functions.logger.info("No jobs to retry.");
        return;
    }

    const batch = db.batch();
    const jobIds = [];
    jobsToRetry.forEach(doc => {
        const jobRef = db.collection("jobs").doc(doc.id);
        batch.update(jobRef, { status: "queued" });
        jobIds.push(doc.id);

        const logRef = db.collection("jobLogs").doc();
        batch.set(logRef, {
            jobId: doc.id,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            stage: "re_queued",
            message: `Job ${doc.id} re-queued for processing after scheduled delay.`
        });
    });

    await batch.commit();

    functions.logger.info(`Re-queued ${jobsToRetry.size} jobs for processing.`, { jobIds });
});
