import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Job } from './models';
import { firestore } from 'firebase-admin';

const db = admin.firestore();

// TODO: Add role-based access control

export const createJob = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { ...jobData } = data;

  const job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'> = {
    ...jobData,
    status: 'paused',
    createdAt: firestore.Timestamp.now(),
    updatedAt: firestore.Timestamp.now(),
    createdBy: context.auth.uid,
  };

  const jobRef = await db.collection('jobs').add(job as Job);

  return { jobId: jobRef.id };
});

export const updateJob = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { jobId, ...jobData } = data;

  await db.collection('jobs').doc(jobId).update({
    ...jobData,
    updatedAt: firestore.Timestamp.now(),
  });

  return { jobId };
});

export const listJobs = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const snapshot = await db.collection('jobs').get();
  const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return { jobs };
});

export const getJob = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { jobId } = data;
  const doc = await db.collection('jobs').doc(jobId).get();
  const job = { id: doc.id, ...doc.data() };

  return { job };
});

export const listRuns = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { jobId } = data;
  const snapshot = await db.collection('jobRuns').where('jobId', '==', jobId).get();
  const runs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return { runs };
});

export const getRun = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { runId } = data;
  const doc = await db.collection('jobRuns').doc(runId).get();
  const run = { id: doc.id, ...doc.data() };

  return { run };
});

export const cancelRun = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { runId } = data;
  await db.collection('jobRuns').doc(runId).update({
    status: 'canceled',
    finishedAt: firestore.Timestamp.now(),
  });

  return { runId };
});
