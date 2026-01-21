import * as admin from 'firebase-admin';
import { CloudTasksClient } from '@google-cloud/tasks';
import { ZodError } from 'zod';
import { backoff } from './lib/backoff';
import { claimJob, releaseJob } from './lib/claim';
import { Job, JobPayload, JobStatus } from './types/jobs';
import { handlers } from '../../functions/src/handlers';

const PROJECT_ID = process.env.GCLOUD_PROJECT!;
const QUEUE_LOCATION = 'us-central1';
const QUEUE_ID = 'urai-jobs';
const RUN_JOB_URL = `https://us-central1-${PROJECT_ID}.cloudfunctions.net/runJob`;

export class JobEngine {
  private firestore = admin.firestore();
  private tasksClient = new CloudTasksClient();

  async enqueue(type: string, payload: JobPayload, options: { idempotencyKey: string, scheduledFor?: Date }) {
    const idempotencyKey = options.idempotencyKey;
    const jobRef = this.firestore.collection('jobs').doc(`${type}-${idempotencyKey}`);

    try {
      const job = await this.firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(jobRef);
        if (doc.exists) {
          return doc.data() as Job;
        }

        const newJob: Job = {
          type,
          status: 'queued',
          priority: 0,
          attempt: 0,
          maxAttempts: 8,
          createdAt: new Date(),
          updatedAt: new Date(),
          scheduledFor: options.scheduledFor,
          idempotencyKey,
          payload,
          traceId: crypto.randomUUID(),
          lockedBy: null,
          leaseUntil: null,
        };

        transaction.create(jobRef, newJob);
        return newJob;
      });

      const task = {
        httpRequest: {
          httpMethod: 'POST' as const,
          url: RUN_JOB_URL,
          body: Buffer.from(JSON.stringify({ jobId: jobRef.id })).toString('base64'),
          headers: { 'Content-Type': 'application/json' },
          oidcToken: {
            serviceAccountEmail: `${PROJECT_ID}@appspot.gserviceaccount.com`,
          },
        },
        scheduleTime: options.scheduledFor ? { seconds: Math.floor(options.scheduledFor.getTime() / 1000) } : undefined,
      };

      const parent = this.tasksClient.queuePath(PROJECT_ID, QUEUE_LOCATION, QUEUE_ID);
      await this.tasksClient.createTask({ parent, task });

      return job;
    } catch (error) {
      console.error('Error enqueuing job:', error);
      throw error;
    }
  }

  async getJob(jobId: string) {
    const jobRef = this.firestore.collection('jobs').doc(jobId);
    const doc = await jobRef.get();
    return doc.data() as Job;
  }

  async cancelJob(jobId: string) {
    const jobRef = this.firestore.collection('jobs').doc(jobId);
    await jobRef.update({ status: 'canceled', updatedAt: new Date() });
  }

  async runJob(jobId: string) {
    const jobRef = this.firestore.collection('jobs').doc(jobId);

    const job = await claimJob(this.firestore, jobRef);
    if (!job) {
      return;
    }

    const handler = handlers[job.type];
    if (!handler) {
      throw new Error(`No handler for job type ${job.type}`);
    }

    try {
      handler.payload.parse(job.payload);
    } catch (error) {
      await releaseJob(this.firestore, jobRef, 'deadletter', { error: (error as ZodError).format() });
      return;
    }

    const runRef = this.firestore.collection('jobRuns').doc();

    await runRef.set({
      jobId,
      type: job.type,
      attempt: job.attempt,
      startedAt: new Date(),
      status: 'running',
      worker: `worker-${process.pid}`,
      traceId: job.traceId,
    });

    try {
      const result = await handler.handler(job.payload);

      await releaseJob(this.firestore, jobRef, 'succeeded', { result });
      await runRef.update({ status: 'succeeded', endedAt: new Date(), metrics: { durationMs: 0, coldStart: false } });
    } catch (error) {
      console.error('Error processing job:', error);
      const nextAttempt = job.attempt + 1;
      if (nextAttempt >= job.maxAttempts) {
        await releaseJob(this.firestore, jobRef, 'deadletter', { error: error.message });
        await runRef.update({ status: 'deadletter', endedAt: new Date(), error: error.message });
      } else {
        const scheduledFor = new Date(Date.now() + backoff(nextAttempt));
        await releaseJob(this.firestore, jobRef, 'queued', { error: error.message, attempt: nextAttempt, scheduledFor });
        await runRef.update({ status: 'failed', endedAt: new Date(), error: error.message });
      }
    }
  }

  async listJobs(status: JobStatus, type: string) {
    let query = this.firestore.collection('jobs').where('status', '==', status);
    if (type) {
      query = query.where('type', '==', type);
    }
    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data());
  }

  async requeueJob(jobId: string) {
    const jobRef = this.firestore.collection('jobs').doc(jobId);
    const doc = await jobRef.get();
    const job = doc.data() as Job;

    if (job.status !== 'deadletter') {
      throw new Error('Only deadlettered jobs can be requeued');
    }

    await jobRef.update({ status: 'queued', attempt: 0, updatedAt: new Date() });
  }

  async getJobRuns(jobId: string) {
    const snapshot = await this.firestore.collection('jobRuns').where('jobId', '==', jobId).get();
    return snapshot.docs.map(doc => doc.data());
  }
}
