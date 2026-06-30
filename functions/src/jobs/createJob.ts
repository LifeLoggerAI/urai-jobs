import { ulid } from 'ulid';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { CallableContext } from 'firebase-functions/v1/https';
import { z } from 'zod';
import { Job, JobQueueEntry } from '@urai-jobs/shared-types';
import { withAuthenticatedRole, type AuthenticatedUser } from '../core/auth.js';
import { httpsError } from '../core/errors.js';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';

const MAX_PAYLOAD_BYTES = Number(process.env.URAI_JOBS_MAX_PAYLOAD_BYTES || 32768);
const MAX_CREATE_PER_MINUTE = Number(process.env.URAI_JOBS_CREATE_RATE_LIMIT_PER_MINUTE || 10);

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
  idempotencyKey: z.string().max(160).optional(),
});

function payloadSizeBytes(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload ?? {}), 'utf8');
}

function isAllowedJobType(jobType: string): boolean {
  return ALLOWED_JOB_TYPE_PATTERNS.some((pattern) => pattern.test(jobType));
}

function userRecord(user: AuthenticatedUser): Record<string, unknown> {
  return user as unknown as Record<string, unknown>;
}

function userOrgId(user: AuthenticatedUser): string | null {
  const raw = userRecord(user).orgId;
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

function hasJobCreatePermission(user: AuthenticatedUser): boolean {
  const rawPermissions = userRecord(user).permissions;
  const permissions = Array.isArray(rawPermissions) ? rawPermissions.map((value) => String(value)) : [];
  return user.role === 'admin' || user.role === 'operator' || permissions.includes('jobs:create');
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

const handler = async (data: any, context: CallableContext, user: AuthenticatedUser) => {
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

  await assertCreateRateLimit(uid);

  const db = getFirestore();
  const jobId = ulid();
  const now = FieldValue.serverTimestamp();
  const orgId = userOrgId(user);

  const newJob: Job = {
    jobId,
    type: jobType,
    jobType,
    status: 'PENDING',
    payload,
    ownerUid: uid,
    orgId: orgId || undefined,
    retryCount: 0,
    execution: {
      attemptCount: 0,
      maxAttempts: 3,
    },
  };

  const newQueueEntry: JobQueueEntry = {
    jobId,
    jobType,
    status: 'PENDING',
    attemptCount: 0,
  };

  try {
    await db.runTransaction(async (transaction) => {
      const jobRef = jobDoc(jobId);
      const queueRef = jobQueueEntryDoc(jobId);

      transaction.create(jobRef, {
        ...newJob,
        payloadBytes,
        idempotencyKey: idempotencyKey || null,
        createdAt: now,
        updatedAt: now,
      });

      transaction.create(queueRef, {
        ...newQueueEntry,
        availableAt: now,
        createdAt: now,
      });
    });

    await jobDoc(jobId).collection('logs').add({
      level: 'info',
      source: 'createJob',
      message: 'Job created and queued by authorized caller.',
      metadata: {
        jobType,
        ownerUid: uid,
        orgId,
        payloadBytes,
      },
      createdAt: now,
    });
  } catch (error: any) {
    console.error('Error creating job in transaction:', error);
    throw httpsError('internal', 'Failed to create job.', error?.message);
  }

  return { jobId };
};

export const createJob = withAuthenticatedRole(['admin', 'operator', 'user'], handler);
