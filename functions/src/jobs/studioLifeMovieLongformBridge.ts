import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { ulid } from 'ulid';
import { z } from 'zod';
import type { Job, JobQueueEntry, JobStatus } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import {
  bindingMatches,
  buildIdempotencyBindingId,
  buildRequestFingerprint,
  type IdempotencyBinding,
} from '../core/jobsReliability.js';
import { assertSceneTruthReceiptValue } from './sceneTruthReceipt.js';
import {
  StudioLifeMovieLongformPayloadSchema,
  assertLifeMovieLongformTenantPaths,
  planLifeMovieLongformSegments,
} from './studioLifeMovieLongformContract.js';

const bridgeTokenSecret = defineSecret('URAI_STUDIO_JOBS_BRIDGE_TOKEN');
const sceneTruthReceiptSecret = defineSecret('URAI_SCENE_TRUTH_RECEIPT_HMAC');
const PLAN_COLLECTION = 'studioLifeMovieLongformPlans';
const BINDING_COLLECTION = 'studioLifeMovieLongformBindings';
const SCENE_TRUTH_RECEIPT_BINDING_COLLECTION = 'studioSceneTruthReceiptBindings';
const MAX_BODY_BYTES = 512 * 1024;
const TERMINAL = new Set<JobStatus>(['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED']);

const IdentitySchema = z.object({
  tenantId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  userId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
}).strict();

const CreateSchema = IdentitySchema.extend({
  action: z.literal('create'),
  idempotencyKey: z.string().trim().min(8).max(160),
  payload: StudioLifeMovieLongformPayloadSchema,
}).strict();

const PlanActionSchema = IdentitySchema.extend({
  action: z.enum(['status', 'cancel']),
  planId: z.string().trim().regex(/^lmp_[A-Za-z0-9_-]{20,64}$/),
}).strict();

const RequestSchema = z.union([CreateSchema, PlanActionSchema]);

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

function configuredSceneTruthSecret() {
  try {
    return sceneTruthReceiptSecret.value() || process.env.URAI_SCENE_TRUTH_RECEIPT_HMAC || '';
  } catch {
    return process.env.URAI_SCENE_TRUTH_RECEIPT_HMAC || '';
  }
}

function authorized(header: string) {
  const expected = configuredToken();
  if (!expected) return !productionRuntime() && process.env.FUNCTIONS_EMULATOR === 'true';
  const expectedHash = createHash('sha256').update(`Bearer ${expected}`).digest();
  const actualHash = createHash('sha256').update(header || '').digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function longformEnabled() {
  return process.env.URAI_LIFE_MOVIE_LONGFORM_ENABLED === 'true';
}

function jsonBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8');
}

function planRef(planId: string) {
  return getFirestore().collection(PLAN_COLLECTION).doc(planId);
}

function makeChildId(planId: string, index: number) {
  const suffix = String(index).padStart(4, '0');
  return `lms_${createHash('sha256').update(`${planId}:${suffix}`).digest('hex').slice(0, 32)}_${suffix}`;
}

type StoredPlan = {
  planId: string;
  schemaVersion: 'urai-life-movie-longform-plan-v1';
  status: 'PENDING' | 'CANCELLED';
  ownerUid: string;
  tenantId: string;
  projectId: string;
  renderPlanDigest: string;
  sceneTruthDigest: string;
  sceneTruthReceiptRef: string;
  childJobIds: string[];
  segments: Array<{
    index: number;
    startMs: number;
    endMs: number;
    childDigest: string;
    jobId: string;
  }>;
};

function assertPlanOwner(plan: StoredPlan, tenantId: string, userId: string) {
  if (plan.tenantId !== tenantId || plan.ownerUid !== userId) throw new Error('longform_plan_boundary_mismatch');
  return plan;
}

function deriveStatus(plan: StoredPlan, statuses: JobStatus[]) {
  if (plan.status === 'CANCELLED') return 'CANCELLED';
  if (statuses.length === 0) return 'PENDING';
  if (statuses.every((status) => status === 'SUCCESS')) return 'SUCCESS';
  if (statuses.some((status) => status === 'FAILED' || status === 'DEAD')) return 'FAILED';
  if (statuses.every((status) => TERMINAL.has(status)) && statuses.some((status) => status === 'CANCELLED')) return 'CANCELLED';
  if (statuses.some((status) => status === 'RUNNING' || status === 'LEASED')) return 'RUNNING';
  return 'PENDING';
}

async function createPlan(input: z.infer<typeof CreateSchema>) {
  if (!longformEnabled()) throw new Error('life_movie_longform_disabled');

  const payload = assertLifeMovieLongformTenantPaths(input.payload, input.tenantId);
  const secret = configuredSceneTruthSecret();
  const receipt = assertSceneTruthReceiptValue(
    payload.projectId,
    payload.sceneTruthDigest,
    input.userId,
    payload.sceneTruthReceiptRef,
    secret,
  );
  const segments = planLifeMovieLongformSegments(payload);
  if (!segments.length) throw new Error('life_movie_longform_empty_plan');

  const ownerBinding = `${input.tenantId}:${input.userId}`;
  const jobType = 'studio.render.longform';
  const requestFingerprint = buildRequestFingerprint(jobType, {
    tenantId: input.tenantId,
    userId: input.userId,
    payload,
  });
  const expectedBinding = { ownerUid: ownerBinding, jobType, requestFingerprint };
  const db = getFirestore();
  const bindingId = buildIdempotencyBindingId(ownerBinding, jobType, input.idempotencyKey);
  const bindingRef = db.collection(BINDING_COLLECTION).doc(bindingId);
  const receiptBindingId = createHash('sha256').update(payload.sceneTruthReceiptRef).digest('hex');
  const receiptBindingRef = db.collection(SCENE_TRUTH_RECEIPT_BINDING_COLLECTION).doc(receiptBindingId);

  const existing = await bindingRef.get();
  if (existing.exists) {
    const binding = existing.data() as Partial<IdempotencyBinding>;
    if (!bindingMatches(binding, expectedBinding) || typeof binding.jobId !== 'string' || !binding.jobId) {
      throw new Error('idempotency_conflict');
    }
    return { planId: binding.jobId, deduplicated: true, segmentCount: segments.length };
  }

  const planId = `lmp_${ulid()}`;
  const childIds = segments.map((segment) => makeChildId(planId, segment.index));
  const now = FieldValue.serverTimestamp();

  return db.runTransaction(async (transaction) => {
    const [inside, receiptInside] = await Promise.all([
      transaction.get(bindingRef),
      transaction.get(receiptBindingRef),
    ]);

    if (receiptInside.exists) {
      const bound = receiptInside.data() as {
        requestFingerprint?: unknown;
        ownerUid?: unknown;
        projectId?: unknown;
        sceneTruthDigest?: unknown;
        planId?: unknown;
        authorityType?: unknown;
      };
      const sameUse =
        bound.authorityType === 'longform' &&
        bound.requestFingerprint === requestFingerprint &&
        bound.ownerUid === ownerBinding &&
        bound.projectId === payload.projectId &&
        bound.sceneTruthDigest === payload.sceneTruthDigest &&
        typeof bound.planId === 'string' &&
        bound.planId.length > 0;
      if (!sameUse) throw new Error('scene_truth_receipt_replay_conflict');
      if (inside.exists) {
        const binding = inside.data() as Partial<IdempotencyBinding>;
        if (!bindingMatches(binding, expectedBinding) || binding.jobId !== bound.planId) {
          throw new Error('idempotency_conflict');
        }
      }
      return { planId: bound.planId as string, deduplicated: true, segmentCount: segments.length };
    }

    if (inside.exists) {
      const binding = inside.data() as Partial<IdempotencyBinding>;
      if (!bindingMatches(binding, expectedBinding) || typeof binding.jobId !== 'string' || !binding.jobId) {
        throw new Error('idempotency_conflict');
      }
      return { planId: binding.jobId, deduplicated: true, segmentCount: segments.length };
    }

    const storedSegments = segments.map((segment, index) => ({
      index: segment.index,
      startMs: segment.startMs,
      endMs: segment.endMs,
      childDigest: segment.childDigest,
      jobId: childIds[index],
    }));

    transaction.create(planRef(planId), {
      planId,
      schemaVersion: 'urai-life-movie-longform-plan-v1',
      status: 'PENDING',
      ownerUid: input.userId,
      tenantId: input.tenantId,
      projectId: payload.projectId,
      renderPlanDigest: payload.renderPlanDigest,
      sceneTruthDigest: payload.sceneTruthDigest,
      sceneTruthReceiptRef: payload.sceneTruthReceiptRef,
      childJobIds: childIds,
      segments: storedSegments,
      segmentCount: childIds.length,
      publicReleaseAuthorized: false,
      providerGenerationAuthorized: false,
      sourceSystem: 'urai-studio',
      createdAt: now,
      updatedAt: now,
    });

    for (const [index, segment] of segments.entries()) {
      const jobId = childIds[index];
      const child: Job = {
        jobId,
        type: 'studio.render.video',
        jobType: 'studio.render.video',
        status: 'PENDING',
        payload: segment.payload,
        ownerUid: input.userId,
        tenantId: input.tenantId,
        retryCount: 0,
        execution: { attemptCount: 0, maxAttempts: 2 },
        sourceSystem: 'urai-studio',
        sourceProject: 'urai-studio',
        rootJobId: planId,
        parentJobId: planId,
        correlationId: planId,
      };
      const queue: JobQueueEntry = {
        jobId,
        jobType: 'studio.render.video',
        status: 'PENDING',
        attemptCount: 0,
      };
      transaction.create(jobDoc(jobId), { ...child, createdAt: now, updatedAt: now });
      transaction.create(jobQueueEntryDoc(jobId), { ...queue, availableAt: now, createdAt: now });
    }

    transaction.create(bindingRef, {
      ...expectedBinding,
      jobId: planId,
      createdAt: now,
    });
    transaction.create(receiptBindingRef, {
      authorityType: 'longform',
      receiptHash: receiptBindingId,
      receiptId: receipt.receiptId,
      requestFingerprint,
      ownerUid: ownerBinding,
      planId,
      projectId: payload.projectId,
      sceneTruthDigest: payload.sceneTruthDigest,
      renderPlanDigest: payload.renderPlanDigest,
      expiresAt: new Date(receipt.expiresAt).toISOString(),
      createdAt: now,
    });

    return { planId, deduplicated: false, segmentCount: segments.length };
  });
}

async function loadPlan(planId: string, tenantId: string, userId: string) {
  const snapshot = await planRef(planId).get();
  if (!snapshot.exists) throw new Error('longform_plan_not_found');
  return assertPlanOwner(snapshot.data() as StoredPlan, tenantId, userId);
}

async function readPlanStatus(planId: string, tenantId: string, userId: string) {
  const plan = await loadPlan(planId, tenantId, userId);
  const db = getFirestore();
  const snapshots = await db.getAll(...plan.childJobIds.map((jobId) => jobDoc(jobId)));
  const children = snapshots.map((snapshot, index) => {
    const data = snapshot.exists ? snapshot.data() : undefined;
    return {
      jobId: plan.childJobIds[index],
      status: (data?.status ?? 'DEAD') as JobStatus,
      index: plan.segments[index]?.index ?? index,
    };
  });
  const statuses = children.map((child) => child.status);
  const counts = statuses.reduce<Record<string, number>>((result, status) => {
    result[status] = (result[status] ?? 0) + 1;
    return result;
  }, {});
  return {
    planId,
    status: deriveStatus(plan, statuses),
    segmentCount: children.length,
    counts,
    children,
    renderPlanDigest: plan.renderPlanDigest,
    sceneTruthDigest: plan.sceneTruthDigest,
    publicReleaseAuthorized: false,
  };
}

async function cancelPlan(planId: string, tenantId: string, userId: string) {
  const db = getFirestore();
  const ref = planRef(planId);
  return db.runTransaction(async (transaction) => {
    const planSnapshot = await transaction.get(ref);
    if (!planSnapshot.exists) throw new Error('longform_plan_not_found');
    const plan = assertPlanOwner(planSnapshot.data() as StoredPlan, tenantId, userId);
    const childRefs = plan.childJobIds.map((jobId) => jobDoc(jobId));
    const childSnapshots = childRefs.length ? await transaction.getAll(...childRefs) : [];
    const now = FieldValue.serverTimestamp();
    let cancelledChildren = 0;

    for (const [index, snapshot] of childSnapshots.entries()) {
      if (!snapshot.exists) continue;
      const child = snapshot.data() as Job;
      if (TERMINAL.has(child.status)) continue;
      const jobId = plan.childJobIds[index];
      transaction.update(childRefs[index], {
        status: 'CANCELLED',
        completedAt: now,
        updatedAt: now,
        lease: FieldValue.delete(),
        'execution.leaseToken': FieldValue.delete(),
        'execution.asyncCallbackPending': false,
      });
      transaction.set(jobQueueEntryDoc(jobId), {
        jobId,
        jobType: 'studio.render.video',
        status: 'DONE',
        lease: FieldValue.delete(),
        updatedAt: now,
      }, { merge: true });
      cancelledChildren += 1;
    }

    transaction.update(ref, {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelledBy: userId,
      updatedAt: now,
    });

    return { planId, cancelled: true, cancelledChildren };
  });
}

export const studioLifeMovieLongformBridge = onRequest({
  secrets: [bridgeTokenSecret, sceneTruthReceiptSecret],
  timeoutSeconds: 60,
  memory: '512MiB',
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
    res.status(400).json({ ok: false, error: 'invalid_longform_request' });
    return;
  }

  try {
    if (parsed.data.action === 'create') {
      const result = await createPlan(parsed.data);
      res.status(result.deduplicated ? 200 : 202).json({ ok: true, status: 'queued', ...result });
      return;
    }
    if (parsed.data.action === 'status') {
      const result = await readPlanStatus(parsed.data.planId, parsed.data.tenantId, parsed.data.userId);
      res.status(200).json({ ok: true, plan: result });
      return;
    }
    const result = await cancelPlan(parsed.data.planId, parsed.data.tenantId, parsed.data.userId);
    res.status(200).json({ ok: true, cancellation: result });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'longform_bridge_failed';
    const status = code === 'longform_plan_not_found' ? 404
      : code === 'longform_plan_boundary_mismatch' ? 403
      : code === 'scene_truth_receipt_replay_conflict' ? 409
      : code === 'idempotency_conflict' ? 409
      : code === 'life_movie_longform_disabled' ? 503
      : code === 'scene_truth_receipt_authority_unavailable' ? 503
      : code === 'scene_truth_receipt_expired' ? 409
      : code === 'invalid_scene_truth_receipt_signature' ? 403
      : 400;
    res.status(status).json({ ok: false, error: code });
  }
});
