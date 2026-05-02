import { z } from 'zod';
import type { CallableContext } from 'firebase-functions/v1/https';
import { User } from '@urai-jobs/shared-types';
import { httpsError } from '../core/errors.js';
import { jobDoc } from '../core/firestore-paths.js';

const GetJobStatusSchema = z.object({
  jobId: z.string(),
});

/**
 * A callable function that allows an authenticated user to get the status of a job they own,
 * or allows an admin to get the status of any job.
 */
export const getJobStatus = async (data: any, context: CallableContext, user: User) => {
  const validationResult = GetJobStatusSchema.safeParse(data);
  if (!validationResult.success) {
    throw httpsError('invalid-argument', 'Invalid data.', validationResult.error.flatten());
  }

  const { jobId } = validationResult.data;

  const jobRef = jobDoc(jobId);
  const jobSnapshot = await jobRef.get();

  if (!jobSnapshot.exists) {
    throw httpsError('not-found', 'Job not found.');
  }

  const job = jobSnapshot.data();

  // RBAC: Check if the user has permission to view this job.
  // An admin can view any job, a user can only view their own.
  if (user.role !== 'admin' && job.ownerUid !== user.uid) {
    throw httpsError('permission-denied', 'You do not have permission to view this job.');
  }

  return job;
};
