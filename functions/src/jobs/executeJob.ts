import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import axios from 'axios';
import { z } from 'zod';
import { Job } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { httpsError } from '../core/errors.js';

const JOB_EXECUTION_TOPIC = 'job-execution';
const NARRATOR_WORKER_URL = process.env.NARRATOR_WORKER_URL;

const JobExecutionMessageSchema = z.object({
  jobId: z.string(),
  leaseToken: z.string(),
});

async function handleJobFailure(jobId: string, error: any) {
  const db = getFirestore();
  const jobRef = jobDoc(jobId);
  const queueRef = jobQueueEntryDoc(jobId);
  const now = FieldValue.serverTimestamp();

  // A proper implementation will be done in Phase 5.
  // For now, we'll just mark the job as FAILED.
  await db.runTransaction(async (transaction) => {
    transaction.update(jobRef, { 
      status: 'FAILED',
      updatedAt: now,
     });
    transaction.update(queueRef, { 
      status: 'DONE',
      updatedAt: now,
    });
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

    await jobRef.update({ status: 'RUNNING', 'execution.startedAt': FieldValue.serverTimestamp() });

    if (!NARRATOR_WORKER_URL) {
      throw new Error('NARRATOR_WORKER_URL environment variable not set.');
    }

    const response = await axios.post(`${NARRATOR_WORKER_URL}/execute`, job);
    const result = response.data;

    const now = FieldValue.serverTimestamp();
    await db.runTransaction(async (transaction) => {
      transaction.update(jobRef, { status: 'SUCCESS', result, updatedAt: now });
      transaction.update(jobQueueEntryDoc(jobId), { status: 'DONE', updatedAt: now });
    });

  } catch (error) {
    await handleJobFailure(jobId, error);
  }
});
