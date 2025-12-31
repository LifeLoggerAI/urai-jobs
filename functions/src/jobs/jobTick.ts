import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {getFunctions} from "firebase-admin/functions";

const db = admin.firestore();

export const jobTick = functions.pubsub.schedule("every 1 minute").onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();

    const configRef = db.collection("config").doc("jobs");
    const configDoc = await configRef.get();
    const config = configDoc.data() || {};

    const tickBatchSize = config.tickBatchSize || 10;
    const leaseSeconds = config.workerLeaseSeconds || 60;

    const dueJobs = await db.collection("jobs")
        .where("status", "==", "queued")
        .where("nextRunAt", "<=", now)
        .orderBy("nextRunAt")
        .orderBy("priority", "desc")
        .limit(tickBatchSize)
        .get();

    if (dueJobs.empty) {
        console.log("No due jobs found.");
        return;
    }

    const workerId = `jobTick-${context.eventId}`;

    for (const jobDoc of dueJobs.docs) {
        const jobId = jobDoc.id;
        const job = jobDoc.data();

        try {
            await db.runTransaction(async (transaction) => {
                const freshJobDoc = await transaction.get(jobDoc.ref);
                const freshJob = freshJobDoc.data();

                if (freshJob.status !== "queued") {
                    console.log(`Job ${jobId} is no longer queued. Skipping.`);
                    return;
                }

                if (freshJob.lock && freshJob.lock.expiresAt.toMillis() > now.toMillis()) {
                    console.log(`Job ${jobId} is locked. Skipping.`);
                    return;
                }

                transaction.update(jobDoc.ref, {
                    status: "running",
                    "lock.owner": workerId,
                    "lock.expiresAt": admin.firestore.Timestamp.fromMillis(now.toMillis() + leaseSeconds * 1000),
                    attempts: admin.firestore.FieldValue.increment(1),
                    updatedAt: now,
                });

                // Use task queue to execute the actual job logic to avoid long-running functions
                const queue = getFunctions().taskQueue("executeworker");
                await queue.enqueue({jobId});
            });
        } catch (error) {
            console.error(`Error processing job ${jobId}:`, error);
        }
    }
});
