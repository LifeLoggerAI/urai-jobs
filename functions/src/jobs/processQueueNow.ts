import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { PubSub } from '@google-cloud/pubsub';
import { ulid } from 'ulid';
import type { Job, JobQueueEntry, JobQueueStatus, JobLease } from '@urai-jobs/shared-types';
import { returnLeaseAfterPublishFailure } from '../core/dispatchRecovery.js';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { isTerminalJobStatus } from './executionGuards.js';
import { consentBlockRef, isConsentContext, checkedJobConsentBlockState } from '../privacy/consentBlocks.js';
import { deferLifeMovieJob, LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE, LIFE_MOVIE_CONSENT_RECHECK_DELAY_MS } from '../privacy/lifeMovieConsentGate.js';
import { checkedCurrentJobCaller } from './currentJobCallerAuthority.js';

const JOB_EXECUTION_TOPIC = process.env.PUBSUB_JOB_EXECUTION_TOPIC || 'job-execution';
const LEASE_DURATION_MS = 60 * 1000;
const pubsub = new PubSub();

const callableOptions = {
  region: 'us-central1',
  cors: true,
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function authenticatedOperatorUid(auth: unknown): string {
  if (!auth) throw new HttpsError('unauthenticated', 'Authentication is required.');
  const uid = asRecord(auth).uid;
  if (typeof uid !== 'string' || !uid.trim() || uid !== uid.trim()) {
    throw new HttpsError('unauthenticated', 'Authenticated operator ID is required.');
  }
  return uid;
}

function requireCurrentOperator(auth: unknown, serverUser: unknown): void {
  // Firebase token custom claims can remain stale after a role downgrade.
  if (!checkedCurrentJobCaller(auth, serverUser)?.operator) {
    throw new HttpsError('permission-denied', 'Current admin/operator authority is required.');
  }
}

function normalizeLimit(value: unknown, fallback = 10): number {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(25, Math.floor(raw)));
}

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

export const processQueueNow = onCall(callableOptions, async (request) => {
  const uid = authenticatedOperatorUid(request.auth);
  const db = getFirestore();
  const operatorRef = db.collection('users').doc(uid);
  // Refuse stale token claims before listing queue jobs, even when the queue is empty.
  const initialOperator = await operatorRef.get();
  requireCurrentOperator(request.auth, initialOperator.exists ? initialOperator.data() : null);

  const input = asRecord(request.data);
  const limit = normalizeLimit(input.limit, 10);
  const workerId = `operator-${ulid()}`;

  const pendingJobsSnapshot = await db
    .collection('jobQueue')
    .where('status', '==', 'PENDING')
    .where('availableAt', '<=', new Date())
    .orderBy('availableAt')
    .limit(limit)
    .get();

  const leased: string[] = [];
  const skipped: string[] = [];
  const published: string[] = [];
  const failed: string[] = [];

  for (const doc of pendingJobsSnapshot.docs) {
    const { jobId } = doc.data() as JobQueueEntry;
    if (!jobId) continue;

    const result = await db.runTransaction(async (transaction) => {
      const queueRef = jobQueueEntryDoc(jobId);
      const masterJobRef = jobDoc(jobId);
      const [queueDoc, masterJobDoc, operatorSnapshot] = await Promise.all([
        transaction.get(queueRef),
        transaction.get(masterJobRef),
        transaction.get(operatorRef),
      ]);
      // Same transactional snapshot as the job/lease, so a role withdrawal
      // conflicts with leasing rather than authorizing a stale token.
      requireCurrentOperator(request.auth, operatorSnapshot.exists ? operatorSnapshot.data() : null);

      if (!queueDoc.exists || queueDoc.data()?.status !== 'PENDING') {
        return { lease: null, outcome: 'queue-not-pending' as const };
      }

      const now = FieldValue.serverTimestamp();
      if (!masterJobDoc.exists) {
        transaction.update(queueRef, {
          status: 'DEAD',
          lease: FieldValue.delete(),
          updatedAt: now,
          'dispatch.lastError': 'Master job document is missing during manual queue leasing.',
        });
        return { lease: null, outcome: 'missing-job' as const };
      }

      const job = masterJobDoc.data() as Job;
      if (isTerminalJobStatus(job.status)) {
        transaction.update(queueRef, {
          status: terminalQueueStatus(job.status),
          lease: FieldValue.delete(),
          updatedAt: now,
        });
        return { lease: null, outcome: 'terminal-job' as const };
      }

      if (job.status !== 'PENDING') {
        return { lease: null, outcome: 'master-not-pending' as const };
      }

      if (deferLifeMovieJob(job)) {
        transaction.update(queueRef, {
          availableAt: new Date(Date.now() + LIFE_MOVIE_CONSENT_RECHECK_DELAY_MS),
          updatedAt: now,
          'dispatch.blockedReason': LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE,
        });
        return { lease: null, outcome: 'consent-authority-unavailable' as const };
      }

      const consentContexts = jobConsentContexts(job);
      if (consentContexts === null) {
        transaction.update(queueRef, {
          availableAt: new Date(Date.now() + LIFE_MOVIE_CONSENT_RECHECK_DELAY_MS),
          updatedAt: now,
          'dispatch.blockedReason': 'job_consent_context_unverified',
        });
        return { lease: null, outcome: 'consent-context-unverified' as const };
      }
      if (job.ownerUid && consentContexts.length > 0) {
        const blockSnapshots = await Promise.all(
          consentContexts.map((context) => transaction.get(consentBlockRef(job.ownerUid!, context.purpose)))
        );
        const blockStates = blockSnapshots
          .map((snapshot, index) => ({ state: checkedJobConsentBlockState(snapshot), purpose: consentContexts[index].purpose }));
        // Revocation is conclusive even when another block is malformed.
        const blocked = blockStates.find(({ state }) => state === 'revoked')
          ?? blockStates.find(({ state }) => state === 'unverified');
        if (blocked?.state === 'unverified') {
          transaction.update(queueRef, {
            availableAt: new Date(Date.now() + LIFE_MOVIE_CONSENT_RECHECK_DELAY_MS),
            updatedAt: now,
            'dispatch.blockedReason': 'job_consent_block_unverified',
          });
          return { lease: null, outcome: 'consent-block-unverified' as const };
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
          return { lease: null, outcome: 'consent-revoked' as const };
        }
      }

      const newLease = createLease(workerId);
      const leaseUpdate = {
        status: 'LEASED' as const,
        lease: newLease,
        updatedAt: now,
      };

      transaction.update(queueRef, leaseUpdate);
      transaction.update(masterJobRef, leaseUpdate);
      return { lease: newLease, outcome: 'leased' as const };
    });

    if (!result.lease?.leaseToken) {
      skipped.push(jobId);
      console.log(`[${workerId}] Skipped manual dispatch for ${jobId}: ${result.outcome}.`);
      continue;
    }

    leased.push(jobId);
    try {
      await pubsub.topic(JOB_EXECUTION_TOPIC).publishMessage({
        json: { jobId, leaseToken: result.lease.leaseToken },
      });
      published.push(jobId);
    } catch (error) {
      await returnLeaseAfterPublishFailure(jobId, result.lease.leaseToken, error);
      failed.push(jobId);
      console.error(`[${workerId}] Manual dispatch failed for ${jobId}; lease recovery attempted.`, error);
    }
  }

  return {
    workerId,
    requested: limit,
    found: pendingJobsSnapshot.size,
    leased,
    published,
    failed,
    skipped,
  };
});
