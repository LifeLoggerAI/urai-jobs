import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { CallableContext } from 'firebase-functions/v1/https';
import { z } from 'zod';
import { Job, JobQueueEntry } from '@urai-jobs/shared-types';
import { withAuthenticatedRole } from '../core/auth.js';
import { httpsError } from '../core/errors.js';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { parseJobPayload, SUPPORTED_JOB_TYPES } from './job-contracts.js';

const CreateJobSchema = z.object({
  jobType: z.string().trim().min(3, 'Job type must be at least 3 characters'),
  payload: z.unknown(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});

function idempotencyDocId(uid: string, idempotencyKey: string): string {
  return createHash('sha256').update(`${uid}:${idempotencyKey}`).digest('hex');
}

async function appendCreateLog(jobId: string, jobType: string, deduped: boolean) {
  await jobDoc(jobId).collection('logs').add({
    level: 'info',
    source: 'createJob',
    message: deduped ? 'Idempotent createJob returned existing job.' : 'Job created and queued.',
    metadata: { jobType, deduped },
    createdAt: FieldValue.serverTimestamp(),
  });
}

const handler = async (data: any, context: CallableContext) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw httpsError('unauthenticated', 'User must be authenticated.');
  }

  const validationResult = CreateJobSchema.safeParse(data);
  if (!validationResult.success) {
    throw httpsError('invalid-argument', 'Invalid job data.', validationResult.error.flatten());
  }

  const { jobType, idempotencyKey } = validationResult.data;

  let payload: Record<string, unknown>;
  try {
    payload = parseJobPayload(jobType, validationResult.data.payload);
  } catch (error) {
    throw httpsError('invalid-argument', error instanceof Error ? error.message : 'Unsupported or invalid job payload.', {
      supportedJobTypes: SUPPORTED_JOB_TYPES,
    });
  }

  const db = getFirestore();
  const jobId = ulid();
  const now = FieldValue.serverTimestamp();
  let responseJobId = jobId;
  let deduped = false;

  const newJob: Job = {
    jobId,
    type: jobType,
    jobType,
    status: 'PENDING',
    payload,
    ownerUid: uid,
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
      const idempotencyRef = idempotencyKey
        ? db.collection('jobIdempotency').doc(idempotencyDocId(uid, idempotencyKey))
        : null;

      if (idempotencyRef) {
        const existing = await transaction.get(idempotencyRef);
        if (existing.exists) {
          const existingJobId = String(existing.data()?.jobId || '');
          if (!existingJobId) throw new Error('Idempotency record is malformed.');
          responseJobId = existingJobId;
          deduped = true;
          return;
        }
      }

      transaction.create(jobRef, { ...newJob, createdAt: now, updatedAt: now });
      transaction.create(queueRef, { ...newQueueEntry, availableAt: now, createdAt: now, updatedAt: now });

      if (idempotencyRef && idempotencyKey) {
        transaction.create(idempotencyRef, {
          jobId,
          ownerUid: uid,
          jobType,
          idempotencyKeyHash: idempotencyDocId(uid, idempotencyKey),
          createdAt: now,
          updatedAt: now,
        });
      }
    });
  } catch (error: any) {
    console.error('Error creating job in transaction:', error);
    throw httpsError('internal', 'Failed to create job.', error?.message);
  }

  await appendCreateLog(responseJobId, jobType, deduped);
  return { jobId: responseJobId, idempotent: deduped };
};

export const createJob = withAuthenticatedRole(['admin', 'user'], handler);
