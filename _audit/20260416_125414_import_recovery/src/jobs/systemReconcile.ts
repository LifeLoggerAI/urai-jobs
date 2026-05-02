// URAI-JOBS: System Reconciliation (Retry, Dead-letter, Lease Recovery)
// Version: 1.0.0

import * as functions from 'firebase-functions';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { jobDoc, jobQueueCollection, jobQueueEntryDoc, jobsCollection } from '../core/firestore-paths.js.js.js.js';

const MAX_RETRIES = 3;
const LEASE_STALE_MINUTES = 10; // When a RUNNING job is considered stale

/**
 * Resets a job to PENDING or moves it to the DEAD state if retries are exhausted.
 */
async function _resetOrDeadLetterJob(db: FirebaseFirestore.Firestore, jobId: string, reason: string): Promise<void> {
  return db.runTransaction(async (transaction) => {
    const jobRef = jobDoc(jobId);
    const jobSnapshot = await transaction.get(jobRef);
    const jobData = jobSnapshot.data();

    if (!jobData) {
      console.warn(`Cannot reconcile job ${jobId}: master document not found.`);
      // If the master doc is gone, ensure the queue doc is also gone.
      transaction.delete(jobQueueEntryDoc(jobId));
      return;
    }

    const retryCount = jobData.retryCount || 0;

    if (retryCount >= MAX_RETRIES) {
      console.warn(`Job ${jobId} has exhausted all retries. Moving to DEAD state. Reason: ${reason}`);
      const result = { 
        status: 'DEAD',
        error: { message: `Job failed after ${MAX_RETRIES + 1} attempts. Last reason: ${reason}` },
        finishedAt: Timestamp.now(),
      };
      transaction.update(jobRef, { 
        status: 'DEAD', 
        updatedAt: FieldValue.serverTimestamp(), 
        lease: FieldValue.delete(),
        result,
      });
      transaction.delete(jobQueueEntryDoc(jobId)); // Remove from queue permanently
    } else {
      console.log(`Retrying job ${jobId}. Attempt #${retryCount + 1}. Reason: ${reason}`);
      transaction.update(jobRef, { 
        status: 'PENDING', 
        updatedAt: FieldValue.serverTimestamp(),
        retryCount: FieldValue.increment(1),
        lease: FieldValue.delete(),
      });
      // Also reset the queue entry
      transaction.update(jobQueueEntryDoc(jobId), { 
        status: 'PENDING', 
        lease: FieldValue.delete(),
      });
    }
  });
}

/**
 * Finds LEASED jobs with expired leases and resets them.
 */
async function reconcileExpiredLeases(db: FirebaseFirestore.Firestore): Promise<void> {
  const now = Timestamp.now();
  const query = jobQueueCollection()
    .where('status', '==', 'LEASED')
    .where('lease.expiresAt', '<', now);
  
  const snapshot = await query.get();
  if (snapshot.empty) return;

  console.log(`Found ${snapshot.size} jobs with expired leases.`);
  const promises = snapshot.docs.map(doc => 
    _resetOrDeadLetterJob(db, doc.id, 'Lease expired').catch(e => console.error(`Error reconciling lease for job ${doc.id}`, e))
  );
  await Promise.all(promises);
}

/**
 * Finds RUNNING jobs with stale heartbeats and resets them.
 */
async function reconcileStaleRunners(db: FirebaseFirestore.Firestore): Promise<void> {
  const staleThreshold = Timestamp.fromMillis(Date.now() - LEASE_STALE_MINUTES * 60 * 1000);
  // NOTE: This query requires a composite index on (status, lease.heartbeatAt)
  const query = jobsCollection()
    .where('status', '==', 'RUNNING')
    .where('lease.heartbeatAt', '<', staleThreshold);

  const snapshot = await query.get();
  if (snapshot.empty) return;

  console.log(`Found ${snapshot.size} jobs with stale heartbeats.`);
  const promises = snapshot.docs.map(doc => 
    _resetOrDeadLetterJob(db, doc.id, 'Heartbeat stale').catch(e => console.error(`Error reconciling heartbeat for job ${doc.id}`, e))
  );
  await Promise.all(promises);
}

/**
 * A scheduled function that runs periodically to find and fix stuck jobs.
 */
export const systemReconcile = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  console.log('Starting system reconciliation...');
  const db = getFirestore();

  const results = await Promise.allSettled([
    reconcileExpiredLeases(db),
    reconcileStaleRunners(db),
  ]);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Reconciliation task ${index} failed:`, result.reason);
    }
  });

  console.log('Finished system reconciliation.');
});
