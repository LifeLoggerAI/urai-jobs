import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const processJob = functions.firestore
  .document("jobs/{jobId}")
  .onCreate(async (snap, context) => {
    const { jobId } = context.params;
    const job = snap.data();

    if (!job) {
      functions.logger.error(`Job data not found for job ${jobId}`);
      return;
    }

    try {
      // 1. Update status to "processing"
      await db.collection("jobs").doc(jobId).update({ status: "processing" });
      functions.logger.info(`Job ${jobId} status updated to processing`);

      // 2. Simulate work
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. Update status to "completed"
      await db.collection("jobs").doc(jobId).update({ status: "completed" });
      functions.logger.info(`Job ${jobId} status updated to completed`);

      // 4. Write to jobResults collection
      await db.collection("jobResults").doc(jobId).set({
        jobId,
        status: "completed",
        result: "Job completed successfully",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      functions.logger.info(`Job result for ${jobId} written to jobResults`);

    } catch (error) {
      functions.logger.error(`Error processing job ${jobId}:`, error);
      await db.collection("jobs").doc(jobId).update({ status: "failed" });
    }
  });
