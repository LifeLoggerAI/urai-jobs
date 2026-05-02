// URAI-JOBS: Queue Claim / Lease Processor
// Version: 1.0.0

import * as functions from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { jobDoc, jobQueueCollection, jobQueueEntryDoc } from '../core/firestore-paths.js.js';
import { createLease } from '../core/lease.js.js';

const MAX_JOBS_TO_LEASE_PER_TICK = 10;

/**
 * This scheduled function runs periodically to find PENDING jobs in the queue
 * and lease them for processing.
 */
export const processQueueTick = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    const db = getFirestore();
    const functionExecutionId = context.eventId;

    console.log('Starting queue processing tick...');

    const pendingJobsQuery = jobQueueCollection()
        .where('status', '==', 'PENDING')
        .orderBy('createdAt')
        .limit(MAX_JOBS_TO_LEASE_PER_TICK);

    const pendingJobsSnapshot = await pendingJobsQuery.get();

    if (pendingJobsSnapshot.empty) {
        console.log('No pending jobs found.');
        return;
    }

    console.log(`Found ${pendingJobsSnapshot.size} pending job(s). Attempting to lease.`);

    const leasePromises = pendingJobsSnapshot.docs.map((doc) => {
        const { jobId } = doc.data();

        return db.runTransaction(async (transaction) => {
            const queueRef = jobQueueEntryDoc(jobId);
            const masterJobRef = jobDoc(jobId);

            const queueDoc = await transaction.get(queueRef);
            if (!queueDoc.exists || queueDoc.data()?.status !== 'PENDING') {
                console.log(`Job ${jobId} is no longer available for lease. Skipping.`);
                return;
            }

            const lease = createLease(functionExecutionId);
            const update = {
                status: 'LEASED',
                lease,
                updatedAt: FieldValue.serverTimestamp(),
            };

            transaction.update(queueRef, update);
            transaction.update(masterJobRef, update);

            console.log(`Successfully leased job ${jobId} with lease ${lease.leaseId}`);
        }).catch((error) => {
            console.error(`Failed to lease job ${jobId}.`, error);
        });
    });

    await Promise.all(leasePromises);

    console.log('Finished queue processing tick.');
});

