import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { PubSub } from '@google-cloud/pubsub';
import { ulid } from 'ulid';
import type { Job, JobQueueEntry, JobQueueStatus, JobLease } from '@urai-jobs/shared-types';
import { returnLeaseAfterPublishFailure } from '../core/dispatchRecovery.js';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { isTerminalJobStatus } from './executionGuards.js';

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

function rolesToStrings(values: unknown[]): string[] {
  return values.map((value) => String(value));
}

function hasOperatorAccess(auth: unknown): boolean {
  const authRecord = asRecord(auth);
  const token = asRecord(authRecord.token);
  const role = token.role;
  const roles = Array.isArray(token.roles) ? rolesToStrings(token.roles) : [];

  return (
    role === 'admin' ||
    role === 'operator' ||
    token.uraiJobsAdmin === true ||
    roles.includes('admin') ||
    roles.includes('operator')
  );
}

function requireOperator(auth: unknown): void {
  if (!auth) throw new HttpsError('unauthenticated', 'Authentication is required.');
  if (!hasOperatorAccess(auth)) throw new HttpsError('permission-denied', 'Admin/operator access is required.');
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

export const processQueueNow = onCall(callableOptions, async (request) => {
  requireOperator(request.auth);

  const input = asRecord(request.data);
  const limit = normalizeLimit(input.limit, 10);
  const db = getFirestore();
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
      const [queueDoc, masterJobDoc] = await Promise.all([
        transaction.get(queueRef),
        transaction.get(masterJobRef),
      ]);

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
