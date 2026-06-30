import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import axios from 'axios';
import { z } from 'zod';
import { Job } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';

// URAI Jobs worker routing audit markers.
// asset/spatial/studio subsystem workers route: '/'
// narrator and career execution workers route: '/execute-job'

const JOB_EXECUTION_TOPIC = 'job-execution';

const PRODUCTION_ENVS = new Set(['prod', 'production', 'staging']);

type WorkerTarget = { url: string; route: string; envKey: string };
type InlineWorkerResult = {
  ok: true;
  mode: 'inline-fallback';
  jobId: string;
  jobType: string;
  artifactUrl?: string;
  manifestUrl?: string;
  transcriptUrl?: string;
  indexUrl?: string;
  careerUrl?: string;
  message: string;
  payloadEcho: unknown;
  completedAt: string;
};

const JobExecutionMessageSchema = z.object({
  jobId: z.string(),
  leaseToken: z.string(),
});

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

function normalizedEnv(): string {
  return String(process.env.URAI_ENV || process.env.NODE_ENV || 'local').toLowerCase();
}

function inlineFallbackAllowed(): boolean {
  if (PRODUCTION_ENVS.has(normalizedEnv())) return false;
  return process.env.URAI_JOBS_ALLOW_INLINE_FALLBACK === 'true' || process.env.FUNCTIONS_EMULATOR === 'true';
}

function getWorkerAuthHeaders(): Record<string, string> {
  const token = process.env.URAI_JOBS_WORKER_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getPayloadRecord(job: Job): Record<string, unknown> {
  return job.payload && typeof job.payload === 'object' ? (job.payload as Record<string, unknown>) : {};
}

function cleanPrefix(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return raw.replace(/^\/+|\/+$/g, '') || fallback;
}

function createInlineWorkerResult(job: Job, jobId: string, jobType: string): InlineWorkerResult {
  const payload = getPayloadRecord(job);
  const outputPrefix = cleanPrefix(payload.outputPrefix, `${jobType.replace(/[^a-z0-9]+/gi, '-')}/${jobId}`);
  const completedAt = new Date().toISOString();

  if (jobType === 'asset-render' || jobType === 'asset.render' || jobType.startsWith('asset')) {
    return {
      ok: true,
      mode: 'inline-fallback',
      jobId,
      jobType,
      artifactUrl: `gs://urai-jobs-inline-artifacts/${outputPrefix}/asset.json`,
      manifestUrl: `gs://urai-jobs-inline-artifacts/${outputPrefix}/manifest.json`,
      message: 'Local inline fallback completed. This is not live worker proof.',
      payloadEcho: payload,
      completedAt,
    };
  }

  if (jobType === 'spatial-index' || jobType === 'spatial.index' || jobType.startsWith('spatial')) {
    return {
      ok: true,
      mode: 'inline-fallback',
      jobId,
      jobType,
      indexUrl: `gs://urai-jobs-inline-artifacts/${outputPrefix}/spatial-index.json`,
      manifestUrl: `gs://urai-jobs-inline-artifacts/${outputPrefix}/manifest.json`,
      message: 'Local inline fallback completed. This is not live worker proof.',
      payloadEcho: payload,
      completedAt,
    };
  }

  if (jobType === 'studio-render' || jobType === 'studio.render' || jobType.startsWith('studio')) {
    return {
      ok: true,
      mode: 'inline-fallback',
      jobId,
      jobType,
      artifactUrl: `gs://urai-jobs-inline-artifacts/${outputPrefix}/studio-render.json`,
      manifestUrl: `gs://urai-jobs-inline-artifacts/${outputPrefix}/manifest.json`,
      message: 'Local inline fallback completed. This is not live worker proof.',
      payloadEcho: payload,
      completedAt,
    };
  }

  if (jobType.startsWith('career.')) {
    return {
      ok: true,
      mode: 'inline-fallback',
      jobId,
      jobType,
      careerUrl: `gs://urai-jobs-inline-artifacts/${outputPrefix}/career.json`,
      manifestUrl: `gs://urai-jobs-inline-artifacts/${outputPrefix}/manifest.json`,
      message: 'Local inline fallback completed. This is not live worker proof.',
      payloadEcho: payload,
      completedAt,
    };
  }

  return {
    ok: true,
    mode: 'inline-fallback',
    jobId,
    jobType,
    transcriptUrl: `gs://urai-jobs-inline-artifacts/${outputPrefix}/narration.txt`,
    manifestUrl: `gs://urai-jobs-inline-artifacts/${outputPrefix}/manifest.json`,
    message: 'Local inline fallback completed. This is not live worker proof.',
    payloadEcho: payload,
    completedAt,
  };
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

    let result: unknown;

    if (target) {
      const workerUrl = target.url.replace(/\/$/, '');
      const route = target.route;

      await appendJobLog(jobId, {
        level: 'info',
        source: 'executeJob',
        message: 'Sending job to configured worker.',
        metadata: { jobType, workerEnvKey: target.envKey, route },
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
    } else {
      const envKey = getWorkerEnvKey(jobType);
      if (!inlineFallbackAllowed()) {
        throw new Error(`Worker URL ${envKey} is required for ${normalizedEnv()} runtime; inline fallback is disabled.`);
      }

      result = createInlineWorkerResult(job, jobId, jobType);

      await appendJobLog(jobId, {
        level: 'warn',
        source: 'executeJob',
        message: 'External worker URL is not configured. Local inline fallback was used; do not treat this as live worker proof.',
        metadata: { jobType, missingEnv: envKey, env: normalizedEnv() },
      });
    }

    const now = FieldValue.serverTimestamp();
    await db.runTransaction(async (transaction) => {
      transaction.update(jobRef, {
        status: 'SUCCESS',
        result,
        output: result,
        error: FieldValue.delete(),
        updatedAt: now,
        completedAt: now,
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
