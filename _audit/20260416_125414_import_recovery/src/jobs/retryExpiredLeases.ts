import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createLog } from '../core/logging.js.js.js.js';
import { handleJobFailure } from './handleJobFailure.js.js.js.js';
import { updateQueue } from '../core/lease.js.js.js.js';
import { JobDoc } from '../core/types.js.js.js.js';

const db = admin.firestore();

export const retryExpiredLeases = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  const query = db.collection('jobQueue')
    .where('status', '==', 'LEASED')
    .where('leaseExpiresAt', '<=', now);

  const snapshot = await query.get();
  if (snapshot.empty) {
    return;
  }

  for (const doc of snapshot.docs) {
    const queueDoc = doc.data();
    const jobId = queueDoc.jobId;

    try {
      const jobRef = db.collection('jobs').doc(jobId);
      const jobDoc = (await jobRef.get()).data() as JobDoc;

      if (['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED'].includes(jobDoc.status)) {
        // Job is already in a terminal state, just clean up the queue item
        await updateQueue(jobId, { status: 'DONE' });
        continue;
      }

      await createLog(
        jobDoc.tenantId,
        'WARN',
        'SYSTEM',
        'ExpiredLeaseFound',
        `Job ${jobId} has an expired lease. Attempting to requeue or fail.`
      );
      
      // Re-use the failure handler to determine if it should be retried or moved to dead-letter
      await handleJobFailure(jobId, new Error('Lease expired and job was not completed.'));

    } catch (error) {
      console.error(`Failed to process expired lease for job ${jobId}:`, error);
    }
  }
});
