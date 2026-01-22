
import { firestore } from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Job, JobRun } from '../jobs/types';
import { logger } from '../observability/logger';
import { recordJobEvent } from '../observability/events';
import { acquireJobLock } from './locks';
import { getFunctions } from 'firebase-admin/functions';

const db = firestore();

async function dispatchJob(job: Job<any>): Promise<void> {
  const { id: jobId, type } = job;

  const runRef = db.collection('jobRuns').doc();
  const runId = runRef.id;

  const canRun = await acquireJobLock(jobId, runId);
  if (!canRun) {
    logger.info(`Skipping dispatch for ${jobId}: already locked.`, { jobId });
    return;
  }

  const run: JobRun = {
    id: runId,
    jobId,
    attemptNumber: job.attempts + 1,
    workerId: 'n/a',
    startedAt: firestore.Timestamp.now(),
    status: 'running',
  };

  await db.runTransaction(async (transaction) => {
    const jobRef = db.collection('jobs').doc(jobId);
    transaction.update(jobRef, {
      status: 'running',
      updatedAt: firestore.FieldValue.serverTimestamp(),
      'trace.lastRunId': runId,
      'trace.runIds': firestore.FieldValue.arrayUnion(runId),
    });
    transaction.set(runRef, run);
  });

  const queue = getFunctions().taskQueue(`jobWorker`);
  await queue.enqueue({ jobId, runId, type });

  await recordJobEvent(jobId, 'info', `Job dispatched to worker.`, { runId });
  logger.info(`Job ${jobId} dispatched to run ${runId}`, { jobId, runId, type });
}

export const jobDispatcher = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
    const now = firestore.Timestamp.now();
    const query = db
      .collection('jobs')
      .where('status', '==', 'queued')
      .where('availableAt', '<=', now)
      .orderBy('availableAt')
      .orderBy('priority', 'desc')
      .limit(20);

    const snapshot = await query.get();

    if (snapshot.empty) {
      logger.info('No pending jobs to dispatch.');
      return;
    }

    const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Job<any>));
    await Promise.all(jobs.map(dispatchJob));
  });
