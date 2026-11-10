/**
 * R1001 review-only admission protocol for a future exclusive Storage broker.
 * Validates untrusted request shape and canonical output path. This module
 * MUST NOT sign a token, create a reservation or perform a Storage write.
 * The current worker hard-off remains authoritative.
 */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const GENERATION = /^[1-9][0-9]*$/;
const PURPOSE = 'life-movie.render';
const DENIED = 'life_movie_private_write_reservation_denied';
function deny() { throw new Error(DENIED); }
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function segment(value) {
  return typeof value === 'string' && SEGMENT.test(value);
}
function sameKeys(value, keys) {
  return record(value) && Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key));
}
function validPositiveInt(value) {
  return Number.isSafeInteger(value) && value > 0;
}
function generation(value) {
  return typeof value === 'string' && GENERATION.test(value) &&
    Number.isSafeInteger(Number(value));
}
function requiredStringHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}
function expectedPath(scope, attemptId, fileKind) {
  return `tenants/${scope.tenantId}/life-movies/${scope.projectId}/attempt-${attemptId}/${fileKind}`;
}
/**
 * Rejects caller authority and returns canonical data for a future trusted
 * transaction controller. Never returns a capability or 'authorized=true'.
 * The caller MUST NOT use this for actual GCS access or as IAM evidence.
 */
export function inspectPrivateWriteRequest(request, policy) {
  const required = ['ownerUid', 'tenantId', 'projectId', 'purpose', 'epoch', 'attemptId',
    'bucket', 'objectPath', 'fileKind', 'sourceSetDigest', 'renderPlanDigest'];
  const policyFields = ['ownerUid', 'tenantId', 'projectId', 'purpose', 'epoch',
    'phase', 'bucket', 'acceptedSourceSetDigest', 'acceptedRenderPlanDigest'];
  if (!sameKeys(request, required) || !sameKeys(policy, policyFields)) deny();
  const fields = ['ownerUid', 'tenantId', 'projectId'];
  if (!fields.every(k => segment(request[k]) && request[k] === policy[k]) ||
    !segment(request.attemptId) || !segment(request.bucket) ||
    request.purpose !== PURPOSE || policy.purpose !== PURPOSE ||
    !validPositiveInt(request.epoch) || !validPositiveInt(policy.epoch) ||
    request.epoch !== policy.epoch || policy.phase !== 'OPEN' ||
    request.bucket !== policy.bucket ||
    !requiredStringHash(request.sourceSetDigest) ||
    !requiredStringHash(request.renderPlanDigest) ||
    request.sourceSetDigest !== policy.acceptedSourceSetDigest ||
    request.renderPlanDigest !== policy.acceptedRenderPlanDigest ||
    !['life-movie.mp4', 'life-movie.srt', 'life-movie.render-manifest.json'].includes(request.fileKind) ||
    request.objectPath !== expectedPath(request, request.attemptId, request.fileKind)) deny();
  return Object.freeze({
    schema: 'R1001_REVIEW_ONLY_PRIVATE_WRITE_INPUT_V1',
    purpose: PURPOSE,
    ownerUid: request.ownerUid,
    tenantId: request.tenantId,
    projectId: request.projectId,
    epoch: request.epoch,
    attemptId: request.attemptId,
    bucket: request.bucket,
    objectPath: request.objectPath,
    sourceSetDigest: request.sourceSetDigest,
    renderPlanDigest: request.renderPlanDigest,
    storageWriteAuthorized: false,
    deletionAcknowledged: false,
    reviewOnly: true,
  });
}

/**
 * A future broker MUST obtain these fields in a server-owned transaction,
 * not from untrusted user input or stale cached job snapshots.
 */
export function inspectGenerationEvidence(value) {
  const keys = ['attemptId', 'epoch', 'objectPath', 'generation', 'bytesCommitted', 'writerDrained'];
  if (!sameKeys(value, keys) || !segment(value.attemptId) ||
    !validPositiveInt(value.epoch) ||
    typeof value.objectPath !== 'string' || value.objectPath.length > 1024 ||
    !generation(value.generation) || value.bytesCommitted !== true ||
    value.writerDrained !== true) deny();
  if (value.objectPath.includes('..') || value.objectPath.includes('\\') ||
      value.objectPath.startsWith('/') || value.objectPath.split('/').some(p => !p)) deny();
  return Object.freeze({
    schema: 'R1001_REVIEW_ONLY_GENERATION_INPUT_V1',
    attemptId: value.attemptId,
    epoch: value.epoch,
    objectPath: value.objectPath,
    generation: value.generation,
    verifiedByCloud: false,
    deletionAcknowledged: false,
  });
}
export { DENIED };
