
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { enqueueJob, claimNextJob, completeJob, failJob, cancelJob } from './jobs/engine';
import { handlers } from './jobs/handlers';

admin.initializeApp();

const db = admin.firestore();

// Callable function to enqueue a job
export const jobsEnqueue = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be authenticated to enqueue a job.');
    }
    const isAdmin = (await db.collection('admins').doc(context.auth.uid).get()).exists;
    if (!isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'You must be an admin to enqueue a job.');
    }

    const { type, payload, options } = data;
    if (!type || !handlers[type]) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid job type is required.');
    }

    try {
        const job = await enqueueJob(type, payload, options);
        return { success: true, jobId: job.id };
    } catch (error: any) {
        console.error('Error enqueuing job:', error);
        throw new functions.https.HttpsError('internal', 'An error occurred while enqueuing the job.', { errorMessage: error.message });
    }
});

// Callable function to requeue a job
export const jobsRequeue = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be authenticated to requeue a job.');
    }
     const isAdmin = (await db.collection('admins').doc(context.auth.uid).get()).exists;
    if (!isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'You must be an admin to requeue a job.');
    }

    const { jobId } = data;
    if (!jobId) {
        throw new functions.https.HttpsError('invalid-argument', 'A job ID is required.');
    }

    try {
        const jobRef = db.collection('jobs').doc(jobId);
        await jobRef.update({
            status: 'PENDING',
            updatedAt: admin.firestore.Timestamp.now(),
        });
        return { success: true };
    } catch (error: any) {
        console.error(`Error requeuing job ${jobId}:`, error);
        throw new functions.https.HttpsError('internal', 'An error occurred while requeuing the job.', { errorMessage: error.message });
    }
});

// Callable function to cancel a job
export const jobsCancel = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be authenticated to cancel a job.');
    }
     const isAdmin = (await db.collection('admins').doc(context.auth.uid).get()).exists;
    if (!isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'You must be an admin to cancel a job.');
    }

    const { jobId } = data;
    if (!jobId) {
        throw new functions.https.HttpsError('invalid-argument', 'A job ID is required.');
    }

    try {
        await cancelJob(jobId);
        return { success: true };
    } catch (error: any) {
        console.error(`Error canceling job ${jobId}:`, error);
        throw new functions.https.HttpsError('internal', 'An error occurred while canceling the job.', { errorMessage: error.message });
    }
});

// Callable function to get job stats
export const jobsStats = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be authenticated to view job stats.');
    }
     const isAdmin = (await db.collection('admins').doc(context.auth.uid).get()).exists;
    if (!isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'You must be an admin to view job stats.');
    }

    const dailyStatsRef = db.collection('jobStats').doc(new Date().toISOString().split('T')[0]);
    const doc = await dailyStatsRef.get();
    if (!doc.exists) {
        return { success: true, stats: {} };
    }
    return { success: true, stats: doc.data() };
});


// Scheduled function to run every minute
export const jobsTick = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    const workerId = 'scheduled-worker';
    const supportedTypes = Object.keys(handlers);

    // Reclaim expired leases
    const now = admin.firestore.Timestamp.now();
    const query = db.collection('jobs')
        .where('status', '==', 'RUNNING')
        .where('leaseExpiresAt', '<', now);

    const snapshot = await query.get();
    if (!snapshot.empty) {
        console.log(`Found ${snapshot.docs.length} expired leases to reclaim.`);
        for (const doc of snapshot.docs) {
            await doc.ref.update({
                status: 'PENDING',
                updatedAt: now,
                leaseExpiresAt: null,
                lockedBy: null,
            });
        }
    }


    // Process jobs
    const concurrency = 5; // Process up to 5 jobs at a time
    for (let i = 0; i < concurrency; i++) {
        const job = await claimNextJob(workerId, supportedTypes);
        if (!job) {
            break;
        }

        try {
            const handler = handlers[job.type];
            if (!handler) {
                throw new Error(`No handler found for job type: ${job.type}`);
            }
            const result = await handler(job);
            await completeJob(job.id as string, job.runId, result);
        } catch (error: any) {
            await failJob(job.id as string, job.runId, error);
        }
    }
});
