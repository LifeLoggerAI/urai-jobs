import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { CallableContext } from 'firebase-functions/v1/https';
import { User } from '@urai-jobs/shared-types';
import { httpsError } from '../core/errors.js';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { getFirestore } from 'firebase-admin/firestore';

const CancelJobSchema = z.object({
  jobId: z.string(),
});

/**
 * A callable function that allows a user to cancel a job they own, or an admin to cancel any job.
 * The job can only be cancelled if it is not already in a terminal state.
 */
export const cancelJob = async (data: any, context: CallableContext, user: User) => {
  const validationResult = CancelJobSchema.safeParse(data);
  if (!validationResult.success) {
    throw httpsError('invalid-argument', 'Invalid data.', validationResult.error.flatten());
  }

  const { jobId } = validationResult.data;
  const db = getFirestore();

  const jobRef = jobDoc(jobId);
  const queueRef = jobQueueEntryDoc(jobId);

  try {
    await db.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobRef);

      if (!jobSnapshot.exists) {
        throw httpsError('not-found', 'Job not found.');
      }

      const job = jobSnapshot.data();

      // RBAC: Check if the user has permission to cancel this job.
      // An admin can cancel any job, a user can only cancel their own.
      if (user.role !== 'admin' && job.ownerUid !== user.uid) {
        throw httpsError('permission-denied', 'You do not have permission to cancel this job.');
      }

      // A job can only be cancelled if it is not already in a terminal state.
      if (['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED'].includes(job.status)) {
        return;
      }

      const now = FieldValue.serverTimestamp();

      transaction.update(jobRef, { 
        status: 'CANCELLED',
        updatedAt: now,
       });
       
      transaction.update(queueRef, { 
        status: 'DONE', 
        updatedAt: now, 
      });
    });
  } catch (error: any) {
    throw httpsError('internal', 'Failed to cancel job.', { message: error.message });
  }

  return { status: 'CANCELLED' };
};
