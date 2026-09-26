import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { ulid } from 'ulid';
import { z } from 'zod';
import type { Job, JobQueueEntry } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import {
  bindingMatches,
  buildIdempotencyBindingId,
  buildRequestFingerprint,
  type IdempotencyBinding,
} from '../core/jobsReliability.js';
import { StudioLifeMovieRenderPayloadSchema, assertLifeMovieTenantPaths } from './studioLifeMovieContract.js';

const bridgeTokenSecret = defineSecret('URAI_STUDIO_JOBS_BRIDGE_TOKEN');
const IDEMPOTENCY_COLLECTION = 'studioLifeMovieBridgeBindings';
const MAX_BODY_BYTES = 32768;

const IdentitySchema = z.object({
  tenantId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  userId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
}).strict();

const CreateSchema = IdentitySchema.extend({
  action: z.literal('create'),
  idempotencyKey: z.string().trim().min(8).max(160),
  payload: StudioLifeMovieRenderPayloadSchema,
}).strict();

const JobActionSchema = IdentitySchema.extend({
  action: z.enum(['status', 'cancel']),
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

function jsonBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8');
}

function safeJobProjection(job: Job) {
  return {
    jobId: job.jobId,
    jobType: job.jobType || job.type,
    status: job.status,
    tenantId: job.tenantId,
    ownerUid: job.ownerUid,
    retryCount: job.retryCount,
    output: job.output,
    error: job.error && typeof job.error === 'object'
      ? { message: typeof (job.error as { message?: unknown }).message === 'string' ? (job.error as { message: string }).message.slice(0, 500) : 'job_failed' }
      : undefined,
  };
}

async function createLifeMovieJob(input: z.infer<typeof CreateSchema>) {
  const payload = assertLifeMovieTenantPaths(input.payload, input.tenantId);
  const ownerBinding = `${input.tenantId}:${input.userId}`;
  const jobType = 'studio.render.video';
  const fingerprintPayload = { tenantId: input.tenantId, userId: input.userId, payload };
  const requestFingerprint = buildRequestFingerprint(jobType, fingerprintPayload);
  const expectedBinding = { ownerUid: ownerBinding, jobType, requestFingerprint };
  const db = getFirestore();
  const bindingId = buildIdempotencyBindingId(ownerBinding, jobType, input.idempotencyKey);
  const bindingRef = db.collection(IDEMPOTENCY_COLLECTION).doc(bindingId);

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
    if (inside.exists) {
      const binding = inside.data() as Partial<IdempotencyBinding>;
      if (!bindingMatches(binding, expectedBinding) || typeof binding.jobId !== 'string' || !binding.jobId) {
        throw new Error('idempotency_conflict');
      }
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
      },
      createdAt: now,
    });
    transaction.create(bindingRef, {
      ...expectedBinding,
      jobId,
      idempotencyKeyHash: createHash('sha256').update(input.idempotencyKey).digest('hex'),
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

    const job = await cancelBoundJob(parsed.data.tenantId, parsed.data.userId, parsed.data.jobId);
    res.status(200).json({ ok: true, job });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'bridge_failed';
    const status = code === 'job_not_found' ? 404
      : code === 'job_boundary_mismatch' ? 403
      : code === 'idempotency_conflict' ? 409
      : 400;
    res.status(status).json({ ok: false, error: code });
  }
});
