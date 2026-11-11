/**
 * R1016 REVIEW ONLY — deterministic revocation/reservation *reference model*.
 *
 * This module is intentionally NOT wired to production, Firestore, GCS, IAM,
 * consent issuance, workers, or deletion. Its inputs, including Cloud observations,
 * are caller-supplied and are NOT authenticated. The version precondition models
 * a database compare-and-swap; it is NOT an actual transaction. A passing model
 * test does not establish a post-revocation storage-level write fence.
 *
 * Only a trusted server-owned transactional ledger and an independently audited
 * storage write broker may implement the corresponding operations for real.
 * This model NEVER issues deletion ACK or private-write authorization.
 */
import { assertReviewLedgerIntegrity } from './r1020-ledger-integrity.mjs';

export const DENIED = 'R1016_REVIEW_ONLY_DENIED';
const IDENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const GENERATION = /^[1-9][0-9]*$/;
const FILE_KINDS = new Set([
  'life-movie.mp4', 'life-movie.srt', 'life-movie.render-manifest.json',
]);
const LEDGER_SCHEMA = 'R1016_REVIEW_ONLY_REVOCATION_LEDGER_V1';

function deny() { throw new Error(DENIED); }
function ident(v) { return typeof v === 'string' && IDENT.test(v); }
function exact(value, keys) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
}
function integer(v) { return Number.isSafeInteger(v) && v > 0; }
function pathFor(s, attemptId, kind) {
  return `tenants/${s.tenantId}/life-movies/${s.projectId}/attempt-${attemptId}/${kind}`;
}
function freezeLedger(s) {
  for (const a of s.reservations) Object.freeze(a);
  Object.freeze(s.reservations);
  Object.freeze(s.scope);
  return Object.freeze(s);
}
function ledger(s, version) {
  assertReviewLedgerIntegrity(s);
  if (!s || s.schema !== LEDGER_SCHEMA || s.reviewOnly !== true ||
    s.storageWriteAuthorized !== false || s.deletionAcknowledged !== false ||
    s.releaseAuthorized !== false || !integer(s.version) ||
    !Number.isSafeInteger(version) || version !== s.version ||
    !Object.isFrozen(s) || !Object.isFrozen(s.reservations)) deny();
}
function sameScope(s, r) {
  return r.ownerUid === s.scope.ownerUid && r.tenantId === s.scope.tenantId &&
    r.projectId === s.scope.projectId && r.bucket === s.scope.bucket;
}
function update(s, values) {
  if (!Number.isSafeInteger(s.version + 1)) deny();
  return freezeLedger({ ...s, ...values, version: s.version + 1 });
}

export function createReviewLedger(scope) {
  const keys = ['ownerUid', 'tenantId', 'projectId', 'bucket', 'epoch'];
  if (!exact(scope, keys) || keys.slice(0, 4).some(k => !ident(scope[k])) ||
    !integer(scope.epoch)) deny();
  return freezeLedger({
    schema: LEDGER_SCHEMA, scope: { ...scope }, phase: 'OPEN',
    version: 1, withdrawalId: null, reservations: [],
    reviewOnly: true, storageWriteAuthorized: false,
    deletionAcknowledged: false, releaseAuthorized: false,
  });
}

export function reserveForReview(s, r, expectedVersion) {
  ledger(s, expectedVersion);
  if (s.phase !== 'OPEN' || !exact(r, [
    'ownerUid', 'tenantId', 'projectId', 'bucket', 'epoch',
    'attemptId', 'objectPath',
  ]) || !sameScope(s, r) || r.epoch !== s.scope.epoch ||
    !ident(r.attemptId) || s.reservations.some(a => a.attemptId === r.attemptId) ||
    ![...FILE_KINDS].some(k => r.objectPath === pathFor(s.scope, r.attemptId, k))) deny();
  const reservation = {
    attemptId: r.attemptId, epoch: r.epoch, bucket: r.bucket,
    objectPath: r.objectPath, state: 'RESERVED',
    observedGeneration: null,
  };
  return update(s, { reservations: [...s.reservations, reservation] });
}

export function startUploadForReview(s, attemptId, expectedVersion) {
  ledger(s, expectedVersion);
  if (s.phase !== 'OPEN' || !ident(attemptId)) deny();
  const candidate = s.reservations.find(a => a.attemptId === attemptId);
  if (!candidate || candidate.state !== 'RESERVED' ||
    candidate.epoch !== s.scope.epoch) deny();
  return update(s, { reservations: s.reservations.map(a => a.attemptId === attemptId ?
    { ...a, state: 'IN_FLIGHT' } : a) });
}

/** After withdrawal, the old epoch is fenced and no new reservations may start. */
export function withdrawForReview(s, e, expectedVersion) {
  ledger(s, expectedVersion);
  if (!exact(e, ['ownerUid', 'tenantId', 'projectId', 'withdrawalId']) ||
    e.ownerUid !== s.scope.ownerUid || e.tenantId !== s.scope.tenantId ||
    e.projectId !== s.scope.projectId || !ident(e.withdrawalId)) deny();
  if (s.phase === 'FENCING' && s.withdrawalId === e.withdrawalId) return s;
  if (s.phase !== 'OPEN' || !integer(s.scope.epoch + 1)) deny();
  return update(s, { phase: 'FENCING', withdrawalId: e.withdrawalId,
    scope: { ...s.scope, epoch: s.scope.epoch + 1 } });
}

/** Only model eligibility: NOT real cloud settlement or trusted provider proof. */
export function observeDrainCandidate(s, observation, expectedVersion) {
  ledger(s, expectedVersion);
  const keys = ['attemptId', 'epoch', 'bucket', 'objectPath',
    'generation', 'bytesCommitted', 'writerDrained', 'writerIncapable',
    'objectAbsent', 'inventoryAfterFence', 'generationDeleted'];
  if (s.phase !== 'FENCING' || !exact(observation, keys)) deny();
  const a = s.reservations.find(x => x.attemptId === observation.attemptId);
  if (!a || a.state === 'DRAIN_CANDIDATE' || a.epoch !== observation.epoch ||
    a.bucket !== observation.bucket || a.objectPath !== observation.objectPath ||
    observation.writerDrained !== true || observation.writerIncapable !== true ||
    observation.objectAbsent !== true || observation.inventoryAfterFence !== true ||
    typeof observation.bytesCommitted !== 'boolean') deny();
  if (observation.bytesCommitted === true) {
    if (typeof observation.generation !== 'string' ||
      !GENERATION.test(observation.generation) ||
      observation.generationDeleted !== true) deny();
  } else if (observation.generation !== null || observation.generationDeleted !== false) deny();
  return update(s, { reservations: s.reservations.map(x => x.attemptId === a.attemptId ?
    { ...x, state: 'DRAIN_CANDIDATE', observedGeneration: observation.generation } : x) });
}

export function inspectDrainForReview(s) {
  assertReviewLedgerIntegrity(s);
  if (!s || s.schema !== LEDGER_SCHEMA || !Object.isFrozen(s)) deny();
  const unresolved = s.reservations.filter(a => a.state !== 'DRAIN_CANDIDATE');
  return Object.freeze({
    schema: 'R1016_REVIEW_ONLY_DRAIN_INSPECTION_V1',
    phase: s.phase, epoch: s.scope.epoch,
    totalReservations: s.reservations.length,
    unresolvedReservations: unresolved.length,
    modelDrainCandidate: s.phase === 'FENCING' && unresolved.length === 0,
    providerProofAuthenticated: false,
    allWritersStorageFenced: false,
    deletionAcknowledged: false,
    releaseAuthorized: false,
    reviewOnly: true,
  });
}

/** A non-authoritative model must never claim the right to ACK deletion. */
export function acknowledgeDeletionForReview() { deny(); }
