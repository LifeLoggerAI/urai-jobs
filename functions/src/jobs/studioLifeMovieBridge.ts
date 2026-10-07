import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { ulid } from 'ulid';
import { z } from 'zod';
import type { Job, JobConsentContext, JobQueueEntry } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import {
  bindingMatches,
  buildIdempotencyBindingId,
  buildRequestFingerprint,
  type IdempotencyBinding,
} from '../core/jobsReliability.js';
import { StudioLifeMovieRenderPayloadSchema, assertLifeMovieTenantPaths } from './studioLifeMovieContract.js';
import { assertSceneTruthReceiptValue } from './sceneTruthReceipt.js';
import { consentBlockRef, isConsentContext } from '../privacy/consentBlocks.js';

const bridgeTokenSecret = defineSecret('URAI_STUDIO_JOBS_BRIDGE_TOKEN');
const sceneTruthReceiptSecret = defineSecret('URAI_SCENE_TRUTH_RECEIPT_HMAC');
const IDEMPOTENCY_COLLECTION = 'studioLifeMovieBridgeBindings';
const SCENE_TRUTH_RECEIPT_BINDING_COLLECTION = 'studioSceneTruthReceiptBindings';
const MAX_BODY_BYTES = 32768;

const IdentitySchema = z.object({
  tenantId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  userId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
}).strict();

const CreateSchema = IdentitySchema.extend({
  action: z.literal('create'),
  idempotencyKey: z.string().trim().min(8).max(160),
  consent: z.object({
    purpose: z.literal('life-movie.render'),
    policyVersion: z.string().trim().min(1).max(80),
    decisionReceiptId: z.string().trim().min(1).max(160),
  }).strict(),
  payload: StudioLifeMovieRenderPayloadSchema,
}).strict();

const JobActionSchema = IdentitySchema.extend({
  action: z.enum(['status', 'cancel', 'playback', 'download', 'delete-output']),
  jobId: z.string().trim().min(10).max(64).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

const RequestSchema = z.union([CreateSchema, JobActionSchema]);

function productionRuntime() {
  return new Set(['staging', 'prod', 'production']).has(String(process.env.URAI_ENV || process.env.NODE_ENV || '').toLowerCase());
}

function configuredToken() {
  try {
    return bridgeTokenSecret.value() || process.env.URAI_STUDIO_JOBS_BRIDGE_TOKEN || '';
  } catch {
    return process.env.URAI_STUDIO_JOBS_BRIDGE_TOKEN || '';
  }
}

function authorized(header: string) {
  const expected = configuredToken();
  if (!expected) return !productionRuntime() && process.env.FUNCTIONS_EMULATOR === 'true';
  const expectedHash = createHash('sha256').update(`Bearer ${expected}`).digest();
  const actualHash = createHash('sha256').update(header || '').digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function configuredSceneTruthSecret() {
  try {
    return sceneTruthReceiptSecret.value() || process.env.URAI_SCENE_TRUTH_RECEIPT_HMAC || '';
  } catch {
    return process.env.URAI_SCENE_TRUTH_RECEIPT_HMAC || '';
  }
}

function verifySceneTruthReceipt(projectId: string, digest: string, ownerUid: string, receiptRef: string) {
  return assertSceneTruthReceiptValue(
    projectId,
    digest,
    ownerUid,
    receiptRef,
    configuredSceneTruthSecret(),
  );
}

function jsonBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8');
}

type WorkerOutputArtifact = { kind?: unknown; ref?: unknown; mimeType?: unknown; checksum?: unknown };
type WorkerOutput = {
  outputs?: WorkerOutputArtifact[];
  renderPlanDigest?: unknown;
  sceneTruthReceiptRef?: unknown;
  sceneTruthDigest?: unknown;
  providerCalled?: unknown;
  providerSpendAuthorized?: unknown;
  publicReleaseAuthorized?: unknown;
};

function sanitizedOutput(output: unknown) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return undefined;
  const typed = output as WorkerOutput;
  const artifacts = Array.isArray(typed.outputs) ? typed.outputs.map((artifact) => ({
    kind: typeof artifact.kind === 'string' ? artifact.kind : 'unknown',
    mimeType: typeof artifact.mimeType === 'string' ? artifact.mimeType : undefined,
    checksum: typeof artifact.checksum === 'string' ? artifact.checksum : undefined,
  })) : [];
  return {
    artifacts,
    renderPlanDigest: typeof typed.renderPlanDigest === 'string' ? typed.renderPlanDigest : undefined,
    sceneTruthReceiptRef: typeof typed.sceneTruthReceiptRef === 'string' ? typed.sceneTruthReceiptRef : undefined,
    sceneTruthDigest: typeof typed.sceneTruthDigest === 'string' ? typed.sceneTruthDigest : undefined,
    providerCalled: typed.providerCalled === true,
    providerSpendAuthorized: typed.providerSpendAuthorized === true,
    publicReleaseAuthorized: typed.publicReleaseAuthorized === true,
  };
}

function safeJobProjection(job: Job) {
  return {
    jobId: job.jobId,
    jobType: job.jobType || job.type,
    status: job.status,
    tenantId: job.tenantId,
    ownerUid: job.ownerUid,
    retryCount: job.retryCount,
    output: sanitizedOutput(job.output),
    error: job.error && typeof job.error === 'object'
      ? { message: typeof (job.error as { message?: unknown }).message === 'string' ? (job.error as { message: string }).message.slice(0, 500) : 'job_failed' }
      : undefined,
  };
}

async function createLifeMovieJob(input: z.infer<typeof CreateSchema>) {
  const payload = assertLifeMovieTenantPaths(input.payload, input.tenantId);
  const purpose = input.consent?.purpose;
  const policyVersion = input.consent?.policyVersion;
  const decisionReceiptId = input.consent?.decisionReceiptId;
  if (purpose !== 'life-movie.render' || !policyVersion || !decisionReceiptId) {
    throw new Error('life_movie_consent_missing');
  }
  const consent: JobConsentContext = { purpose, policyVersion, decisionReceiptId };
  const sceneTruthReceipt = verifySceneTruthReceipt(payload.projectId, payload.sceneTruthDigest, input.userId, payload.sceneTruthReceiptRef);
  const consentSnapshot = await consentBlockRef(input.userId, consent.purpose).get();
  if (consentSnapshot.exists && consentSnapshot.data()?.active === true) {
    throw new Error('life_movie_consent_revoked');
  }
  const ownerBinding = `${input.tenantId}:${input.userId}`;
  const jobType = 'studio.render.video';
  const fingerprintPayload = { tenantId: input.tenantId, userId: input.userId, consent, payload };
  const requestFingerprint = buildRequestFingerprint(jobType, fingerprintPayload);
  const expectedBinding = { ownerUid: ownerBinding, jobType, requestFingerprint };
  const db = getFirestore();
  const bindingId = buildIdempotencyBindingId(ownerBinding, jobType, input.idempotencyKey);
  const bindingRef = db.collection(IDEMPOTENCY_COLLECTION).doc(bindingId);
  const sceneTruthBindingId = createHash('sha256').update(payload.sceneTruthReceiptRef).digest('hex');
  const sceneTruthBindingRef = db.collection(SCENE_TRUTH_RECEIPT_BINDING_COLLECTION).doc(sceneTruthBindingId);

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
  const newJob: Job = {
    jobId,
    type: jobType,
    jobType,
    status: 'PENDING',
    payload,
    ownerUid: input.userId,
    tenantId: input.tenantId,
    consent,
    retryCount: 0,
    execution: { attemptCount: 0, maxAttempts: 2 },
    sourceSystem: 'urai-studio',
    sourceProject: 'urai-studio',
  };
  const newQueueEntry: JobQueueEntry = {
    jobId,
    jobType,
    status: 'PENDING',
    attemptCount: 0,
  };

  return db.runTransaction(async (transaction) => {
    const inside = await transaction.get(bindingRef);
    const sceneTruthInside = await transaction.get(sceneTruthBindingRef);

    if (sceneTruthInside.exists) {
      const bound = sceneTruthInside.data() as {
        requestFingerprint?: unknown;
        ownerUid?: unknown;
        jobId?: unknown;
        projectId?: unknown;
        sceneTruthDigest?: unknown;
      };
      const sameReceiptUse =
        bound.requestFingerprint === requestFingerprint &&
        bound.ownerUid === ownerBinding &&
        bound.projectId === payload.projectId &&
        bound.sceneTruthDigest === payload.sceneTruthDigest &&
        typeof bound.jobId === 'string' &&
        bound.jobId.length > 0;
      if (!sameReceiptUse) throw new Error('scene_truth_receipt_replay_conflict');
      if (inside.exists) {
        const binding = inside.data() as Partial<IdempotencyBinding>;
        if (!bindingMatches(binding, expectedBinding) || binding.jobId !== bound.jobId) {
          throw new Error('idempotency_conflict');
        }
      }
      return { jobId: bound.jobId as string, deduplicated: true };
    }

    if (inside.exists) {
      const binding = inside.data() as Partial<IdempotencyBinding>;
      if (!bindingMatches(binding, expectedBinding) || typeof binding.jobId !== 'string' || !binding.jobId) {
        throw new Error('idempotency_conflict');
      }
      transaction.create(sceneTruthBindingRef, {
        receiptHash: sceneTruthBindingId,
        ownerUid: ownerBinding,
        projectId: payload.projectId,
        sceneTruthDigest: payload.sceneTruthDigest,
        requestFingerprint,
        jobId: binding.jobId,
        expiresAt: new Date(sceneTruthReceipt.expiresAt).toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });
      return { jobId: binding.jobId, deduplicated: true };
    }

    const jobRef = jobDoc(jobId);
    const queueRef = jobQueueEntryDoc(jobId);
    transaction.create(jobRef, {
      ...newJob,
      createdAt: now,
      updatedAt: now,
    });
    transaction.create(queueRef, {
      ...newQueueEntry,
      availableAt: now,
      createdAt: now,
    });
    transaction.create(jobRef.collection('logs').doc('studio-bridge-created'), {
      level: 'info',
      source: 'studioLifeMovieBridge',
      message: 'Life Movies render job accepted from authenticated URAI Studio bridge.',
      metadata: {
        tenantId: input.tenantId,
        ownerUid: input.userId,
        projectId: payload.projectId,
        renderPlanDigest: payload.renderPlanDigest,
        sceneTruthReceiptRef: payload.sceneTruthReceiptRef,
        sceneTruthDigest: payload.sceneTruthDigest,
        sceneTruthReceiptExpiresAt: new Date(sceneTruthReceipt.expiresAt).toISOString(),
      },
      createdAt: now,
    });
    transaction.create(bindingRef, {
      ...expectedBinding,
      jobId,
      idempotencyKeyHash: createHash('sha256').update(input.idempotencyKey).digest('hex'),
      createdAt: now,
    });
    transaction.create(sceneTruthBindingRef, {
      receiptHash: sceneTruthBindingId,
      ownerUid: ownerBinding,
      projectId: payload.projectId,
      sceneTruthDigest: payload.sceneTruthDigest,
      requestFingerprint,
      jobId,
      expiresAt: new Date(sceneTruthReceipt.expiresAt).toISOString(),
      createdAt: now,
    });
    return { jobId, deduplicated: false };
  });
}

async function loadBoundJob(tenantId: string, userId: string, jobId: string) {
  const snapshot = await jobDoc(jobId).get();
  if (!snapshot.exists) throw new Error('job_not_found');
  const job = snapshot.data() as Job & { sourceSystem?: string };
  if (job.sourceSystem !== 'urai-studio' || job.tenantId !== tenantId || job.ownerUid !== userId || (job.jobType || job.type) !== 'studio.render.video') {
    throw new Error('job_boundary_mismatch');
  }
  return job;
}

function allowedLifeMovieOutputBuckets() {
  const buckets = new Set([
    String(process.env.GCS_BUCKET_NAME || '').trim(),
    ...String(process.env.URAI_STUDIO_OUTPUT_BUCKETS || '').split(',').map((value) => value.trim()),
  ].filter(Boolean));
  if (!buckets.size) throw new Error('life_movie_output_bucket_authority_unavailable');
  return buckets;
}

function parseGcsRef(ref: unknown) {
  if (typeof ref !== 'string' || !ref.startsWith('gs://')) throw new Error('invalid_output_ref');
  const raw = ref.slice(5);
  const slash = raw.indexOf('/');
  if (slash < 1 || slash === raw.length - 1) throw new Error('invalid_output_ref');
  const bucket = raw.slice(0, slash);
  const objectPath = raw.slice(slash + 1);
  if (objectPath.includes('..')) throw new Error('invalid_output_ref');
  return { bucket, objectPath };
}

async function signedMovieAccess(tenantId: string, userId: string, jobId: string, disposition: 'inline' | 'attachment') {
  const job = await loadBoundJob(tenantId, userId, jobId);
  if (!isConsentContext(job.consent) || job.consent.purpose !== 'life-movie.render') {
    throw new Error('life_movie_consent_missing');
  }
  const consentSnapshot = await consentBlockRef(userId, job.consent.purpose).get();
  if (consentSnapshot.exists && consentSnapshot.data()?.active === true) {
    throw new Error('life_movie_consent_revoked');
  }
  if (String(job.status) !== 'SUCCESS') throw new Error('job_not_ready_for_playback');
  const output = job.output as WorkerOutput | undefined;
  const artifacts = Array.isArray(output?.outputs) ? output!.outputs! : [];
  const video = artifacts.find((artifact) => artifact?.kind === 'mp4');
  if (!video?.ref) throw new Error('life_movie_video_output_missing');
  const videoLocation = parseGcsRef(video.ref);
  const expectedPrefix = `tenants/${tenantId}/life-movies/`;
  const allowedBuckets = allowedLifeMovieOutputBuckets();
  if (!allowedBuckets.has(videoLocation.bucket) || !videoLocation.objectPath.startsWith(expectedPrefix)) {
    throw new Error('life_movie_output_boundary_mismatch');
  }

  const expiresAtMs = Date.now() + 5 * 60 * 1000;
  const [videoUrl] = await getStorage().bucket(videoLocation.bucket).file(videoLocation.objectPath).getSignedUrl({
    action: 'read',
    expires: expiresAtMs,
    responseDisposition: disposition,
    responseType: typeof video.mimeType === 'string' ? video.mimeType : 'video/mp4',
  });

  const subtitle = artifacts.find((artifact) => artifact?.kind === 'srt');
  let subtitleText = '';
  if (subtitle?.ref) {
    const subtitleLocation = parseGcsRef(subtitle.ref);
    if (!allowedBuckets.has(subtitleLocation.bucket) || !subtitleLocation.objectPath.startsWith(expectedPrefix)) {
      throw new Error('life_movie_output_boundary_mismatch');
    }
    const [bytes] = await getStorage().bucket(subtitleLocation.bucket).file(subtitleLocation.objectPath).download();
    if (bytes.length > 2 * 1024 * 1024) throw new Error('life_movie_subtitles_too_large');
    subtitleText = bytes.toString('utf8');
  }

  return {
    expiresAt: new Date(expiresAtMs).toISOString(),
    disposition,
    video: {
      url: videoUrl,
      mimeType: typeof video.mimeType === 'string' ? video.mimeType : 'video/mp4',
      checksum: typeof video.checksum === 'string' ? video.checksum : undefined,
    },
    subtitleText,
    renderPlanDigest: typeof output?.renderPlanDigest === 'string' ? output.renderPlanDigest : undefined,
    publicReleaseAuthorized: false,
  };
}

async function deleteBoundMovieOutput(tenantId: string, userId: string, jobId: string) {
  const db = getFirestore();
  const allowedBuckets = allowedLifeMovieOutputBuckets();
  const locations = await db.runTransaction(async (transaction) => {
    const ref = jobDoc(jobId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error('job_not_found');
    const job = snapshot.data() as Job & { result?: unknown; outputDeletionPreviousStatus?: Job['status'] };
    if (job.sourceSystem !== 'urai-studio' || job.tenantId !== tenantId || job.ownerUid !== userId
      || (job.jobType || job.type) !== 'studio.render.video') throw new Error('job_boundary_mismatch');
    const projectId = (job.payload as { projectId?: unknown } | undefined)?.projectId;
    if (typeof projectId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(projectId)) {
      throw new Error('job_boundary_mismatch');
    }
    const expectedPrefix = `tenants/${tenantId}/life-movies/${projectId}/`;
    const locations = new Map<string, { bucket: string; objectPath: string }>();
    for (const value of [job.output, job.result]) {
      const output = value as WorkerOutput | undefined;
      for (const artifact of Array.isArray(output?.outputs) ? output!.outputs! : []) {
        if (typeof artifact?.ref !== 'string' || !artifact.ref.startsWith('gs://')) continue;
        const location = parseGcsRef(artifact.ref);
        if (!allowedBuckets.has(location.bucket) || !location.objectPath.startsWith(expectedPrefix)
          || location.objectPath.includes('..') || location.objectPath.includes('\\')) {
          throw new Error('output_delete_boundary_mismatch');
        }
        locations.set(`${location.bucket}/${location.objectPath}`, location);
      }
    }
    const now = FieldValue.serverTimestamp();
    transaction.update(ref, {
      status: 'CANCELLED', derivativeAccessState: 'DELETED', outputDeletionState: 'PENDING',
      outputDeletionRequestedAt: now, outputDeletedBy: userId, updatedAt: now, completedAt: job.completedAt || now,
      outputDeletionPreviousStatus: job.outputDeletionPreviousStatus || job.status,
      lease: FieldValue.delete(), 'execution.leaseToken': FieldValue.delete(),
      'execution.asyncCallbackPending': false, 'execution.callbackTokenHash': FieldValue.delete(),
      'execution.callbackLeaseToken': FieldValue.delete(), 'execution.callbackDeadlineAt': FieldValue.delete(),
    });
    transaction.set(jobQueueEntryDoc(jobId), {
      jobId, jobType: 'studio.render.video', status: 'CANCELLED', lease: FieldValue.delete(), updatedAt: now,
    }, { merge: true });
    return [...locations.values()];
  });

  await Promise.all(locations.map(({ bucket, objectPath }) =>
    getStorage().bucket(bucket).file(objectPath).delete({ ignoreNotFound: true })));

  const now = FieldValue.serverTimestamp();
  await db.runTransaction(async (transaction) => {
    const ref = jobDoc(jobId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error('job_not_found');
    const current = snapshot.data() as Job & { sourceSystem?: string };
    if (current.sourceSystem !== 'urai-studio' || current.tenantId !== tenantId || current.ownerUid !== userId || (current.jobType || current.type) !== 'studio.render.video') {
      throw new Error('job_boundary_mismatch');
    }
    transaction.update(ref, {
      output: FieldValue.delete(),
      result: FieldValue.delete(),
      outputDeletionState: 'COMPLETE',
      outputDeletedAt: now,
      outputDeletedBy: userId,
      updatedAt: now,
    });
    transaction.create(ref.collection('logs').doc(`output-deleted-${Date.now()}`), {
      level: 'info',
      source: 'studioLifeMovieBridge',
      message: 'Life Movie generated outputs deleted by the bound owner.',
      metadata: {
        tenantId,
        ownerUid: userId,
        deletedObjectCount: locations.length,
        retainedSourceMedia: true,
      },
      createdAt: now,
    });
  });

  return { deleted: true, deletedObjectCount: locations.length, retainedSourceMedia: true };
}

async function cancelBoundJob(tenantId: string, userId: string, jobId: string) {
  const db = getFirestore();
  return db.runTransaction(async (transaction) => {
    const ref = jobDoc(jobId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error('job_not_found');
    const job = snapshot.data() as Job & { sourceSystem?: string };
    if (job.sourceSystem !== 'urai-studio' || job.tenantId !== tenantId || job.ownerUid !== userId || (job.jobType || job.type) !== 'studio.render.video') {
      throw new Error('job_boundary_mismatch');
    }
    if (['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED'].includes(String(job.status))) return safeJobProjection(job);

    const now = FieldValue.serverTimestamp();
    transaction.update(ref, {
      status: 'CANCELLED',
      updatedAt: now,
      completedAt: now,
      lease: FieldValue.delete(),
      'execution.leaseToken': FieldValue.delete(),
      'execution.asyncCallbackPending': false,
    });
    transaction.set(jobQueueEntryDoc(jobId), {
      jobId,
      status: 'DONE',
      lease: FieldValue.delete(),
      updatedAt: now,
    }, { merge: true });
    return { ...safeJobProjection(job), status: 'CANCELLED' };
  });
}

export const studioLifeMovieBridge = onRequest({
  secrets: [bridgeTokenSecret, sceneTruthReceiptSecret],
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
  if (jsonBytes(req.body) > MAX_BODY_BYTES) {
    res.status(413).json({ ok: false, error: 'request_too_large' });
    return;
  }

  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid_bridge_request' });
    return;
  }

  try {
    if (parsed.data.action === 'create') {
      const result = await createLifeMovieJob(parsed.data);
      res.status(result.deduplicated ? 200 : 202).json({ ok: true, status: 'queued', ...result });
      return;
    }

    if (parsed.data.action === 'status') {
      const job = await loadBoundJob(parsed.data.tenantId, parsed.data.userId, parsed.data.jobId);
      res.status(200).json({ ok: true, job: safeJobProjection(job) });
      return;
    }

    if (parsed.data.action === 'playback') {
      const playback = await signedMovieAccess(parsed.data.tenantId, parsed.data.userId, parsed.data.jobId, 'inline');
      res.status(200).json({ ok: true, playback });
      return;
    }

    if (parsed.data.action === 'download') {
      const download = await signedMovieAccess(parsed.data.tenantId, parsed.data.userId, parsed.data.jobId, 'attachment');
      res.status(200).json({ ok: true, download });
      return;
    }

    if (parsed.data.action === 'delete-output') {
      const deletion = await deleteBoundMovieOutput(parsed.data.tenantId, parsed.data.userId, parsed.data.jobId);
      res.status(200).json({ ok: true, deletion });
      return;
    }

    const job = await cancelBoundJob(parsed.data.tenantId, parsed.data.userId, parsed.data.jobId);
    res.status(200).json({ ok: true, job });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'bridge_failed';
    const status = code === 'job_not_found' ? 404
      : code === 'job_boundary_mismatch' ? 403
      : code === 'idempotency_conflict' ? 409
      : code === 'job_not_ready_for_playback' ? 409
      : code === 'life_movie_consent_missing' ? 409
      : code === 'life_movie_consent_revoked' ? 409
      : code === 'output_delete_boundary_mismatch' ? 403
      : code === 'life_movie_output_boundary_mismatch' ? 403
      : code === 'life_movie_output_bucket_authority_unavailable' ? 503
      : code === 'scene_truth_receipt_authority_unavailable' ? 503
      : code === 'scene_truth_receipt_expired' ? 409
      : code === 'invalid_scene_truth_receipt_signature' ? 403
      : code === 'scene_truth_receipt_replay_conflict' ? 409
      : 400;
    res.status(status).json({ ok: false, error: code });
  }
});
