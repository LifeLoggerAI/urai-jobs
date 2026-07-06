import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ulid } from 'ulid';
import type { Job, JobQueueEntry, JobQueueStatus } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { canRequeueUnstartedLease, isTerminalJobStatus } from './executionGuards.js';

const MAX_RETRIES = 3;
const MAX_EXPIRED_LEASES_PER_TICK = 20;
const RETRY_BACKOFF_MS = 5 * 1000;

function terminalQueueStatus(status: unknown): JobQueueStatus {
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'DEAD') return 'DEAD';
  return 'DONE';
}

function leaseExpiryMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  return Number.NaN;
}

export const retryExpiredLeases = onSchedule('every 1 minutes', async () => {
  const db = getFirestore();
  const tickWorkerId = `retry-${ulid()}`;
  const observedAt = new Date();

  console.log(`[${tickWorkerId}] Starting expired unstarted lease check.`);

  const snapshot = await db.collection('jobQueue')
    .where('status', '==', 'LEASED')
    .where('lease.expiresAt', '<=', observedAt)
    .orderBy('lease.expiresAt')
    .limit(MAX_EXPIRED_LEASES_PER_TICK)
    .get();

  if (snapshot.empty) {
    console.log(`[${tickWorkerId}] No expired unstarted leases found.`);
    return;
  }

  console.log(`[${tickWorkerId}] Found ${snapshot.size} expired lease candidate(s).`);

  for (const candidate of snapshot.docs) {
    const candidateData = candidate.data() as JobQueueEntry;
    const jobId = String(candidateData.jobId || candidate.id);

    try {
      const outcome = await db.runTransaction(async (transaction) => {
        const jobRef = jobDoc(jobId);
        const queueRef = jobQueueEntryDoc(jobId);
        const [queueSnapshot, jobSnapshot] = await Promise.all([
          transaction.get(queueRef),
          transaction.get(jobRef),
        ]);

        if (!queueSnapshot.exists) return 'missing-queue' as const;
        const queueEntry = queueSnapshot.data() as JobQueueEntry;
        const leaseToken = String(queueEntry.lease?.leaseToken || '');
        const expiresAtMs = leaseExpiryMillis(queueEntry.lease?.expiresAt);
        if (
          queueEntry.status !== 'LEASED'
          || !leaseToken
          || !Number.isFinite(expiresAtMs)
          || expiresAtMs > Date.now()
        ) {
          return 'no-longer-expired' as const;
        }

        const now = FieldValue.serverTimestamp();
        if (!jobSnapshot.exists) {
          transaction.set(queueRef, {
            status: 'DEAD',
            lease: FieldValue.delete(),
            updatedAt: now,
            'dispatch.lastError': 'Master job document is missing during expired-lease recovery.',
            'dispatch.recoveredAt': now,
          }, { merge: true });
          return 'dead-missing-job' as const;
        }

        const job = jobSnapshot.data() as Job;
        if (isTerminalJobStatus(job.status)) {
          transaction.set(queueRef, {
            status: terminalQueueStatus(job.status),
            lease: FieldValue.delete(),
            updatedAt: now,
            'dispatch.recoveredAt': now,
          }, { merge: true });
          return 'reconciled-terminal' as const;
        }

        if (!canRequeueUnstartedLease(job, queueEntry, leaseToken)) {
          return 'unsafe-to-requeue' as const;
        }

        const currentRetryCount = Number(job.retryCount || 0);
        const maxRetries = Number(job.execution?.maxAttempts || job.maxAttempts || MAX_RETRIES);
        if (!Number.isInteger(maxRetries) || maxRetries < 1) {
          transaction.set(jobRef, {
            status: 'DEAD',
            lease: FieldValue.delete(),
            error: { message: 'Invalid max-attempt policy during expired-lease recovery.' },
            updatedAt: now,
            completedAt: now,
          }, { merge: true });
          transaction.set(queueRef, {
            status: 'DEAD',
            lease: FieldValue.delete(),
            updatedAt: now,
          }, { merge: true });
          return 'dead-invalid-policy' as const;
        }

        if (currentRetryCount >= maxRetries) {
          transaction.set(jobRef, {
            status: 'DEAD',
            lease: FieldValue.delete(),
            error: { message: `Job exceeded ${maxRetries} expired-lease recoveries before execution started.` },
            updatedAt: now,
            completedAt: now,
            'dispatch.recoveredAt': now,
          }, { merge: true });
          transaction.set(queueRef, {
            status: 'DEAD',
            lease: FieldValue.delete(),
            updatedAt: now,
            'dispatch.recoveredAt': now,
          }, { merge: true });
          return 'dead-max-retries' as const;
        }

        const nextRetryCount = currentRetryCount + 1;
        const nextAvailableAt = new Date(Date.now() + RETRY_BACKOFF_MS * nextRetryCount);
        transaction.set(jobRef, {
          status: 'PENDING',
          retryCount: nextRetryCount,
          lease: FieldValue.delete(),
          updatedAt: now,
          'dispatch.recoveryCount': FieldValue.increment(1),
          'dispatch.recoveredAt': now,
          'dispatch.lastError': 'Lease expired before execution entered RUNNING.',
        }, { merge: true });
        transaction.set(queueRef, {
          status: 'PENDING',
          availableAt: nextAvailableAt,
          retryCount: nextRetryCount,
          lease: FieldValue.delete(),
          updatedAt: now,
          'dispatch.recoveryCount': FieldValue.increment(1),
          'dispatch.recoveredAt': now,
          'dispatch.lastError': 'Lease expired before execution entered RUNNING.',
        }, { merge: true });
        return 'requeued' as const;
      });

      console.log(`[${tickWorkerId}] ${jobId}: ${outcome}`);
    } catch (error) {
      console.error(`[${tickWorkerId}] Failed expired-lease recovery for ${jobId}:`, error);
    }
  }

  console.log(`[${tickWorkerId}] Finished expired unstarted lease check.`);
});
