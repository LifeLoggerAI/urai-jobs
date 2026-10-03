import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { jobQueueEntryDoc } from '../core/firestore-paths.js';

type ArtifactLike = { ref?: unknown };
type OutputLike = { outputs?: ArtifactLike[] };

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

function allowedOutputBuckets(): Set<string> {
  return new Set([
    String(process.env.GCS_BUCKET_NAME || '').trim(),
    ...String(process.env.URAI_STUDIO_OUTPUT_BUCKETS || '').split(',').map((value) => value.trim()),
  ].filter(Boolean));
}

function parseAuthorizedLifeMovieRef(ref: string, tenantId: string, buckets: Set<string>) {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(ref);
  if (!match) throw new Error('life_movie_revocation_output_ref_invalid');
  const [, bucket, objectPath] = match;
  const expectedPrefix = `tenants/${tenantId}/life-movies/`;
  if (!buckets.has(bucket) || !objectPath.startsWith(expectedPrefix) || objectPath.includes('..')) {
    throw new Error('life_movie_revocation_output_boundary_mismatch');
  }
  return { bucket, objectPath };
}

function artifactRefs(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const outputs = Array.isArray((value as OutputLike).outputs) ? (value as OutputLike).outputs! : [];
  return outputs
    .map((artifact) => artifact?.ref)
    .filter((ref): ref is string => typeof ref === 'string' && ref.startsWith('gs://'));
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
  const jobSnapshots = await db.collection('jobs').where('ownerUid', '==', event.ownerUid).get();
  summary.jobsScanned = jobSnapshots.size;

  const affectedJobs = jobSnapshots.docs.filter((snapshot) => {
    const job = snapshot.data() as Record<string, unknown>;
    const jobType = String(job.jobType || job.type || '');
    if (job.sourceSystem !== 'urai-studio') return false;
    if (jobType !== 'studio.render.video' && jobType !== 'studio.assemble.video') return false;
    const consent = job.consent;
    // Legacy short-form jobs predate canonical consent persistence. A user-wide
    // life-movie.render revocation must still invalidate their generated outputs.
    if (!consent || typeof consent !== 'object') return jobType === 'studio.render.video';
    return (consent as Record<string, unknown>).purpose === event.purpose;
  });

  const plans = await db.collection('studioLifeMovieLongformPlans')
    .where('ownerUid', '==', event.ownerUid)
    .get();
  const affectedPlans = plans.docs.filter((snapshot) => {
    const consent = snapshot.data().consent;
    return consent && typeof consent === 'object'
      && (consent as Record<string, unknown>).purpose === event.purpose;
  });

  const buckets = allowedOutputBuckets();
  const objectLocations = new Map<string, { bucket: string; objectPath: string }>();
  for (const snapshot of affectedJobs) {
    const job = snapshot.data() as Record<string, unknown>;
    const tenantId = typeof job.tenantId === 'string' ? job.tenantId : '';
    if (!tenantId) throw new Error('life_movie_revocation_tenant_missing');
    for (const ref of [...artifactRefs(job.output), ...artifactRefs(job.result)]) {
      const location = parseAuthorizedLifeMovieRef(ref, tenantId, buckets);
      objectLocations.set(`${location.bucket}/${location.objectPath}`, location);
    }
  }

  await Promise.all([...objectLocations.values()].map(({ bucket, objectPath }) =>
    getStorage().bucket(bucket).file(objectPath).delete({ ignoreNotFound: true })));
  summary.storageObjectsDeleted = objectLocations.size;

  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  for (const snapshot of affectedJobs) {
    const job = snapshot.data() as Record<string, unknown>;
    const status = String(job.status || '');
    const patch: Record<string, unknown> = {
      output: FieldValue.delete(),
      result: FieldValue.delete(),
      derivativeAccessState: 'REVOKED',
      consentRevocationEventId: event.eventId,
      consentRevokedAt: event.revokedAt,
      outputDeletedAt: now,
      outputDeletedBy: 'consent-revocation',
      updatedAt: now,
    };
    if (!TERMINAL.has(status)) {
      patch.status = 'CANCELLED';
      patch.completedAt = now;
      patch.lease = FieldValue.delete();
      patch['execution.leaseToken'] = FieldValue.delete();
      patch['execution.asyncCallbackPending'] = false;
      patch['execution.callbackTokenHash'] = FieldValue.delete();
      patch['execution.callbackLeaseToken'] = FieldValue.delete();
      patch['execution.callbackDeadlineAt'] = FieldValue.delete();
      batch.set(jobQueueEntryDoc(snapshot.id), {
        jobId: snapshot.id,
        status: 'CANCELLED',
        lease: FieldValue.delete(),
        updatedAt: now,
      }, { merge: true });
    }
    batch.update(snapshot.ref, patch);
    summary.jobsInvalidated += 1;
  }

  for (const snapshot of affectedPlans) {
    batch.update(snapshot.ref, {
      status: 'CANCELLED',
      derivativeAccessState: 'REVOKED',
      consentRevocationEventId: event.eventId,
      consentRevokedAt: event.revokedAt,
      outputDeletedAt: now,
      outputDeletedBy: 'consent-revocation',
      updatedAt: now,
    });
    summary.plansInvalidated += 1;
  }

  if (summary.jobsInvalidated || summary.plansInvalidated) await batch.commit();
  return summary;
}
