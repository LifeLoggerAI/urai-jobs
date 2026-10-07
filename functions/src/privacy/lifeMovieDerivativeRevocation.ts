import { FieldPath, FieldValue, getFirestore, type DocumentReference, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
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
// Conservative work budgets, not the removed 500-write Firestore service limit.
// Each job fence writes its job and queue. Bound request payloads and owner
// query pages; Firestore request-size and transaction-time limits still apply.
const PAGE_SIZE = 100;
const STORAGE_CONCURRENCY = 8;

function isAffectedJob(job: Record<string, unknown>, event: LifeMovieRevocationEvent): boolean {
  const jobType = String(job.jobType || job.type || '');
  if (job.ownerUid !== event.ownerUid || job.sourceSystem !== 'urai-studio') return false;
  if (jobType !== 'studio.render.video' && jobType !== 'studio.assemble.video') return false;
  const consent = job.consent;
  // Legacy short-form jobs predate canonical consent persistence.
  if (!consent || typeof consent !== 'object') return jobType === 'studio.render.video';
  return (consent as Record<string, unknown>).purpose === event.purpose;
}

function isAffectedPlan(plan: Record<string, unknown>, event: LifeMovieRevocationEvent): boolean {
  const consent = plan.consent;
  return plan.ownerUid === event.ownerUid && !!consent && typeof consent === 'object'
    && (consent as Record<string, unknown>).purpose === event.purpose;
}

async function* ownerPages(collection: string, ownerUid: string) {
  const query = getFirestore().collection(collection).where('ownerUid', '==', ownerUid)
    .orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
  let cursor: QueryDocumentSnapshot | undefined;
  while (true) {
    const page = await (cursor ? query.startAfter(cursor) : query).get();
    if (page.empty) return;
    yield page.docs;
    cursor = page.docs[page.docs.length - 1];
    if (page.size < PAGE_SIZE) return;
  }
}

function allowedOutputBuckets(): Set<string> {
  return new Set([
    String(process.env.GCS_BUCKET_NAME || '').trim(),
    ...String(process.env.URAI_STUDIO_OUTPUT_BUCKETS || '').split(',').map((value) => value.trim()),
  ].filter(Boolean));
}

function parseAuthorizedLifeMovieRef(ref: string, tenantId: string, projectId: string, buckets: Set<string>) {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(ref);
  if (!match) throw new Error('life_movie_revocation_output_ref_invalid');
  const [, bucket, objectPath] = match;
  const expectedPrefix = `tenants/${tenantId}/life-movies/`;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(tenantId) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(projectId)
    || !buckets.has(bucket) || !objectPath.startsWith(`${expectedPrefix}${projectId}/`)
    || objectPath.includes('..') || objectPath.includes('\\')) {
    throw new Error('life_movie_revocation_output_boundary_mismatch');
  }
  return { bucket, objectPath };
}

function artifactRefs(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const outputs = Array.isArray((value as OutputLike).outputs) ? (value as OutputLike).outputs! : [];
  return outputs.map((artifact) => artifact?.ref)
    .filter((ref): ref is string => typeof ref === 'string' && ref.startsWith('gs://'));
}

export async function invalidateLifeMovieDerivativesForConsent(
  event: LifeMovieRevocationEvent,
): Promise<LifeMovieDerivativeInvalidationSummary> {
  const summary: LifeMovieDerivativeInvalidationSummary = {
    purpose: event.purpose, jobsScanned: 0, jobsInvalidated: 0, plansInvalidated: 0, storageObjectsDeleted: 0,
  };
  if (event.purpose !== 'life-movie.render') return summary;

  const db = getFirestore(), now = FieldValue.serverTimestamp();
  const fencedPlans: DocumentReference[] = [];
  const fencedJobs: Array<{ ref: DocumentReference; tenantId: string; projectId: string; refs: string[] }> = [];

  // The event endpoint has already durably blocked consent. Cancel every parent
  // before its children, then revoke leases/callbacks before any Storage await.
  for await (const page of ownerPages('studioLifeMovieLongformPlans', event.ownerUid)) {
    const refs = await db.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(...page.map((snapshot) => snapshot.ref));
      const affected = snapshots.filter((snapshot) => snapshot.exists && isAffectedPlan(snapshot.data()!, event));
      for (const snapshot of affected) transaction.update(snapshot.ref, {
        status: 'CANCELLED', derivativeAccessState: 'REVOKED',
        consentRevocationEventId: event.eventId, consentRevokedAt: event.revokedAt,
        outputDeletionState: 'PENDING', updatedAt: now,
      });
      return affected.map((snapshot) => snapshot.ref);
    });
    fencedPlans.push(...refs);
  }
  summary.plansInvalidated = fencedPlans.length;

  for await (const page of ownerPages('jobs', event.ownerUid)) {
    summary.jobsScanned += page.length;
    const fenced = await db.runTransaction(async (transaction) => {
      // Capture a finishing worker's result-only artifacts from current authority,
      // not the older owner query snapshot. All reads precede writes.
      const snapshots = await transaction.getAll(...page.map((snapshot) => snapshot.ref));
      const affected = snapshots.filter((snapshot) => snapshot.exists && isAffectedJob(snapshot.data()!, event));
      const outputs: typeof fencedJobs = [];
      for (const snapshot of affected) {
        const job = snapshot.data()!, status = String(job.status || '');
        const refs = [...new Set([...artifactRefs(job.output), ...artifactRefs(job.result)])];
        const patch: Record<string, unknown> = {
          derivativeAccessState: 'REVOKED', consentRevocationEventId: event.eventId, consentRevokedAt: event.revokedAt,
          outputDeletionState: !refs.length && job.outputDeletionState === 'COMPLETE' ? 'COMPLETE' : 'PENDING',
          lease: FieldValue.delete(), 'execution.leaseToken': FieldValue.delete(),
          'execution.asyncCallbackPending': false, 'execution.callbackTokenHash': FieldValue.delete(),
          'execution.callbackLeaseToken': FieldValue.delete(), 'execution.callbackDeadlineAt': FieldValue.delete(),
          updatedAt: now,
        };
        if (!TERMINAL.has(status)) {
          patch.status = 'CANCELLED';
          patch.completedAt = now;
        }
        transaction.set(jobQueueEntryDoc(snapshot.id), {
          jobId: snapshot.id, status: 'CANCELLED', lease: FieldValue.delete(), updatedAt: now,
        }, { merge: true });
        // Keep aliases until cleanup succeeds so a partial failure remains retryable.
        transaction.update(snapshot.ref, patch);
        outputs.push({ ref: snapshot.ref, tenantId: String(job.tenantId || ''),
          projectId: String((job.payload as Record<string, unknown>)?.projectId || ''), refs });
      }
      return outputs;
    });
    fencedJobs.push(...fenced);
  }
  summary.jobsInvalidated = fencedJobs.length;

  const buckets = allowedOutputBuckets();
  const objectLocations = new Map<string, { bucket: string; objectPath: string }>();
  for (const job of fencedJobs) for (const ref of job.refs) {
    const location = parseAuthorizedLifeMovieRef(ref, job.tenantId, job.projectId, buckets);
    objectLocations.set(`${location.bucket}/${location.objectPath}`, location);
  }
  const locations = [...objectLocations.values()];
  for (let offset = 0; offset < locations.length; offset += STORAGE_CONCURRENCY) {
    // Await every in-flight deletion before returning an error to the event sender.
    const deletions = await Promise.allSettled(locations.slice(offset, offset + STORAGE_CONCURRENCY)
      .map(async ({ bucket, objectPath }) => getStorage().bucket(bucket).file(objectPath).delete({ ignoreNotFound: true })));
    const failure = deletions.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }
  summary.storageObjectsDeleted = objectLocations.size;

  for (let offset = 0; offset < fencedJobs.length; offset += PAGE_SIZE) {
    const group = fencedJobs.slice(offset, offset + PAGE_SIZE);
    await db.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(...group.map((job) => job.ref));
      const affected = snapshots.filter((snapshot) => snapshot.exists && isAffectedJob(snapshot.data()!, event));
      for (const snapshot of affected) {
        const job = snapshot.data()!, deletedRefs = group.find((entry) => entry.ref.path === snapshot.ref.path)!.refs;
        const currentRefs = [...artifactRefs(job.output), ...artifactRefs(job.result)];
        if (currentRefs.some((ref) => !deletedRefs.includes(ref))) throw new Error('life_movie_revocation_outputs_changed_retry');
        transaction.update(snapshot.ref, {
          output: FieldValue.delete(), result: FieldValue.delete(), outputDeletionState: 'COMPLETE',
          outputDeletedAt: job.outputDeletedAt || now, outputDeletedBy: 'consent-revocation', updatedAt: now,
        });
      }
    });
  }
  for (let offset = 0; offset < fencedPlans.length; offset += PAGE_SIZE) {
    await db.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(...fencedPlans.slice(offset, offset + PAGE_SIZE));
      for (const snapshot of snapshots) {
        if (snapshot.exists && isAffectedPlan(snapshot.data()!, event)) transaction.update(snapshot.ref, {
          outputDeletionState: 'COMPLETE', outputDeletedAt: snapshot.data()!.outputDeletedAt || now,
          outputDeletedBy: 'consent-revocation', updatedAt: now,
        });
      }
    });
  }
  return summary;
}
