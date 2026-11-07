/**
 * R520: FIREBASE EMULATOR-ONLY transaction prototype for Life Movie output
 * reservations. NOT production write authority. NOT installed in worker.
 *
 * This models a per-owner/tenant/project revocation epoch as a shared
 * serializable Firestore document. A reservation and revocation both read and
 * write that document, preventing a stale post-revocation reservation from
 * committing. It deliberately DOES NOT upload media or confer GCS permissions.
 *
 * Firestore transactions are not transactions over GCS bytes. Even when this
 * model drains simulated attempts, production revocation ACK must stay DENIED
 * until independently reviewed Storage IAM, transfer termination and proof of
 * actual generation absence are implemented and verified.
 */
import { createHash } from 'node:crypto';
import { getApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { assertReviewOnlyHistoricalObservationClaim, assessReviewOnlyGenerationEvidence, canonicalReviewOnlyStorageGeneration } from './lifeMovieGenerationEvidenceReview.js';
import { getStorage } from 'firebase-admin/storage';

const PROJECT = 'urai-staging-test';
const PURPOSE = 'life-movie.render';
const FENCES = 'lifeMovieWriteFencesReviewOnly';
const ATTEMPTS = 'lifeMovieWriteAttemptsReviewOnly';
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HOST = /^(?:127\.0\.0\.1|localhost):[1-9][0-9]{0,4}$/;
export type ReviewOutputScope = {
  ownerUid: string;
  tenantId: string;
  projectId: string;
};
export type ReviewAttemptIdentity = ReviewOutputScope & {
  jobId: string;
  attemptId: string;
};

function segment(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SAFE.test(value)) {
    throw new Error('life_movie_review_write_' + field + '_invalid');
  }
  return value;
}
function checkedScope(scope: ReviewOutputScope): ReviewOutputScope {
  if (!scope || typeof scope !== 'object') throw new Error('life_movie_review_write_scope_invalid');
  return {
    ownerUid: segment(scope.ownerUid, 'owner'),
    tenantId: segment(scope.tenantId, 'tenant'),
    projectId: segment(scope.projectId, 'project'),
  };
}
function reviewedOnly(): void {
  if (process.env.URAI_EMULATOR_PROJECT !== PROJECT
    || !HOST.test(String(process.env.FIRESTORE_EMULATOR_HOST || ''))
    || !HOST.test(String(process.env.FIREBASE_STORAGE_EMULATOR_HOST || ''))
    || getApp().options.projectId !== PROJECT) {
    throw new Error('life_movie_review_write_emulator_only');
  }
  for (const name of ['GOOGLE_APPLICATION_CREDENTIALS',
    'FIREBASE_TOKEN', 'GITHUB_TOKEN', 'RUNPOD_API_KEY']) {
    if (process.env[name]) throw new Error('life_movie_review_write_cloud_credentials_forbidden');
  }
  // firebase emulators:exec sets GCLOUD_PROJECT to its disposable project.
  for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
    if (process.env[name] && process.env[name] !== PROJECT) {
      throw new Error('life_movie_review_write_cloud_project_forbidden');
    }
  }
}
export function reviewOnlyScopeId(scope: ReviewOutputScope): string {
  const s = checkedScope(scope);
  return createHash('sha256')
    .update(['urai-life-movie-write-fence-review-v1', s.ownerUid, s.tenantId, s.projectId].join('\n'))
    .digest('hex');
}
function refs(scope: ReviewOutputScope) {
  const id = reviewOnlyScopeId(scope);
  const db = getFirestore();
  return { id, db, fence: db.collection(FENCES).doc(id) };
}
function attemptRef(scope: ReviewOutputScope, jobId: string, attemptId: string) {
  const scopeId = reviewOnlyScopeId(scope);
  const id = createHash('sha256')
    .update(['urai-life-movie-attempt-review-v1', scopeId,
      segment(jobId, 'job'), segment(attemptId, 'attempt')].join('\n')).digest('hex');
  return getFirestore().collection(ATTEMPTS).doc(id);
}
function checkedFence(data: unknown, scope: ReviewOutputScope) {
  const s = checkedScope(scope);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('life_movie_review_write_fence_unverified');
  }
  const r = data as Record<string, unknown>;
  if (r.ownerUid !== s.ownerUid || r.tenantId !== s.tenantId ||
    r.projectId !== s.projectId || r.purpose !== PURPOSE ||
    r.reviewOnlyEmulator !== true || r.productionAuthorized !== false ||
    !Number.isSafeInteger(r.epoch) || Number(r.epoch) <= 0 ||
    Number(r.epoch) >= Number.MAX_SAFE_INTEGER ||
    // Only a withdrawal fence can be modeled here. No actual GCS IAM, transfer
    // drain or generation proof exists to authorize completed REVOKED state.
    (r.state !== 'OPEN' && r.state !== 'FENCING') ||
    (r.state === 'OPEN' && r.revocationEventId !== null) ||
    (r.state === 'FENCING' &&
      (typeof r.revocationEventId !== 'string' || !SAFE.test(r.revocationEventId)))) {
    throw new Error('life_movie_review_write_fence_unverified');
  }
  return { epoch: Number(r.epoch), state: r.state, revocationEventId: r.revocationEventId };
}
function checkedAttempt(data: unknown, scope: ReviewOutputScope, jobId: string, attemptId: string) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('life_movie_review_write_attempt_unverified');
  }
  const r = data as Record<string, unknown>;
  if (r.scopeId !== reviewOnlyScopeId(scope) || r.jobId !== jobId ||
    r.attemptId !== attemptId || r.ownerUid !== scope.ownerUid ||
    r.tenantId !== scope.tenantId || r.projectId !== scope.projectId ||
    r.reviewOnlyEmulator !== true || r.productionAuthorized !== false ||
    !Number.isSafeInteger(r.epoch) || Number(r.epoch) <= 0 ||
    !['RESERVED', 'SIMULATED_IN_FLIGHT', 'CANCELLED_BEFORE_UPLOAD',
      'PHYSICAL_GENERATION_UNVERIFIED'].includes(String(r.state))) {
    throw new Error('life_movie_review_write_attempt_unverified');
  }
  if (r.state === 'PHYSICAL_GENERATION_UNVERIFIED' &&
    (r.storageWriteFenceVerified !== false || r.productionAuthorized !== false ||
      r.storageMetadataReadbackVerified !== true ||
      !canonicalReviewOnlyStorageGeneration(r.physicalGeneration) ||
      r.objectPath !== reviewOnlySyntheticOutputObjectPath({
        ...scope, jobId, attemptId,
      }))) {
    throw new Error('life_movie_review_write_physical_generation_unverified');
  }
  return { epoch: Number(r.epoch), state: String(r.state) };
}

/** Synthetic fixture only; refuses to reopen or reset an existing fence. */
export async function seedReviewOnlyOutputScope(scope: ReviewOutputScope) {
  reviewedOnly();
  const s = checkedScope(scope);
  const { db, fence } = refs(s);
  await db.runTransaction(async (transaction) => {
    const prior = await transaction.get(fence);
    if (prior.exists) throw new Error('life_movie_review_write_fence_already_exists');
    transaction.create(fence, {
      ...s, purpose: PURPOSE, epoch: 1, state: 'OPEN',
      revocationEventId: null, reviewOnlyEmulator: true,
      productionAuthorized: false, createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { epoch: 1, simulatedOnly: true, productionAuthorized: false };
}

/**
 * A review-only reservation. Its job/owner and consent-block reads are VETOES,
 * never grants. Both this operation and revocation transact on the same fence.
 * Caller-supplied scope, jobId and attemptId are NOT trusted in production.
 */
export async function reserveReviewOnlyOutputAttempt(
  identity: ReviewAttemptIdentity, expectedEpoch: number,
) {
  reviewedOnly();
  const s = checkedScope(identity);
  const jobId = segment(identity.jobId, 'job');
  const attemptId = segment(identity.attemptId, 'attempt');
  if (!Number.isSafeInteger(expectedEpoch) || expectedEpoch <= 0) {
    throw new Error('life_movie_review_write_epoch_invalid');
  }
  const { db, id, fence } = refs(s);
  const item = attemptRef(s, jobId, attemptId);
  const owner = db.collection('users').doc(s.ownerUid);
  const job = db.collection('jobs').doc(jobId);
  const consentBlockId = createHash('sha256').update(s.ownerUid + '\n' + PURPOSE).digest('hex');
  const block = db.collection('jobConsentBlocks').doc(consentBlockId);
  return db.runTransaction(async (transaction) => {
    const [fenceSnap, itemSnap, ownerSnap, jobSnap, blockSnap] = await Promise.all([
      transaction.get(fence), transaction.get(item), transaction.get(owner),
      transaction.get(job), transaction.get(block),
    ]);
    if (!fenceSnap.exists) throw new Error('life_movie_review_write_fence_missing');
    const current = checkedFence(fenceSnap.data(), s);
    if (current.state !== 'OPEN' || current.epoch !== expectedEpoch) {
      throw new Error('life_movie_review_write_fence_revoked_or_stale');
    }
    if (itemSnap.exists) throw new Error('life_movie_review_write_attempt_reused');
    const user = ownerSnap.data();
    if (!ownerSnap.exists || !user || user.disabled !== false ||
      user.deletionPending !== false) {
      throw new Error('life_movie_review_write_owner_unverified');
    }
    const currentJob = jobSnap.data();
    const payload = currentJob?.payload;
    if (!jobSnap.exists || !currentJob || currentJob.ownerUid !== s.ownerUid ||
      currentJob.tenantId !== s.tenantId || currentJob.sourceSystem !== 'urai-studio' ||
      currentJob.status !== 'RUNNING' ||
      !['studio.render.video', 'studio.assemble.video'].includes(String(currentJob.jobType || currentJob.type)) ||
      !payload || typeof payload !== 'object' || Array.isArray(payload) ||
      payload.projectId !== s.projectId ||
      currentJob.consent?.purpose !== PURPOSE) {
      throw new Error('life_movie_review_write_job_unverified');
    }
    // Missing block means no veto, NEVER positive consent permission.
    if (blockSnap.exists && blockSnap.data()?.active !== false) {
      throw new Error('life_movie_review_write_consent_blocked_or_unverified');
    }
    transaction.create(item, {
      ...s, scopeId: id, jobId, attemptId, epoch: current.epoch,
      state: 'RESERVED', reviewOnlyEmulator: true,
      productionAuthorized: false, createdAt: FieldValue.serverTimestamp(),
    });
    // No upload token, signed URL, GCS client or production grant returned.
    return { epoch: current.epoch, simulatedOnly: true, productionAuthorized: false };
  });
}

/**
 * Models a pre-byte transition only; it deliberately cannot upload any bytes.
 * An epoch read alone is NOT a production post-check-before-write fence.
 */
export async function beginReviewOnlySimulatedUpload(identity: ReviewAttemptIdentity) {
  reviewedOnly();
  const s = checkedScope(identity);
  const jobId = segment(identity.jobId, 'job');
  const attemptId = segment(identity.attemptId, 'attempt');
  const { db, fence } = refs(s);
  const item = attemptRef(s, jobId, attemptId);
  return db.runTransaction(async (transaction) => {
    const [fenceSnap, itemSnap] = await Promise.all([transaction.get(fence), transaction.get(item)]);
    if (!fenceSnap.exists) throw new Error('life_movie_review_write_fence_missing');
    const current = checkedFence(fenceSnap.data(), s);
    const attempt = checkedAttempt(itemSnap.data(), s, jobId, attemptId);
    if (current.state !== 'OPEN' || current.epoch !== attempt.epoch || attempt.state !== 'RESERVED') {
      throw new Error('life_movie_review_write_fence_revoked_or_stale');
    }
    transaction.update(item, {
      state: 'SIMULATED_IN_FLIGHT', updatedAt: FieldValue.serverTimestamp(),
    });
    return { simulatedOnly: true, productionAuthorized: false };
  });
}

/** Records withdrawal by fencing admissions; NEVER acknowledges media deletion. */
export async function revokeReviewOnlyOutputScope(scope: ReviewOutputScope, eventId: string) {
  reviewedOnly();
  const s = checkedScope(scope);
  const event = segment(eventId, 'event');
  const { db, fence } = refs(s);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(fence);
    if (!snapshot.exists) throw new Error('life_movie_review_write_fence_missing');
    const current = checkedFence(snapshot.data(), s);
    if (current.state === 'FENCING') {
      if (current.revocationEventId !== event) throw new Error('life_movie_review_write_revocation_conflict');
      return {
        epoch: current.epoch, alreadyFenced: true,
        revocationAcknowledgementPermitted: false, productionAuthorized: false,
      };
    }
    const next = current.epoch + 1;
    transaction.update(fence, {
      epoch: next, state: 'FENCING', revocationEventId: event,
      fencedAt: FieldValue.serverTimestamp(),
    });
    return {
      epoch: next, alreadyFenced: false,
      revocationAcknowledgementPermitted: false, productionAuthorized: false,
    };
  });
}

/**
 * Can cancel a reservation ONLY if the simulated upload never began.
 * In-flight or unknown attempts cannot be abandoned on timeout or caller say-so.
 */
export async function cancelUnstartedReviewOnlyAttempt(identity: ReviewAttemptIdentity) {
  reviewedOnly();
  const s = checkedScope(identity);
  const jobId = segment(identity.jobId, 'job');
  const attemptId = segment(identity.attemptId, 'attempt');
  const { db, fence } = refs(s);
  const item = attemptRef(s, jobId, attemptId);
  await db.runTransaction(async (transaction) => {
    const [fenceSnap, itemSnap] = await Promise.all([transaction.get(fence), transaction.get(item)]);
    if (!fenceSnap.exists) throw new Error('life_movie_review_write_fence_missing');
    const current = checkedFence(fenceSnap.data(), s);
    const attempt = checkedAttempt(itemSnap.data(), s, jobId, attemptId);
    if (current.state !== 'FENCING' || current.epoch <= attempt.epoch ||
      attempt.state !== 'RESERVED') {
      throw new Error('life_movie_review_write_attempt_cannot_reconcile');
    }
    transaction.update(item, {
      state: 'CANCELLED_BEFORE_UPLOAD', updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { simulatedOnly: true, productionAuthorized: false };
}

/**
 * Read-only simulator status. A zero pending count STILL cannot authorize
 * deletion ACK: GCS IAM, in-flight network transfers and generations are
 * entirely outside this test-only ledger.
 */
export async function reviewOnlyDrainStatus(scope: ReviewOutputScope) {
  reviewedOnly();
  const s = checkedScope(scope);
  const { db, id, fence } = refs(s);
  const snapshot = await fence.get();
  if (!snapshot.exists) throw new Error('life_movie_review_write_fence_missing');
  const current = checkedFence(snapshot.data(), s);
  const docs = await db.collection(ATTEMPTS).where('scopeId', '==', id).limit(101).get();
  if (docs.size > 100) throw new Error('life_movie_review_write_attempt_limit_exceeded');
  const unresolved = docs.docs.reduce((sum, doc) => {
    const data = doc.data();
    const a = checkedAttempt(data, s, String(data.jobId || ''), String(data.attemptId || ''));
    return sum + (a.state === 'CANCELLED_BEFORE_UPLOAD' ? 0 : 1);
  }, 0);
  return {
    state: current.state, epoch: current.epoch, activeOrUnproven: unresolved,
    withdrawalFenced: current.state === 'FENCING',
    revocationComplete: false, simulatedOnly: true, storageWriteFenceVerified: false,
    revocationAcknowledgementPermitted: false, productionAuthorized: false,
  };
}


/**
 * R857 NONPRODUCTION: a deterministic object path used only by the disposable
 * emulator broker fixture. This is not a production storage authority.
 * Unlike a caller-supplied gs:// URI it cannot point outside the canonical
 * owner/tenant/project output namespace.
 */
export function reviewOnlySyntheticOutputObjectPath(identity: ReviewAttemptIdentity): string {
  const s = checkedScope(identity);
  const jobId = segment(identity.jobId, 'job');
  const attemptId = segment(identity.attemptId, 'attempt');
  const suffix = createHash('sha256')
    .update(['urai-r857-review-only-physical-broker', s.ownerUid, s.tenantId,
      s.projectId, jobId, attemptId].join('\n')).digest('hex');
  return `tenants/${s.tenantId}/life-movies/${s.projectId}/review-only-broker/${suffix}.bin`;
}

/**
 * A last emulator-only veto immediately before a synthetic byte write.
 * This is deliberately not a production grant: revocation can still race
 * after a Firestore read and before Storage receives the bytes.
 */
export async function assertReviewOnlyBrokerPreByte(identity: ReviewAttemptIdentity): Promise<void> {
  reviewedOnly();
  const s = checkedScope(identity);
  const jobId = segment(identity.jobId, 'job');
  const attemptId = segment(identity.attemptId, 'attempt');
  const { db, fence } = refs(s);
  const item = attemptRef(s, jobId, attemptId);
  await db.runTransaction(async (transaction) => {
    const [fenceSnap, attemptSnap] = await Promise.all([
      transaction.get(fence), transaction.get(item),
    ]);
    if (!fenceSnap.exists) throw new Error('life_movie_review_write_fence_missing');
    const current = checkedFence(fenceSnap.data(), s);
    const attempt = checkedAttempt(attemptSnap.data(), s, jobId, attemptId);
    if (current.state !== 'OPEN' || current.epoch !== attempt.epoch ||
      attempt.state !== 'SIMULATED_IN_FLIGHT') {
      throw new Error('life_movie_review_write_fence_revoked_or_stale');
    }
  });
}

/**
 * Stores a REAL emulator Storage generation as unresolved durable evidence.
 * A byte stream may have committed after revocation, so this must be allowed
 * during FENCING for reconciliation. The generation is not a deletion ACK,
 * storage IAM proof, or caller-conferred upload authorization.
 */
export async function recordReviewOnlyBrokerPhysicalGeneration(
  identity: ReviewAttemptIdentity, generation: string,
) {
  reviewedOnly();
  const s = checkedScope(identity);
  const jobId = segment(identity.jobId, 'job');
  const attemptId = segment(identity.attemptId, 'attempt');
  if (!canonicalReviewOnlyStorageGeneration(generation)) {
    throw new Error('life_movie_review_write_generation_invalid');
  }
  const objectPath = reviewOnlySyntheticOutputObjectPath(identity);
  // This ledger must NOT accept a caller's claimed physical generation
  // without a real emulator Storage read. A Firestore-only declaration can
  // fabricate an object that never existed at the bound canonical path.
  // Storage metadata and Firestore are not atomic: this is observation only,
  // with every attempt permanently unresolved for deletion ACK.
  let observedGeneration: unknown = null;
  let storageNotFound = false;
  try {
    const [metadata] = await getStorage().bucket(PROJECT + '.appspot.com')
      .file(objectPath).getMetadata();
    observedGeneration = metadata?.generation;
  } catch (error) {
    if ((error as { code?: unknown })?.code === 404) {
      storageNotFound = true;
    } else {
      throw new Error('life_movie_review_write_storage_unverified');
    }
  }
  const { db, fence } = refs(s);
  const item = attemptRef(s, jobId, attemptId);
  return db.runTransaction(async (transaction) => {
    const [fenceSnap, attemptSnap] = await Promise.all([
      transaction.get(fence), transaction.get(item),
    ]);
    if (!fenceSnap.exists) throw new Error('life_movie_review_write_fence_missing');
    const current = checkedFence(fenceSnap.data(), s);
    const attempt = checkedAttempt(attemptSnap.data(), s, jobId, attemptId);
    const data = attemptSnap.data() as Record<string, unknown>;
    // Reject a forged historical claim before classifying the current GCS
    // object. This preserves the original generation_conflict contract.
    if (attempt.state === 'PHYSICAL_GENERATION_UNVERIFIED') {
      assertReviewOnlyHistoricalObservationClaim(
        generation, data.physicalGeneration, objectPath, data.objectPath,
      );
    }
    // An actual live replacement is distinct from missing after exact cleanup.
    const { storageCurrentlyObserved } = assessReviewOnlyGenerationEvidence(
      generation, observedGeneration, storageNotFound,
      attempt.state === 'PHYSICAL_GENERATION_UNVERIFIED',
    );
    if (attempt.state === 'PHYSICAL_GENERATION_UNVERIFIED') {
      // checkedAttempt insists this record was physically verified under R869.
      // Historical replay after exact cleanup grants no current write or ACK.
      return {
        observed: true, alreadyRecorded: true,
        storageCurrentlyObserved,
        withdrawalFenced: current.state === 'FENCING',
        revocationAcknowledgementPermitted: false, productionAuthorized: false,
      };
    }
    if (attempt.state !== 'SIMULATED_IN_FLIGHT' ||
      (current.state === 'OPEN' && current.epoch !== attempt.epoch) ||
      (current.state === 'FENCING' && current.epoch <= attempt.epoch)) {
      throw new Error('life_movie_review_write_generation_state_unverified');
    }
    transaction.update(item, {
      state: 'PHYSICAL_GENERATION_UNVERIFIED',
      physicalGeneration: generation,
      objectPath,
      storageMetadataReadbackVerified: true,
      withdrawalFencedBeforeObservation: current.state === 'FENCING',
      storageWriteFenceVerified: false,
      productionAuthorized: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      observed: true, alreadyRecorded: false,
      storageCurrentlyObserved: true,
      withdrawalFenced: current.state === 'FENCING',
      revocationAcknowledgementPermitted: false, productionAuthorized: false,
    };
  });
}
