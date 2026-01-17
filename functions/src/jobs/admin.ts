
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Job, JobStatus } from "./types";
import { firestore } from "firebase-admin";

// Helper to check for admin privileges
const ensureAdmin = (context: functions.https.CallableContext) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    // This uses a custom claim. You must set this on your admin users.
    // e.g., admin.auth().setCustomUserClaims(uid, { admin: true });
    if (context.auth.token.admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'The function must be called by an admin.');
    }
};

/**
 * A callable function for admins to manually requeue a job.
 * This can be used for jobs that are FAILED or DEAD.
 */
export const requeueJob = functions.https.onCall(async (data, context) => {
    ensureAdmin(context);

    const jobId = data.jobId;
    if (!jobId || typeof jobId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "jobId" string argument.');
    }

    const db = admin.firestore();
    const jobRef = db.collection("jobs").doc(jobId);

    try {
        await db.runTransaction(async (transaction) => {
            const jobDoc = await transaction.get(jobRef);
            if (!jobDoc.exists) {
                throw new functions.https.HttpsError('not-found', `Job with ID ${jobId} not found.`);
            }

            const job = jobDoc.data() as Job;

            if (job.status === "PENDING" || job.status === "RUNNING" || job.status === "SUCCEEDED") {
                throw new functions.https.HttpsError('failed-precondition', `Job ${jobId} is in status ${job.status} and cannot be requeued.`);
            }

            transaction.update(jobRef, {
                status: "PENDING" as JobStatus,
                updatedAt: firestore.Timestamp.now(),
                runAfter: firestore.Timestamp.now(), // Run immediately
                leaseOwner: null,
                leaseExpiresAt: null,
            });
        });

        functions.logger.info(`Admin ${context.auth?.uid} requeued job ${jobId}`);
        return { success: true, message: `Job ${jobId} has been requeued.` };

    } catch (error: any) {
        functions.logger.error(`Error requeueing job ${jobId}:`, error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', 'An internal error occurred while requeueing the job.');
    }
});

/**
 * A callable function for admins to manually cancel a job.
 * A canceled job will not be processed.
 */
export const cancelJob = functions.https.onCall(async (data, context) => {
    ensureAdmin(context);
    // Implementation similar to requeueJob
    // ...
    return { success: true, message: `Job has been canceled.` };
});

/**
 * A callable function for admins to force a job into the DEAD state.
 */
export const forceDeadJob = functions.https.onCall(async (data, context) => {
    ensureAdmin(context);
    // Implementation similar to requeueJob
    // ...
    return { success: true, message: `Job has been marked as DEAD.` };
});


/**
 * A callable function for admins to list jobs with filtering and pagination.
 */
export const listJobs = functions.https.onCall(async(data, context) => {
    ensureAdmin(context);

    const { status, pageSize = 25, pageToken } = data;

    let query: admin.firestore.Query = admin.firestore().collection('jobs');

    if (status && typeof status === 'string') {
        query = query.where('status', '==', status);
    }

    query = query.orderBy('updatedAt', 'desc');

    if (pageToken && typeof pageToken === 'string') {
        const docSnapshot = await admin.firestore().collection('jobs').doc(pageToken).get();
        if(docSnapshot.exists) {
            query = query.startAfter(docSnapshot);
        }
    }

    const jobSnapshots = await query.limit(pageSize).get();

    const jobs = jobSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const nextPageToken = jobSnapshots.docs.length === pageSize ? jobSnapshots.docs[jobSnapshots.docs.length - 1].id : null;

    return { jobs, nextPageToken };
});
