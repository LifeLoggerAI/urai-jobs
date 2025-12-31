import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {getFirestore} from "firebase-admin/firestore";
import {handlers} from "./handlers";

const db = getFirestore();

export const executeWorker = functions.tasks.taskQueue().onDispatch(async (data) => {
    const {jobId} = data as { jobId: string };

    if (!jobId) {
        console.error("No jobId provided to executeWorker.");
        return;
    }

    const jobRef = db.collection("jobs").doc(jobId);
    let jobRunRef;

    try {
        const jobDoc = await jobRef.get();
        if (!jobDoc.exists) {
            console.error(`Job ${jobId} not found.`);
            return;
        }
        const job = jobDoc.data();

        const handler = handlers[job.type];
        if (!handler) {
            throw new Error(`No handler found for job type: ${job.type}`);
        }

        jobRunRef = await db.collection("jobRuns").add({
            jobId,
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            workerId: "executeWorker", // Simplified worker ID
            attempt: job.attempts || 1,
            outcome: "running",
        });

        const result = await handler(job.payload);

        await jobRef.update({
            status: "succeeded",
            result,
            "lock.owner": null,
            "lock.expiresAt": null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await jobRunRef.update({
            endedAt: admin.firestore.FieldValue.serverTimestamp(),
            outcome: "succeeded",
        });

    } catch (error) {
        console.error(`Error executing job ${jobId}:`, error);
        const jobDoc = await jobRef.get();
        const job = jobDoc.data();
        const maxAttempts = job.maxAttempts || 5;

        if (job.attempts >= maxAttempts) {
            await jobRef.update({
                status: "dead",
                error: {message: error.message, stack: error.stack},
                "lock.owner": null,
                "lock.expiresAt": null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            await jobRef.update({
                status: "queued",
                error: {message: error.message, stack: error.stack},
                "lock.owner": null,
                "lock.expiresAt": null,
                nextRunAt: admin.firestore.Timestamp.fromMillis(Date.now() + 15000 * Math.pow(2, job.attempts)), // Exponential backoff
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        if (jobRunRef) {
            await jobRunRef.update({
                endedAt: admin.firestore.FieldValue.serverTimestamp(),
                outcome: "failed",
                error: {message: error.message, stack: error.stack},
            });
        }
    }
});
