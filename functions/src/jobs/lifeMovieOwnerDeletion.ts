import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { jobDoc } from '../core/firestore-paths.js';
import { lifeMovieArtifactRefs } from '../privacy/lifeMovieArtifactRefs.js';

type Owner = { tenantId: string; userId: string; jobId: string; projectId?: string; planId?: string;
  kind?: 'segment' | 'assembly'; expectedOutputPrefix?: string };
type Location = { bucket: string; objectPath: string; key: string; generation: string };
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TERMINAL = new Set(['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED']);
const MAX_OUTPUTS = 100;

function movieJobRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('life_movie_owner_job_boundary_mismatch');
  }
  return value as Record<string, unknown>;
}

function buckets() {
  const allowed = new Set([String(process.env.GCS_BUCKET_NAME || '').trim(),
    ...String(process.env.URAI_STUDIO_OUTPUT_BUCKETS || '').split(',').map((value) => value.trim())].filter(Boolean));
  if (!allowed.size) throw new Error('life_movie_output_bucket_authority_unavailable');
  return allowed;
}

export function validateOwnedMovieJob(job: Record<string, unknown>, owner: Owner) {
  const payload = job.payload;
  const execution = job.execution;
  const projectId = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).projectId : undefined;
  const expectedType = owner.kind === 'assembly' ? 'studio.assemble.video' : 'studio.render.video';
  if (job.jobId !== owner.jobId || job.ownerUid !== owner.userId || job.tenantId !== owner.tenantId
    || job.sourceSystem !== 'urai-studio' || (job.jobType || job.type) !== expectedType
    || typeof projectId !== 'string' || !SAFE_SEGMENT.test(projectId)
    || (owner.projectId !== undefined && projectId !== owner.projectId)) {
    throw new Error('life_movie_owner_job_boundary_mismatch');
  }
  if (owner.planId && (!execution || typeof execution !== 'object' || Array.isArray(execution)
    || (execution as Record<string, unknown>).rootJobId !== owner.planId
    || (execution as Record<string, unknown>).parentJobId !== owner.planId)) {
    throw new Error('life_movie_owner_job_boundary_mismatch');
  }
  return { projectId };
}

function validateOutputs(job: Record<string, unknown>, owner: Owner) {
  const { projectId } = validateOwnedMovieJob(job, owner);
  if (!TERMINAL.has(String(job.status)) || job.outputDeletionInFlightUnresolved === true
    || job.consentRevocationInFlightUnresolved === true) throw new Error('life_movie_output_inflight_unresolved');
  const refs = [...lifeMovieArtifactRefs(job.output), ...lifeMovieArtifactRefs(job.result)];
  if (refs.length > MAX_OUTPUTS) throw new Error('life_movie_output_limit_exceeded');
  const allowed = buckets();
  const prefix = `tenants/${owner.tenantId}/life-movies/${projectId}/`;
  const payload = job.payload as Record<string, unknown>;
  const declaredPrefix = payload.outputPrefix;
  if (owner.expectedOutputPrefix !== undefined && declaredPrefix !== owner.expectedOutputPrefix) {
    throw new Error('life_movie_output_boundary_mismatch');
  }
  if (refs.length && (typeof declaredPrefix !== 'string' || !declaredPrefix.startsWith(prefix)
    || declaredPrefix.includes('..') || declaredPrefix.includes('\\')
    || declaredPrefix.split('/').some((part, index, parts) => !part && index !== parts.length - 1))) {
    throw new Error('life_movie_output_boundary_mismatch');
  }
  const locations = new Map<string, { bucket: string; objectPath: string; key: string }>();
  for (const ref of refs) {
    const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(ref);
    if (!match) throw new Error('life_movie_output_ref_invalid');
    const [, bucket, objectPath] = match;
    const outputPrefix = `${String(declaredPrefix).replace(/\/+$/, '')}/`;
    if (!allowed.has(bucket) || !objectPath.startsWith(prefix) || !objectPath.startsWith(outputPrefix)
      || objectPath.includes('..') || objectPath.includes('\\')
      || objectPath.split('/').some((part) => !part || part === '.')) {
      throw new Error('life_movie_output_boundary_mismatch');
    }
    const key = createHash('sha256').update(JSON.stringify([bucket, objectPath])).digest('hex');
    locations.set(key, { bucket, objectPath, key });
  }
  return [...locations.values()];
}

export function preflightOwnedMovieOutputs(job: Record<string, unknown>, owner: Owner) {
  validateOutputs(job, owner);
}

function generation(value: unknown) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) throw new Error('life_movie_output_generation_invalid');
  const result = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  if (!/^[1-9][0-9]*$/.test(result)) throw new Error('life_movie_output_generation_invalid');
  return result;
}

function sameSnapshot(current: Record<string, unknown>, before: Record<string, unknown>) {
  return current.status === before.status
    && current.outputDeletionInFlightUnresolved !== true && current.consentRevocationInFlightUnresolved !== true
    && isDeepStrictEqual(current.payload, before.payload)
    && isDeepStrictEqual(current.output, before.output) && isDeepStrictEqual(current.result, before.result)
    && isDeepStrictEqual(current.execution, before.execution);
}

export async function deleteOwnedMovieOutputs(owner: Owner) {
  const db = getFirestore();
  const ref = jobDoc(owner.jobId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error('job_not_found');
  const before = movieJobRecord(snapshot.data());
  const locations = validateOutputs(before, owner);
  // Metadata reads precede the transaction; its saved fence survives failed
  // attempts so a retry cannot adopt a later object at the same path.
  const observed = await Promise.all(locations.map(async (location) => {
    try {
      const [metadata] = await getStorage().bucket(location.bucket).file(location.objectPath).getMetadata();
      return { ...location, generation: generation(metadata.generation) };
    } catch (error) {
      if ((error as { code?: unknown })?.code === 404) return { ...location, generation: '0' };
      throw error;
    }
  }));
  const guarded: Location[] = await db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(ref);
    if (!currentSnapshot.exists) throw new Error('job_not_found');
    const current = movieJobRecord(currentSnapshot.data());
    validateOutputs(current, owner);
    if (!sameSnapshot(current, before)) throw new Error('life_movie_output_changed');
    const fences = current.ownerOutputDeletionFences;
    if (fences !== undefined && (!fences || typeof fences !== 'object' || Array.isArray(fences))) {
      throw new Error('life_movie_output_generation_invalid');
    }
    const updates: Record<string, string> = {};
    const result = observed.map((item) => {
      const prior = (fences as Record<string, unknown> | undefined)?.[item.key];
      if (prior !== undefined && (typeof prior !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(prior))) {
        throw new Error('life_movie_output_generation_invalid');
      }
      if (prior === undefined) updates[`ownerOutputDeletionFences.${item.key}`] = item.generation;
      return { ...item, generation: (prior as string | undefined) ?? item.generation };
    });
    if (Object.keys(updates).length) transaction.update(ref, updates);
    return result;
  });
  let deletedObjectCount = 0;
  // Bound concurrency and wait for each batch to settle before a caller retries.
  for (let index = 0; index < guarded.length; index += 8) {
    const results = await Promise.allSettled(guarded.slice(index, index + 8).map(async (item) => {
      try {
        await getStorage().bucket(item.bucket).file(item.objectPath, { preconditionOpts: { ifGenerationMatch: item.generation } }).delete();
        return true;
      } catch (error) {
        if ((error as { code?: unknown })?.code === 404) return false;
        if ((error as { code?: unknown })?.code === 412) throw new Error('life_movie_output_generation_changed');
        throw error;
      }
    }));
    const failed = results.find((item) => item.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    deletedObjectCount += results.filter((item) => item.status === 'fulfilled' && item.value).length;
  }
  // Catch a replacement that appeared after an earlier delete or 404. This
  // cannot prove that another writer will not write after this final check.
  for (const item of guarded) {
    try {
      await getStorage().bucket(item.bucket).file(item.objectPath).getMetadata();
      throw new Error('life_movie_output_generation_changed');
    } catch (error) {
      if ((error as { code?: unknown })?.code !== 404) throw error;
    }
  }
  await db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(ref);
    if (!currentSnapshot.exists) throw new Error('job_not_found');
    const current = movieJobRecord(currentSnapshot.data());
    validateOutputs(current, owner);
    if (!sameSnapshot(current, before)) throw new Error('life_movie_output_changed');
    const now = FieldValue.serverTimestamp();
    transaction.update(ref, {
      output: FieldValue.delete(), result: FieldValue.delete(), ownerOutputDeletionFences: FieldValue.delete(),
      outputDeletedAt: now, outputDeletedBy: owner.userId, updatedAt: now,
    });
  });
  return { deleted: true, deletedObjectCount, retainedSourceMedia: true };
}
