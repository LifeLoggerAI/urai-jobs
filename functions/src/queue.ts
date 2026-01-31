import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { JobRun } from './models';
import { firestore } from 'firebase-admin';

const db = admin.firestore();

export const enqueueRun = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { jobId, params } = data;

  // TODO: Add validation

  const jobRef = db.collection('jobs').doc(jobId);
  const jobDoc = await jobRef.get();

  if (!jobDoc.exists) {
    throw new functions.https.HttpsError('not-found', `Job with ID ${jobId} not found.`);
  }

  const job = jobDoc.data()!;
  const paramsHash = await hashParams(params);
  const idempotencyKey = `${jobId}-${paramsHash}`;

  if (job.idempotencyPolicy === 'byParamsHash') {
    const existingRuns = await db.collection('jobRuns')
      .where('idempotencyKey', '==', idempotencyKey)
      .where('status', 'in', ['queued', 'running', 'succeeded'])
      .get();

    if (!existingRuns.empty) {
      console.log(`Job run with idempotency key ${idempotencyKey} already exists.`);
      return { runId: existingRuns.docs[0].id };
    }
  }


  const run: Omit<JobRun, 'id' | 'logRef' | 'artifactRefs'> = {
    jobId,
    status: 'queued',
    queuedAt: firestore.Timestamp.now(),
    startedAt: null,
    finishedAt: null,
    attempt: 0,
    params,
    paramsHash,
    idempotencyKey,
    leaseExpiresAt: null,
    workerId: null,
    error: null,
    metrics: {},
  };

  const runRef = await db.collection('jobRuns').add(run as JobRun);

  return { runId: runRef.id };
});

async function hashParams(params: Record<string, any>): Promise<string> {
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(params));
  return hash.digest('hex');
}
