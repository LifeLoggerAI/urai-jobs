import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import axios from 'axios';
import { z } from 'zod';
import { Job, JobQueueEntry } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';

const JOB_EXECUTION_TOPIC = 'job-execution';
const TERMINAL_JOB_STATUSES = new Set(['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED']);

const JobExecutionMessageSchema = z.object({
  jobId: z.string(),
  leaseToken: z.string(),
});

type WorkerTarget = { url: string; route: string; envKey: string };
type StartDecision =
  | { action: 'run'; job: Job; jobType: string }
  | { action: 'noop'; reason: string; status?: string; jobType?: string };

function getJobType(job: Job): string {
  return String(job.type || job.jobType || 'narrator.tts');
}

function getWorkerEnvKey(jobType: string): string {
  if (jobType === 'asset-render' || jobType === 'asset.render' || jobType.startsWith('asset')) return 'ASSET_WORKER_URL';
  if (jobType === 'spatial-index' || jobType === 'spatial.index' || jobType.startsWith('spatial')) return 'SPATIAL_WORKER_URL';
  if (jobType === 'studio-render' || jobType === 'studio.render' || jobType.startsWith('studio')) return 'STUDIO_WORKER_URL';
  if (jobType.startsWith('career.')) return 'CAREER_WORKER_URL';
  return 'NARRATOR_WORKER_URL';
}

function getWorkerRoute(jobType: string): string {
  if (jobType === 'asset-render' || jobType === 'asset.render' || jobType.startsWith('asset')) return '/';
  if (jobType === 'spatial-index' || jobType === 'spatial.index' || jobType.startsWith('spatial')) return '/';
  if (jobType === 'studio-render' || jobType === 'studio.render' || jobType.startsWith('studio')) return '/';
  return '/execute-job';
}

function getWorkerTarget(jobType: string): WorkerTarget | null {
  const envKey = getWorkerEnvKey(jobType);
  const url = process.env[envKey];
  if (!url) return null;
  return { url, route: getWorkerRoute(jobType), envKey };
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.URAI_ENV === 'prod';
}

function inlineFallbackAllowed(): boolean {
  return process.env.URAI_JOBS_ALLOW_INLINE_FALLBACK === 'true' && !isProductionRuntime();
}

function getWorkerAuthHeaders(): Record<string, string> {
  const workerToken = process.env.URAI_JOBS_WORKER_TOKEN;
  return workerToken ? { authorization: `Bearer ${workerToken}` } : {};
}

function requireWorkerAuthConfigForProduction() {
  if (isProductionRuntime() && !process.env.URAI_JOBS_WORKER_TOKEN) {
    throw new Error('URAI_JOBS_WORKER_TOKEN is required in production before dispatching to external workers.');
  }
}

function cleanErrorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
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
  const errorMessage = cleanErrorMessage(error);
  let terminalNoop = false;

  await db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef);
    if (!jobSnapshot.exists) return;

    const job = jobSnapshot.data() as Job;
    if (TERMINAL_JOB_STATUSES.has(String(job.status))) {
      terminalNoop = true;
      return;
    }

    transaction.update(jobRef, {
      status: 'FAILED',
      error: { message: errorMessage },
      lease: FieldValue.delete(),
      updatedAt: now,
      completedAt: now,
    });
    transaction.set(queueRef, { status: 'DONE', lease: FieldValue.delete(), updatedAt: now }, { merge: true });
  });

  await appendJobLog(jobId, {
    level: terminalNoop ? 'warn' : 'error',
    source: 'executeJob',
    message: terminalNoop ? 'Failure handler no-op because job is already terminal.' : 'Job execution failed.',
    metadata: { error: errorMessage },
  });

  if (!terminalNoop) console.error(`Job ${jobId} failed:`, errorMessage);
}

async function startJobIfLeased(jobId: string, leaseToken: string): Promise<StartDecision> {
  const db = getFirestore();
  const jobRef = jobDoc(jobId);
  const queueRef = jobQueueEntryDoc(jobId);

  return db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef);
    const queueSnapshot = await transaction.get(queueRef);
    const now = FieldValue.serverTimestamp();

    if (!jobSnapshot.exists) {
      return { action: 'noop', reason: 'missing-job' };
    }

    const job = jobSnapshot.data() as Job;
    const jobType = getJobType(job);
    const status = String(job.status || '');

    if (TERMINAL_JOB_STATUSES.has(status)) {
      transaction.create(jobRef.collection('logs').doc(), {
        level: 'warn',
        source: 'executeJob',
        message: 'Duplicate execution ignored because job is already terminal.',
        metadata: { status, jobType },
        createdAt: now,
      });
      return { action: 'noop', reason: 'terminal', status, jobType };
    }

    if (!queueSnapshot.exists) {
      transaction.create(jobRef.collection('logs').doc(), {
        level: 'warn',
        source: 'executeJob',
        message: 'Execution ignored because queue entry is missing.',
        metadata: { status, jobType },
        createdAt: now,
      });
      return { action: 'noop', reason: 'missing-queue', status, jobType };
    }

    const queue = queueSnapshot.data() as JobQueueEntry;
    if (job.status !== 'LEASED' || queue.status !== 'LEASED') {
      transaction.create(jobRef.collection('logs').doc(), {
        level: 'warn',
        source: 'executeJob',
        message: 'Execution ignored because job is not in LEASED state.',
        metadata: { jobStatus: job.status, queueStatus: queue.status, jobType },
        createdAt: now,
      });
      return { action: 'noop', reason: 'not-leased', status, jobType };
    }

    if (job.lease?.leaseToken !== leaseToken || queue.lease?.leaseToken !== leaseToken) {
      transaction.create(jobRef.collection('logs').doc(), {
        level: 'warn',
        source: 'executeJob',
        message: 'Execution ignored because lease token did not match job and queue state.',
        metadata: { jobType },
        createdAt: now,
      });
      return { action: 'noop', reason: 'lease-mismatch', status, jobType };
    }

    transaction.update(jobRef, {
      status: 'RUNNING',
      'execution.leaseToken': leaseToken,
      'execution.startedAt': now,
      'lease.heartbeatAt': now,
      updatedAt: now,
    });
    transaction.update(queueRef, { status: 'RUNNING', updatedAt: now });
    transaction.create(jobRef.collection('logs').doc(), {
      level: 'info',
      source: 'executeJob',
      message: 'Job transitioned from LEASED to RUNNING.',
      metadata: { jobType },
      createdAt: now,
    });

    return { action: 'run', job, jobType };
  });
}

function createNonProductionInlineResult(job: Job, jobId: string, jobType: string) {
  return {
    ok: true,
    mode: 'inline-fallback',
    jobId,
    jobType,
    message: 'Completed by explicit non-production inline fallback. Production fallback is disabled by default.',
    payloadEcho: job.payload,
    completedAt: new Date().toISOString(),
  };
}

export const executeJob = onMessagePublished(JOB_EXECUTION_TOPIC, async (event) => {
  const validationResult = JobExecutionMessageSchema.safeParse(event.data.message.json);
  if (!validationResult.success) {
    console.error('Invalid job execution message:', validationResult.error.flatten());
    return;
  }

  const { jobId, leaseToken } = validationResult.data;

  try {
    const startDecision = await startJobIfLeased(jobId, leaseToken);
    if (startDecision.action !== 'run') {
      console.log(`Job ${jobId} execution no-op: ${startDecision.reason}`);
      return;
    }

    const { job, jobType } = startDecision;
    const target = getWorkerTarget(jobType);
    let result: unknown;

    await appendJobLog(jobId, {
      level: 'info',
      source: 'executeJob',
      message: 'Job execution started.',
      metadata: { jobType },
    });

    if (target) {
      requireWorkerAuthConfigForProduction();
      const workerUrl = target.url.replace(/\/$/, '');
      const route = target.route;

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
      }, {
        headers: getWorkerAuthHeaders(),
        timeout: Number(process.env.URAI_JOBS_WORKER_TIMEOUT_MS || 120000),
      });
      result = response.data;

      await appendJobLog(jobId, {
        level: 'info',
        source: 'executeJob',
        message: 'Worker response received.',
        metadata: { jobType, status: response.status },
      });
    } else if (inlineFallbackAllowed()) {
      const envKey = getWorkerEnvKey(jobType);
      result = createNonProductionInlineResult(job, jobId, jobType);
      await appendJobLog(jobId, {
        level: 'warn',
        source: 'executeJob',
        message: 'External worker URL is not configured. Completed job with explicit non-production inline fallback worker.',
        metadata: { jobType, missingEnv: envKey },
      });
    } else {
      const envKey = getWorkerEnvKey(jobType);
      throw new Error(`Worker URL missing for ${jobType}. Inline fallback is disabled by default; configure ${envKey} or explicit non-production URAI_JOBS_ALLOW_INLINE_FALLBACK=true.`);
    }

    const now = FieldValue.serverTimestamp();
    await getFirestore().runTransaction(async (transaction) => {
      const currentJob = await transaction.get(jobDoc(jobId));
      const status = String(currentJob.data()?.status || '');
      if (TERMINAL_JOB_STATUSES.has(status)) return;

      transaction.update(jobDoc(jobId), {
        status: 'SUCCESS',
        result,
        output: result,
        error: FieldValue.delete(),
        lease: FieldValue.delete(),
        updatedAt: now,
        completedAt: now,
        'execution.completedAt': now,
      });
      transaction.set(jobQueueEntryDoc(jobId), { status: 'DONE', lease: FieldValue.delete(), updatedAt: now }, { merge: true });
    });

    await appendJobLog(jobId, {
      level: 'info',
      source: 'executeJob',
      message: 'Job execution succeeded.',
      metadata: { jobType, resultPresent: result !== undefined },
    });
  } catch (error) {
    await handleJobFailure(jobId, error);
  }
});
