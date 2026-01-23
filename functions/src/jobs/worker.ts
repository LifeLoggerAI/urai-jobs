import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';
import { Job, JobRun, JobStatus } from '../jobs/types';
import { logger } from '../observability/logger';
import { recordJobEvent } from '../observability/events';
import { handleRetry } from '../queue/retry';
import { releaseJobLock } from '../queue/locks';
import { jobHandlers } from '../jobs/handlers';

const db = firestore();

async function executeJob(job: Job<any>, run: JobRun): Promise<void> {
  const { id: jobId, type } = job;
  const { id: runId } = run;

  const handler = jobHandlers[type];

  if (!handler) {
    throw new Error(`No handler found for job type \"${type}\".`);
  }

  try {
    await handler(job);
  } catch (error: any) {
    await recordJobEvent(jobId, 'error', error.message, { runId });
    throw error;
  }
}

export const jobWorker = functions.tasks.taskQueue().onDispatch(async (data) => {
  const { jobId, runId } = data as { jobId: string; runId: string; type: string };

  const jobRef = db.collection('jobs').doc(jobId);
  const runRef = db.collection('jobRuns').doc(runId);

  let runDoc: firestore.DocumentSnapshot;
  let jobDoc: firestore.DocumentSnapshot;

  try {
    [jobDoc, runDoc] = await Promise.all([jobRef.get(), runRef.get()]);

    if (!jobDoc.exists || !runDoc.exists) {
      throw new Error(`Job ${jobId} or run ${runId} not found.`);
    }

    const job = { id: jobDoc.id, ...jobDoc.data() } as Job<any>;
    const run = { id: runDoc.id, ...runDoc.data() } as JobRun;

    await executeJob(job, run);

    const finishedRun: Partial<JobRun> = {
      endedAt: firestore.Timestamp.now(),
      status: 'succeeded',
      timingMs: Date.now() - run.startedAt.toMillis(),
    };

    await runRef.update(finishedRun);
    await jobRef.update({
      status: 'succeeded' as JobStatus,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    await recordJobEvent(jobId, 'info', 'Job finished successfully', { runId });
  } catch (error: any) {
    logger.error(`Job ${jobId} execution failed.`, error, { jobId, runId });
    const job = (await jobRef.get()).data() as Job<any>;
    await handleRetry(job, error);
  } finally {
    await releaseJobLock(jobId);
  }
});
