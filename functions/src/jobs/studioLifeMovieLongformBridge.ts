import { createHash, timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { ulid } from 'ulid';
import { z } from 'zod';
import type { Job, JobQueueEntry, JobStatus } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { consentBlockRef, checkedJobConsentBlockState, assertJobConsentBlockClear } from '../privacy/consentBlocks.js';
import { LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE, lifeMovieConsentAuthorityAvailable } from '../privacy/lifeMovieConsentGate.js';
import { parseLifeMoviePrivateDeliveryRequest } from './lifeMoviePrivateDeliveryContract.js';
import { requireLifeMovieCreationAdmission } from '../privacy/lifeMovieCreationAdmission.js';
import { assertLifeMovieOwnerTenantAuthorityClear, assertOwnerDeletionFenceClear } from '../privacy/ownerDeletionFence.js';
import { requirePinnedMovieOutputGeneration } from '../privacy/lifeMovieOutputGeneration.js';
import { deleteOwnedMovieOutputs, preflightOwnedMovieOutputs, validateOwnedMovieJob } from './lifeMovieOwnerDeletion.js';
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
  assertStudioLifeMovieLongformPlanDigest,
  planLifeMovieLongformSegments,
} from './studioLifeMovieLongformContract.js';
import { LifeMovieConsentReferenceSchema } from './studioLifeMovieContract.js';

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
  consent: LifeMovieConsentReferenceSchema,
  payload: StudioLifeMovieLongformPayloadSchema,
}).strict();

const PlanActionSchema = IdentitySchema.extend({
  action: z.enum(['status', 'cancel', 'playback', 'download', 'resume', 'assemble', 'delete-output']),
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
  if (!expected) return false;
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

function makeAssemblyJobId(planId: string) {
  return `lma_${createHash('sha256').update(`${planId}:assembly-v1`).digest('hex').slice(0, 40)}`;
}

type WorkerArtifact = {
  kind?: unknown;
  ref?: unknown;
  generation?: unknown;
  mimeType?: unknown;
  checksum?: unknown;
};

type WorkerOutput = {
  outputs?: WorkerArtifact[];
  renderPlanDigest?: unknown;
  sceneTruthDigest?: unknown;
  publicReleaseAuthorized?: unknown;
};

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
  consent: { purpose: 'life-movie.render'; policyVersion: string; decisionReceiptId: string };
  width: number;
  height: number;
  fps: number;
  assemblyJobId?: string;
  childJobIds: string[];
  segments: Array<{
    index: number;
    startMs: number;
    endMs: number;
    childDigest: string;
    childPayloadFingerprint: string;
    jobId: string;
  }>;
};

function allowedLifeMovieOutputBuckets() {
  const buckets = new Set([
    String(process.env.GCS_BUCKET_NAME || '').trim(),
    ...String(process.env.URAI_STUDIO_OUTPUT_BUCKETS || '').split(',').map((value) => value.trim()),
  ].filter(Boolean));
  if (!buckets.size) throw new Error('longform_output_bucket_authority_unavailable');
  return buckets;
}

function parseGcsRef(ref: string) {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(ref);
  if (!match) throw new Error('longform_output_ref_invalid');
  return { bucket: match[1], objectPath: match[2] };
}

function boundedArtifact(output: unknown, kind: 'mp4' | 'srt') {
  if (!output || typeof output !== 'object' || Array.isArray(output)) throw new Error('longform_child_output_missing');
  const typed = output as WorkerOutput;
  if (typed.publicReleaseAuthorized === true) throw new Error('longform_public_release_mismatch');
  const artifacts = Array.isArray(typed.outputs) ? typed.outputs : [];
  const artifact = artifacts.find((candidate) => candidate?.kind === kind);
  if (!artifact || typeof artifact.ref !== 'string') throw new Error(`longform_${kind}_output_missing`);
  return {
    ref: artifact.ref,
    generation: requirePinnedMovieOutputGeneration(artifact.generation),
    mimeType: typeof artifact.mimeType === 'string'
      ? artifact.mimeType
      : kind === 'mp4' ? 'video/mp4' : 'application/x-subrip',
    checksum: typeof artifact.checksum === 'string' ? artifact.checksum : undefined,
  };
}

function assertPlanOwner(plan: StoredPlan, tenantId: string, userId: string) {
  if (plan.tenantId !== tenantId || plan.ownerUid !== userId) throw new Error('longform_plan_boundary_mismatch');
  return plan;
}

function assertPlanStructure(plan: StoredPlan, planId: string) {
  if (plan.planId !== planId || !Array.isArray(plan.childJobIds) || !Array.isArray(plan.segments)
    || plan.childJobIds.length < 1 || plan.childJobIds.length > 180
    || plan.segments.length !== plan.childJobIds.length
    || new Set(plan.childJobIds).size !== plan.childJobIds.length
    || plan.childJobIds.some((jobId, index) => jobId !== makeChildId(planId, index)
      || plan.segments[index]?.jobId !== jobId || plan.segments[index]?.index !== index)
    || (plan.assemblyJobId !== undefined && plan.assemblyJobId !== makeAssemblyJobId(planId))) {
    throw new Error('longform_plan_structure_invalid');
  }
}

function boundPlanJob(plan: StoredPlan, jobId: string, kind: 'segment' | 'assembly') {
  const expectedOutputPrefix = kind === 'assembly'
    ? `tenants/${plan.tenantId}/life-movies/${plan.projectId}/final/`
    : `tenants/${plan.tenantId}/life-movies/${plan.projectId}/segments/${String(plan.childJobIds.indexOf(jobId)).padStart(4, '0')}/`;
  return { tenantId: plan.tenantId, userId: plan.ownerUid, jobId, planId: plan.planId,
    projectId: plan.projectId, kind, expectedOutputPrefix } as const;
}

/**
 * A successful child is not sufficient evidence for assembly or private
 * playback. Bind its owner, parent, immutable segment number and content
 * identity to the originally approved long-form plan before accessing refs.
 * The preflight is read-only; it never deletes media.
 */
function assertBoundSegmentForUse(plan: StoredPlan, job: Job, index: number) {
  const jobId = plan.childJobIds[index];
  const descriptor = plan.segments[index];
  const expectedChildDigest = descriptor && createHash('sha256')
    .update(`urai-life-movie-longform-segment-v1\n${plan.renderPlanDigest}\n${index}\n${descriptor.startMs}\n${descriptor.endMs}`)
    .digest('hex');
  if (!jobId || !descriptor || descriptor.jobId !== jobId || descriptor.index !== index
    || !Number.isSafeInteger(descriptor.startMs) || !Number.isSafeInteger(descriptor.endMs)
    || descriptor.startMs < 0 || descriptor.endMs <= descriptor.startMs
    || descriptor.childDigest !== expectedChildDigest
    || typeof descriptor.childPayloadFingerprint !== 'string'
    || !/^[0-9a-f]{64}$/.test(descriptor.childPayloadFingerprint)) {
    throw new Error('longform_segment_binding_mismatch');
  }
  // Reuse the owner-bound deletion preflight: it checks the exact child output
  // prefix (including segment index), permitted buckets, unsafe object paths,
  // live in-flight flags and any unrecognized derivative refs.
  preflightOwnedMovieOutputs(job as unknown as Record<string, unknown>, boundPlanJob(plan, jobId, 'segment'));
  const payload = job.payload as Record<string, unknown> | undefined;
  const output = job.output as WorkerOutput | undefined;
  // The child digest derives only from the parent and time range. The exact
  // normalized media selection/timeline must separately match its original
  // immutable request fingerprint before reading private output.
  if (!payload
    || buildRequestFingerprint('studio.render.video', payload) !== descriptor.childPayloadFingerprint
    || payload.renderPlanDigest !== descriptor.childDigest
    || output?.renderPlanDigest !== descriptor.childDigest
    || payload?.sceneTruthDigest !== plan.sceneTruthDigest
    || output?.sceneTruthDigest !== plan.sceneTruthDigest
    || !isDeepStrictEqual(job.consent, plan.consent)) {
    throw new Error('longform_segment_binding_mismatch');
  }
}

/** Require the same complete authority binding for final assembled media. */
function assertBoundAssemblyForUse(plan: StoredPlan, job: Job) {
  if (!plan.assemblyJobId) throw new Error('longform_assembly_binding_mismatch');
  preflightOwnedMovieOutputs(job as unknown as Record<string, unknown>,
    boundPlanJob(plan, plan.assemblyJobId, 'assembly'));
  const payload = job.payload as Record<string, unknown> | undefined;
  const output = job.output as WorkerOutput | undefined;
  if (payload?.renderPlanDigest !== plan.renderPlanDigest
    || output?.renderPlanDigest !== plan.renderPlanDigest
    || payload?.sceneTruthDigest !== plan.sceneTruthDigest
    || output?.sceneTruthDigest !== plan.sceneTruthDigest
    || !isDeepStrictEqual(job.consent, plan.consent)) {
    throw new Error('longform_assembly_binding_mismatch');
  }
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

async function assertPlanConsentActive(plan: StoredPlan) {
  const snapshot = await consentBlockRef(plan.ownerUid, plan.consent.purpose).get();
  assertJobConsentBlockClear(snapshot, 'life_movie_longform_consent_revoked');
}

async function createPlan(input: z.infer<typeof CreateSchema>) {
  if (!longformEnabled()) throw new Error('life_movie_longform_disabled');

  const payload = assertStudioLifeMovieLongformPlanDigest(assertLifeMovieLongformTenantPaths(input.payload, input.tenantId));
  // CreateSchema has already parsed the strict consent reference. Zod's
  // inferred optional properties under the repo's TS settings are not an
  // excuse to loosen the required downstream admission contract.
  await requireLifeMovieCreationAdmission({
    ownerUid: input.userId,
    tenantId: input.tenantId,
    consent: {
      purpose: input.consent.purpose!,
      policyVersion: input.consent.policyVersion!,
      decisionReceiptId: input.consent.decisionReceiptId!,
    },
    // Do not pass the whole render payload: only this exact source selection
    // is accepted by the immutable admission snapshot.
    selection: {
      projectId: payload.projectId,
      renderPlanDigest: payload.renderPlanDigest,
      sources: payload.sources,
    },
  });
  const consentRef = consentBlockRef(input.userId, input.consent.purpose);
  const consentSnapshot = await consentRef.get();
  assertJobConsentBlockClear(consentSnapshot, 'life_movie_longform_consent_revoked');
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
    consent: input.consent,
  });
  const expectedBinding = { ownerUid: ownerBinding, jobType, requestFingerprint };
  const db = getFirestore();
  const bindingId = buildIdempotencyBindingId(ownerBinding, jobType, input.idempotencyKey);
  const bindingRef = db.collection(BINDING_COLLECTION).doc(bindingId);
  const receiptBindingId = createHash('sha256').update(payload.sceneTruthReceiptRef).digest('hex');
  const receiptBindingRef = db.collection(SCENE_TRUTH_RECEIPT_BINDING_COLLECTION).doc(receiptBindingId);

  const planId = `lmp_${ulid()}`;
  const childIds = segments.map((segment) => makeChildId(planId, segment.index));
  const now = FieldValue.serverTimestamp();

  return db.runTransaction(async (transaction) => {
    // Check active revocation in the same serializable write transaction.
    // Preflight alone cannot close the revoke-before-commit window.
    const [inside, receiptInside, liveConsentBlock, ownerSnapshot] = await Promise.all([
      transaction.get(bindingRef),
      transaction.get(receiptBindingRef),
      transaction.get(consentRef),
      transaction.get(db.collection('users').doc(input.userId)),
    ]);
    assertOwnerDeletionFenceClear(ownerSnapshot);
    assertLifeMovieOwnerTenantAuthorityClear(ownerSnapshot, input.userId, input.tenantId);
    assertJobConsentBlockClear(liveConsentBlock, 'life_movie_longform_consent_revoked');

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
      childPayloadFingerprint: buildRequestFingerprint('studio.render.video', segment.payload),
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
      consent: input.consent,
      width: payload.width,
      height: payload.height,
      fps: payload.fps,
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
        consent: {
          purpose: input.consent.purpose,
          policyVersion: input.consent.policyVersion,
          decisionReceiptId: input.consent.decisionReceiptId,
        },
        retryCount: 0,
        execution: {
          attemptCount: 0,
          maxAttempts: 2,
          rootJobId: planId,
          parentJobId: planId,
          correlationId: planId,
        },
        sourceSystem: 'urai-studio',
        sourceProject: 'urai-studio',
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
  const db = getFirestore();
  // Long-form status cannot use a historical plan binding as current owner
  // authority. Read both records in one Firestore read transaction before
  // observing the consent block, segment states or provenance.
  // Cancellation and deletion keep their separate cleanup paths.
  const plan = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(planRef(planId));
    if (!snapshot.exists) throw new Error('longform_plan_not_found');
    const current = assertPlanOwner(snapshot.data() as StoredPlan, tenantId, userId);
    // Validate the entire stored plan before reading any owner-private child
    // metadata. A corrupt or oversized historic child list must fail closed
    // rather than triggering unbounded Firestore status fan-out.
    assertPlanStructure(current, planId);
    const ownerSnapshot = await transaction.get(db.collection('users').doc(userId));
    assertLifeMovieOwnerTenantAuthorityClear(ownerSnapshot, userId, tenantId);
    return current;
  });
  const consentSnapshot = await consentBlockRef(plan.ownerUid, plan.consent.purpose).get();
  const consentState = checkedJobConsentBlockState(consentSnapshot);
  if (consentState === 'unverified') throw new Error('life_movie_consent_block_unverified');
  const revoked = consentState === 'revoked';
  if (revoked) {
    // A revoked owner may see that consent was revoked, but never private
    // segment/assembly IDs or provenance. Do not read child job documents.
    // Cancellation and deletion retain their separate restricted paths.
    return {
      planId,
      status: 'REVOKED',
      consentRevoked: true,
      segmentCount: 0,
      counts: {},
      children: [],
      assembly: null,
      publicReleaseAuthorized: false,
    };
  }
  const snapshots = await db.getAll(...plan.childJobIds.map((jobId) => jobDoc(jobId)));
  const assemblySnapshot = plan.assemblyJobId ? await jobDoc(plan.assemblyJobId).get() : null;
  const children = snapshots.map((snapshot, index) => {
    const data = snapshot.exists ? snapshot.data() : undefined;
    // The parent plan's historical child list is a locator, NOT authority
    // over the present job record. Reject any existing foreign, replaced,
    // stale-parent or reconsented child before returning its private status.
    if (snapshot.exists && (!data || data.jobId !== plan.childJobIds[index]
      || data.ownerUid !== plan.ownerUid || data.tenantId !== plan.tenantId
      || data.sourceSystem !== 'urai-studio'
      || (data.jobType || data.type) !== 'studio.render.video'
      || data.execution?.rootJobId !== planId || data.execution?.parentJobId !== planId
      || !isDeepStrictEqual(data.consent, plan.consent))) {
      throw new Error('longform_child_status_boundary_mismatch');
    }
    return {
      jobId: plan.childJobIds[index],
      status: (data?.status ?? 'DEAD') as JobStatus,
      index: plan.segments[index]?.index ?? index,
    };
  });
  const assemblyData = assemblySnapshot?.exists ? assemblySnapshot.data() : undefined;
  if (assemblySnapshot?.exists && (!assemblyData
    || assemblyData.jobId !== plan.assemblyJobId
    || assemblyData.ownerUid !== plan.ownerUid || assemblyData.tenantId !== plan.tenantId
    || assemblyData.sourceSystem !== 'urai-studio'
    || (assemblyData.jobType || assemblyData.type) !== 'studio.assemble.video'
    || assemblyData.execution?.rootJobId !== planId
    || assemblyData.execution?.parentJobId !== planId
    || !isDeepStrictEqual(assemblyData.consent, plan.consent))) {
    throw new Error('longform_assembly_status_boundary_mismatch');
  }
  const statuses = children.map((child) => child.status);
  const counts = statuses.reduce<Record<string, number>>((result, status) => {
    result[status] = (result[status] ?? 0) + 1;
    return result;
  }, {});
  return {
    planId,
    status: revoked ? 'REVOKED' : deriveStatus(plan, statuses),
    consentRevoked: revoked,
    segmentCount: children.length,
    counts,
    children,
    renderPlanDigest: plan.renderPlanDigest,
    sceneTruthDigest: plan.sceneTruthDigest,
    assembly: plan.assemblyJobId ? {
      jobId: plan.assemblyJobId,
      status: assemblyData ? String(assemblyData.status || 'DEAD') : 'DEAD',
    } : null,
    publicReleaseAuthorized: false,
  };
}

async function assemblePlan(planId: string, tenantId: string, userId: string) {
  const plan = await loadPlan(planId, tenantId, userId);
  assertPlanStructure(plan, planId);
  if (plan.status === 'CANCELLED') throw new Error('longform_plan_cancelled');
  if (plan.status !== 'PENDING') throw new Error('longform_plan_changed');
  await assertPlanConsentActive(plan);

  const db = getFirestore();
  const childSnapshots = await db.getAll(...plan.childJobIds.map((jobId) => jobDoc(jobId)));
  const children = childSnapshots.map((snapshot) => snapshot.exists ? snapshot.data() as Job : undefined);
  if (children.some((job) => !job || job.status !== 'SUCCESS')) {
    throw new Error('longform_plan_not_ready_for_assembly');
  }

  const allowedBuckets = allowedLifeMovieOutputBuckets();
  const requiredPrefix = `tenants/${tenantId}/life-movies/${plan.projectId}/segments/`;
  const segments = children.map((job, index) => {
    const descriptor = plan.segments[index];
    if (!job || !descriptor || descriptor.jobId !== plan.childJobIds[index]) {
      throw new Error('longform_segment_binding_mismatch');
    }
    assertBoundSegmentForUse(plan, job, index);
    const video = boundedArtifact(job.output, 'mp4');
    const subtitle = boundedArtifact(job.output, 'srt');
    const videoLocation = parseGcsRef(video.ref);
    const subtitleLocation = parseGcsRef(subtitle.ref);
    if (!allowedBuckets.has(videoLocation.bucket)
      || !allowedBuckets.has(subtitleLocation.bucket)
      || !videoLocation.objectPath.startsWith(requiredPrefix)
      || !subtitleLocation.objectPath.startsWith(requiredPrefix)) {
      throw new Error('longform_output_boundary_mismatch');
    }
    if (!/^[a-f0-9]{64}$/.test(String(video.checksum || ''))
      || !/^[a-f0-9]{64}$/.test(String(subtitle.checksum || ''))) {
      throw new Error('longform_segment_checksum_missing');
    }
    return {
      index: descriptor.index,
      startMs: descriptor.startMs,
      endMs: descriptor.endMs,
      videoRef: video.ref,
      videoGeneration: video.generation,
      videoChecksum: video.checksum as string,
      subtitleRef: subtitle.ref,
      subtitleGeneration: subtitle.generation,
      subtitleChecksum: subtitle.checksum as string,
    };
  });

  const jobId = makeAssemblyJobId(planId);
  const payload = {
    schemaVersion: 'urai-life-movie-assembly-v1',
    planId,
    projectId: plan.projectId,
    renderPlanDigest: plan.renderPlanDigest,
    sceneTruthReceiptRef: plan.sceneTruthReceiptRef,
    sceneTruthDigest: plan.sceneTruthDigest,
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    outputPrefix: `tenants/${tenantId}/life-movies/${plan.projectId}/final/`,
    segments,
    publicReleaseAuthorized: false,
    providerGenerationAuthorized: false,
  };
  const now = FieldValue.serverTimestamp();

  return db.runTransaction(async (transaction) => {
    // Refresh source, consent, and all selected segment outputs in the same
    // write transaction that queues an assembly job. These reads conflict
    // with concurrent revocation/cancellation/output changes at commit time.
    const [planSnapshot, existing, liveConsentBlock, currentChildSnapshots, ownerSnapshot] = await Promise.all([
      transaction.get(planRef(planId)),
      transaction.get(jobDoc(jobId)),
      transaction.get(consentBlockRef(plan.ownerUid, plan.consent.purpose)),
      transaction.getAll(...plan.childJobIds.map((childId) => jobDoc(childId))),
      transaction.get(db.collection('users').doc(userId)),
    ]);
    assertOwnerDeletionFenceClear(ownerSnapshot);
    assertLifeMovieOwnerTenantAuthorityClear(ownerSnapshot, userId, tenantId);
    assertJobConsentBlockClear(liveConsentBlock, 'life_movie_longform_consent_revoked');
    if (!planSnapshot.exists) throw new Error('longform_plan_not_found');
    const currentPlan = assertPlanOwner(planSnapshot.data() as StoredPlan, tenantId, userId);
    assertPlanStructure(currentPlan, planId);
    if (currentPlan.status === 'CANCELLED') throw new Error('longform_plan_cancelled');
    if (currentPlan.status !== 'PENDING') throw new Error('longform_plan_changed');
    if (!isDeepStrictEqual(currentPlan.childJobIds, plan.childJobIds)
      || !isDeepStrictEqual(currentPlan.segments, plan.segments)
      || !isDeepStrictEqual(currentPlan.consent, plan.consent)
      || currentPlan.projectId !== plan.projectId
      || currentPlan.renderPlanDigest !== plan.renderPlanDigest
      || currentPlan.sceneTruthDigest !== plan.sceneTruthDigest
      || currentPlan.sceneTruthReceiptRef !== plan.sceneTruthReceiptRef
      || currentPlan.width !== plan.width || currentPlan.height !== plan.height
      || currentPlan.fps !== plan.fps
      || (currentPlan.assemblyJobId !== undefined && currentPlan.assemblyJobId !== jobId)) {
      throw new Error('longform_plan_changed');
    }
    for (const [index, latest] of currentChildSnapshots.entries()) {
      if (!latest.exists) throw new Error('longform_plan_not_ready_for_assembly');
      const currentChild = latest.data() as Job;
      if (currentChild.status !== 'SUCCESS') throw new Error('longform_plan_not_ready_for_assembly');
      assertBoundSegmentForUse(currentPlan, currentChild, index);
      const selectedChild = children[index];
      if (!selectedChild
        || !isDeepStrictEqual(currentChild.payload, selectedChild.payload)
        || !isDeepStrictEqual(currentChild.output, selectedChild.output)
        || !isDeepStrictEqual(currentChild.consent, selectedChild.consent)) {
        throw new Error('longform_segment_binding_mismatch');
      }
    }

    if (existing.exists) {
      const current = existing.data() as Job;
      if (current.ownerUid !== userId || current.tenantId !== tenantId
        || (current.jobType || current.type) !== 'studio.assemble.video'
        || buildRequestFingerprint('studio.assemble.video', current.payload) !== buildRequestFingerprint('studio.assemble.video', payload)) {
        throw new Error('longform_assembly_binding_mismatch');
      }
      if (currentPlan.assemblyJobId !== jobId) {
        transaction.update(planRef(planId), { assemblyJobId: jobId, updatedAt: now });
      }
      return { planId, jobId, deduplicated: true, status: current.status };
    }

    const job: Job = {
      jobId,
      type: 'studio.assemble.video',
      jobType: 'studio.assemble.video',
      status: 'PENDING',
      payload,
      ownerUid: userId,
      tenantId,
      consent: currentPlan.consent,
      retryCount: 0,
      execution: {
        attemptCount: 0,
        maxAttempts: 3,
        rootJobId: planId,
        parentJobId: planId,
        correlationId: planId,
      },
      sourceSystem: 'urai-studio',
      sourceProject: 'urai-studio',
    };
    const queue: JobQueueEntry = {
      jobId,
      jobType: 'studio.assemble.video',
      status: 'PENDING',
      attemptCount: 0,
    };
    transaction.create(jobDoc(jobId), { ...job, createdAt: now, updatedAt: now });
    transaction.create(jobQueueEntryDoc(jobId), { ...queue, availableAt: now, createdAt: now });
    transaction.update(planRef(planId), { assemblyJobId: jobId, updatedAt: now });
    return { planId, jobId, deduplicated: false, status: 'PENDING' };
  });
}

async function readPlanPlayback(planId: string, tenantId: string, userId: string, disposition: 'inline' | 'attachment' = 'inline') {
  const plan = await loadPlan(planId, tenantId, userId);
  assertPlanStructure(plan, planId);
  await assertPlanConsentActive(plan);
  const db = getFirestore();
  const snapshots = await db.getAll(...plan.childJobIds.map((jobId) => jobDoc(jobId)));
  const jobs = snapshots.map((snapshot) => snapshot.exists ? snapshot.data() : undefined);
  const statuses = jobs.map((job) => (job?.status ?? 'DEAD') as JobStatus);
  if (deriveStatus(plan, statuses) !== 'SUCCESS') throw new Error('longform_plan_not_ready_for_playback');

  const expiresAtMs = Date.now() + 5 * 60 * 1000;
  const requiredPrefix = `tenants/${tenantId}/life-movies/${plan.projectId}/segments/`;
  const allowedBuckets = allowedLifeMovieOutputBuckets();
  let finalFile: null | {
    video: { url: string; mimeType: string; checksum?: string };
    subtitles: { url: string; mimeType: string; checksum?: string };
  } = null;
  if (plan.assemblyJobId) {
    const assemblySnapshot = await jobDoc(plan.assemblyJobId).get();
    if (assemblySnapshot.exists) {
      const assembly = assemblySnapshot.data() as Job;
      if (assembly.status === 'SUCCESS') {
        assertBoundAssemblyForUse(plan, assembly);
        const video = boundedArtifact(assembly.output, 'mp4');
        const subtitle = boundedArtifact(assembly.output, 'srt');
        const finalPrefix = `tenants/${tenantId}/life-movies/${plan.projectId}/final/`;
        const videoLocation = parseGcsRef(video.ref);
        const subtitleLocation = parseGcsRef(subtitle.ref);
        if (!allowedBuckets.has(videoLocation.bucket)
          || !allowedBuckets.has(subtitleLocation.bucket)
          || !videoLocation.objectPath.startsWith(finalPrefix)
          || !subtitleLocation.objectPath.startsWith(finalPrefix)) {
          throw new Error('longform_output_boundary_mismatch');
        }
        const [videoUrl] = await getStorage().bucket(videoLocation.bucket).file(videoLocation.objectPath, { generation: Number(video.generation) }).getSignedUrl({
      version: 'v4', queryParams: { generation: video.generation },
          action: 'read', expires: expiresAtMs, responseDisposition: disposition, responseType: video.mimeType,
        });
        const [subtitleUrl] = await getStorage().bucket(subtitleLocation.bucket).file(subtitleLocation.objectPath, { generation: Number(subtitle.generation) }).getSignedUrl({
      version: 'v4', queryParams: { generation: subtitle.generation },
          action: 'read', expires: expiresAtMs, responseDisposition: disposition, responseType: subtitle.mimeType,
        });
        finalFile = {
          video: { url: videoUrl, mimeType: video.mimeType, checksum: video.checksum },
          subtitles: { url: subtitleUrl, mimeType: subtitle.mimeType, checksum: subtitle.checksum },
        };
      }
    }
  }
  const segmentAuthority: Array<{
    index: number;
    startMs: number;
    endMs: number;
    gapBeforeMs: number;
    videoChecksum?: string;
    subtitleChecksum?: string;
  }> = [];
  const segments = [];

  for (const [index, job] of jobs.entries()) {
    if (!job || job.status !== 'SUCCESS') throw new Error('longform_plan_not_ready_for_playback');
    const descriptor = plan.segments[index];
    if (!descriptor || descriptor.jobId !== plan.childJobIds[index]) throw new Error('longform_segment_binding_mismatch');
    assertBoundSegmentForUse(plan, job as Job, index);
    const video = boundedArtifact(job.output, 'mp4');
    const subtitle = boundedArtifact(job.output, 'srt');
    const videoLocation = parseGcsRef(video.ref);
    const subtitleLocation = parseGcsRef(subtitle.ref);
    if (!allowedBuckets.has(videoLocation.bucket)
      || !allowedBuckets.has(subtitleLocation.bucket)
      || !videoLocation.objectPath.startsWith(requiredPrefix)
      || !subtitleLocation.objectPath.startsWith(requiredPrefix)) {
      throw new Error('longform_output_boundary_mismatch');
    }

    const [videoUrl] = await getStorage().bucket(videoLocation.bucket).file(videoLocation.objectPath, { generation: Number(video.generation) }).getSignedUrl({
      version: 'v4', queryParams: { generation: video.generation },
      action: 'read',
      expires: expiresAtMs,
      responseDisposition: disposition,
      responseType: video.mimeType,
    });
    const [subtitleUrl] = await getStorage().bucket(subtitleLocation.bucket).file(subtitleLocation.objectPath, { generation: Number(subtitle.generation) }).getSignedUrl({
      version: 'v4', queryParams: { generation: subtitle.generation },
      action: 'read',
      expires: expiresAtMs,
      responseDisposition: disposition,
      responseType: subtitle.mimeType,
    });

    const previousEnd = index > 0 ? plan.segments[index - 1].endMs : 0;
    const gapBeforeMs = Math.max(0, descriptor.startMs - previousEnd);
    segmentAuthority.push({
      index: descriptor.index,
      startMs: descriptor.startMs,
      endMs: descriptor.endMs,
      gapBeforeMs,
      videoChecksum: video.checksum,
      subtitleChecksum: subtitle.checksum,
    });
    segments.push({
      index: descriptor.index,
      startMs: descriptor.startMs,
      endMs: descriptor.endMs,
      gapBeforeMs,
      video: { url: videoUrl, mimeType: video.mimeType, checksum: video.checksum },
      subtitles: { url: subtitleUrl, mimeType: subtitle.mimeType, checksum: subtitle.checksum },
    });
  }

  const playlistDigest = createHash('sha256').update(JSON.stringify({
    schemaVersion: 'urai-life-movie-private-playlist-v1',
    planId,
    renderPlanDigest: plan.renderPlanDigest,
    sceneTruthDigest: plan.sceneTruthDigest,
    segments: segmentAuthority,
  })).digest('hex');

  return {
    schemaVersion: 'urai-life-movie-private-playlist-v1',
    planId,
    expiresAt: new Date(expiresAtMs).toISOString(),
    renderPlanDigest: plan.renderPlanDigest,
    sceneTruthDigest: plan.sceneTruthDigest,
    playlistDigest,
    publicReleaseAuthorized: false,
    finalFile,
    segments,
  };
}

async function resumePlan(planId: string, tenantId: string, userId: string) {
  const plan = await loadPlan(planId, tenantId, userId);
  if (plan.status === 'CANCELLED') throw new Error('longform_plan_cancelled');
  await assertPlanConsentActive(plan);

  const db = getFirestore();
  const childRefs = plan.childJobIds.map((jobId) => jobDoc(jobId));
  return db.runTransaction(async (transaction) => {
    // Read both owner-plan state and consent revocation in the same write
    // transaction that can requeue failed children. These transaction reads
    // force retry/abort if cancellation or revocation races this resume.
    const [snapshots, assemblySnapshot, planSnapshot, liveConsentBlock, ownerSnapshot] = await Promise.all([
      childRefs.length ? transaction.getAll(...childRefs) : Promise.resolve([]),
      plan.assemblyJobId ? transaction.get(jobDoc(plan.assemblyJobId)) : Promise.resolve(null),
      transaction.get(planRef(planId)),
      transaction.get(consentBlockRef(plan.ownerUid, plan.consent.purpose)),
      transaction.get(db.collection('users').doc(userId)),
    ]);
    assertOwnerDeletionFenceClear(ownerSnapshot);
    assertLifeMovieOwnerTenantAuthorityClear(ownerSnapshot, userId, tenantId);
    assertJobConsentBlockClear(liveConsentBlock, 'life_movie_longform_consent_revoked');
    if (!planSnapshot.exists) throw new Error('longform_plan_not_found');
    const currentPlan = assertPlanOwner(planSnapshot.data() as StoredPlan, tenantId, userId);
    assertPlanStructure(currentPlan, planId);
    if (currentPlan.status === 'CANCELLED') throw new Error('longform_plan_cancelled');
    // Child refs came from the earlier plan snapshot; stale membership,
    // source selection, or consent must not be replayed into a newer plan.
    if (!isDeepStrictEqual(currentPlan.childJobIds, plan.childJobIds)
      || !isDeepStrictEqual(currentPlan.segments, plan.segments)
      || currentPlan.assemblyJobId !== plan.assemblyJobId
      || currentPlan.projectId !== plan.projectId
      || currentPlan.renderPlanDigest !== plan.renderPlanDigest
      || currentPlan.sceneTruthDigest !== plan.sceneTruthDigest
      || currentPlan.sceneTruthReceiptRef !== plan.sceneTruthReceiptRef
      || currentPlan.width !== plan.width || currentPlan.height !== plan.height
      || currentPlan.fps !== plan.fps
      || !isDeepStrictEqual(currentPlan.consent, plan.consent)) {
      throw new Error('longform_plan_changed');
    }
    // Before re-queuing any child, verify every current job remains bound
    // to the same owner, plan, consent, and immutable segment source.
    if (snapshots.length !== currentPlan.childJobIds.length) throw new Error('longform_child_not_found');
    for (const [index, snapshot] of snapshots.entries()) {
      if (!snapshot.exists) throw new Error('longform_child_not_found');
      const child = snapshot.data() as Job;
      validateOwnedMovieJob(child as unknown as Record<string, unknown>,
        boundPlanJob(currentPlan, currentPlan.childJobIds[index], 'segment'));
      const descriptor = currentPlan.segments[index];
      const payload = child.payload as Record<string, unknown> | undefined;
      if (!payload || !descriptor
        || buildRequestFingerprint('studio.render.video', payload) !== descriptor.childPayloadFingerprint
        || payload.renderPlanDigest !== descriptor.childDigest
        || payload.sceneTruthDigest !== currentPlan.sceneTruthDigest
        || !isDeepStrictEqual(child.consent, currentPlan.consent)) {
        throw new Error('longform_segment_binding_mismatch');
      }
    }
    if (currentPlan.assemblyJobId) {
      if (!assemblySnapshot?.exists) throw new Error('longform_child_not_found');
      const assembly = assemblySnapshot.data() as Job;
      validateOwnedMovieJob(assembly as unknown as Record<string, unknown>,
        boundPlanJob(currentPlan, currentPlan.assemblyJobId, 'assembly'));
      const assemblyPayload = assembly.payload as Record<string, unknown> | undefined;
      if (!assemblyPayload || assemblyPayload.planId !== planId
        || assemblyPayload.renderPlanDigest !== currentPlan.renderPlanDigest
        || assemblyPayload.sceneTruthDigest !== currentPlan.sceneTruthDigest
        || assemblyPayload.sceneTruthReceiptRef !== currentPlan.sceneTruthReceiptRef
        || !isDeepStrictEqual(assembly.consent, currentPlan.consent)) {
        throw new Error('longform_assembly_binding_mismatch');
      }
    }
    const now = FieldValue.serverTimestamp();
    let resumedChildren = 0;

    for (const [index, snapshot] of snapshots.entries()) {
      const child = snapshot.data() as Job;
      if (!['FAILED', 'DEAD', 'CANCELLED'].includes(String(child.status))) continue;
      const jobId = plan.childJobIds[index];
      transaction.update(childRefs[index], {
        status: 'PENDING',
        retryCount: 0,
        error: FieldValue.delete(),
        result: FieldValue.delete(),
        completedAt: FieldValue.delete(),
        lease: FieldValue.delete(),
        updatedAt: now,
        'execution.attemptCount': 0,
        'execution.completedAt': FieldValue.delete(),
        'execution.leaseToken': FieldValue.delete(),
        'execution.asyncCallbackPending': false,
        'execution.callbackTokenHash': FieldValue.delete(),
        'execution.callbackLeaseToken': FieldValue.delete(),
        'execution.callbackDeadlineAt': FieldValue.delete(),
      });
      transaction.set(jobQueueEntryDoc(jobId), {
        jobId,
        jobType: 'studio.render.video',
        status: 'PENDING',
        attemptCount: 0,
        retryCount: 0,
        availableAt: now,
        lease: FieldValue.delete(),
        updatedAt: now,
      }, { merge: true });
      resumedChildren += 1;
    }

    let assemblyResumed = false;
    if (plan.assemblyJobId && assemblySnapshot?.exists) {
      const assemblyRef = jobDoc(plan.assemblyJobId);
      {
        const assembly = assemblySnapshot.data() as Job;
        if (['FAILED', 'DEAD', 'CANCELLED'].includes(String(assembly.status))) {
          transaction.update(assemblyRef, {
            status: 'PENDING',
            retryCount: 0,
            error: FieldValue.delete(),
            result: FieldValue.delete(),
            completedAt: FieldValue.delete(),
            lease: FieldValue.delete(),
            updatedAt: now,
            'execution.attemptCount': 0,
            'execution.completedAt': FieldValue.delete(),
            'execution.leaseToken': FieldValue.delete(),
          });
          transaction.set(jobQueueEntryDoc(plan.assemblyJobId), {
            jobId: plan.assemblyJobId,
            jobType: 'studio.assemble.video',
            status: 'PENDING',
            attemptCount: 0,
            retryCount: 0,
            availableAt: now,
            lease: FieldValue.delete(),
            updatedAt: now,
          }, { merge: true });
          assemblyResumed = true;
        }
      }
    }

    transaction.update(planRef(planId), {
      status: 'PENDING',
      resumedAt: now,
      resumedBy: userId,
      updatedAt: now,
    });
    return { planId, resumedChildren, assemblyResumed };
  });
}

async function deletePlanOutputs(planId: string, tenantId: string, userId: string) {
  const plan = await loadPlan(planId, tenantId, userId);
  assertPlanStructure(plan, planId);
  if (plan.status !== 'CANCELLED') throw new Error('longform_plan_cancel_required');
  const db = getFirestore();
  const owners = plan.childJobIds.map((jobId) => boundPlanJob(plan, jobId, 'segment'));
  if (plan.assemblyJobId) owners.push(boundPlanJob(plan, plan.assemblyJobId, 'assembly'));
  const snapshots = await db.getAll(...owners.map((owner) => jobDoc(owner.jobId)));
  // Preflight the entire plan before deleting any object. Individual jobs are
  // revalidated again by the deletion routine and the plan is checked last.
  for (const [index, snapshot] of snapshots.entries()) {
    if (!snapshot.exists) throw new Error('longform_child_not_found');
    const job = snapshot.data() as Record<string, unknown>;
    preflightOwnedMovieOutputs(job, owners[index]);
  }
  let deletedObjectCount = 0;
  for (const owner of owners) {
    const result = await deleteOwnedMovieOutputs(owner);
    deletedObjectCount += result.deletedObjectCount;
  }
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(planRef(planId));
    if (!snapshot.exists) throw new Error('longform_plan_not_found');
    const current = assertPlanOwner(snapshot.data() as StoredPlan, tenantId, userId);
    assertPlanStructure(current, planId);
    if (current.status !== 'CANCELLED' || current.projectId !== plan.projectId
      || current.assemblyJobId !== plan.assemblyJobId
      || !isDeepStrictEqual(current.childJobIds, plan.childJobIds)
      || !isDeepStrictEqual(current.segments, plan.segments)) throw new Error('longform_plan_changed');
    const now = FieldValue.serverTimestamp();
    transaction.update(planRef(planId), { outputDeletedAt: now, outputDeletedBy: userId, updatedAt: now });
  });
  return { planId, deletedObjectCount, retainedSourceMedia: true };
}

async function cancelPlan(planId: string, tenantId: string, userId: string) {
  const db = getFirestore();
  const ref = planRef(planId);
  return db.runTransaction(async (transaction) => {
    const planSnapshot = await transaction.get(ref);
    if (!planSnapshot.exists) throw new Error('longform_plan_not_found');
    const plan = assertPlanOwner(planSnapshot.data() as StoredPlan, tenantId, userId);
    assertPlanStructure(plan, planId);
    const childRefs = plan.childJobIds.map((jobId) => jobDoc(jobId));
    const [childSnapshots, assemblySnapshot] = await Promise.all([
      childRefs.length ? transaction.getAll(...childRefs) : Promise.resolve([]),
      plan.assemblyJobId ? transaction.get(jobDoc(plan.assemblyJobId)) : Promise.resolve(null),
    ]);
    // Validate every child before any writes, including already-terminal jobs.
    for (const [index, snapshot] of childSnapshots.entries()) {
      if (!snapshot.exists) throw new Error('longform_child_not_found');
      validateOwnedMovieJob(snapshot.data() as Record<string, unknown>, boundPlanJob(plan, plan.childJobIds[index], 'segment'));
    }
    if (plan.assemblyJobId) {
      if (!assemblySnapshot?.exists) throw new Error('longform_child_not_found');
      validateOwnedMovieJob(assemblySnapshot.data() as Record<string, unknown>, boundPlanJob(plan, plan.assemblyJobId, 'assembly'));
    }
    const now = FieldValue.serverTimestamp();
    let cancelledChildren = 0;

    for (const [index, snapshot] of childSnapshots.entries()) {
      if (!snapshot.exists) continue;
      const child = snapshot.data() as Job;
      if (TERMINAL.has(child.status)) continue;
      const jobId = plan.childJobIds[index];
      transaction.update(childRefs[index], {
        status: 'CANCELLED',
        ...(['RUNNING', 'LEASED'].includes(String(child.status)) ? { outputDeletionInFlightUnresolved: true } : {}),
        completedAt: now,
        updatedAt: now,
        lease: FieldValue.delete(),
        'execution.leaseToken': FieldValue.delete(),
        'execution.asyncCallbackPending': false,
      });
      transaction.set(jobQueueEntryDoc(jobId), {
        jobId,
        jobType: 'studio.render.video',
        status: 'CANCELLED',
        lease: FieldValue.delete(),
        updatedAt: now,
      }, { merge: true });
      cancelledChildren += 1;
    }

    let assemblyCancelled = false;
    if (plan.assemblyJobId && assemblySnapshot?.exists) {
      const assemblyRef = jobDoc(plan.assemblyJobId);
      {
        const assembly = assemblySnapshot.data() as Job;
        if (!TERMINAL.has(assembly.status)) {
          transaction.update(assemblyRef, {
            status: 'CANCELLED',
            ...(['RUNNING', 'LEASED'].includes(String(assembly.status)) ? { outputDeletionInFlightUnresolved: true } : {}),
            completedAt: now,
            updatedAt: now,
            lease: FieldValue.delete(),
            'execution.leaseToken': FieldValue.delete(),
            'execution.asyncCallbackPending': false,
          });
          transaction.set(jobQueueEntryDoc(plan.assemblyJobId), {
            jobId: plan.assemblyJobId,
            jobType: 'studio.assemble.video',
            status: 'CANCELLED',
            lease: FieldValue.delete(),
            updatedAt: now,
          }, { merge: true });
          assemblyCancelled = true;
        }
      }
    }

    transaction.update(ref, {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelledBy: userId,
      updatedAt: now,
    });

    return { planId, cancelled: true, cancelledChildren, assemblyCancelled };
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

  // This is an authenticated contract endpoint, not a delivery grant. The
  // caller's authorityHash cannot authorize private data access.
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && req.body.action === 'deliver') {
    try {
      parseLifeMoviePrivateDeliveryRequest(req.body, 'longform');
    } catch {
      res.status(400).json({ ok: false, error: 'life_movie_private_delivery_request_invalid' });
      return;
    }
    res.status(503).json({ ok: false, error: LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE });
    return;
  }

  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid_longform_request' });
    return;
  }

  // Legacy playback/download return five-minute signed URLs and cannot revoke
  // access while the link is live. Never resurrect them when the scoped
  // consent authority becomes available: use authenticated 'deliver' only.
  if (parsed.data.action === 'playback' || parsed.data.action === 'download') {
    res.status(503).json({ ok: false, error: 'life_movie_authenticated_delivery_required' });
    return;
  }

  if (['create', 'playback', 'download', 'resume', 'assemble'].includes(parsed.data.action)
    && !lifeMovieConsentAuthorityAvailable()) {
    res.status(503).json({ ok: false, error: LIFE_MOVIE_CONSENT_AUTHORITY_UNAVAILABLE });
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
    // Legacy playback/download are rejected before dispatch; no signed URL fallback.
    if (parsed.data.action === 'resume') {
      const result = await resumePlan(parsed.data.planId, parsed.data.tenantId, parsed.data.userId);
      res.status(200).json({ ok: true, resume: result });
      return;
    }
    if (parsed.data.action === 'assemble') {
      const result = await assemblePlan(parsed.data.planId, parsed.data.tenantId, parsed.data.userId);
      res.status(result.deduplicated ? 200 : 202).json({ ok: true, assembly: result });
      return;
    }
    if (parsed.data.action === 'delete-output') {
      const result = await deletePlanOutputs(parsed.data.planId, parsed.data.tenantId, parsed.data.userId);
      res.status(200).json({ ok: true, deletion: result });
      return;
    }
    const result = await cancelPlan(parsed.data.planId, parsed.data.tenantId, parsed.data.userId);
    res.status(200).json({ ok: true, cancellation: result });
  } catch (error) {
    const known = new Set([
      'longform_plan_not_found', 'longform_plan_boundary_mismatch', 'longform_output_boundary_mismatch',
      'longform_output_bucket_authority_unavailable', 'longform_plan_not_ready_for_playback',
      'longform_plan_not_ready_for_assembly', 'longform_final_assembly_not_ready',
      'longform_segment_checksum_missing', 'longform_assembly_binding_mismatch', 'longform_plan_cancelled',
      'longform_plan_structure_invalid', 'longform_child_not_found', 'longform_plan_cancel_required', 'longform_plan_changed',
      'longform_child_status_boundary_mismatch', 'longform_assembly_status_boundary_mismatch',
      'scene_truth_receipt_replay_conflict', 'idempotency_conflict', 'life_movie_longform_disabled',
      'life_movie_longform_consent_revoked', 'scene_truth_receipt_authority_unavailable',
      'scene_truth_receipt_expired', 'invalid_scene_truth_receipt_signature', 'life_movie_owner_job_boundary_mismatch',
      'life_movie_output_inflight_unresolved', 'life_movie_output_ref_invalid', 'life_movie_output_limit_exceeded',
      'life_movie_output_changed', 'life_movie_output_generation_invalid', 'life_movie_output_generation_changed',
      'life_movie_output_boundary_mismatch', 'life_movie_output_bucket_authority_unavailable',
      'owner_data_rights_deletion_pending', 'owner_data_rights_authority_unavailable',
      'life_movie_owner_tenant_authority_unavailable',
    ]);
    const code = error instanceof Error && known.has(error.message) ? error.message : 'longform_bridge_failed';
    const status = code === 'owner_data_rights_deletion_pending' ? 409
      : code === 'owner_data_rights_authority_unavailable' ? 503
      : code === 'life_movie_owner_tenant_authority_unavailable' ? 503
      : code === 'longform_plan_not_found' ? 404
      : code === 'longform_plan_boundary_mismatch' ? 403
      : code === 'longform_child_status_boundary_mismatch'
        || code === 'longform_assembly_status_boundary_mismatch' ? 403
      : code === 'life_movie_owner_job_boundary_mismatch' || code === 'life_movie_output_boundary_mismatch' ? 403
      : code === 'longform_output_boundary_mismatch' ? 403
      : code === 'longform_output_bucket_authority_unavailable' || code === 'life_movie_output_bucket_authority_unavailable' ? 503
      : code === 'longform_child_not_found' ? 404
      : code === 'longform_plan_structure_invalid' || code === 'longform_plan_cancel_required'
        || code === 'longform_plan_changed' || code === 'life_movie_output_inflight_unresolved'
        || code === 'life_movie_output_changed' || code === 'life_movie_output_generation_changed' ? 409
      : code === 'longform_plan_not_ready_for_playback' ? 409
      : code === 'longform_plan_not_ready_for_assembly' ? 409
      : code === 'longform_final_assembly_not_ready' ? 409
      : code === 'longform_segment_checksum_missing' ? 409
      : code === 'longform_assembly_binding_mismatch' ? 409
      : code === 'longform_plan_cancelled' ? 409
      : code === 'scene_truth_receipt_replay_conflict' ? 409
      : code === 'idempotency_conflict' ? 409
      : code === 'life_movie_longform_disabled' ? 503
      : code === 'life_movie_longform_consent_revoked' ? 409
      : code === 'scene_truth_receipt_authority_unavailable' ? 503
      : code === 'scene_truth_receipt_expired' ? 409
      : code === 'invalid_scene_truth_receipt_signature' ? 403
      : code === 'longform_bridge_failed' ? 500 : 400;
    res.status(status).json({ ok: false, error: code });
  }
});
