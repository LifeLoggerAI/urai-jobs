import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { ulid } from 'ulid';
import { z } from 'zod';
import type { Job, JobConsentContext, JobQueueEntry } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { bindingMatches, buildIdempotencyBindingId, buildRequestFingerprint, type IdempotencyBinding } from '../core/jobsReliability.js';
import { consentBlockRef } from '../privacy/consentBlocks.js';

const bridgeTokenSecret = defineSecret('URAI_STORYTIME_JOBS_BRIDGE_TOKEN');
const IDEMPOTENCY_COLLECTION = 'storytimeNarratorBridgeBindings';
const MAX_BODY_BYTES = 24 * 1024;

const IdentitySchema = z.object({
  userId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  sessionId: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  narratorScriptId: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();

const ConsentSchema = z.object({
  purpose: z.literal('storytime.voiceover'),
  policyVersion: z.string().trim().min(1).max(80),
  decisionReceiptId: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();

const CreateSchema = IdentitySchema.extend({
  action: z.literal('create'),
  idempotencyKey: z.string().trim().min(8).max(160),
  consent: ConsentSchema,
  payload: z.object({
    text: z.string().min(1).max(5000),
    locale: z.string().trim().min(2).max(35).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).default('en-US'),
    provider: z.enum(['google', 'elevenlabs']).default('google'),
    voice: z.string().trim().min(1).max(160).optional(),
    voiceId: z.string().trim().min(1).max(160).optional(),
    format: z.enum(['MP3', 'OGG_OPUS']).default('MP3'),
  }).strict(),
}).strict();

const JobActionSchema = IdentitySchema.extend({
  action: z.enum(['status', 'cancel', 'playback', 'delete-output']),
  jobId: z.string().trim().min(10).max(64).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

const RequestSchema = z.union([CreateSchema, JobActionSchema]);

function productionRuntime() {
  return new Set(['staging', 'prod', 'production']).has(String(process.env.URAI_ENV || process.env.NODE_ENV || '').toLowerCase());
}

function configuredToken() {
  try {
    return bridgeTokenSecret.value() || process.env.URAI_STORYTIME_JOBS_BRIDGE_TOKEN || '';
  } catch {
    return process.env.URAI_STORYTIME_JOBS_BRIDGE_TOKEN || '';
  }
}

function authorized(header: string) {
  const expected = configuredToken();
  if (!expected) return !productionRuntime() && process.env.FUNCTIONS_EMULATOR === 'true';
  const expectedHash = createHash('sha256').update(`Bearer ${expected}`).digest();
  const actualHash = createHash('sha256').update(header || '').digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function bodyBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8');
}

function safeOutput(output: unknown) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return undefined;
  const value = output as Record<string, unknown>;
  return {
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : undefined,
    size: typeof value.size === 'number' ? value.size : undefined,
    provider: typeof value.provider === 'string' ? value.provider : undefined,
    modelId: typeof value.modelId === 'string' ? value.modelId : undefined,
    voiceId: typeof value.voiceId === 'string' ? value.voiceId : undefined,
    provenanceRef: typeof value.provenanceRef === 'string' ? value.provenanceRef : undefined,
    consentRef: typeof value.consentRef === 'string' ? value.consentRef : undefined,
    rightsRef: typeof value.rightsRef === 'string' ? value.rightsRef : undefined,
  };
}

type BoundJob = Job & {
  sourceSystem?: string;
  sourceSessionId?: string;
  sourceNarratorScriptId?: string;
};

function assertBoundJob(job: BoundJob, input: z.infer<typeof JobActionSchema>) {
  if (
    job.sourceSystem !== 'urai-storytime' ||
    job.ownerUid !== input.userId ||
    job.sourceSessionId !== input.sessionId ||
    job.sourceNarratorScriptId !== input.narratorScriptId ||
    (job.jobType || job.type) !== 'narrator.tts'
  ) {
    throw new Error('storytime_narrator_boundary_mismatch');
  }
  return job;
}

async function loadBoundJob(input: z.infer<typeof JobActionSchema>) {
  const snapshot = await jobDoc(input.jobId).get();
  if (!snapshot.exists) throw new Error('job_not_found');
  return assertBoundJob(snapshot.data() as BoundJob, input);
}

function safeProjection(job: BoundJob) {
  return {
    jobId: job.jobId,
    status: job.status,
    retryCount: job.retryCount,
    output: safeOutput(job.output),
    error: job.error && typeof job.error === 'object'
      ? { message: String((job.error as { message?: unknown }).message || 'job_failed').slice(0, 400) }
      : undefined,
  };
}

async function createNarratorJob(input: z.infer<typeof CreateSchema>) {
  if (input.payload.provider === 'elevenlabs' && !input.payload.voiceId) {
    throw new Error('elevenlabs_voice_id_required');
  }
  const consent: JobConsentContext = input.consent;
  const blocked = await consentBlockRef(input.userId, consent.purpose).get();
  if (blocked.exists && blocked.data()?.active === true) throw new Error('storytime_voiceover_consent_revoked');

  const jobType = 'narrator.tts';
  const outputPrefix = `storytime/${input.userId}/${input.sessionId}/${input.narratorScriptId}`;
  const payload = {
    text: input.payload.text,
    locale: input.payload.locale,
    provider: input.payload.provider,
    ...(input.payload.voice ? { voice: input.payload.voice } : {}),
    ...(input.payload.voiceId ? { voiceId: input.payload.voiceId } : {}),
    format: input.payload.format,
    outputPrefix,
  };
  const fingerprintPayload = {
    userId: input.userId,
    sessionId: input.sessionId,
    narratorScriptId: input.narratorScriptId,
    consent,
    payload,
  };
  const requestFingerprint = buildRequestFingerprint(jobType, fingerprintPayload);
  const expectedBinding = { ownerUid: input.userId, jobType, requestFingerprint };
  const db = getFirestore();
  const bindingRef = db.collection(IDEMPOTENCY_COLLECTION)
    .doc(buildIdempotencyBindingId(input.userId, jobType, input.idempotencyKey));
  const existing = await bindingRef.get();
  if (existing.exists) {
    const binding = existing.data() as Partial<IdempotencyBinding>;
    if (!bindingMatches(binding, expectedBinding) || typeof binding.jobId !== 'string' || !binding.jobId) {
      throw new Error('idempotency_conflict');
    }
    return { jobId: binding.jobId, deduplicated: true };
  }

  const jobId = ulid();
  const now = FieldValue.serverTimestamp();
  const newJob: BoundJob = {
    jobId,
    type: jobType,
    jobType,
    status: 'PENDING',
    payload,
    ownerUid: input.userId,
    consent,
    retryCount: 0,
    execution: { attemptCount: 0, maxAttempts: 3 },
    sourceSystem: 'urai-storytime',
    sourceSessionId: input.sessionId,
    sourceNarratorScriptId: input.narratorScriptId,
  };
  const queue: JobQueueEntry = { jobId, jobType, status: 'PENDING', attemptCount: 0 };

  return db.runTransaction(async (transaction) => {
    const inside = await transaction.get(bindingRef);
    if (inside.exists) {
      const binding = inside.data() as Partial<IdempotencyBinding>;
      if (!bindingMatches(binding, expectedBinding) || typeof binding.jobId !== 'string' || !binding.jobId) {
        throw new Error('idempotency_conflict');
      }
      return { jobId: binding.jobId, deduplicated: true };
    }
    transaction.create(jobDoc(jobId), { ...newJob, createdAt: now, updatedAt: now });
    transaction.create(jobQueueEntryDoc(jobId), { ...queue, availableAt: now, createdAt: now });
    transaction.create(jobDoc(jobId).collection('logs').doc('storytime-bridge-created'), {
      level: 'info',
      source: 'storytimeNarratorBridge',
      message: 'Narrator TTS job accepted from authenticated Storytime bridge.',
      metadata: {
        ownerUid: input.userId,
        sessionId: input.sessionId,
        narratorScriptId: input.narratorScriptId,
        provider: input.payload.provider,
        consentReceiptId: consent.decisionReceiptId,
      },
      createdAt: now,
    });
    transaction.create(bindingRef, { ...expectedBinding, jobId, createdAt: now });
    return { jobId, deduplicated: false };
  });
}

async function cancelJob(input: z.infer<typeof JobActionSchema>) {
  const db = getFirestore();
  return db.runTransaction(async (transaction) => {
    const ref = jobDoc(input.jobId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error('job_not_found');
    const job = assertBoundJob(snapshot.data() as BoundJob, input);
    if (['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED'].includes(String(job.status))) return safeProjection(job);
    const now = FieldValue.serverTimestamp();
    transaction.update(ref, {
      status: 'CANCELLED',
      completedAt: now,
      updatedAt: now,
      lease: FieldValue.delete(),
      'execution.leaseToken': FieldValue.delete(),
      'execution.asyncCallbackPending': false,
    });
    transaction.set(jobQueueEntryDoc(input.jobId), {
      jobId: input.jobId,
      status: 'CANCELLED',
      lease: FieldValue.delete(),
      updatedAt: now,
    }, { merge: true });
    return { ...safeProjection(job), status: 'CANCELLED' };
  });
}

function parseArtifactPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('gs://')) throw new Error('narrator_artifact_missing');
  const raw = value.slice(5);
  const slash = raw.indexOf('/');
  if (slash < 1 || slash === raw.length - 1) throw new Error('narrator_artifact_invalid');
  const bucket = raw.slice(0, slash);
  const objectPath = raw.slice(slash + 1);
  if (objectPath.includes('..')) throw new Error('narrator_artifact_invalid');
  return { bucket, objectPath };
}

async function artifactLocation(input: z.infer<typeof JobActionSchema>) {
  const job = await loadBoundJob(input);
  if (String(job.status) !== 'SUCCESS') throw new Error('job_not_ready_for_playback');
  const output = job.output && typeof job.output === 'object' ? job.output as Record<string, unknown> : {};
  const location = parseArtifactPath(output.artifactPath);
  const allowedBucket = String(process.env.GCS_BUCKET_NAME || '').trim();
  const requiredPrefix = `storytime/${input.userId}/${input.sessionId}/`;
  if (!allowedBucket || location.bucket !== allowedBucket || !location.objectPath.startsWith(requiredPrefix)) {
    throw new Error('narrator_artifact_boundary_mismatch');
  }
  return { job, output, location };
}

async function playback(input: z.infer<typeof JobActionSchema>) {
  const { output, location } = await artifactLocation(input);
  const expiresAtMs = Date.now() + 5 * 60 * 1000;
  const [url] = await getStorage().bucket(location.bucket).file(location.objectPath).getSignedUrl({
    action: 'read',
    expires: expiresAtMs,
    responseDisposition: 'inline',
    responseType: typeof output.mimeType === 'string' ? output.mimeType : 'audio/mpeg',
  });
  return {
    url,
    expiresAt: new Date(expiresAtMs).toISOString(),
    mimeType: typeof output.mimeType === 'string' ? output.mimeType : 'audio/mpeg',
    provider: typeof output.provider === 'string' ? output.provider : undefined,
    modelId: typeof output.modelId === 'string' ? output.modelId : undefined,
    voiceId: typeof output.voiceId === 'string' ? output.voiceId : undefined,
  };
}

async function deleteOutput(input: z.infer<typeof JobActionSchema>) {
  const { location } = await artifactLocation(input);
  await getStorage().bucket(location.bucket).file(location.objectPath).delete({ ignoreNotFound: true });
  const now = FieldValue.serverTimestamp();
  await jobDoc(input.jobId).update({
    output: FieldValue.delete(),
    result: FieldValue.delete(),
    outputDeletedAt: now,
    outputDeletedBy: input.userId,
    updatedAt: now,
  });
  return { deleted: true };
}

export const storytimeNarratorBridge = onRequest({
  secrets: [bridgeTokenSecret],
  timeoutSeconds: 60,
  memory: '256MiB',
  cors: false,
}, async (req, res) => {
  res.set('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  if (!authorized(req.get('authorization') || '')) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  if (bodyBytes(req.body) > MAX_BODY_BYTES) {
    res.status(413).json({ ok: false, error: 'request_too_large' });
    return;
  }
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid_storytime_narrator_request' });
    return;
  }

  try {
    if (parsed.data.action === 'create') {
      const result = await createNarratorJob(parsed.data);
      res.status(result.deduplicated ? 200 : 202).json({ ok: true, status: 'queued', ...result });
      return;
    }
    if (parsed.data.action === 'status') {
      const job = await loadBoundJob(parsed.data);
      res.status(200).json({ ok: true, job: safeProjection(job) });
      return;
    }
    if (parsed.data.action === 'cancel') {
      const job = await cancelJob(parsed.data);
      res.status(200).json({ ok: true, job });
      return;
    }
    if (parsed.data.action === 'playback') {
      res.status(200).json({ ok: true, playback: await playback(parsed.data) });
      return;
    }
    res.status(200).json({ ok: true, deletion: await deleteOutput(parsed.data) });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'storytime_narrator_bridge_failed';
    const status = code === 'job_not_found' ? 404
      : code === 'storytime_narrator_boundary_mismatch' ? 403
      : code === 'storytime_voiceover_consent_revoked' ? 409
      : code === 'idempotency_conflict' ? 409
      : code === 'job_not_ready_for_playback' ? 409
      : code === 'narrator_artifact_boundary_mismatch' ? 403
      : code === 'narrator_artifact_missing' ? 409
      : code === 'elevenlabs_voice_id_required' ? 400
      : 400;
    res.status(status).json({ ok: false, error: code });
  }
});
