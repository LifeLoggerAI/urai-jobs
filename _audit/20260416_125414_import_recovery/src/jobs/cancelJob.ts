import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getAuthContext, ensureHasPermission } from '../core/auth.js.js.js.js';
import { createLog } from '../core/logging.js.js.js.js';
import { updateJob, updateQueue } from '../core/lease.js.js.js.js';
import { URAI_Error, logError } from '../core/errors.js.js.js.js';

export const cancelJob = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { jobId } = data;

  try {
    const authContext = await getAuthContext(context.auth.uid);
    const jobRef = admin.firestore().collection('jobs').doc(jobId);
    const jobDoc = (await jobRef.get()).data();

    if (!jobDoc) {
      throw new URAI_Error('NotFound', 'VALIDATION', 'Job not found');
    }

    if (jobDoc.requestedBy.uid === authContext.uid) {
      ensureHasPermission(authContext, 'jobs.cancel.own');
    } else {
      ensureHasPermission(authContext, 'jobs.cancel.any');
    }

    if (['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED'].includes(jobDoc.status)) {
      return { status: jobDoc.status }; // Already terminal
    }

    await updateJob(jobId, { status: 'CANCELLED', 'flags.cancelRequested': true });
    await updateQueue(jobId, { status: 'DONE' });

    await createLog(
      jobDoc.tenantId,
      'INFO',
      'API',
      'JobCancelled',
      `Job ${jobId} was cancelled by user ${authContext.uid}.`
    );

    return { status: 'CANCELLED' };

  } catch (error) {
    logError(error as URAI_Error | Error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'An internal error occurred while cancelling the job.');
  }
});
