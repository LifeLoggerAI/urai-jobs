import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { ulid } from 'ulid';
import { z } from 'zod';
import type { Job, JobQueueEntry, JobStatus } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { consentBlockRef } from '../privacy/consentBlocks.js';
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
  consent: z.object({
    purpose: z.literal('life-movie.render'),
    policyVersion: z.string().trim().min(1).max(80),
    decisionReceiptId: z.string().trim().min(1).max(160),
  }).strict(),
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

function makeAssemblyJobId(planId: string) {
  return `lma_${createHash('sha256').update(`${planId}:assembly-v1`).digest('hex').slice(0, 40)}`;
}

type WorkerArtifact = {
  kind?: unknown;
  ref?: unknown;
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
  if (snapshot.exists && snapshot.data()?.active === true) {
    throw new Error('life_movie_longform_consent_revoked');
  }
}

async function createPlan(input: z.infer<typeof CreateSchema>) {
  if (!longformEnabled()) throw new Error('life_movie_longform_disabled');

  const payload = assertLifeMovieLongformTenantPaths(input.payload, input.tenantId);
  const consentSnapshot = await consentBlockRef(input.userId, input.consent.purpose).get();
  if (consentSnapshot.exists && consentSnapshot.data()?.active === true) {
    throw new Error('life_movie_longform_consent_revoked');
  }
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
  const plan = await loadPlan(planId, tenantId, userId);
  const consentSnapshot = await consentBlockRef(plan.ownerUid, plan.consent.purpose).get();
  const revoked = consentSnapshot.exists && consentSnapshot.data()?.active === true;
  const db = getFirestore();
  const snapshots = await db.getAll(...plan.childJobIds.map((jobId) => jobDoc(jobId)));
  const assemblySnapshot = plan.assemblyJobId ? await jobDoc(plan.assemblyJobId).get() : null;
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
    status: revoked ? 'REVOKED' : deriveStatus(plan, statuses),
    consentRevoked: revoked,
    segmentCount: children.length,
    counts,
    children,
    renderPlanDigest: plan.renderPlanDigest,
    sceneTruthDigest: plan.sceneTruthDigest,
    assembly: plan.assemblyJobId ? {
      jobId: plan.assemblyJobId,
      status: assemblySnapshot?.exists ? String(assemblySnapshot.data()?.status || 'DEAD') : 'DEAD',
    } : null,
    publicReleaseAuthorized: false,
  };
}

async function assemblePlan(planId: string, tenantId: string, userId: string) {
  const plan = await loadPlan(planId, tenantId, userId);
  if (plan.status === 'CANCELLED') throw new Error('longform_plan_cancelled');
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
      videoChecksum: video.checksum as string,
      subtitleRef: subtitle.ref,
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
    const [planSnapshot, existing] = await Promise.all([
      transaction.get(planRef(planId)),
      transaction.get(jobDoc(jobId)),
    ]);
    if (!planSnapshot.exists) throw new Error('longform_plan_not_found');
    const currentPlan = assertPlanOwner(planSnapshot.data() as StoredPlan, tenantId, userId);
    if (currentPlan.status === 'CANCELLED') throw new Error('longform_plan_cancelled');

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
        const [videoUrl] = await getStorage().bucket(videoLocation.bucket).file(videoLocation.objectPath).getSignedUrl({
          action: 'read', expires: expiresAtMs, responseDisposition: disposition, responseType: video.mimeType,
        });
        const [subtitleUrl] = await getStorage().bucket(subtitleLocation.bucket).file(subtitleLocation.objectPath).getSignedUrl({
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

    const [videoUrl] = await getStorage().bucket(videoLocation.bucket).file(videoLocation.objectPath).getSignedUrl({
      action: 'read',
      expires: expiresAtMs,
      responseDisposition: disposition,
      responseType: video.mimeType,
    });
    const [subtitleUrl] = await getStorage().bucket(subtitleLocation.bucket).file(subtitleLocation.objectPath).getSignedUrl({
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
    // A resume may have loaded the parent before an owner deletion/cancel.
    // Re-read its durable authority inside the same transaction as every write.
    const currentPlanSnapshot = await transaction.get(planRef(planId));
    if (!currentPlanSnapshot.exists) throw new Error('longform_plan_not_found');
    const currentPlan = assertPlanOwner(currentPlanSnapshot.data() as StoredPlan, tenantId, userId);
    if (currentPlan.status === 'CANCELLED') throw new Error('longform_plan_cancelled');
    if (currentPlan.assemblyJobId !== plan.assemblyJobId) throw new Error('longform_plan_changed');
    const [snapshots, assemblySnapshot] = await Promise.all([
      childRefs.length ? transaction.getAll(...childRefs) : Promise.resolve([]),
      plan.assemblyJobId ? transaction.get(jobDoc(plan.assemblyJobId)) : Promise.resolve(null),
    ]);
    const now = FieldValue.serverTimestamp();
    let resumedChildren = 0;

    for (const [index, snapshot] of snapshots.entries()) {
      if (!snapshot.exists) continue;
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
  const db = getFirestore();
  const allowedBuckets = allowedLifeMovieOutputBuckets();
  // Fence the parent and all attempts before an awaited storage operation. Keep
  // output/result references until cleanup succeeds so a failure remains retryable.
  const fenced = await db.runTransaction(async (transaction) => {
    const parentSnapshot = await transaction.get(planRef(planId));
    if (!parentSnapshot.exists) throw new Error('longform_plan_not_found');
    const plan = assertPlanOwner(parentSnapshot.data() as StoredPlan, tenantId, userId);
    const ids = [...plan.childJobIds, ...(plan.assemblyJobId ? [plan.assemblyJobId] : [])];
    const refs = ids.map((id) => jobDoc(id));
    const snapshots = refs.length ? await transaction.getAll(...refs) : [];
    const locations = new Map<string, { bucket: string; objectPath: string }>();
    const jobs: Array<{ id: string; ref: ReturnType<typeof jobDoc>; type: string; previousStatus: JobStatus; completedAt: unknown }> = [];

    for (const [index, snapshot] of snapshots.entries()) {
      if (!snapshot.exists) continue;
      const job = snapshot.data() as Job & { result?: unknown; outputDeletionPreviousStatus?: JobStatus };
      const type = index < plan.childJobIds.length ? 'studio.render.video' : 'studio.assemble.video';
      if (job.ownerUid !== userId || job.tenantId !== tenantId || (job.jobType || job.type) !== type
        || job.sourceSystem !== 'urai-studio' || job.execution?.parentJobId !== planId
        || job.execution?.rootJobId !== planId
        || (job.payload as { projectId?: unknown } | undefined)?.projectId !== plan.projectId) {
        throw new Error('longform_segment_binding_mismatch');
      }
      const requiredPrefix = `tenants/${tenantId}/life-movies/${plan.projectId}/${type === 'studio.render.video' ? 'segments' : 'final'}/`;
      for (const value of [job.output, job.result]) {
        const output = value as WorkerOutput | undefined;
        for (const artifact of Array.isArray(output?.outputs) ? output!.outputs! : []) {
          if (typeof artifact?.ref !== 'string' || !artifact.ref.startsWith('gs://')) continue;
          const location = parseGcsRef(artifact.ref);
          if (!allowedBuckets.has(location.bucket) || !location.objectPath.startsWith(requiredPrefix)
            || location.objectPath.includes('..') || location.objectPath.includes('\\')) {
            throw new Error('longform_output_boundary_mismatch');
          }
          locations.set(`${location.bucket}/${location.objectPath}`, location);
        }
      }
      jobs.push({ id: ids[index], ref: refs[index], type,
        previousStatus: job.outputDeletionPreviousStatus || job.status, completedAt: job.completedAt });
    }
    const now = FieldValue.serverTimestamp();
    for (const job of jobs) {
      transaction.update(job.ref, {
        status: 'CANCELLED', derivativeAccessState: 'DELETED', outputDeletionState: 'PENDING',
        outputDeletionRequestedAt: now, outputDeletedBy: userId, updatedAt: now, completedAt: job.completedAt || now,
        outputDeletionPreviousStatus: job.previousStatus,
        lease: FieldValue.delete(), 'execution.leaseToken': FieldValue.delete(),
        'execution.asyncCallbackPending': false, 'execution.callbackTokenHash': FieldValue.delete(),
        'execution.callbackLeaseToken': FieldValue.delete(), 'execution.callbackDeadlineAt': FieldValue.delete(),
      });
      transaction.set(jobQueueEntryDoc(job.id), {
        jobId: job.id, jobType: job.type, status: 'CANCELLED', lease: FieldValue.delete(), updatedAt: now,
      }, { merge: true });
    }
    transaction.update(planRef(planId), {
      status: 'CANCELLED', derivativeAccessState: 'DELETED', outputDeletionState: 'PENDING',
      outputDeletionRequestedAt: now, outputDeletedBy: userId, updatedAt: now,
    });
    return { jobs: jobs.map((job) => job.id), deletions: [...locations.values()] };
  });

  await Promise.all(fenced.deletions.map(({ bucket, objectPath }) =>
    getStorage().bucket(bucket).file(objectPath).delete({ ignoreNotFound: true })));

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  for (const jobId of fenced.jobs) {
    batch.update(jobDoc(jobId), {
      output: FieldValue.delete(),
      result: FieldValue.delete(),
      outputDeletionState: 'COMPLETE',
      outputDeletedAt: now,
      outputDeletedBy: userId,
      updatedAt: now,
    });
  }
  batch.update(planRef(planId), {
    outputDeletionState: 'COMPLETE',
    outputDeletedAt: now,
    outputDeletedBy: userId,
    updatedAt: now,
  });
  await batch.commit();

  return {
    planId,
    deletedObjectCount: fenced.deletions.length,
    retainedSourceMedia: true,
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
    const [childSnapshots, assemblySnapshot] = await Promise.all([
      childRefs.length ? transaction.getAll(...childRefs) : Promise.resolve([]),
      plan.assemblyJobId ? transaction.get(jobDoc(plan.assemblyJobId)) : Promise.resolve(null),
    ]);
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
    if (parsed.data.action === 'playback') {
      const result = await readPlanPlayback(parsed.data.planId, parsed.data.tenantId, parsed.data.userId);
      res.status(200).json({ ok: true, playback: result });
      return;
    }
    if (parsed.data.action === 'download') {
      const result = await readPlanPlayback(parsed.data.planId, parsed.data.tenantId, parsed.data.userId, 'attachment');
      if (!result.finalFile) throw new Error('longform_final_assembly_not_ready');
      res.status(200).json({ ok: true, download: result });
      return;
    }
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
    const code = error instanceof Error ? error.message : 'longform_bridge_failed';
    const status = code === 'longform_plan_not_found' ? 404
      : code === 'longform_plan_boundary_mismatch' ? 403
      : code === 'longform_output_boundary_mismatch' ? 403
      : code === 'longform_output_bucket_authority_unavailable' ? 503
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
      : 400;
    res.status(status).json({ ok: false, error: code });
  }
});
