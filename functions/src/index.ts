import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { enqueueJob, claimJobs, releaseJob } from './queue/firestore';
import { JOB_REGISTRY } from './jobs/registry';

admin.initializeApp();

const db = admin.firestore();

export const enqueue = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can enqueue jobs.');
  }

  const { jobId, payload, options } = data;
  await enqueueJob(jobId, payload, { ...options, createdByUid: context.auth.uid });
});

export const runWorker = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  const workerId = uuidv4();
  const jobs = await claimJobs(workerId, 10);

  for (const job of jobs) {
    const jobDefinition = JOB_REGISTRY[job.jobId];
    if (!jobDefinition) {
      await releaseJob(job.id, 'dead', 'Job definition not found');
      continue;
    }

    try {
      const result = await jobDefinition.handler(job.payload);
      await releaseJob(job.id, 'succeeded');
    } catch (error: any) {
      await releaseJob(job.id, 'failed', error.message);
    }
  }
});

export const adminDashboard = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can access the admin dashboard.');
  }

  const snapshot = await db.collection('jobQueue').get();
  const jobs = snapshot.docs.map(doc => doc.data());

  const stats = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  return { stats, jobs };
});

export const retryJob = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can retry jobs.');
  }

  const { jobId } = data;
  const jobRef = db.collection('jobQueue').doc(jobId);
  await jobRef.update({ status: 'queued', attempt: 0 });
});

export const cancel = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can cancel jobs.');
  }

  const { jobId } = data;
  const jobRef = db.collection('jobQueue').doc(jobId);
  await jobRef.update({ status: 'canceled' });
});
