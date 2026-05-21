import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { PubSub } from '@google-cloud/pubsub';
import { ulid } from 'ulid';
import type { JobQueueEntry, JobLease } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';

const JOB_EXECUTION_TOPIC = 'job-execution';
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
  return {
    leaseId: ulid(),
    leaseToken: ulid(),
    workerId,
    expiresAt: new Date(Date.now() + LEASE_DURATION_MS),
  };
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

  for (const doc of pendingJobsSnapshot.docs) {
    const { jobId } = doc.data() as JobQueueEntry;
    if (!jobId) continue;

    const lease = await db.runTransaction(async (transaction) => {
      const queueRef = jobQueueEntryDoc(jobId);
      const masterJobRef = jobDoc(jobId);
      const queueDoc = await transaction.get(queueRef);

      if (!queueDoc.exists || queueDoc.data()?.status !== 'PENDING') {
        skipped.push(jobId);
        return null;
      }

      const newLease = createLease(workerId);
      const now = FieldValue.serverTimestamp();
      const leaseUpdate = {
        status: 'LEASED',
        lease: newLease,
        updatedAt: now,
      };

      transaction.update(queueRef, leaseUpdate);
      transaction.update(masterJobRef, leaseUpdate);
      return newLease;
    });

    if (lease?.leaseToken) {
      leased.push(jobId);
      await pubsub.topic(JOB_EXECUTION_TOPIC).publishMessage({
        json: { jobId, leaseToken: lease.leaseToken },
      });
      published.push(jobId);
    }
  }

  return {
    workerId,
    requested: limit,
    found: pendingJobsSnapshot.size,
    leased,
    published,
    skipped,
  };
});
