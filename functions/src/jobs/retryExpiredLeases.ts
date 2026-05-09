import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ulid } from 'ulid';
import { Job, JobQueueEntry } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 5 * 1000;

export const retryExpiredLeases = onSchedule('every 1 minutes', async (context) => {
    const db = getFirestore();
    const tickWorkerId = `retry-${ulid()}`;

    console.log(`[${tickWorkerId}] Starting expired lease check...`);

    const now = new Date();

    // Query the queue for items that are leased and expired.
    // processQueueTick writes lease.expiresAt as a Date, which Firestore stores as a Timestamp.
    const expiredLeaseQuery = db.collection('jobQueue')
        .where('status', '==', 'LEASED')
        .where('lease.expiresAt', '<', now);

    const snapshot = await expiredLeaseQuery.get();

    if (snapshot.empty) {
        console.log(`[${tickWorkerId}] No expired leases found.`);
        return;
    }

    console.log(`[${tickWorkerId}] Found ${snapshot.size} expired lease(s).`);

    const retryPromises = snapshot.docs.map(async (queueDoc) => {
        const queueEntry = queueDoc.data() as JobQueueEntry;
        const jobId = queueEntry.jobId;

        try {
            await db.runTransaction(async (transaction) => {
                const jobRef = jobDoc(jobId);
                const queueRef = jobQueueEntryDoc(jobId);

                const jobSnapshot = await transaction.get(jobRef);
                if (!jobSnapshot.exists) {
                    console.error(`[${tickWorkerId}] Job ${jobId} not found for expired queue entry. Cleaning up queue.`);
                    transaction.update(queueRef, { status: 'DONE', updatedAt: FieldValue.serverTimestamp() });
                    return;
                }
                const job = jobSnapshot.data() as Job;

                if (['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED'].includes(job.status)) {
                    console.log(`[${tickWorkerId}] Job ${jobId} is already in terminal state '${job.status}'. Cleaning up queue entry.`);
                    transaction.update(queueRef, { status: 'DONE', updatedAt: FieldValue.serverTimestamp() });
                    return;
                }

                const currentRetryCount = job.retryCount || 0;
                const maxRetries = job.execution?.maxAttempts ?? MAX_RETRIES;

                console.warn(`[${tickWorkerId}] Expired lease detected for job ${jobId}. Retry attempt ${currentRetryCount + 1}.`);

                if (currentRetryCount >= maxRetries) {
                    console.error(`[${tickWorkerId}] Job ${jobId} has exceeded max retries (${maxRetries}). Moving to FAILED.`);
                    const failureUpdate = {
                        status: 'FAILED',
                        lease: FieldValue.delete(),
                        'execution.error': 'Job failed after exceeding max retry count due to expired leases.',
                        updatedAt: FieldValue.serverTimestamp(),
                    };
                    transaction.update(jobRef, failureUpdate);
                    transaction.update(queueRef, { status: 'DONE', updatedAt: FieldValue.serverTimestamp() });
                } else {
                    console.log(`[${tickWorkerId}] Re-queueing job ${jobId}.`);
                    const newAvailableAt = new Date(Date.now() + RETRY_BACKOFF_MS * (currentRetryCount + 1));

                    const requeueJobUpdate = {
                        status: 'PENDING',
                        retryCount: FieldValue.increment(1),
                        lease: FieldValue.delete(),
                        updatedAt: FieldValue.serverTimestamp(),
                    };
                    const requeueQueueUpdate = {
                        status: 'PENDING',
                        availableAt: newAvailableAt,
                        lease: FieldValue.delete(),
                        updatedAt: FieldValue.serverTimestamp(),
                    };
                    transaction.update(jobRef, requeueJobUpdate);
                    transaction.update(queueRef, requeueQueueUpdate);
                }
            });
        } catch (error) {
            console.error(`[${tickWorkerId}] CRITICAL: Failed to process expired lease for job ${jobId}:`, error);
        }
    });

    await Promise.all(retryPromises);
    console.log(`[${tickWorkerId}] Finished expired lease check.`);
});
