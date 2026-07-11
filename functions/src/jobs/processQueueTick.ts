import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { ulid } from 'ulid';
import type { Job, JobQueueEntry, JobQueueStatus, JobLease } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { canRequeueUnstartedLease, isTerminalJobStatus } from './executionGuards.js';

const MAX_JOBS_TO_LEASE_PER_TICK = 10;
const JOB_EXECUTION_TOPIC = process.env.PUBSUB_JOB_EXECUTION_TOPIC || 'job-execution';
const LEASE_DURATION_MS = 60 * 1000;
const PUBLISH_RETRY_BACKOFF_MS = 5 * 1000;

const pubsub = new PubSub();

function createLease(workerId: string): JobLease {
  const now = new Date();
  return {
    leaseId: ulid(),
    leaseToken: ulid(),
    workerId,
    expiresAt: new Date(now.getTime() + LEASE_DURATION_MS),
    heartbeatAt: now,
  };
}

function terminalQueueStatus(status: unknown): JobQueueStatus {
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'DEAD') return 'DEAD';
  return 'DONE';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error || 'Unknown Pub/Sub publish failure');
}

async function compensatePublishFailure(
  db: ReturnType<typeof getFirestore>,
  jobId: string,
  leaseToken: string,
  publishError: unknown,
): Promise<string> {
  const message = errorMessage(publishError);

  return db.runTransaction(async (transaction) => {
    const queueRef = jobQueueEntryDoc(jobId);
    const jobRef = jobDoc(jobId);
    const [queueSnapshot, jobSnapshot] = await Promise.all([
      transaction.get(queueRef),
      transaction.get(jobRef),
    ]);

    if (!queueSnapshot.exists) return 'missing-queue';

    const queueEntry = queueSnapshot.data() as JobQueueEntry;
    const queueLeaseToken = String(queueEntry.lease?.leaseToken || '');
    const now = FieldValue.serverTimestamp();

    if (!jobSnapshot.exists) {
      if (queueEntry.status === 'LEASED' && queueLeaseToken === leaseToken) {
        transaction.update(queueRef, {
          status: 'DEAD',
          lease: FieldValue.delete(),
          updatedAt: now,
          'dispatch.lastError': `Pub/Sub publish failed and the master job is missing: ${message}`,
          'dispatch.recoveredAt': now,
        });
        return 'dead-missing-job';
      }
      return 'missing-job-unsafe-to-change';
    }

    const job = jobSnapshot.data() as Job;
    if (isTerminalJobStatus(job.status)) {
      if (queueEntry.status === 'LEASED' && queueLeaseToken === leaseToken) {
        transaction.update(queueRef, {
          status: terminalQueueStatus(job.status),
          lease: FieldValue.delete(),
          updatedAt: now,
          'dispatch.recoveredAt': now,
        });
      }
      return 'reconciled-terminal';
    }

    if (!canRequeueUnstartedLease(job, queueEntry, leaseToken)) {
      return 'unsafe-to-requeue';
    }

    const currentRetryCount = Number(job.retryCount ?? queueEntry.retryCount ?? 0);
    const normalizedRetryCount = Number.isInteger(currentRetryCount) && currentRetryCount >= 0
      ? currentRetryCount
      : 0;
    const nextRetryCount = normalizedRetryCount + 1;
    const availableAt = new Date(
      Date.now() + PUBLISH_RETRY_BACKOFF_MS * Math.min(nextRetryCount, 12),
    );

    transaction.update(jobRef, {
      status: 'PENDING',
      retryCount: nextRetryCount,
      lease: FieldValue.delete(),
      updatedAt: now,
      'dispatch.recoveryCount': FieldValue.increment(1),
      'dispatch.recoveredAt': now,
      'dispatch.lastError': `Pub/Sub publish failed before execution started: ${message}`,
    });
    transaction.update(queueRef, {
      status: 'PENDING',
      availableAt,
      retryCount: nextRetryCount,
      lease: FieldValue.delete(),
      updatedAt: now,
      'dispatch.recoveryCount': FieldValue.increment(1),
      'dispatch.recoveredAt': now,
      'dispatch.lastError': `Pub/Sub publish failed before execution started: ${message}`,
    });

    return 'requeued';
  });
}

export const processQueueTick = onSchedule('every 1 minutes', async () => {
  const db = getFirestore();
  const tickWorkerId = `tick-${ulid()}`;

  console.log(`[${tickWorkerId}] Starting queue processing tick.`);

  const pendingJobsSnapshot = await db
    .collection('jobQueue')
    .where('status', '==', 'PENDING')
    .where('availableAt', '<=', new Date())
    .orderBy('availableAt')
    .limit(MAX_JOBS_TO_LEASE_PER_TICK)
    .get();

  if (pendingJobsSnapshot.empty) {
    console.log(`[${tickWorkerId}] No pending jobs found.`);
    return;
  }

  console.log(`[${tickWorkerId}] Found ${pendingJobsSnapshot.size} pending job(s).`);

  await Promise.all(pendingJobsSnapshot.docs.map(async (candidate) => {
    const candidateData = candidate.data() as JobQueueEntry;
    const jobId = String(candidateData.jobId || candidate.id);

    const lease = await db.runTransaction(async (transaction) => {
      const queueRef = jobQueueEntryDoc(jobId);
      const masterJobRef = jobDoc(jobId);
      const [queueSnapshot, jobSnapshot] = await Promise.all([
        transaction.get(queueRef),
        transaction.get(masterJobRef),
      ]);

      if (!queueSnapshot.exists || queueSnapshot.data()?.status !== 'PENDING') {
        return null;
      }

      const now = FieldValue.serverTimestamp();
      if (!jobSnapshot.exists) {
        transaction.update(queueRef, {
          status: 'DEAD',
          updatedAt: now,
          'dispatch.lastError': 'Master job document is missing during queue leasing.',
        });
        return null;
      }

      const job = jobSnapshot.data() as Job;
      if (isTerminalJobStatus(job.status)) {
        transaction.update(queueRef, {
          status: terminalQueueStatus(job.status),
          lease: FieldValue.delete(),
          updatedAt: now,
        });
        return null;
      }
      if (job.status !== 'PENDING') return null;

      const newLease = createLease(tickWorkerId);
      const leaseUpdate = {
        status: 'LEASED' as const,
        lease: newLease,
        updatedAt: now,
      };

      transaction.update(queueRef, leaseUpdate);
      transaction.update(masterJobRef, leaseUpdate);
      return newLease;
    });

    const leaseToken = String(lease?.leaseToken || '');
    if (!leaseToken) return;

    try {
      await pubsub.topic(JOB_EXECUTION_TOPIC).publishMessage({
        json: { jobId, leaseToken },
      });
      console.log(`[${tickWorkerId}] Published execution message for job ${jobId}.`);
    } catch (error) {
      const outcome = await compensatePublishFailure(db, jobId, leaseToken, error);
      console.error(
        `[${tickWorkerId}] Pub/Sub publish failed for ${jobId}; compensation outcome: ${outcome}.`,
        error,
      );
      throw error;
    }
  }));

  console.log(`[${tickWorkerId}] Finished queue processing tick.`);
});
