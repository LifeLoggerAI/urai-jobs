import { z } from 'zod';
import type { CallableContext } from 'firebase-functions/v1/https';
import type { User } from '@urai-jobs/shared-types';
import { withAuthenticatedRole } from '../core/auth.js';
import { httpsError } from '../core/errors.js';
import { jobDoc } from '../core/firestore-paths.js';
import { consentBlockRef, isConsentContext } from '../privacy/consentBlocks.js';
import { ownerDeletionFenceRefs, ownerDeletionFenced } from '../privacy/ownerDeletionFence.js';

const GetJobStatusSchema = z.object({
  jobId: z.string().min(1),
});

async function handler(data: unknown, context: CallableContext, user: User) {
  const validationResult = GetJobStatusSchema.safeParse(data);
  if (!validationResult.success) {
    throw httpsError('invalid-argument', 'Invalid data.', validationResult.error.flatten());
  }

  const authenticatedUid = context.auth?.uid;
  if (!authenticatedUid) {
    throw httpsError('unauthenticated', 'User must be authenticated.');
  }

  const { jobId } = validationResult.data;
  const jobSnapshot = await jobDoc(jobId).get();

  if (!jobSnapshot.exists) {
    throw httpsError('not-found', 'Job not found.');
  }

  const job = jobSnapshot.data();
  if (!job) {
    throw httpsError('not-found', 'Job not found.');
  }

  const canReadAny = user.role === 'admin' || user.role === 'operator';
  if (!canReadAny && job.ownerUid !== authenticatedUid) {
    throw httpsError('permission-denied', 'You do not have permission to view this job.');
  }

  // Operational oversight is not an exception to private result revocation.
  // Deny both job metadata and output on owner deletion, before returning data.
  if (!job.ownerUid || typeof job.ownerUid !== 'string') {
    throw httpsError('failed-precondition', 'Job owner authority is missing.');
  }
  const fences = await Promise.all(ownerDeletionFenceRefs(job.ownerUid).map(ref => ref.get()));
  if (ownerDeletionFenced(fences)) {
    throw httpsError('failed-precondition', 'Job owner deletion fence prohibits status and output access.');
  }
  const contexts = [
    ...(isConsentContext(job.consent) ? [job.consent] : []),
    ...(Array.isArray(job.consents) ? job.consents.filter(isConsentContext) : []),
  ];
  const blocks = await Promise.all(contexts.map(ctx => consentBlockRef(job.ownerUid!, ctx.purpose).get()));
  if (blocks.some(snapshot => snapshot.exists && snapshot.data()?.active === true)) {
    throw httpsError('failed-precondition', 'Revoked job consent prohibits status and output access.');
  }

  return { job };
}

/**
 * Authenticated callable that returns a job to its owner or an operator.
 *
 * Keep this on the v1 callable surface to preserve the deployed function name
 * and avoid an implicit Gen 1 -> Gen 2 replacement.
 */
export const getJobStatus = withAuthenticatedRole(['admin', 'operator', 'user'], handler);
