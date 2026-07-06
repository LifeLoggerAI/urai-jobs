import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { CallableContext } from 'firebase-functions/v1/https';
import { z } from 'zod';
import type { Job, JobQueueEntry } from '@urai-jobs/shared-types';
import { withAuthenticatedRole } from '../core/auth.js';
import { httpsError } from '../core/errors.js';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';

const MAX_PAYLOAD_BYTES = parseInt(process.env.URAI_JOBS_MAX_PAYLOAD_BYTES || '', 10) || 32768;
const MAX_CREATE_PER_MINUTE = parseInt(process.env.URAI_JOBS_CREATE_RATE_LIMIT_PER_MINUTE || '', 10) || 10;
const IDEMPOTENCY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const ALLOWED_JOB_TYPE_PATTERNS = [
  /^narrator\.tts$/,
  /^asset[.-]/,
  /^spatial[.-]/,
  /^studio[.-]/,
  /^career\./,
  /^content[.-]/,
  /^storytime\./,
  /^analytics\./,
  /^communications\./,
  /^admin\./,
  /^deployment\./,
  /^proof\./,
];

const CreateJobSchema = z.object({
  jobType: z.string().min(3, 'Job type must be at least 3 characters').max(80),
  payload: z.record(z.any()),
  idempotencyKey: z.string().min(1).max(160).optional(),
});

function payloadSizeBytes(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload ?? {}), 'utf8');
}

function isAllowedJobType(jobType: string): boolean {
  return ALLOWED_JOB_TYPE_PATTERNS.some((pattern) => pattern.test(jobType));
}

function userRecord(user: unknown): Record<string, unknown> {
  return user && typeof user === 'object' ? (user as Record<string, unknown>) : {};
}

function userOrgId(user: unknown): string | null {
  const raw = userRecord(user).orgId;
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

function hasJobCreatePermission(user: unknown): boolean {
  const record = userRecord(user);
  const rawPermissions = record.permissions;
  const permissions = Array.isArray(rawPermissions) ? rawPermissions.map((value) => String(value)) : [];
  return record.role === 'admin' || record.role === 'operator' || permissions.includes('jobs:create');
}

function idempotencyDocumentId(uid: string, jobType: string, idempotencyKey: string): string {
  return createHash('sha256').update(`${uid}\n${jobType}\n${idempotencyKey}`).digest('hex');
}

async function assertCreateRateLimit(uid: string) {
  const db = getFirestore();
  const windowStart = Timestamp.fromMillis(Date.now() - 60_000);
  const recent = await db
    .collection('jobs')
    .where('ownerUid', '==', uid)
    .where('createdAt', '>=', windowStart)
    .limit(MAX_CREATE_PER_MINUTE + 1)
    .get();

  if (recent.size >= MAX_CREATE_PER_MINUTE) {
    throw httpsError('resource-exhausted', 'Job create rate limit exceeded. Try again later.');
  }
}

const handler = async (data: unknown, context: CallableContext, user: unknown) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw httpsError('unauthenticated', 'User must be authenticated.');
  }

  if (!hasJobCreatePermission(user)) {
    throw httpsError('permission-denied', 'User is not allowed to create runtime jobs.');
  }

  const validationResult = CreateJobSchema.safeParse(data);
  if (!validationResult.success) {
    throw httpsError('invalid-argument', 'Invalid job data.', validationResult.error.flatten());
  }

  const { jobType, payload, idempotencyKey } = validationResult.data;
  if (!isAllowedJobType(jobType)) {
    throw httpsError('invalid-argument', `Unsupported job type: ${jobType}`);
  }

  const payloadBytes = payloadSizeBytes(payload);
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    throw httpsError('invalid-argument', `Payload is too large. Max bytes: ${MAX_PAYLOAD_BYTES}`);
  }

  const db = getFirestore();
  const idempotencyRef = idempotencyKey
    ? db.collection('jobIdempotency').doc(idempotencyDocumentId(uid, jobType, idempotencyKey))
    : null;

  if (idempotencyRef) {
    const existing = await idempotencyRef.get();
    const existingJobId = existing.exists ? existing.data()?.jobId : null;
    if (typeof existingJobId === 'string' && existingJobId) {
      return { jobId: existingJobId, deduplicated: true };
    }
  }

  await assertCreateRateLimit(uid);

  const proposedJobId = ulid();
  const orgId = userOrgId(user);
  const newJob: Job = {
    jobId: proposedJobId,
    type: jobType,
    jobType,
    status: 'PENDING',
    payload,
    ownerUid: uid,
    ...(orgId ? { orgId } : {}),
    retryCount: 0,
    execution: {
      attemptCount: 0,
      maxAttempts: 3,
    },
  };
  const newQueueEntry: JobQueueEntry = {
    jobId: proposedJobId,
    jobType,
    status: 'PENDING',
    attemptCount: 0,
  };

  try {
    const outcome = await db.runTransaction(async (transaction) => {
      if (idempotencyRef) {
        const existing = await transaction.get(idempotencyRef);
        const existingJobId = existing.exists ? existing.data()?.jobId : null;
        if (typeof existingJobId === 'string' && existingJobId) {
          return { jobId: existingJobId, created: false };
        }
      }

      const now = FieldValue.serverTimestamp();
      const jobRef = jobDoc(proposedJobId);
      const queueRef = jobQueueEntryDoc(proposedJobId);

      transaction.create(jobRef, {
        ...newJob,
        createdAt: now,
        updatedAt: now,
      });
      transaction.create(queueRef, {
        ...newQueueEntry,
        availableAt: now,
        createdAt: now,
      });

      if (idempotencyRef) {
        transaction.create(idempotencyRef, {
          jobId: proposedJobId,
          ownerUid: uid,
          jobType,
          createdAt: now,
          expiresAt: Timestamp.fromMillis(Date.now() + IDEMPOTENCY_RETENTION_MS),
        });
      }

      return { jobId: proposedJobId, created: true };
    });

    if (!outcome.created) {
      return { jobId: outcome.jobId, deduplicated: true };
    }

    await jobDoc(outcome.jobId).collection('logs').add({
      level: 'info',
      source: 'createJob',
      message: 'Job created and queued by authorized caller.',
      metadata: {
        jobType,
        ownerUid: uid,
        orgId,
        payloadBytes,
        idempotencyProtected: Boolean(idempotencyKey),
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return { jobId: outcome.jobId, deduplicated: false };
  } catch (error: unknown) {
    console.error('Error creating job in transaction:', error);
    throw httpsError('internal', 'Failed to create job.', error instanceof Error ? error.message : String(error));
  }
};

export const createJob = withAuthenticatedRole(['admin', 'operator', 'user'], handler);
