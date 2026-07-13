// URAI-JOBS: System Reconciliation (Retry, Dead-letter, Lease Recovery)
// Version: 1.2.0

import * as functions from 'firebase-functions/v1';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Job, JobQueueEntry } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc, jobsCollection } from '../core/firestore-paths.js';

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

function protectedAsyncCallbackPending(job: unknown, expectedLeaseToken: string, nowMillis: number): boolean {
  const record = job && typeof job === 'object'
    ? job as { execution?: unknown }
    : {};
  const execution = record.execution && typeof record.execution === 'object'
    ? record.execution as Record<string, unknown>
    : {};
  if (execution.asyncCallbackPending !== true) return false;
  if (String(execution.callbackLeaseToken || '') !== expectedLeaseToken) return false;
  const deadlineMillis = timestampMillis(execution.callbackDeadlineAt);
  return deadlineMillis !== null && deadlineMillis > nowMillis;
}

async function resetOrDeadLetterStaleRunner(
  db: FirebaseFirestore.Firestore,
  jobId: string,
  expectedLeaseToken: string,
  staleBeforeMillis: number,
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const jobRef = jobDoc(jobId);
    const queueRef = jobQueueEntryDoc(jobId);
    const [jobSnapshot, queueSnapshot] = await Promise.all([
      transaction.get(jobRef),
      transaction.get(queueRef),
    ]);

    if (!jobSnapshot.exists) {
      if (queueSnapshot.exists) {
        const queue = queueSnapshot.data() as JobQueueEntry;
        if (queue.status === 'RUNNING' && queue.lease?.leaseToken === expectedLeaseToken) {
          transaction.update(queueRef, {
            status: 'DEAD',
            lease: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
            'dispatch.lastError': 'Master job document is missing during stale-runner recovery.',
          });
        }
      }
      return;
    }

    const job = jobSnapshot.data() as Job;
    const queue = queueSnapshot.exists ? queueSnapshot.data() as JobQueueEntry : null;
    const heartbeatMillis = timestampMillis(job.lease?.heartbeatAt);

    if (
      job.status !== 'RUNNING' ||
      job.lease?.leaseToken !== expectedLeaseToken ||
      heartbeatMillis === null ||
      heartbeatMillis > staleBeforeMillis
    ) {
      return;
    }

    if (
      !queue ||
      queue.status !== 'RUNNING' ||
      queue.lease?.leaseToken !== expectedLeaseToken
    ) {
      return;
    }

    if (protectedAsyncCallbackPending(job, expectedLeaseToken, Date.now())) {
      console.log(`Skipping stale-runner recovery for ${jobId}: an unexpired asynchronous callback lease is pending.`);
      return;
    }

    const retryCount = Number(job.retryCount || 0);
    const now = FieldValue.serverTimestamp();

    if (retryCount >= MAX_RETRIES) {
      console.warn(`Job ${jobId} has exhausted all retries. Moving to DEAD state. Reason: Heartbeat stale`);
      const result = {
        status: 'DEAD',
        error: { message: `Job failed after ${MAX_RETRIES + 1} attempts. Last reason: Heartbeat stale` },
        finishedAt: Timestamp.now(),
      };
      transaction.update(jobRef, {
        status: 'DEAD',
        updatedAt: now,
        lease: FieldValue.delete(),
        'execution.leaseToken': FieldValue.delete(),
        'execution.asyncCallbackPending': false,
        'execution.callbackTokenHash': FieldValue.delete(),
        'execution.callbackLeaseToken': FieldValue.delete(),
        'execution.callbackDeadlineAt': FieldValue.delete(),
        result,
      });
      transaction.update(queueRef, {
        status: 'DEAD',
        lease: FieldValue.delete(),
        updatedAt: now,
      });
      return;
    }

    console.log(`Retrying job ${jobId}. Attempt #${retryCount + 1}. Reason: Heartbeat stale`);
    transaction.update(jobRef, {
      status: 'PENDING',
      updatedAt: now,
      retryCount: FieldValue.increment(1),
      lease: FieldValue.delete(),
      'execution.leaseToken': FieldValue.delete(),
      'execution.asyncCallbackPending': false,
      'execution.callbackTokenHash': FieldValue.delete(),
      'execution.callbackLeaseToken': FieldValue.delete(),
      'execution.callbackDeadlineAt': FieldValue.delete(),
    });
    transaction.update(queueRef, {
      status: 'PENDING',
      lease: FieldValue.delete(),
      availableAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Finds RUNNING jobs with stale heartbeats and resets them, except for an
 * explicitly deadline-bound asynchronous callback attempt. LEASED recovery
 * is owned only by retryExpiredLeases to prevent double recovery.
 */
async function reconcileStaleRunners(db: FirebaseFirestore.Firestore): Promise<void> {
  const nowMillis = Date.now();
  const staleBeforeMillis = nowMillis - LEASE_STALE_MINUTES * 60 * 1000;
  const staleThreshold = Timestamp.fromMillis(staleBeforeMillis);
  const query = jobsCollection()
    .where('status', '==', 'RUNNING')
    .where('lease.heartbeatAt', '<', staleThreshold);

  const snapshot = await query.get();
  if (snapshot.empty) return;

  const candidates = snapshot.docs.flatMap((doc) => {
    const job = doc.data() as Job;
    const leaseToken = String(job.lease?.leaseToken || '');
    if (!leaseToken) return [];
    if (protectedAsyncCallbackPending(job, leaseToken, nowMillis)) return [];
    return [{ jobId: doc.id, leaseToken }];
  });

  const protectedCount = snapshot.size - candidates.length;
  if (protectedCount > 0) {
    console.log(`Skipped ${protectedCount} stale snapshot(s) without recoverable exact lease authority.`);
  }
  if (candidates.length === 0) return;

  console.log(`Found ${candidates.length} recoverable job(s) with stale heartbeats.`);
  await Promise.all(candidates.map(({ jobId, leaseToken }) =>
    resetOrDeadLetterStaleRunner(db, jobId, leaseToken, staleBeforeMillis)
      .catch((error) => console.error(`Error reconciling heartbeat for job ${jobId}`, error))
  ));
}

export const systemReconcile = functions.pubsub.schedule('every 5 minutes').onRun(async () => {
  console.log('Starting system reconciliation...');
  const db = getFirestore();
  await reconcileStaleRunners(db);
  console.log('Finished system reconciliation.');
});
