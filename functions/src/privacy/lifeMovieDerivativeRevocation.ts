import { FieldPath, FieldValue, getFirestore, type DocumentReference, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { deleteOwnedLifeMovieArtifact } from '../jobs/privateMediaDelivery.js';
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

/** An untyped or blank consent purpose is not evidence that a Life Movie
 * belongs to an unrelated purpose. Only an explicit nonempty *different*
 * purpose may exempt an otherwise owner-bound derivative from revocation. */
function consentPurposeMatchesOrMalformed(consent: object, purpose: string): boolean {
  if (Array.isArray(consent)) return true;
  const persisted = (consent as Record<string, unknown>).purpose;
  return persisted === purpose || typeof persisted !== 'string' || persisted.trim().length === 0;
}

function isAffectedJob(job: Record<string, unknown>, event: LifeMovieRevocationEvent): boolean {
  const jobType = String(job.jobType || job.type || '');
  if (job.ownerUid !== event.ownerUid || job.sourceSystem !== 'urai-studio') return false;
  if (jobType !== 'studio.render.video' && jobType !== 'studio.assemble.video') return false;
  const consent = job.consent;
  // Legacy short-form jobs predate canonical consent persistence. Preserve the
  // legacy assembly exception, but never trust a malformed persisted envelope.
  if (!consent || typeof consent !== 'object') return jobType === 'studio.render.video';
  return consentPurposeMatchesOrMalformed(consent, event.purpose);
}

function isAffectedPlan(plan: Record<string, unknown>, event: LifeMovieRevocationEvent): boolean {
  if (plan.ownerUid !== event.ownerUid) return false;
  const consent = plan.consent;
  // Longform plans are dedicated Life Movie derivatives. An invalid envelope
  // cannot exempt them from their owner's Life Movie consent revocation.
  if (!consent || typeof consent !== 'object') return true;
  return consentPurposeMatchesOrMalformed(consent, event.purpose);
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

// A malformed derivative ledger must never be treated as an empty ledger.
// Return the error alongside valid refs so the transaction can durably revoke
// job/queue access before the handler refuses physical Storage cleanup.
function artifactRefs(value: unknown): { refs: string[]; malformed: boolean } {
  if (value == null) return { refs: [], malformed: false };
  if (typeof value !== 'object' || Array.isArray(value)) return { refs: [], malformed: true };
  const outputs = (value as OutputLike).outputs;
  if (outputs === undefined) return { refs: [], malformed: false };
  if (!Array.isArray(outputs)) return { refs: [], malformed: true };
  const refs: string[] = [];
  let malformed = false;
  for (const artifact of outputs) {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)
      || typeof artifact.ref !== 'string' || !artifact.ref.startsWith('gs://')) {
      malformed = true;
    } else {
      refs.push(artifact.ref);
    }
  }
  return { refs, malformed };
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
  const fencedJobs: Array<{ ref: DocumentReference; jobId: string; tenantId: string; projectId: string; refs: string[]; malformed: boolean }> = [];

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
        const outputRefs = artifactRefs(job.output), resultRefs = artifactRefs(job.result);
        const refs = [...new Set([...outputRefs.refs, ...resultRefs.refs])];
        const malformed = outputRefs.malformed || resultRefs.malformed;
        const patch: Record<string, unknown> = {
          derivativeAccessState: 'REVOKED', consentRevocationEventId: event.eventId, consentRevokedAt: event.revokedAt,
          outputDeletionState: !refs.length && job.outputDeletionState === 'COMPLETE' ? 'COMPLETE' : 'PENDING',
          lease: FieldValue.delete(), 'execution.leaseToken': FieldValue.delete(),
          'execution.asyncCallbackPending': false, 'execution.callbackTokenHash': FieldValue.delete(),
          'execution.callbackLeaseToken': FieldValue.delete(), 'execution.callbackDeadlineAt': FieldValue.delete(),
          updatedAt: now,
        };
        // A legacy FAILED job has no canonical consent for the queue/worker to
        // recheck. Permanent cancellation also closes status-only admin retries.
        // Preserve generation history without copying arbitrary persisted values
        // into the bounded patch or overwriting history on event replay.
        patch.status = 'CANCELLED';
        if (!job.completedAt) patch.completedAt = now;
        if (!job.outputDeletionPreviousStatus) patch.outputDeletionPreviousStatus =
          TERMINAL.has(status) || ['PENDING', 'LEASED', 'RUNNING'].includes(status) ? status : 'UNKNOWN';
        transaction.set(jobQueueEntryDoc(snapshot.id), {
          jobId: snapshot.id, status: 'CANCELLED', lease: FieldValue.delete(), updatedAt: now,
        }, { merge: true });
        // Keep aliases until cleanup succeeds so a partial failure remains retryable.
        transaction.update(snapshot.ref, patch);
        outputs.push({ ref: snapshot.ref, jobId: snapshot.id, tenantId: String(job.tenantId || ''),
          projectId: String((job.payload as Record<string, unknown>)?.projectId || ''), refs, malformed });
      }
      return outputs;
    });
    fencedJobs.push(...fenced);
  }
  summary.jobsInvalidated = fencedJobs.length;

  const buckets = allowedOutputBuckets();
  // Every physical deletion must retain the exact job and owner binding.
  // Another attempt's object or a duplicate cross-job reference is never an
  // authorized target, even when the bucket and tenant path look plausible.
  const objectLocations = new Map<string, { bucket: string; objectPath: string; ownerUid: string; jobId: string }>();
  for (const job of fencedJobs) {
    if (job.malformed) throw new Error('life_movie_revocation_output_ref_invalid');
    for (const ref of job.refs) {
      const location = parseAuthorizedLifeMovieRef(ref, job.tenantId, job.projectId, buckets);
      const key = `${location.bucket}/${location.objectPath}`;
      const previous = objectLocations.get(key);
      if (previous && previous.jobId !== job.jobId) {
        throw new Error('life_movie_revocation_output_owner_ambiguous');
      }
      objectLocations.set(key, { ...location, ownerUid: event.ownerUid, jobId: job.jobId });
    }
  }
  const locations = [...objectLocations.values()];
  for (let offset = 0; offset < locations.length; offset += STORAGE_CONCURRENCY) {
    // Await every in-flight deletion before returning an error to the event sender.
    const deletions = await Promise.allSettled(locations.slice(offset, offset + STORAGE_CONCURRENCY)
      .map((location) => deleteOwnedLifeMovieArtifact(location)));
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
        const currentOutput = artifactRefs(job.output), currentResult = artifactRefs(job.result);
        const currentRefs = [...currentOutput.refs, ...currentResult.refs];
        if (currentOutput.malformed || currentResult.malformed || currentRefs.some((ref) => !deletedRefs.includes(ref))) {
          throw new Error('life_movie_revocation_outputs_changed_retry');
        }
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
