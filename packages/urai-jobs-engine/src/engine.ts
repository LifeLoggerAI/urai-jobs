import * as admin from 'firebase-admin';
import { CloudTasksClient } from '@google-cloud/tasks';
import { z, ZodError } from 'zod';
import { backoff } from './lib/backoff';
import { claimJob, releaseJob } from './lib/claim';
import { Job, JobPayload, JobStatus } from './types/jobs';
import { handlers } from './handlers';
import { log } from './lib/logger';
import { v4 as uuidv4 } from 'uuid';

const envSchema = z.object({
  GCLOUD_PROJECT: z.string(),
  QUEUE_LOCATION: z.string().default('us-central1'),
  QUEUE_ID: z.string().default('urai-jobs'),
});

const env = envSchema.parse(process.env);

const RUN_JOB_URL = `https://us-central1-${env.GCLOUD_PROJECT}.cloudfunctions.net/runJob`;

export class JobEngine {
  private firestore = admin.firestore();
  private tasksClient = new CloudTasksClient();

  async enqueue<T extends z.ZodType<any, any>>(type: string, payload: JobPayload<T>, options: { idempotencyKey: string, scheduledFor?: Date }) {
    const idempotencyKey = options.idempotencyKey;
    const jobId = `${type}-${idempotencyKey}`;
    const jobRef = this.firestore.collection('jobs').doc(jobId);

    try {
      const job = await this.firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(jobRef);
        if (doc.exists) {
          return doc.data() as Job<T>;
        }

        const newJob: Job<T> = {
          id: jobId,
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
          traceId: uuidv4(),
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
            serviceAccountEmail: `${env.GCLOUD_PROJECT}@appspot.gserviceaccount.com`,
          },
        },
        scheduleTime: options.scheduledFor ? { seconds: Math.floor(options.scheduledFor.getTime() / 1000) } : undefined,
      };

      const parent = this.tasksClient.queuePath(env.GCLOUD_PROJECT, env.QUEUE_LOCATION, env.QUEUE_ID);
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
    return doc.data() as Job<any>;
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

    log('info', 'starting job', job);

    const handler = handlers[job.type];
    if (!handler) {
      log('error', 'no handler for job type', job);
      throw new Error(`No handler for job type ${job.type}`);
    }

    try {
      handler.payload.parse(job.payload);
    } catch (error) {
      log('error', 'invalid payload', job, { error: (error as ZodError).format() });
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

      log('info', 'job succeeded', job);
      await releaseJob(this.firestore, jobRef, 'succeeded', { result });
      await runRef.update({ status: 'succeeded', endedAt: new Date(), metrics: { durationMs: 0, coldStart: false } });
    } catch (error: any) {
      log('error', 'job failed', job, { error: error.message });
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
    const job = doc.data() as Job<any>;

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
