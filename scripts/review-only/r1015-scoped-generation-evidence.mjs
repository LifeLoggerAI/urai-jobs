/**
 * R1015 REVIEW ONLY: cross-scope correlation for untrusted GCS generation evidence.
 * This validates shape, a previously inspected request and current scope data.
 * It does not verify trusted issuer provenance, Firestore transaction ordering,
 * IAM, upload drain, GCS metadata, or deletion; NEVER use it as write authority.
 */
import { inspectGenerationEvidence, DENIED } from './r1001-private-output-broker-contract.mjs';

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const KINDS = new Set(['life-movie.mp4', 'life-movie.srt', 'life-movie.render-manifest.json']);
const POLICY_KEYS = ['ownerUid', 'tenantId', 'projectId', 'purpose', 'epoch',
  'phase', 'bucket', 'acceptedSourceSetDigest', 'acceptedRenderPlanDigest'];
const ADMISSION_KEYS = ['schema', 'purpose', 'ownerUid', 'tenantId', 'projectId',
  'epoch', 'attemptId', 'bucket', 'objectPath', 'sourceSetDigest',
  'renderPlanDigest', 'storageWriteAuthorized', 'deletionAcknowledged', 'reviewOnly'];

function deny() { throw new Error(DENIED); }
function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
}
function segment(value) { return typeof value === 'string' && SEGMENT.test(value); }
function digest(value) { return typeof value === 'string' && HASH.test(value); }

export function inspectScopedGenerationEvidence(evidence, currentPolicy, admission) {
  // Original R1001 canonical evidence validator remains the first gate.
  const original = inspectGenerationEvidence(evidence);
  if (!exactKeys(currentPolicy, POLICY_KEYS) || !exactKeys(admission, ADMISSION_KEYS)) deny();
  if (!['OPEN', 'FENCING'].includes(currentPolicy.phase) ||
    currentPolicy.purpose !== 'life-movie.render' ||
    admission.purpose !== currentPolicy.purpose ||
    admission.schema !== 'R1001_REVIEW_ONLY_PRIVATE_WRITE_INPUT_V1' ||
    admission.storageWriteAuthorized !== false || admission.reviewOnly !== true ||
    admission.deletionAcknowledged !== false) deny();
  for (const key of ['ownerUid', 'tenantId', 'projectId', 'bucket']) {
    if (!segment(currentPolicy[key]) || admission[key] !== currentPolicy[key]) deny();
  }
  if (!segment(admission.attemptId) || !Number.isSafeInteger(currentPolicy.epoch) ||
    currentPolicy.epoch <= 0 || !Number.isSafeInteger(admission.epoch) ||
    !Number.isSafeInteger(evidence.epoch) ||
    admission.epoch !== currentPolicy.epoch || evidence.epoch !== currentPolicy.epoch ||
    admission.attemptId !== evidence.attemptId) deny();
  if (!digest(currentPolicy.acceptedSourceSetDigest) ||
    !digest(currentPolicy.acceptedRenderPlanDigest) ||
    admission.sourceSetDigest !== currentPolicy.acceptedSourceSetDigest ||
    admission.renderPlanDigest !== currentPolicy.acceptedRenderPlanDigest) deny();
  const prefix = `tenants/${currentPolicy.tenantId}/life-movies/${currentPolicy.projectId}/attempt-${admission.attemptId}/`;
  const fileKind = evidence.objectPath.startsWith(prefix) ? evidence.objectPath.slice(prefix.length) : null;
  if (!KINDS.has(fileKind) || admission.objectPath !== evidence.objectPath ||
    evidence.objectPath !== prefix + fileKind) deny();
  // Validated input does not become verified cloud evidence or a release gate.
  return Object.freeze({
    schema: 'R1015_REVIEW_ONLY_SCOPED_GENERATION_INPUT_V1',
    ownerUid: currentPolicy.ownerUid,
    tenantId: currentPolicy.tenantId,
    projectId: currentPolicy.projectId,
    epoch: currentPolicy.epoch,
    attemptId: admission.attemptId,
    bucket: currentPolicy.bucket,
    objectPath: original.objectPath,
    generation: original.generation,
    reviewOnly: true,
    verifiedByCloud: false,
    storageWriteAuthorized: false,
    deletionAcknowledged: false,
  });
}
