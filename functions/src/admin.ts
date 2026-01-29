

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { v4 as uuidv4 } from 'uuid';

import { JobDocSchema, JobDoc, JobStatus } from './contracts/v1';

// Initialize Firebase Admin SDK if not already initialized
if (!process.env.FUNCTIONS_EMULATOR) {
  initializeApp();
}
const db = getFirestore();

async function isAdmin(uid: string): Promise<boolean> {
  const adminDoc = await db.collection('admins').doc(uid).get();
  return adminDoc.exists;
}

export const enqueueJob = onCall(async (request) => {
  if (!request.auth || !(await isAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Must be an admin to enqueue jobs.');
  }

  const { type, payload, priority = 5, maxAttempts = 3, idempotencyKey } = request.data;

  const jobId = uuidv4();
  const now = new Date();

  const jobData: JobDoc = {
    jobId,
    type,
    version: '1.0',
    createdAt: now,
    updatedAt: now,
    tenantId: request.data.tenantId || 'default', // Or extract from admin claims
    priority,
    attempts: 0,
    maxAttempts,
    status: 'queued',
    payload,
    traceId: uuidv4(),
    runAt: now,
  };

  if (idempotencyKey) {
    jobData.idempotencyKey = idempotencyKey;
  }

  // Validate with Zod before saving
  try {
    JobDocSchema.parse(jobData);
  } catch (error) {
    logger.error('Invalid job data', { error });
    throw new HttpsError('invalid-argument', 'Invalid job data');
  }


  await db.collection('jobs').doc(jobId).set(jobData);

  logger.info(`Job ${jobId} enqueued by ${request.auth.uid}`);
  return { jobId };
});

export const retryDeadJob = onCall(async (request) => {
  if (!request.auth || !(await isAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Must be an admin to retry jobs.');
  }

  const { jobId } = request.data;
  if (!jobId) {
    throw new HttpsError('invalid-argument', 'jobId is required');
  }

  const deadJobRef = db.collection('deadJobs').doc(jobId);
  const deadJobDoc = await deadJobRef.get();

  if (!deadJobDoc.exists) {
    throw new HttpsError('not-found', `Dead job ${jobId} not found`);
  }

  const jobData = deadJobDoc.data() as JobDoc;

  // Move back to jobs queue
  await db.runTransaction(async (transaction) => {
    transaction.delete(deadJobRef);
    transaction.set(db.collection('jobs').doc(jobId), {
      ...jobData,
      status: 'queued',
      attempts: 0, // Reset attempts
      runAt: new Date(),
      updatedAt: new Date(),
      error: null, // Clear previous error
      lease: null,
    });
  });

  logger.info(`Dead job ${jobId} requeued by ${request.auth.uid}`);
  return { success: true };
});

export const cancelJob = onCall(async (request) => {
  if (!request.auth || !(await isAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Must be an admin to cancel jobs.');
  }

  const { jobId } = request.data;
  if (!jobId) {
    throw new HttpsError('invalid-argument', 'jobId is required');
  }

  const jobRef = db.collection('jobs').doc(jobId);
  const jobDoc = await jobRef.get();

  if (!jobDoc.exists) {
    throw new HttpsError('not-found', `Job ${jobId} not found`);
  }

  const jobData = jobDoc.data() as JobDoc;

  if (jobData.status !== 'queued') {
      throw new HttpsError('failed-precondition', `Job ${jobId} cannot be cancelled as it is not in a queued state.`);
  }

  await jobRef.delete();

  logger.info(`Job ${jobId} cancelled by ${request.auth.uid}`);
  return { success: true };
});

export const adminJobsDashboard = onCall(async (request) => {
  if (!request.auth || !(await isAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Must be an admin to view the dashboard.');
  }

  const jobsSnapshot = await db.collection('jobs').get();
  const deadJobsSnapshot = await db.collection('deadJobs').get();

  const statusCounts: Record<JobStatus, number> = {
    queued: 0,
    leased: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    dead: deadJobsSnapshot.size,
  };

  jobsSnapshot.forEach(doc => {
    const job = doc.data() as JobDoc;
    if (job.status && statusCounts[job.status] !== undefined) {
        statusCounts[job.status]++;
    }
  });

  return {
    statusCounts,
    totalJobs: jobsSnapshot.size + deadJobsSnapshot.size,
  };
});

