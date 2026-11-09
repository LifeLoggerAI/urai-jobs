import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { jobQueueEntryDoc } from '../core/firestore-paths.js';
import { consentEventReceiptRef } from './consentBlocks.js';
import { lifeMovieArtifactRefs } from './lifeMovieArtifactRefs.js';

export type LifeMovieRevocationEvent = {
  eventId: string;
  ownerUid: string;
  purpose: string;
  revokedAt: string;
};

export type LifeMovieDerivativeInvalidationSummary = {
  purpose: string;
  jobsScanned: number;
  jobsInvalidated: number;
  plansInvalidated: number;
  storageObjectsDeleted: number;
};

const TERMINAL = new Set(['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED']);
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FIRESTORE_CONCURRENCY = 8;
const DELETE_CONCURRENCY = 8;

async function mapInBatches<T, R>(items: T[], task: (item: T) => Promise<R>): Promise<R[]> {
  const values: R[] = [];
  for (let index = 0; index < items.length; index += FIRESTORE_CONCURRENCY) {
    // Wait for every transaction in a batch to settle before reporting an
    // error, so the caller cannot retry while this batch is still mutating.
    const settled = await Promise.allSettled(items.slice(index, index + FIRESTORE_CONCURRENCY)
      .map((item) => Promise.resolve().then(() => task(item))));
    for (const result of settled) {
      if (result.status === 'rejected') throw result.reason;
      values.push(result.value);
    }
  }
  return values;
}

function allowedOutputBuckets(): Set<string> {
  return new Set([
    String(process.env.GCS_BUCKET_NAME || '').trim(),
    ...String(process.env.URAI_STUDIO_OUTPUT_BUCKETS || '').split(',').map((value) => value.trim()),
  ].filter(Boolean));
}

function isAffectedJob(job: Record<string, unknown>, event: LifeMovieRevocationEvent): boolean {
  const jobType = String(job.jobType || job.type || '');
  if (job.ownerUid !== event.ownerUid || job.sourceSystem !== 'urai-studio') return false;
  if (jobType !== 'studio.render.video' && jobType !== 'studio.assemble.video') return false;
  // Both job types are Life Movie work even if a legacy or malformed record
  // omitted or mislabeled its consent. The owner and source still must match.
  return true;
}

function isAffectedPlan(plan: Record<string, unknown>, event: LifeMovieRevocationEvent): boolean {
  // This collection is dedicated to Life Movie plans, including legacy records.
  return plan.ownerUid === event.ownerUid;
}

function parseAuthorizedLifeMovieRef(ref: string, job: Record<string, unknown>, buckets: Set<string>) {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(ref);
  if (!match) throw new Error('life_movie_revocation_output_ref_invalid');
  const tenantId = job.tenantId;
  const payload = job.payload;
  const projectId = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).projectId : undefined;
  if (typeof tenantId !== 'string' || !SAFE_SEGMENT.test(tenantId)
    || typeof projectId !== 'string' || !SAFE_SEGMENT.test(projectId)) {
    throw new Error('life_movie_revocation_output_boundary_mismatch');
  }
  const [, bucket, objectPath] = match;
  const expectedPrefix = `tenants/${tenantId}/life-movies/${projectId}/`;
  if (!buckets.has(bucket) || !objectPath.startsWith(expectedPrefix) || objectPath.includes('..')
    || objectPath.includes('\\') || objectPath.split('/').some((segment) => !segment || segment === '.')) {
    throw new Error('life_movie_revocation_output_boundary_mismatch');
  }
  return { bucket, objectPath };
}

function artifactRefs(value: unknown): string[] {
  try { return lifeMovieArtifactRefs(value); }
  catch { throw new Error('life_movie_revocation_output_ref_invalid'); }
}

function observedGeneration(value: unknown): string {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) {
    throw new Error('life_movie_revocation_output_generation_invalid');
  }
  const generation = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (!/^[1-9][0-9]*$/.test(generation)) throw new Error('life_movie_revocation_output_generation_invalid');
  return generation;
}

export async function invalidateLifeMovieDerivativesForConsent(
  event: LifeMovieRevocationEvent,
): Promise<LifeMovieDerivativeInvalidationSummary> {
  const summary: LifeMovieDerivativeInvalidationSummary = {
    purpose: event.purpose,
    jobsScanned: 0,
    jobsInvalidated: 0,
    plansInvalidated: 0,
    storageObjectsDeleted: 0,
  };

  if (event.purpose !== 'life-movie.render') return summary;

  const db = getFirestore();
  const plans = await db.collection('studioLifeMovieLongformPlans').where('ownerUid', '==', event.ownerUid).get();
  const affectedPlans = plans.docs.filter((snapshot) => isAffectedPlan(snapshot.data(), event));

  // Stop plan orchestration before scanning and fencing its jobs. Do not claim
  // deletion is complete yet.
  await mapInBatches(affectedPlans, async (snapshot) => {
    await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(snapshot.ref);
      const plan = currentSnapshot.data();
      if (!currentSnapshot.exists || !plan || !isAffectedPlan(plan, event)) {
        throw new Error('life_movie_revocation_plan_changed');
      }
      transaction.update(snapshot.ref, {
        status: 'CANCELLED', derivativeAccessState: 'REVOKED',
        consentRevocationEventId: event.eventId, consentRevokedAt: event.revokedAt,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  });

  const jobSnapshots = await db.collection('jobs').where('ownerUid', '==', event.ownerUid).get();
  summary.jobsScanned = jobSnapshots.size;
  const affectedJobs = jobSnapshots.docs.filter((snapshot) => isAffectedJob(snapshot.data(), event));

  // Fence every active job before touching Storage. Keep the references until
  // deletion succeeds, and re-read under a transaction to avoid stale leases.
  const fencedJobs = await mapInBatches(affectedJobs, async (snapshot) =>
    db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(snapshot.ref);
      const job = currentSnapshot.data();
      if (!currentSnapshot.exists || !job || !isAffectedJob(job, event)) {
        throw new Error('life_movie_revocation_job_changed');
      }
      const status = String(job.status || '');
      const inFlightUnresolved = status === 'RUNNING' || status === 'LEASED'
        || job.consentRevocationInFlightUnresolved === true || job.outputDeletionInFlightUnresolved === true;
      const now = FieldValue.serverTimestamp();
      const patch: Record<string, unknown> = {
        derivativeAccessState: 'REVOKED',
        consentRevocationEventId: event.eventId,
        consentRevokedAt: event.revokedAt,
        updatedAt: now,
      };
      // A running worker may have uploaded files not yet recorded on the job.
      // Keep this marker across retries until that attempt is reconciled.
      if (inFlightUnresolved) patch.consentRevocationInFlightUnresolved = true;
      if (!TERMINAL.has(status)) {
        patch.status = 'CANCELLED';
        patch.completedAt = now;
        patch.lease = FieldValue.delete();
        patch['execution.leaseToken'] = FieldValue.delete();
        patch['execution.asyncCallbackPending'] = false;
        patch['execution.callbackTokenHash'] = FieldValue.delete();
        patch['execution.callbackLeaseToken'] = FieldValue.delete();
        patch['execution.callbackDeadlineAt'] = FieldValue.delete();
        transaction.set(jobQueueEntryDoc(snapshot.id), {
          jobId: snapshot.id, status: 'CANCELLED', lease: FieldValue.delete(), updatedAt: now,
        }, { merge: true });
      }
      transaction.update(snapshot.ref, patch);
      return { ref: snapshot.ref, data: job, status: TERMINAL.has(status) ? status : 'CANCELLED', inFlightUnresolved };
    }));

  // Validate every reference before the first deletion. Unknown or malformed
  // metadata is retained for reconciliation instead of acknowledged as deleted.
  const buckets = allowedOutputBuckets();
  const objectLocations = new Map<string, { bucket: string; objectPath: string }>();
  for (const { data: job } of fencedJobs) {
    for (const ref of [...artifactRefs(job.output), ...artifactRefs(job.result)]) {
      const location = parseAuthorizedLifeMovieRef(ref, job, buckets);
      objectLocations.set(`${location.bucket}/${location.objectPath}`, location);
    }
  }
  const locations = [...objectLocations.values()];
  const receiptRef = consentEventReceiptRef(event.eventId);
  // Persist each observed generation before deletion so an exact event retry
  // cannot silently adopt a newer object written to the same path. Only a hash
  // of the storage location, not the private path itself, is added to the receipt.
  const observedLocations = await mapInBatches(locations, async ({ bucket, objectPath }) => {
    let observed: string;
    try {
      const [metadata] = await getStorage().bucket(bucket).file(objectPath).getMetadata();
      observed = observedGeneration(metadata.generation);
    } catch (error) {
      if ((error as { code?: unknown })?.code !== 404) throw error;
      // Generation zero requires that no live object exists at delete time.
      observed = '0';
    }
    const locationKey = createHash('sha256').update(JSON.stringify([bucket, objectPath])).digest('hex');
    return { bucket, objectPath, locationKey, observed };
  });
  const guardedLocations = observedLocations.length === 0 ? [] : await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(receiptRef);
    const receipt = snapshot.data();
    if (!snapshot.exists || !receipt || receipt.eventId !== event.eventId || receipt.ownerUid !== event.ownerUid
      || receipt.purpose !== event.purpose || receipt.status !== 'blocked') {
      throw new Error('life_movie_revocation_receipt_invalid');
    }
    const fences = receipt.storageGenerationFences;
    if (fences !== undefined && (!fences || typeof fences !== 'object' || Array.isArray(fences))) {
      throw new Error('life_movie_revocation_output_generation_invalid');
    }
    const updates: Record<string, string> = {};
    const guarded = observedLocations.map(({ bucket, objectPath, locationKey, observed }) => {
      const existing = (fences as Record<string, unknown> | undefined)?.[locationKey];
      if (existing !== undefined) {
        if (typeof existing !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(existing)) {
          throw new Error('life_movie_revocation_output_generation_invalid');
        }
        return { bucket, objectPath, generation: existing };
      }
      updates[`storageGenerationFences.${locationKey}`] = observed;
      return { bucket, objectPath, generation: observed };
    });
    if (Object.keys(updates).length > 0) transaction.update(receiptRef, updates);
    return guarded;
  });
  for (let index = 0; index < guardedLocations.length; index += DELETE_CONCURRENCY) {
    const results = await Promise.allSettled(guardedLocations.slice(index, index + DELETE_CONCURRENCY).map(async ({ bucket, objectPath, generation }) => {
      try {
        await getStorage().bucket(bucket).file(objectPath, { preconditionOpts: { ifGenerationMatch: generation } }).delete();
        return true;
      } catch (error) {
        if ((error as { code?: unknown })?.code === 404) return false;
        if ((error as { code?: unknown })?.code === 412) {
          // A previous attempt might already have deleted the recorded generation.
          // An existing object, however, is a replacement and requires reconciliation.
          try {
            await getStorage().bucket(bucket).file(objectPath).getMetadata();
          } catch (metadataError) {
            if ((metadataError as { code?: unknown })?.code === 404) return false;
            throw metadataError;
          }
          throw new Error('life_movie_revocation_output_generation_changed');
        }
        throw error;
      }
    }));
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    summary.storageObjectsDeleted += results.filter((result) => result.status === 'fulfilled' && result.value).length;
  }
  if (fencedJobs.some((job) => job.inFlightUnresolved)) {
    throw new Error('life_movie_revocation_inflight_unresolved');
  }

  // A writer that changed outputs after fencing must not lose its references.
  // The caller returns a failure so the same event can retry the fresh outputs.
  await mapInBatches(fencedJobs, async (fenced) => {
    await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(fenced.ref);
      const current = currentSnapshot.data();
      if (!currentSnapshot.exists || !current || !isAffectedJob(current, event)
        || current.tenantId !== fenced.data.tenantId || !isDeepStrictEqual(current.payload, fenced.data.payload)
        || current.status !== fenced.status || current.derivativeAccessState !== 'REVOKED'
        || current.consentRevocationEventId !== event.eventId
        || !isDeepStrictEqual(current.output, fenced.data.output) || !isDeepStrictEqual(current.result, fenced.data.result)) {
        throw new Error('life_movie_revocation_output_changed');
      }
      const now = FieldValue.serverTimestamp();
      transaction.update(fenced.ref, {
        output: FieldValue.delete(), result: FieldValue.delete(),
        outputDeletedAt: now, outputDeletedBy: 'consent-revocation', updatedAt: now,
      });
    });
  });
  summary.jobsInvalidated = fencedJobs.length;
  await mapInBatches(affectedPlans, async (snapshot) => {
    await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(snapshot.ref);
      const current = currentSnapshot.data();
      if (!currentSnapshot.exists || !current || !isAffectedPlan(current, event)
        || current.status !== 'CANCELLED' || current.derivativeAccessState !== 'REVOKED'
        || current.consentRevocationEventId !== event.eventId) {
        throw new Error('life_movie_revocation_plan_changed');
      }
      const now = FieldValue.serverTimestamp();
      transaction.update(snapshot.ref, { outputDeletedAt: now, outputDeletedBy: 'consent-revocation', updatedAt: now });
    });
  });
  summary.plansInvalidated = affectedPlans.length;
  return summary;
}
