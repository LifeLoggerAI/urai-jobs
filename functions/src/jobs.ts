
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Job, JobStatus } from '../../jobs-web/src/lib/schemas';

admin.initializeApp();

// ... (createJob, claimNextJob, heartbeatJobLease, completeJob)

export const cancelJob = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const { uid } = context.auth;
  const { jobId } = data;

  const jobRef = admin.firestore().collection('jobs').doc(jobId);
  const jobDoc = await jobRef.get();

  if (!jobDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Job not found');
  }

  const job = jobDoc.data() as Job;

  if (job.ownerUid !== uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You do not have permission to cancel this job.'
    );
  }

  if (job.status !== 'QUEUED' && job.status !== 'RUNNING') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Job can only be canceled if it is QUEUED or RUNNING.'
    );
  }

  await jobRef.update({ status: 'CANCELED', updatedAt: new Date() });

  return { status: 'ok' };
});

export const retryJob = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const { uid } = context.auth;
  const { jobId } = data;

  const jobRef = admin.firestore().collection('jobs').doc(jobId);
  const jobDoc = await jobRef.get();

  if (!jobDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Job not found');
  }

  const job = jobDoc.data() as Job;

  if (job.ownerUid !== uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You do not have permission to retry this job.'
    );
  }

  if (job.status !== 'FAILED') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Job can only be retried if it has FAILED.'
    );
  }

  if (job.attempts >= job.maxAttempts) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Job has reached its maximum number of retries.'
    );
  }

  await jobRef.update({
    status: 'QUEUED',
    attempts: admin.firestore.FieldValue.increment(1),
    updatedAt: new Date(),
  });

  return { status: 'ok' };
});
