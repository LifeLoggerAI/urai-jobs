// URAI-JOBS: System Reconciliation (Retry, Dead-letter, Lease Recovery)
// Version: 1.1.0

import * as functions from 'firebase-functions/v1';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { jobDoc, jobQueueCollection, jobQueueEntryDoc, jobsCollection } from '../core/firestore-paths.js';

const MAX_RETRIES = 3;
const LEASE_STALE_MINUTES = 10;

function timestampMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const millis = new Date(value).getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
}

function protectedAsyncCallbackPending(job: unknown, nowMillis: number): boolean {
  const record = job && typeof job === 'object'
    ? job as { execution?: unknown }
    : {};
  const execution = record.execution && typeof record.execution === 'object'
    ? record.execution as Record<string, unknown>
    : {};
  if (execution.asyncCallbackPending !== true) return false;
  const deadlineMillis = timestampMillis(execution.callbackDeadlineAt);
  return deadlineMillis !== null && deadlineMillis > nowMillis;
}

/**
 * Resets a job to PENDING or moves it to the DEAD state if retries are exhausted.
 */
async function _resetOrDeadLetterJob(db: FirebaseFirestore.Firestore, jobId: string, reason: string): Promise<void> {
  return db.runTransaction(async (transaction) => {
    const jobRef = jobDoc(jobId);
    const queueRef = jobQueueEntryDoc(jobId);
    const jobSnapshot = await transaction.get(jobRef);
    const jobData = jobSnapshot.data();

    if (!jobData) {
      console.warn(`Cannot reconcile job ${jobId}: master document not found.`);
      transaction.update(queueRef, { status: 'DONE', updatedAt: FieldValue.serverTimestamp() });
      return;
    }

    if (protectedAsyncCallbackPending(jobData, Date.now())) {
      console.log(`Skipping stale-runner recovery for ${jobId}: an unexpired asynchronous callback lease is pending.`);
      return;
    }

    const retryCount = Number(jobData.retryCount || 0);

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
        'execution.asyncCallbackPending': false,
        'execution.callbackTokenHash': FieldValue.delete(),
        'execution.callbackLeaseToken': FieldValue.delete(),
        'execution.callbackDeadlineAt': FieldValue.delete(),
        result,
      });
      transaction.update(queueRef, {
        status: 'DEAD',
        lease: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      console.log(`Retrying job ${jobId}. Attempt #${retryCount + 1}. Reason: ${reason}`);
      transaction.update(jobRef, {
        status: 'PENDING',
        updatedAt: FieldValue.serverTimestamp(),
        retryCount: FieldValue.increment(1),
        lease: FieldValue.delete(),
        'execution.asyncCallbackPending': false,
        'execution.callbackTokenHash': FieldValue.delete(),
        'execution.callbackLeaseToken': FieldValue.delete(),
        'execution.callbackDeadlineAt': FieldValue.delete(),
      });
      transaction.update(queueRef, {
        status: 'PENDING',
        lease: FieldValue.delete(),
        availableAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
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
 * Finds RUNNING jobs with stale heartbeats and resets them, except for an
 * explicitly deadline-bound asynchronous callback attempt.
 */
async function reconcileStaleRunners(db: FirebaseFirestore.Firestore): Promise<void> {
  const nowMillis = Date.now();
  const staleThreshold = Timestamp.fromMillis(nowMillis - LEASE_STALE_MINUTES * 60 * 1000);
  const query = jobsCollection()
    .where('status', '==', 'RUNNING')
    .where('lease.heartbeatAt', '<', staleThreshold);

  const snapshot = await query.get();
  if (snapshot.empty) return;

  const recoverable = snapshot.docs.filter((doc) => !protectedAsyncCallbackPending(doc.data(), nowMillis));
  const protectedCount = snapshot.size - recoverable.length;
  if (protectedCount > 0) {
    console.log(`Protected ${protectedCount} asynchronous job(s) with unexpired callback deadlines from stale-runner recovery.`);
  }
  if (recoverable.length === 0) return;

  console.log(`Found ${recoverable.length} recoverable job(s) with stale heartbeats.`);
  const promises = recoverable.map(doc =>
    _resetOrDeadLetterJob(db, doc.id, 'Heartbeat stale').catch(e => console.error(`Error reconciling heartbeat for job ${doc.id}`, e))
  );
  await Promise.all(promises);
}

/**
 * A scheduled function that runs periodically to find and fix stuck jobs.
 */
export const systemReconcile = functions.pubsub.schedule('every 5 minutes').onRun(async () => {
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
