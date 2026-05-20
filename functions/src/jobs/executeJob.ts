import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import axios from 'axios';
import { z } from 'zod';
import { Job } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';

const JOB_EXECUTION_TOPIC = 'job-execution';

const JobExecutionMessageSchema = z.object({
  jobId: z.string(),
  leaseToken: z.string(),
});

function getJobType(job: Job): string {
  return String(job.type || job.jobType || 'narrator.tts');
}

function getWorkerTarget(jobType: string): { url: string; route: string } {
  if (jobType === 'asset-render' || jobType.startsWith('asset')) {
    if (!process.env.ASSET_WORKER_URL) throw new Error('ASSET_WORKER_URL environment variable not set.');
    return { url: process.env.ASSET_WORKER_URL, route: '/' };
  }

  if (jobType === 'spatial-index' || jobType.startsWith('spatial')) {
    if (!process.env.SPATIAL_WORKER_URL) throw new Error('SPATIAL_WORKER_URL environment variable not set.');
    return { url: process.env.SPATIAL_WORKER_URL, route: '/' };
  }

  if (jobType === 'studio-render' || jobType.startsWith('studio')) {
    if (!process.env.STUDIO_WORKER_URL) throw new Error('STUDIO_WORKER_URL environment variable not set.');
    return { url: process.env.STUDIO_WORKER_URL, route: '/' };
  }

  if (!process.env.NARRATOR_WORKER_URL) throw new Error('NARRATOR_WORKER_URL environment variable not set.');
  return { url: process.env.NARRATOR_WORKER_URL, route: '/execute-job' };
}

async function appendJobLog(jobId: string, input: { level: string; message: string; source: string; metadata?: Record<string, unknown> }) {
  try {
    await jobDoc(jobId).collection('logs').add({
      ...input,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (logError) {
    console.error(`Failed to append job log for ${jobId}:`, logError);
  }
}

async function handleJobFailure(jobId: string, error: unknown) {
  const db = getFirestore();
  const jobRef = jobDoc(jobId);
  const queueRef = jobQueueEntryDoc(jobId);
  const now = FieldValue.serverTimestamp();
  const errorMessage = error instanceof Error ? error.message : String(error);

  await db.runTransaction(async (transaction) => {
    transaction.update(jobRef, {
      status: 'FAILED',
      error: { message: errorMessage },
      updatedAt: now,
    });
    transaction.update(queueRef, {
      status: 'DONE',
      updatedAt: now,
    });
  });

  await appendJobLog(jobId, {
    level: 'error',
    source: 'executeJob',
    message: 'Job execution failed.',
    metadata: { error: errorMessage },
  });

  console.error(`Job ${jobId} failed:`, error);
}

export const executeJob = onMessagePublished(JOB_EXECUTION_TOPIC, async (event) => {
  const validationResult = JobExecutionMessageSchema.safeParse(event.data.message.json);
  if (!validationResult.success) {
    console.error('Invalid job execution message:', validationResult.error.flatten());
    return;
  }

  const { jobId, leaseToken } = validationResult.data;
  const db = getFirestore();
  const jobRef = jobDoc(jobId);

  try {
    const jobSnapshot = await jobRef.get();
    if (!jobSnapshot.exists) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const job = jobSnapshot.data() as Job;

    if (job.lease?.leaseToken !== leaseToken) {
      throw new Error(`Invalid lease token for job: ${jobId}`);
    }

    const jobType = getJobType(job);
    const target = getWorkerTarget(jobType);
    const workerUrl = target.url.replace(/\/$/, '');
    const route = target.route;

    await db.runTransaction(async (transaction) => {
      transaction.update(jobRef, {
        status: 'RUNNING',
        'execution.leaseToken': leaseToken,
        'execution.startedAt': FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(jobQueueEntryDoc(jobId), {
        status: 'RUNNING',
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await appendJobLog(jobId, {
      level: 'info',
      source: 'executeJob',
      message: 'Job execution started.',
      metadata: { jobType },
    });

    await appendJobLog(jobId, {
      level: 'info',
      source: 'executeJob',
      message: 'Sending job to worker.',
      metadata: { jobType, workerUrl, route },
    });

    const response = await axios.post(`${workerUrl}${route}`, {
      ...job,
      jobId,
      leaseToken,
      type: jobType,
      jobType,
    });
    const result = response.data;

    const now = FieldValue.serverTimestamp();
    await db.runTransaction(async (transaction) => {
      transaction.update(jobRef, {
        status: 'SUCCESS',
        result,
        updatedAt: now,
        'execution.completedAt': now,
      });
      transaction.update(jobQueueEntryDoc(jobId), { status: 'DONE', updatedAt: now });
    });

    await appendJobLog(jobId, {
      level: 'info',
      source: 'executeJob',
      message: 'Job execution succeeded.',
      metadata: { jobType, result },
    });
  } catch (error) {
    await handleJobFailure(jobId, error);
  }
});