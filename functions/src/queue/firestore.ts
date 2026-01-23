import * as admin from 'firebase-admin';
import { JOB_REGISTRY } from '../jobs/registry';
import { v4 as uuidv4 } from 'uuid';

const db = admin.firestore();

export const enqueueJob = async (jobId: string, payload: any, options?: { dedupeKey?: string, concurrencyKey?: string, createdByUid?: string }) => {
  const jobDefinition = JOB_REGISTRY[jobId];
  if (!jobDefinition) {
    throw new Error(`Job with id ${jobId} not found in registry.`);
  }

  const validatedPayload = jobDefinition.validate.parse(payload);

  if (options?.dedupeKey) {
    const existingJob = await db.collection('jobQueue').where('dedupeKey', '==', options.dedupeKey).where('status', 'in', ['queued', 'running']).get();
    if (!existingJob.empty) {
      console.log(`Job with dedupeKey ${options.dedupeKey} already exists. Skipping.`);
      return;
    }
  }

  const job = {
    jobId,
    jobVersion: jobDefinition.version,
    payload: validatedPayload,
    status: 'queued',
    createdAt: new Date(),
    runAt: new Date(),
    attempt: 0,
    maxAttempts: jobDefinition.maxAttempts,
    lastError: null,
    dedupeKey: options?.dedupeKey || null,
    concurrencyKey: options?.concurrencyKey || null,
    leaseUntil: null,
    createdByUid: options?.createdByUid || null,
  };

  await db.collection('jobQueue').add(job);
};

export const claimJobs = async (workerId: string, limit: number) => {
  return db.runTransaction(async (transaction) => {
    const now = new Date();
    const query = db.collection('jobQueue').where('status', '==', 'queued').where('runAt', '<=', now).limit(limit);
    const snapshot = await transaction.get(query);

    const claimedJobs = [];
    for (const doc of snapshot.docs) {
      const leaseUntil = new Date(now.getTime() + 60 * 1000); // 1 minute lease
      transaction.update(doc.ref, { status: 'running', leaseUntil, workerId });
      claimedJobs.push({ id: doc.id, ...doc.data() });
    }
    return claimedJobs;
  });
};

export const releaseJob = async (jobId: string, status: 'succeeded' | 'failed' | 'dead', error?: string) => {
  const jobRef = db.collection('jobQueue').doc(jobId);
  const job = (await jobRef.get()).data();

  if (!job) {
    return;
  }

  if (status === 'succeeded') {
    await jobRef.update({ status: 'succeeded', finishedAt: new Date() });
  } else if (status === 'failed') {
    const nextAttempt = job.attempt + 1;
    if (nextAttempt >= job.maxAttempts) {
      await jobRef.update({ status: 'dead', lastError: error, finishedAt: new Date() });
    } else {
      const backoff = Math.pow(2, nextAttempt) * 1000; // Exponential backoff
      const runAt = new Date(Date.now() + backoff);
      await jobRef.update({ status: 'queued', attempt: nextAttempt, lastError: error, runAt });
    }
  } else if (status === 'dead') {
    await jobRef.update({ status: 'dead', lastError: error, finishedAt: new Date() });
  }

  await db.collection('jobRuns').add({
    jobId: jobId,
    status: status,
    timestamp: new Date(),
    error: error || null,
  });
};
