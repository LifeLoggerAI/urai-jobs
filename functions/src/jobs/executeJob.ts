import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import axios from 'axios';
import { z } from 'zod';
import type { Job, JobConsentContext } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { consentBlockRef, isConsentContext } from '../privacy/consentBlocks.js';
import { workerEnvKeyForJobType, workerRouteForJobType } from '../core/runtimeJobTypes.js';
import { executeTinyFishJob, isTinyFishJobType, tinyFishApiKeySecret } from '../providers/tinyfish.js';
import { canFinalizeExecution, decideExecutionStart, isTerminalJobStatus } from './executionGuards.js';

// URAI Jobs worker routing audit markers.
// asset/spatial/studio subsystem workers route: '/'
// narrator, career, content, storytime, analytics, and communications workers route: '/execute-job'

const JOB_EXECUTION_TOPIC = process.env.PUBSUB_JOB_EXECUTION_TOPIC || 'job-execution';
const PRODUCTION_ENVS = new Set(['prod', 'production', 'staging']);
const workerTokenSecret = defineSecret('URAI_JOBS_WORKER_TOKEN');

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

type FailureOutcome = 'failed' | 'ignored' | 'callback-pending';

const JobExecutionMessageSchema = z.object({
  jobId: z.string().min(1),
  leaseToken: z.string().min(1),
});

function jobConsentContexts(job: Job) {
  const contexts: JobConsentContext[] = [];
  if (isConsentContext(job.consent)) contexts.push(job.consent);
  if (Array.isArray(job.consents)) {
    for (const consent of job.consents) {
      if (isConsentContext(consent)) contexts.push(consent);
    }
  }
  const seen = new Set<string>();
  return contexts.filter((consent) => {
    const key = `${consent.purpose}\n${consent.policyVersion}\n${consent.decisionReceiptId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getJobType(job: Job): string {
  return String(job.type || job.jobType || '');
}

function getWorkerEnvKey(jobType: string): string | null {
  return workerEnvKeyForJobType(jobType);
}

function getWorkerRoute(jobType: string): string {
  return workerRouteForJobType(jobType) || '/execute-job';
}

function getWorkerTarget(jobType: string): WorkerTarget | null {
  const envKey = getWorkerEnvKey(jobType);
  if (!envKey) return null;
  const url = process.env[envKey];
  if (!url) return null;
  return { url, route: getWorkerRoute(jobType), envKey };
}

function normalizedEnv(): string {
  return String(process.env.URAI_ENV || process.env.NODE_ENV || 'local').toLowerCase();
}

function inlineFallbackAllowed(jobType?: string): boolean {
  if (jobType === 'memory.private-source.transcribe' || jobType === 'memory.private-source.reconstruct-place') return false;
  if (PRODUCTION_ENVS.has(normalizedEnv())) return false;
  return process.env.URAI_JOBS_ALLOW_INLINE_FALLBACK === 'true' || process.env.FUNCTIONS_EMULATOR === 'true';
}

function getWorkerToken(): string {
  try {
    return workerTokenSecret.value() || process.env.URAI_JOBS_WORKER_TOKEN || '';
  } catch {
    return process.env.URAI_JOBS_WORKER_TOKEN || '';
  }
}

function getWorkerAuthHeaders(): Record<string, string> {
  const token = getWorkerToken();
  if (!token && PRODUCTION_ENVS.has(normalizedEnv())) {
    throw new Error('URAI_JOBS_WORKER_TOKEN Secret Manager binding is required in production.');
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getPayloadRecord(job: Job): Record<string, unknown> {
  return job.payload && typeof job.payload === 'object' ? (job.payload as Record<string, unknown>) : {};
}

type TrustedNarratorProviderAuthorization = {
  provider: 'elevenlabs';
  ownerUid: string;
  consentReceiptId: string;
  rightsReceiptId: string;
  provenanceRef: string;
  voiceId: string;
};

async function resolveTrustedNarratorProviderAuthorization(job: Job): Promise<TrustedNarratorProviderAuthorization | null> {
  const payload = getPayloadRecord(job);
  if (payload.provider !== 'elevenlabs') return null;
  if (!job.ownerUid) throw new Error('elevenlabs_owner_required');
  const consent = job.consent;
  if (!isConsentContext(consent)) throw new Error('elevenlabs_canonical_consent_required');

  const voiceId = typeof payload.voiceId === 'string' ? payload.voiceId.trim() : '';
  if (!voiceId) throw new Error('elevenlabs_voice_id_required');

  const authorization = await getFirestore()
    .doc(`users/${job.ownerUid}/providerAuthorizations/elevenlabs`)
    .get();
  if (!authorization.exists) throw new Error('elevenlabs_server_authorization_required');

  const data = authorization.data() || {};
  const voiceIds = Array.isArray(data.voiceIds) ? data.voiceIds.map((value) => String(value)) : [];
  const consentPurpose = String(data.consentPurpose || '');
  const policyVersion = String(data.policyVersion || '');
  const consentReceiptId = String(data.decisionReceiptId || '');
  const rightsReceiptId = String(data.rightsReceiptId || '');
  const provenanceRef = String(data.provenanceRef || '');

  if (
    data.enabled !== true ||
    data.provider !== 'elevenlabs' ||
    data.ownerUid !== job.ownerUid ||
    consentPurpose !== consent.purpose ||
    policyVersion !== consent.policyVersion ||
    consentReceiptId !== consent.decisionReceiptId ||
    !voiceIds.includes(voiceId) ||
    !consentReceiptId ||
    !rightsReceiptId ||
    !provenanceRef
  ) {
    throw new Error('elevenlabs_server_authorization_mismatch');
  }

  return {
    provider: 'elevenlabs',
    ownerUid: job.ownerUid,
    consentReceiptId,
    rightsReceiptId,
    provenanceRef,
    voiceId,
  };
}

function cleanPrefix(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return raw.replace(/^\/+|\/+$/g, '') || fallback;
}

function timestampMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const millis = new Date(value).getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
}

function activeAsyncCallbackForLease(job: Job, leaseToken: string, nowMillis: number): boolean {
  const execution = job.execution;
  if (execution?.asyncCallbackPending !== true) return false;
  if (execution.callbackLeaseToken !== leaseToken) return false;
  const deadlineMillis = timestampMillis(execution.callbackDeadlineAt);
  return deadlineMillis !== null && deadlineMillis > nowMillis;
}

function createInlineWorkerResult(job: Job, jobId: string, jobType: string): InlineWorkerResult {
  const payload = getPayloadRecord(job);
  const outputPrefix = cleanPrefix(payload.outputPrefix, `${jobType.replace(/[^a-z0-9]+/gi, '-')}/${jobId}`);
  const completedAt = new Date().toISOString();

  if (jobType === 'asset-render' || jobType === 'asset.render') {
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

  if (jobType === 'studio.render.video') {
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

  if (jobType === 'narrator.tts') {
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

  throw new Error(`Inline fallback is not implemented for job type ${jobType}.`);
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

async function handleJobFailure(jobId: string, leaseToken: string, error: unknown) {
  const db = getFirestore();
  const jobRef = jobDoc(jobId);
  const queueRef = jobQueueEntryDoc(jobId);
  const errorMessage = error instanceof Error ? error.message : String(error);

  const outcome = await db.runTransaction<FailureOutcome>(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) return 'ignored';

    const current = snapshot.data() as Job;
    if (current.status !== 'RUNNING' || current.execution?.leaseToken !== leaseToken) {
      return 'ignored';
    }
    if (activeAsyncCallbackForLease(current, leaseToken, Date.now())) {
      return 'callback-pending';
    }

    const now = FieldValue.serverTimestamp();
    const attemptCount = Number(current.execution?.attemptCount || 0);
    const maxAttempts = Number(current.execution?.maxAttempts || current.maxAttempts || 3);

    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || attemptCount >= maxAttempts) {
      transaction.update(jobRef, {
        status: 'DEAD',
        error: { message: errorMessage },
        lease: FieldValue.delete(),
        updatedAt: now,
        completedAt: now,
        'execution.leaseToken': FieldValue.delete(),
        'execution.completedAt': now,
        'execution.asyncCallbackPending': false,
        'execution.callbackTokenHash': FieldValue.delete(),
        'execution.callbackLeaseToken': FieldValue.delete(),
        'execution.callbackDeadlineAt': FieldValue.delete(),
      });
      transaction.set(queueRef, {
        jobId,
        status: 'DEAD',
        lease: FieldValue.delete(),
        updatedAt: now,
      }, { merge: true });
      return 'failed';
    }

    const retryDelayMs = Math.min(60000, 1000 * Math.pow(2, Math.max(1, attemptCount)));
    const nextAvailableAt = new Date(Date.now() + retryDelayMs);
    transaction.update(jobRef, {
      status: 'PENDING',
      retryCount: FieldValue.increment(1),
      error: { message: errorMessage },
      lease: FieldValue.delete(),
      updatedAt: now,
      completedAt: FieldValue.delete(),
      'execution.leaseToken': FieldValue.delete(),
      'execution.completedAt': FieldValue.delete(),
      'execution.asyncCallbackPending': false,
      'execution.callbackTokenHash': FieldValue.delete(),
      'execution.callbackLeaseToken': FieldValue.delete(),
      'execution.callbackDeadlineAt': FieldValue.delete(),
    });
    transaction.set(queueRef, {
      jobId,
      status: 'PENDING',
      availableAt: nextAvailableAt,
      retryCount: FieldValue.increment(1),
      lease: FieldValue.delete(),
      updatedAt: now,
    }, { merge: true });
    return 'failed';
  });

  if (outcome === 'callback-pending') {
    console.warn(`Preserved active asynchronous callback attempt for ${jobId} after ambiguous dispatch error:`, errorMessage);
    await appendJobLog(jobId, {
      level: 'warn',
      source: 'executeJob',
      message: 'Dispatch returned an error after the worker registered an active callback attempt; terminal failure was deferred.',
      metadata: { error: errorMessage, leaseTokenBound: true },
    });
    return;
  }

  if (outcome === 'ignored') {
    console.warn(`Ignored execution failure for stale, non-running, or terminal job ${jobId}:`, errorMessage);
    return;
  }

  await appendJobLog(jobId, {
    level: 'error',
    source: 'executeJob',
    message: 'Job execution failed; retry or DEAD transition applied by canonical failure policy.',
    metadata: { error: errorMessage },
  });

  console.error(`Job ${jobId} failed:`, error);
}

export const executeJob = onMessagePublished({
  topic: JOB_EXECUTION_TOPIC,
  // 110s render + 10s transport allowance + bounded bookkeeping headroom.
  // The function must outlive its existing worker request, not abandon it.
  timeoutSeconds: 180,
  secrets: [workerTokenSecret, tinyFishApiKeySecret],
}, async (event) => {
  const validationResult = JobExecutionMessageSchema.safeParse(event.data.message.json);
  if (!validationResult.success) {
    console.error('Invalid job execution message:', validationResult.error.flatten());
    return;
  }

  const { jobId, leaseToken } = validationResult.data;
  const db = getFirestore();
  const jobRef = jobDoc(jobId);
  const queueRef = jobQueueEntryDoc(jobId);

  const prepared = await db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef);
    if (!jobSnapshot.exists) {
      return { action: 'ignore' as const, reason: 'missing-job' };
    }

    const job = jobSnapshot.data() as Job;
    const decision = decideExecutionStart(job, leaseToken);
    if (decision.action === 'ignore') {
      return decision;
    }

    const consentContexts = jobConsentContexts(job);
    if (job.ownerUid && consentContexts.length > 0) {
      const blockSnapshots = await Promise.all(
        consentContexts.map((context) => transaction.get(consentBlockRef(job.ownerUid!, context.purpose)))
      );
      const blockedPurpose = blockSnapshots
        .map((snapshot, index) => ({ snapshot, purpose: consentContexts[index].purpose }))
        .find(({ snapshot }) => snapshot.exists && snapshot.data()?.active === true)?.purpose;
      if (blockedPurpose) {
        const now = FieldValue.serverTimestamp();
        transaction.update(jobRef, {
          status: 'CANCELLED',
          lease: FieldValue.delete(),
          updatedAt: now,
          completedAt: now,
          'execution.leaseToken': FieldValue.delete(),
          'execution.completedAt': now,
        });
        transaction.set(queueRef, {
          jobId,
          status: 'CANCELLED',
          lease: FieldValue.delete(),
          updatedAt: now,
        }, { merge: true });
        return { action: 'ignore' as const, reason: 'consent-revoked' as const };
      }
    }

    const now = FieldValue.serverTimestamp();
    transaction.update(jobRef, {
      status: 'RUNNING',
      'execution.leaseToken': leaseToken,
      'execution.startedAt': now,
      'execution.attemptCount': FieldValue.increment(1),
      'execution.asyncCallbackPending': false,
      'execution.callbackTokenHash': FieldValue.delete(),
      'execution.callbackLeaseToken': FieldValue.delete(),
      'execution.callbackDeadlineAt': FieldValue.delete(),
      'lease.heartbeatAt': now,
      updatedAt: now,
    });
    transaction.update(queueRef, {
      status: 'RUNNING',
      'lease.heartbeatAt': now,
      updatedAt: now,
    });

    return { action: 'start' as const, job };
  });

  if (prepared.action !== 'start') {
    console.warn(`Ignoring execution message for ${jobId}: ${prepared.reason}`);
    if (prepared.reason !== 'missing-job') {
      await appendJobLog(jobId, {
        level: 'warn',
        source: 'executeJob',
        message: 'Execution message ignored.',
        metadata: { reason: prepared.reason },
      });
    }
    return;
  }

  const job = prepared.job;
  const jobType = getJobType(job);
  const target = getWorkerTarget(jobType);

  await appendJobLog(jobId, {
    level: 'info',
    source: 'executeJob',
    message: 'Job execution started.',
    metadata: { jobType },
  });

  try {
    let result: unknown;

    if (isTinyFishJobType(jobType)) {
      await appendJobLog(jobId, {
        level: 'info',
        source: 'executeJob',
        message: 'Executing governed TinyFish web job.',
        metadata: { jobType, provider: 'tinyfish' },
      });
      result = await executeTinyFishJob(jobType, getPayloadRecord(job));
    } else if (target) {
      const dispatchConsentContexts = jobConsentContexts(job);
      if (job.ownerUid && dispatchConsentContexts.length > 0) {
        const blockSnapshots = await Promise.all(
          dispatchConsentContexts.map((context) => consentBlockRef(job.ownerUid!, context.purpose).get())
        );
        const blockedPurpose = blockSnapshots
          .map((snapshot, index) => ({ snapshot, purpose: dispatchConsentContexts[index].purpose }))
          .find(({ snapshot }) => snapshot.exists && snapshot.data()?.active === true)?.purpose;
        if (blockedPurpose) {
          const now = FieldValue.serverTimestamp();
          await db.runTransaction(async (transaction) => {
            const currentSnapshot = await transaction.get(jobRef);
            if (!currentSnapshot.exists) return;
            const current = currentSnapshot.data() as Job;
            if (current.status !== 'RUNNING' || current.execution?.leaseToken !== leaseToken) return;
            transaction.update(jobRef, {
              status: 'CANCELLED',
              lease: FieldValue.delete(),
              updatedAt: now,
              completedAt: now,
              'execution.leaseToken': FieldValue.delete(),
              'execution.completedAt': now,
            });
            transaction.set(queueRef, {
              jobId,
              status: 'CANCELLED',
              lease: FieldValue.delete(),
              updatedAt: now,
            }, { merge: true });
          });
          await appendJobLog(jobId, {
            level: 'warn',
            source: 'executeJob',
            message: 'Worker dispatch blocked because required consent was revoked.',
            metadata: { jobType, consentPurpose: blockedPurpose },
          });
          return;
        }
      }

      const workerUrl = target.url.replace(/\/$/, '');
      const route = target.route;

      await appendJobLog(jobId, {
        level: 'info',
        source: 'executeJob',
        message: 'Sending job to configured worker.',
        metadata: { jobType, workerEnvKey: target.envKey, route },
      });

      const providerAuthorization = jobType === 'narrator.tts'
        ? await resolveTrustedNarratorProviderAuthorization(job)
        : null;

      const response = await axios.post(`${workerUrl}${route}`, {
        ...job,
        jobId,
        leaseToken,
        type: jobType,
        jobType,
        ...(providerAuthorization ? { providerAuthorization } : {}),
      }, {
        headers: getWorkerAuthHeaders(),
        timeout: jobType === 'studio.render.video'
          ? 120000
          : Math.max(1, Math.min(120000, parseInt(process.env.URAI_JOBS_WORKER_TIMEOUT_MS || '', 10) || 120000)),
        validateStatus: (status) => status >= 200 && status < 300,
      });

      result = response.data;

      if (response.status === 202) {
        await appendJobLog(jobId, {
          level: 'info',
          source: 'executeJob',
          message: 'Worker accepted asynchronous execution; awaiting callback or terminal update.',
          metadata: { jobType, workerEnvKey: target.envKey },
        });
        return;
      }
    } else {
      const envKey = getWorkerEnvKey(jobType);
      if (!envKey) {
        throw new Error(`No worker mapping is registered for job type ${jobType}.`);
      }

      if (!inlineFallbackAllowed(jobType)) {
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

    const finalized = await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(jobRef);
      if (!currentSnapshot.exists) return false;

      const current = currentSnapshot.data() as Job;
      if (!canFinalizeExecution(current, leaseToken)) {
        return false;
      }

      const now = FieldValue.serverTimestamp();
      transaction.update(jobRef, {
        status: 'SUCCESS',
        result,
        output: result,
        error: FieldValue.delete(),
        lease: FieldValue.delete(),
        updatedAt: now,
        completedAt: now,
        'execution.leaseToken': FieldValue.delete(),
        'execution.completedAt': now,
        'execution.asyncCallbackPending': false,
        'execution.callbackTokenHash': FieldValue.delete(),
        'execution.callbackLeaseToken': FieldValue.delete(),
        'execution.callbackDeadlineAt': FieldValue.delete(),
      });
      transaction.set(queueRef, {
        jobId,
        status: 'DONE',
        lease: FieldValue.delete(),
        updatedAt: now,
      }, { merge: true });
      return true;
    });

    if (!finalized) {
      await appendJobLog(jobId, {
        level: 'warn',
        source: 'executeJob',
        message: 'Worker result was not applied because the job state or lease changed.',
        metadata: { jobType },
      });
      return;
    }

    await appendJobLog(jobId, {
      level: 'info',
      source: 'executeJob',
      message: 'Job execution succeeded.',
      metadata: { jobType },
    });
  } catch (error) {
    await handleJobFailure(jobId, leaseToken, error);
  }
});
