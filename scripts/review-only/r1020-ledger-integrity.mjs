/**
 * R1020 REVIEW ONLY: reject structurally forged or internally inconsistent
 * R1016 model snapshots before they are inspected or advanced.
 *
 * This is NOT an authentication mechanism, Firestore transaction, or GCS/IAM
 * authority. A caller can still construct a plausible snapshot; production
 * provenance requires server-owned transactional reads and cloud readback.
 */
export const DENIED = 'R1016_REVIEW_ONLY_DENIED';
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const GEN = /^[1-9][0-9]*$/;
const FILES = new Set(['life-movie.mp4', 'life-movie.srt', 'life-movie.render-manifest.json']);
const ROOT = ['schema', 'scope', 'phase', 'version', 'withdrawalId', 'reservations',
  'reviewOnly', 'storageWriteAuthorized', 'deletionAcknowledged', 'releaseAuthorized'];
const SCOPE = ['ownerUid', 'tenantId', 'projectId', 'bucket', 'epoch'];
const ATTEMPT = ['attemptId', 'epoch', 'bucket', 'objectPath', 'state', 'observedGeneration'];
function deny() { throw new Error(DENIED); }
function id(v) { return typeof v === 'string' && ID.test(v); }
function positive(v) { return Number.isSafeInteger(v) && v > 0; }
function exactFrozenData(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !Object.isFrozen(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) deny();
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || keys.some(k => !actual.includes(k))) deny();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) deny();
  }
}

/** Reject malformed snapshots. Does not certify who created the snapshot. */
export function assertReviewLedgerIntegrity(s) {
  exactFrozenData(s, ROOT);
  if (s.schema !== 'R1016_REVIEW_ONLY_REVOCATION_LEDGER_V1' ||
      s.reviewOnly !== true || s.storageWriteAuthorized !== false ||
      s.deletionAcknowledged !== false || s.releaseAuthorized !== false ||
      !positive(s.version) || !['OPEN', 'FENCING'].includes(s.phase)) deny();
  exactFrozenData(s.scope, SCOPE);
  if (SCOPE.slice(0, 4).some(k => !id(s.scope[k])) || !positive(s.scope.epoch)) deny();
  if (s.phase === 'OPEN' && s.withdrawalId !== null) deny();
  if (s.phase === 'FENCING' && (!id(s.withdrawalId) || s.scope.epoch < 2)) deny();
  if (!Array.isArray(s.reservations) || !Object.isFrozen(s.reservations)) deny();
  if (s.version < 1 + s.reservations.length + (s.phase === 'FENCING' ? 1 : 0)) deny();
  const seen = new Set();
  for (const a of s.reservations) {
    exactFrozenData(a, ATTEMPT);
    if (!id(a.attemptId) || seen.has(a.attemptId) ||
        !positive(a.epoch) || a.bucket !== s.scope.bucket ||
        !['RESERVED', 'IN_FLIGHT', 'DRAIN_CANDIDATE'].includes(a.state)) deny();
    seen.add(a.attemptId);
    const expectedEpoch = s.phase === 'OPEN' ? s.scope.epoch : s.scope.epoch - 1;
    if (a.epoch !== expectedEpoch) deny();
    const prefix = 'tenants/' + s.scope.tenantId + '/life-movies/' +
      s.scope.projectId + '/attempt-' + a.attemptId + '/';
    if (typeof a.objectPath !== 'string' || !a.objectPath.startsWith(prefix) ||
        !FILES.has(a.objectPath.slice(prefix.length))) deny();
    if (a.state === 'DRAIN_CANDIDATE') {
      if (s.phase !== 'FENCING' ||
          (a.observedGeneration !== null &&
            !(typeof a.observedGeneration === 'string' && GEN.test(a.observedGeneration)))) deny();
    } else if (a.observedGeneration !== null) deny();
  }
  return s;
}
