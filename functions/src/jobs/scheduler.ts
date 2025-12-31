import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const jobTick = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();

    const configRef = db.collection("config").doc("jobs");
    const configDoc = await configRef.get();
    const config = configDoc.data() || {};

    const tickBatchSize = config.tickBatchSize || 10;
    const workerLeaseSeconds = config.workerLeaseSeconds || 60;

    const dueJobs = await db
      .collection("jobs")
      .where("status", "==", "queued")
      .where("nextRunAt", "<=", now)
      .orderBy("nextRunAt")
      .orderBy("priority", "desc")
      .limit(tickBatchSize)
      .get();

    const workerId = context.run.id;

    const promises = dueJobs.docs.map(async (jobDoc) => {
      const jobId = jobDoc.id;
      const jobData = jobDoc.data();

      return db.runTransaction(async (transaction) => {
        const jobRef = db.collection("jobs").doc(jobId);
        const freshJobDoc = await transaction.get(jobRef);
        const freshJobData = freshJobDoc.data();

        if (freshJobData?.status !== "queued") {
          return;
        }

        if (freshJobData?.lock?.expiresAt > now) {
          return;
        }

        transaction.update(jobRef, {
          status: "running",
          lock: {
            owner: workerId,
            expiresAt: admin.firestore.Timestamp.fromMillis(
              now.toMillis() + workerLeaseSeconds * 1000
            ),
          },
          attempts: (freshJobData?.attempts || 0) + 1,
          updatedAt: now,
        });

        // The actual job execution logic would be triggered from here.
        // For now, we'll just log a message.
        console.log(`Job ${jobId} claimed by worker ${workerId}`);
      });
    });

    await Promise.all(promises);

    console.log(`Job tick finished. Claimed ${dueJobs.size} jobs.`);
  });
