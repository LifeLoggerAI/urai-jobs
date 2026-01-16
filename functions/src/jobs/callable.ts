import * as functions from "firebase-functions";
import { enqueueJob, cancelJob } from "./engine";
import { firestore } from "../lib/firebase";
import { JOB_COLLECTION } from "../config";

export const jobsEnqueue = functions.https.onCall(async (data, context) => {
    if (!context.auth?.token.admin) {
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    }

    const { type, payload, options } = data;
    if (!type) {
        throw new functions.https.HttpsError("invalid-argument", "Missing job type");
    }

    try {
        const job = await enqueueJob(type, payload, options);
        return { jobId: job.id };
    } catch (error) {
        console.error("Failed to enqueue job:", error);
        throw new functions.https.HttpsError("internal", "Failed to enqueue job");
    }
});

export const jobsRequeue = functions.https.onCall(async (data, context) => {
    if (!context.auth?.token.admin) {
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    }

    const { jobId } = data;
    if (!jobId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing jobId");
    }

    try {
        const jobRef = firestore.collection(JOB_COLLECTION).doc(jobId);
        await jobRef.update({ status: "PENDING" });
        return { success: true };
    } catch (error) {
        console.error("Failed to requeue job:", error);
        throw new functions.https.HttpsError("internal", "Failed to requeue job");
    }
});

export const jobsCancel = functions.https.onCall(async (data, context) => {
    if (!context.auth?.token.admin) {
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    }

    const { jobId } = data;
    if (!jobId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing jobId");
    }

    try {
        await cancelJob(jobId);
        return { success: true };
    } catch (error) {
        console.error("Failed to cancel job:", error);
        throw new functions.https.HttpsError("internal", "Failed to cancel job");
    }
});

export const jobsStats = functions.https.onCall(async (data, context) => {
    if (!context.auth?.token.admin) {
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    }
    // This is a placeholder for a more complete stats implementation
    return { success: true };
});
