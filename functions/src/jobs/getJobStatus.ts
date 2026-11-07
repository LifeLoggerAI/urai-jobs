import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import type { CallableContext } from 'firebase-functions/v1/https';
import type { User } from '@urai-jobs/shared-types';
import { withAuthenticatedRole } from '../core/auth.js';
import { httpsError } from '../core/errors.js';
import { jobDoc } from '../core/firestore-paths.js';
import { checkedCurrentJobCaller } from './currentJobCallerAuthority.js';

const GetJobStatusSchema = z.object({
  jobId: z.string().min(1),
});

async function handler(data: unknown, context: CallableContext, _user: User) {
  const validationResult = GetJobStatusSchema.safeParse(data);
  if (!validationResult.success) {
    throw httpsError('invalid-argument', 'Invalid data.', validationResult.error.flatten());
  }

  const authenticatedUid = context.auth?.uid;
  if (!authenticatedUid) {
    throw httpsError('unauthenticated', 'User must be authenticated.');
  }

  const { jobId } = validationResult.data;
  const db = getFirestore();
  const userRef = db.collection('users').doc(authenticatedUid);
  const jobRef = jobDoc(jobId);

  // Read user and job atomically: a simultaneous role withdrawal/deletion
  // transaction cannot leave a stale owner/operator access decision.
  return db.runTransaction(async transaction => {
    const [userSnapshot, jobSnapshot] = await Promise.all([
      transaction.get(userRef), transaction.get(jobRef)
    ]);
    const caller = checkedCurrentJobCaller(context.auth, userSnapshot.exists ? userSnapshot.data() : null);
    if (!caller) {
      throw httpsError('permission-denied', 'Current user authority is unavailable.');
    }
    if (!jobSnapshot.exists) {
      throw httpsError('not-found', 'Job not found.');
    }
    const job = jobSnapshot.data();
    if (!job) {
      throw httpsError('not-found', 'Job not found.');
    }
    if (!caller.operator && job.ownerUid !== caller.uid) {
      throw httpsError('permission-denied', 'You do not have permission to view this job.');
    }
    return { job };
  });
}

/**
 * Authenticated callable that returns a job to its owner or an operator.
 *
 * Keep this on the v1 callable surface to preserve the deployed function name
 * and avoid an implicit Gen 1 -> Gen 2 replacement.
 */
export const getJobStatus = withAuthenticatedRole(['admin', 'operator', 'user'], handler);
