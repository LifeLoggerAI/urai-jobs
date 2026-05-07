import { ulid } from 'ulid';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { CallableContext } from 'firebase-functions/v1/https';
import { z } from 'zod';
import { Job, JobQueueEntry } from '@urai-jobs/shared-types';
import { withAuthenticatedRole } from '../core/auth.js';
import { httpsError } from '../core/errors.js';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';

const CreateJobSchema = z.object({
  jobType: z.string().min(3, 'Job type must be at least 3 characters').trim(),
  payload: z.record(z.any()).default({}),
  idempotencyKey: z.string().trim().optional(),
});

const handler = async (data: any, context: CallableContext) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw httpsError('unauthenticated', 'User must be authenticated.');
  }

  const validationResult = CreateJobSchema.safeParse(data);
  if (!validationResult.success) {
    throw httpsError('invalid-argument', 'Invalid job data.', validationResult.error.flatten());
  }

  const { jobType, payload, idempotencyKey } = validationResult.data;
  const db = getFirestore();
  const jobId = ulid();
  const now = FieldValue.serverTimestamp();

  const newJob: Job = {
    jobId,
    jobType,
    type: jobType,
    status: 'PENDING',
    payload,
    ownerUid: uid,
    createdBy: uid,
    retryCount: 0,
    execution: {
      attemptCount: 0,
      maxAttempts: 3,
    },
    ...(idempotencyKey ? { idempotencyKey } : {}),
  } as Job;

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
        createdAt: now,
        updatedAt: now,
      });

      transaction.create(queueRef, {
        ...newQueueEntry,
        availableAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });
  } catch (error: any) {
    console.error('Error creating job in transaction:', error);
    throw httpsError('internal', 'Failed to create job.', error?.message);
  }

  return { jobId };
};

export const createJob = withAuthenticatedRole(['admin', 'user'], handler);
