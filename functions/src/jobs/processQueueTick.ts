import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { ulid } from 'ulid';
import type { Job, JobQueueEntry, JobQueueStatus, JobLease } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { canRequeueUnstartedLease, isTerminalJobStatus } from './executionGuards.js';

const MAX_JOBS_TO_LEASE_PER_TICK = 10;
const MAX_EXPIRED_LEASES_TO_RECOVER_PER_TICK = 10;
const JOB_EXECUTION_TOPIC = process.env.PUBSUB_JOB_EXECUTION_TOPIC || 'job-execution';
const LEASE_DURATION_MS = 60 * 1000;

const pubsub = new PubSub();

function createLease(workerId: string): JobLease {
  const leaseId = ulid();
  const leaseToken = ulid();
  const now = new Date();

  return {
    leaseId,
    leaseToken,
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

function safeErrorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

async function recoverExpiredUnstartedLeases(): Promise<number> {
  const db = getFirestore();
  const nowDate = new Date();
  const snapshot = await db.collection('jobQueue')
    .where('status', '==', 'LEASED')
    .where('lease.expiresAt', '<=', nowDate)
    .orderBy('lease.expiresAt')
    .limit(MAX_EXPIRED_LEASES_TO_RECOVER_PER_TICK)
    .get();

  let recovered = 0;
  for (const queueSnapshot of snapshot.docs) {
    const queueData = queueSnapshot.data() as JobQueueEntry;
    const jobId = String(queueData.jobId || queueSnapshot.id);

    const outcome = await db.runTransaction(async (transaction) => {
      const queueRef = jobQueueEntryDoc(jobId);
      const masterJobRef = jobDoc(jobId);
      const [currentQueueSnapshot, currentJobSnapshot] = await Promise.all([
        transaction.get(queueRef),
        transaction.get(masterJobRef),
      ]);

      if (!currentQueueSnapshot.exists) return 'missing-queue' as const;
      const currentQueue = currentQueueSnapshot.data() as JobQueueEntry;
      const leaseToken = String(currentQueue.lease?.leaseToken || '');
      const leaseExpiresAt = currentQueue.lease?.expiresAt as { toMillis?: () => number } | Date | undefined;
      const expiresAtMs = leaseExpiresAt instanceof Date
        ? leaseExpiresAt.getTime()
        : typeof leaseExpiresAt?.toMillis === 'function'
          ? leaseExpiresAt.toMillis()
          : Number.NaN;

      if (currentQueue.status !== 'LEASED' || !leaseToken || !Number.isFinite(expiresAtMs) || expiresAtMs > Date.now()) {
        return 'not-expired' as const;
      }

      const now = FieldValue.serverTimestamp();
      if (!currentJobSnapshot.exists) {
        transaction.set(queueRef, {
          status: 'DEAD',
          lease: FieldValue.delete(),
          updatedAt: now,
          'dispatch.lastError': 'Master job document is missing during lease recovery.',
          'dispatch.recoveredAt': now,
        }, { merge: true });
        return 'dead-missing-job' as const;
      }

      const currentJob = currentJobSnapshot.data() as Job;
      if (isTerminalJobStatus(currentJob.status)) {
        transaction.set(queueRef, {
          status: terminalQueueStatus(currentJob.status),
          lease: FieldValue.delete(),
          updatedAt: now,
          'dispatch.recoveredAt': now,
        }, { merge: true });
        return 'reconciled-terminal' as const;
      }

      if (!canRequeueUnstartedLease(currentJob, currentQueue, leaseToken)) {
        return 'unsafe-to-requeue' as const;
      }

      const requeueUpdate = {
        status: 'PENDING' as const,
        availableAt: nowDate,
        lease: FieldValue.delete(),
        updatedAt: now,
        'dispatch.recoveryCount': FieldValue.increment(1),
        'dispatch.recoveredAt': now,
        'dispatch.lastError': 'Expired before execution dispatch started.',
      };
      transaction.set(queueRef, requeueUpdate, { merge: true });
      transaction.set(masterJobRef, requeueUpdate, { merge: true });
      return 'requeued' as const;
    });

    if (outcome === 'requeued') recovered += 1;
    console.log(`[lease-recovery] ${jobId}: ${outcome}`);
  }

  return recovered;
}

async function compensatePublishFailure(jobId: string, leaseToken: string, error: unknown): Promise<boolean> {
  const db = getFirestore();
  const errorMessage = safeErrorMessage(error);
  return db.runTransaction(async (transaction) => {
    const queueRef = jobQueueEntryDoc(jobId);
    const masterJobRef = jobDoc(jobId);
    const [queueSnapshot, jobSnapshot] = await Promise.all([
      transaction.get(queueRef),
      transaction.get(masterJobRef),
    ]);
    if (!queueSnapshot.exists || !jobSnapshot.exists) return false;

    const queueEntry = queueSnapshot.data() as JobQueueEntry;
    const job = jobSnapshot.data() as Job;
    if (!canRequeueUnstartedLease(job, queueEntry, leaseToken)) return false;

    const now = FieldValue.serverTimestamp();
    const update = {
      status: 'PENDING' as const,
      availableAt: new Date(),
      lease: FieldValue.delete(),
      updatedAt: now,
      'dispatch.lastError': errorMessage,
      'dispatch.failedAt': now,
      'dispatch.recoveryCount': FieldValue.increment(1),
    };
    transaction.set(queueRef, update, { merge: true });
    transaction.set(masterJobRef, update, { merge: true });
    return true;
  });
}

async function recordPublishedMessage(jobId: string, leaseToken: string, messageId: string): Promise<void> {
  const db = getFirestore();
  await db.runTransaction(async (transaction) => {
    const queueRef = jobQueueEntryDoc(jobId);
    const masterJobRef = jobDoc(jobId);
    const [queueSnapshot, jobSnapshot] = await Promise.all([
      transaction.get(queueRef),
      transaction.get(masterJobRef),
    ]);
    if (!queueSnapshot.exists || !jobSnapshot.exists) return;
    const queueEntry = queueSnapshot.data() as JobQueueEntry;
    const job = jobSnapshot.data() as Job;
    if (!canRequeueUnstartedLease(job, queueEntry, leaseToken)) return;

    const now = FieldValue.serverTimestamp();
    const update = {
      'dispatch.messageId': messageId,
      'dispatch.publishedAt': now,
      'dispatch.lastError': FieldValue.delete(),
      updatedAt: now,
    };
    transaction.set(queueRef, update, { merge: true });
    transaction.set(masterJobRef, update, { merge: true });
  });
}

export const processQueueTick = onSchedule('every 1 minutes', async () => {
  const db = getFirestore();
  const tickWorkerId = `tick-${ulid()}`;

  console.log(`Starting queue processing tick with worker ID: ${tickWorkerId}`);
  const recovered = await recoverExpiredUnstartedLeases();
  if (recovered > 0) {
    console.warn(`[${tickWorkerId}] Requeued ${recovered} expired lease(s) that never entered RUNNING.`);
  }

  const pendingJobsQuery = db.collection('jobQueue')
    .where('status', '==', 'PENDING')
    .where('availableAt', '<=', new Date())
    .orderBy('availableAt')
    .limit(MAX_JOBS_TO_LEASE_PER_TICK);

  const pendingJobsSnapshot = await pendingJobsQuery.get();

  if (pendingJobsSnapshot.empty) {
    console.log('No pending jobs found for this tick.');
    return;
  }

  console.log(`Found ${pendingJobsSnapshot.size} pending job(s). Attempting to lease.`);

  const leasePromises = pendingJobsSnapshot.docs.map(async (doc) => {
    const { jobId } = doc.data() as JobQueueEntry;
    let leasedToken: string | null = null;

    try {
      const lease = await db.runTransaction(async (transaction) => {
        const queueRef = jobQueueEntryDoc(jobId);
        const masterJobRef = jobDoc(jobId);
        const [queueDoc, masterJobDoc] = await Promise.all([
          transaction.get(queueRef),
          transaction.get(masterJobRef),
        ]);
        if (!queueDoc.exists || queueDoc.data()?.status !== 'PENDING') {
          return null;
        }
        if (!masterJobDoc.exists) {
          transaction.set(queueRef, {
            status: 'DEAD',
            lease: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
            'dispatch.lastError': 'Master job document is missing during lease acquisition.',
          }, { merge: true });
          return null;
        }

        const masterJob = masterJobDoc.data() as Job;
        if (isTerminalJobStatus(masterJob.status)) {
          transaction.set(queueRef, {
            status: terminalQueueStatus(masterJob.status),
            lease: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          return null;
        }
        if (masterJob.status !== 'PENDING') {
          return null;
        }

        const newLease = createLease(tickWorkerId);
        const now = FieldValue.serverTimestamp();
        const leaseUpdate = {
          status: 'LEASED' as const,
          lease: newLease,
          updatedAt: now,
          'dispatch.attemptCount': FieldValue.increment(1),
          'dispatch.lastAttemptAt': now,
          'dispatch.lastError': FieldValue.delete(),
        };

        transaction.set(queueRef, leaseUpdate, { merge: true });
        transaction.set(masterJobRef, leaseUpdate, { merge: true });
        return newLease;
      });

      if (!lease?.leaseToken) return;
      leasedToken = lease.leaseToken;
      const messageId = await pubsub.topic(JOB_EXECUTION_TOPIC).publishMessage({
        json: { jobId, leaseToken: lease.leaseToken },
      });
      await recordPublishedMessage(jobId, lease.leaseToken, messageId);
      console.log(`[${tickWorkerId}] Published execution message ${messageId} for job ${jobId}`);
    } catch (error) {
      console.error(`[${tickWorkerId}] Critical error leasing or publishing job ${jobId}.`, error);
      if (leasedToken) {
        const compensated = await compensatePublishFailure(jobId, leasedToken, error).catch((compensationError) => {
          console.error(`[${tickWorkerId}] Failed to compensate publish failure for ${jobId}.`, compensationError);
          return false;
        });
        console.warn(`[${tickWorkerId}] Publish failure compensation for ${jobId}: ${compensated ? 'requeued' : 'not-applied'}`);
      }
    }
  });

  await Promise.all(leasePromises);
  console.log(`Finished queue processing tick: ${tickWorkerId}`);
});
