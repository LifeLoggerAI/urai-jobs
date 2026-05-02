import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getAuthContext, ensureHasPermission } from '../core/auth.js.js.js.js';
import { URAI_Error, logError } from '../core/errors.js.js.js.js';

export const getJobStatus = functions.https.onCall(async (data, context) => {
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
      ensureHasPermission(authContext, 'jobs.read.own');
    } else {
      ensureHasPermission(authContext, 'jobs.read.any');
    }

    return {
      jobId: jobDoc.id,
      status: jobDoc.status,
      progress: jobDoc.progress,
      resultSummary: jobDoc.result?.summary,
      error: jobDoc.error
    };

  } catch (error) {
    logError(error as URAI_Error | Error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'An internal error occurred while fetching job status.');
  }
});
