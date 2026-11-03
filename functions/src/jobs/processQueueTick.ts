import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { ulid } from 'ulid';
import type { Job, JobQueueEntry, JobQueueStatus, JobLease } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { canRequeueUnstartedLease, isTerminalJobStatus } from './executionGuards.js';
import { consentBlockRef, isConsentContext, checkedJobConsentBlockState } from '../privacy/consentBlocks.js';
import { deferLifeMovieJob, LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE, LIFE_MOVIE_CONSENT_RECHECK_DELAY_MS } from '../privacy/lifeMovieConsentGate.js';

const MAX_JOBS_TO_LEASE_PER_TICK = 10;
const MAX_DISPATCH_RETRIES = 3;
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

function jobConsentContexts(job: Job) {
  // Existing documents can be malformed even when createJob validated the original request.
  // Never silently discard an invalid consent context and treat it as unblocked.
  const consentValue = (job as unknown as Record<string, unknown>).consent;
  const consentsValue = (job as unknown as Record<string, unknown>).consents;
  if (consentValue !== undefined && !isConsentContext(consentValue)) return null;
  if (consentsValue !== undefined &&
      (!Array.isArray(consentsValue) || consentsValue.length === 0 ||
       consentsValue.some((entry) => !isConsentContext(entry)))) return null;
  if ((consentValue !== undefined || consentsValue !== undefined) &&
      (typeof job.ownerUid !== 'string' || !job.ownerUid.trim())) return null;
  const contexts = [
    ...(isConsentContext(job.consent) ? [job.consent] : []),
    ...(Array.isArray(job.consents) ? job.consents.filter(isConsentContext) : []),
  ];
  const seen = new Set<string>();
  return contexts.filter((context) => {
    const key = `${context.purpose}\n${context.policyVersion}\n${context.decisionReceiptId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

    if (normalizedRetryCount >= MAX_DISPATCH_RETRIES) {
      const terminalError = `Pub/Sub publish failed after ${MAX_DISPATCH_RETRIES + 1} dispatch attempts: ${message}`;
      transaction.update(jobRef, {
        status: 'DEAD',
        retryCount: normalizedRetryCount,
        lease: FieldValue.delete(),
        updatedAt: now,
        completedAt: now,
        result: {
          status: 'DEAD',
          error: { message: terminalError },
          finishedAt: Timestamp.now(),
        },
        'dispatch.recoveryCount': FieldValue.increment(1),
        'dispatch.recoveredAt': now,
        'dispatch.lastError': terminalError,
      });
      transaction.update(queueRef, {
        status: 'DEAD',
        retryCount: normalizedRetryCount,
        lease: FieldValue.delete(),
        updatedAt: now,
        'dispatch.recoveryCount': FieldValue.increment(1),
        'dispatch.recoveredAt': now,
        'dispatch.lastError': terminalError,
      });
      return 'dead-retries-exhausted';
    }

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

async function recordDispatchPublished(
  db: ReturnType<typeof getFirestore>,
  jobId: string,
  leaseToken: string,
): Promise<string> {
  return db.runTransaction(async (transaction) => {
    const queueRef = jobQueueEntryDoc(jobId);
    const jobRef = jobDoc(jobId);
    const [queueSnapshot, jobSnapshot] = await Promise.all([
      transaction.get(queueRef),
      transaction.get(jobRef),
    ]);

    if (!queueSnapshot.exists || !jobSnapshot.exists) return 'missing-state';

    const current = jobSnapshot.data() as Job;
    const queueEntry = queueSnapshot.data() as JobQueueEntry;
    if (current.status === 'RUNNING') {
      return 'already-running';
    }
    if (
      current.lease?.leaseToken !== leaseToken ||
      queueEntry.lease?.leaseToken !== leaseToken
    ) {
      return 'superseded-lease';
    }
    if (current.status !== 'LEASED' || queueEntry.status !== 'LEASED') {
      return 'state-changed';
    }

    const now = FieldValue.serverTimestamp();
    const receipt = {
      'dispatch.publishedAt': now,
      'dispatch.topic': JOB_EXECUTION_TOPIC,
      'dispatch.leaseToken': leaseToken,
      updatedAt: now,
    };
    transaction.update(jobRef, receipt);
    transaction.update(queueRef, receipt);
    return 'recorded';
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

      if (deferLifeMovieJob(job)) {
        transaction.update(queueRef, {
          availableAt: new Date(Date.now() + LIFE_MOVIE_CONSENT_RECHECK_DELAY_MS),
          updatedAt: now,
          'dispatch.blockedReason': LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE,
        });
        return null;
      }

      const consentContexts = jobConsentContexts(job);
      if (consentContexts === null) {
        transaction.update(queueRef, {
          availableAt: new Date(Date.now() + LIFE_MOVIE_CONSENT_RECHECK_DELAY_MS),
          updatedAt: now,
          'dispatch.blockedReason': 'job_consent_context_unverified',
        });
        return null;
      }
      if (job.ownerUid && consentContexts.length > 0) {
        const blockSnapshots = await Promise.all(
          consentContexts.map((context) => transaction.get(consentBlockRef(job.ownerUid!, context.purpose)))
        );
        const blocked = blockSnapshots
          .map((snapshot, index) => ({ state: checkedJobConsentBlockState(snapshot), purpose: consentContexts[index].purpose }))
          .find(({ state }) => state !== 'clear');
        if (blocked?.state === 'unverified') {
          // A malformed/unreadable block is not proof of consent. Leave both
          // job and queue unleased, then retry after central reconciliation.
          transaction.update(queueRef, {
            availableAt: new Date(Date.now() + LIFE_MOVIE_CONSENT_RECHECK_DELAY_MS),
            updatedAt: now,
            'dispatch.blockedReason': 'job_consent_block_unverified',
          });
          return null;
        }
        const blockedPurpose = blocked?.state === 'revoked' ? blocked.purpose : null;
        if (blockedPurpose) {
          transaction.update(masterJobRef, {
            status: 'CANCELLED',
            lease: FieldValue.delete(),
            updatedAt: now,
            completedAt: now,
            error: { message: `Consent revoked for purpose ${blockedPurpose} before queue lease.` },
          });
          transaction.update(queueRef, {
            status: 'CANCELLED',
            lease: FieldValue.delete(),
            updatedAt: now,
            'dispatch.lastError': `Consent revoked for purpose ${blockedPurpose} before queue lease.`,
          });
          return null;
        }
      }

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
      const receiptOutcome = await recordDispatchPublished(db, jobId, leaseToken);
      console.log(
        `[${tickWorkerId}] Published execution message for job ${jobId}; receipt outcome: ${receiptOutcome}.`,
      );
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
