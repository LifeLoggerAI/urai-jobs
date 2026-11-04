/**
 * R526: OFFLINE, READ-ONLY review of already-exported Google Cloud IAM evidence.
 * This program NEVER queries or modifies GCP, and NEVER declares production GO.
 * Effective access may also arise via org/folder IAM, groups, deny policies,
 * custom roles, service-account impersonation, signed URLs, existing keys,
 * long-lived sessions, and already running Cloud Run revisions.
 *
 * Inputs are sensitive: store snapshots outside the repository. CLI prints
 * aggregate reason codes only, never raw principals or bucket objects.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'urai-studio-private-storage-iam-review-v1';
const WRITE_ROLES = new Set([
  'roles/storage.admin', 'roles/storage.objectAdmin',
  'roles/storage.objectCreator', 'roles/storage.objectUser',
  'roles/storage.legacyBucketOwner', 'roles/storage.legacyBucketWriter',
  'roles/storage.legacyObjectOwner', 'roles/storage.legacyObjectWriter',
  // Folder and Express roles can create private objects without objectAdmin.
  'roles/storage.folderAdmin', 'roles/storage.expressModeUserAccess',
  'roles/owner', 'roles/editor',
]);
const IMPERSONATION_ROLES = new Set([
  'roles/iam.serviceAccountTokenCreator', 'roles/iam.serviceAccountUser',
  'roles/iam.workloadIdentityUser', 'roles/iam.securityAdmin',
  'roles/iam.serviceAccountKeyAdmin', 'roles/iam.serviceAccountAdmin',
  'roles/iam.admin', 'roles/iam.editor',
  // HMAC key issuance can create credentials for Storage XML API callers.
  'roles/storage.hmacKeyAdmin',
  'roles/resourcemanager.projectIamAdmin',
]);
const PROJECT = /^[a-z][a-z0-9-]{4,62}$/;
const BUCKET = /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/;
const SERVICE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SA = /^[a-z0-9._+-]+@(?:[a-z0-9._-]+\.)?gserviceaccount\.com$/;
const MEMBER = /^(?:(?:serviceAccount|user|group|domain|principal|principalSet):\S+|allUsers|allAuthenticatedUsers)$/;
const IAM_ROLE = /^(?:roles\/[A-Za-z0-9_.]+|(?:projects|organizations)\/[A-Za-z0-9._-]+\/roles\/[A-Za-z0-9_]+)$/;

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function policy(value) {
  return object(value) && Array.isArray(value.bindings) &&
    value.bindings.length <= 10000 &&
    value.bindings.every(b => object(b) &&
      typeof b.role === 'string' && b.role.length < 300 &&
      Array.isArray(b.members) && b.members.length <= 10000 &&
      b.members.every(m => typeof m === 'string' && m.length <= 2048) &&
      (b.condition === undefined || object(b.condition)));
}
function collectPolicy(policyObject, scope, findings, counters) {
  for (const binding of policyObject.bindings) {
    counters.bindings += 1;
    counters.members += binding.members.length;
    const { role } = binding;
    if (!IAM_ROLE.test(role)) findings.add('IAM_ROLE_SYNTAX_UNVERIFIED_' + scope);
    if (WRITE_ROLES.has(role)) findings.add('POTENTIAL_DIRECT_STORAGE_WRITE_' + scope);
    if (IMPERSONATION_ROLES.has(role)) findings.add('IAM_IMPERSONATION_OR_ADMIN_REVIEW_' + scope);
    if (/^(?:projects|organizations)\/[^/]+\/roles\//.test(role)) findings.add('CUSTOM_ROLE_PERMISSIONS_UNRESOLVED_' + scope);
    if (/^roles\/storage\./.test(role) && !WRITE_ROLES.has(role) &&
        !['roles/storage.objectViewer','roles/storage.legacyBucketReader'].includes(role)) {
      findings.add('STORAGE_ROLE_SEMANTICS_UNVERIFIED_' + scope);
    }
    if (binding.condition) findings.add('CONDITIONAL_POLICY_EFFECTIVENESS_UNVERIFIED_' + scope);
    if (binding.members.some(m => ['allUsers','allAuthenticatedUsers'].includes(m))) {
      findings.add('PUBLIC_OR_DOMAIN_WIDE_MEMBER_' + scope);
    }
    if (binding.members.some(m => !MEMBER.test(m))) {
      findings.add('UNRECOGNIZED_IAM_MEMBER_FORMAT_' + scope);
    }
    if (binding.members.some(m => m.startsWith('group:') || m.startsWith('domain:') ||
        m.startsWith('principalSet:'))) findings.add('INDIRECT_GROUP_OR_FEDERATION_MEMBERSHIP_' + scope);
  }
}
function invalidResult(reason, snapshot) {
  return {
    schemaVersion: 'urai-studio-iam-audit-output-v1',
    verdict: 'HOLD', productionAuthorized: false,
    liveEffectiveIamVerified: false, revokeAckPermitted: false,
    inputDigestSha256: snapshot === undefined ? null :
      createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
    findings: [reason], totals: { bindings: 0, members: 0, cloudRunServices: 0 },
  };
}
/**
 * Diagnostic ONLY: never returns a signed approval, writer token or GO.
 * @param {unknown} snapshot reviewer-supplied saved GCP CLI output
 * @param {{projectId: string, bucket: string, now?: Date}} expected exact scope
 */
export function auditStudioStorageIamSnapshot(snapshot, expected) {
  if (!object(snapshot) || !object(expected)) return invalidResult('EVIDENCE_MALFORMED', snapshot);
  const inputDigest = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  if (!PROJECT.test(String(expected.projectId ?? '')) ||
      !BUCKET.test(String(expected.bucket ?? '')) ||
      String(expected.bucket).includes('..')) {
    return invalidResult('EXPECTED_SCOPE_INVALID', snapshot);
  }
  if (snapshot.schemaVersion !== SCHEMA ||
      snapshot.projectId !== expected.projectId || snapshot.bucket !== expected.bucket) {
    return invalidResult('EVIDENCE_SCOPE_MISMATCH', snapshot);
  }
  if (!policy(snapshot.projectPolicy) || !policy(snapshot.bucketPolicy)) {
    return invalidResult('PROJECT_OR_BUCKET_POLICY_MISSING', snapshot);
  }
  if (!Array.isArray(snapshot.runServices) || snapshot.runServices.length > 10000 ||
      !snapshot.runServices.every(s => object(s) && SERVICE.test(String(s.name ?? '')) &&
        (s.serviceAccount === null || SA.test(String(s.serviceAccount ?? ''))))) {
    return invalidResult('CLOUD_RUN_SERVICE_INVENTORY_INCOMPLETE', snapshot);
  }
  const findings = new Set([
    'LIVE_EFFECTIVE_IAM_NOT_VERIFIED',
    'EXISTING_CREDENTIALS_AND_SIGNED_URLS_NOT_REVOKED',
    'ALREADY_RUNNING_REVISIONS_NOT_FULLY_INVENTORIED',
    'AFTER_REVOKE_OLD_IDENTITY_NEGATIVE_GCS_TEST_REQUIRED',
    'ACTUAL_UPLOAD_DRAIN_AND_GCS_GENERATION_PROOF_REQUIRED',
    'INDEPENDENT_REVIEW_AND_FOUNDER_RELEASE_APPROVAL_REQUIRED',
  ]);
  const now = expected.now instanceof Date ? expected.now : new Date();
  const timestamp = Date.parse(String(snapshot.collectedAt ?? ''));
  if (!Number.isFinite(timestamp) || timestamp > now.getTime() + 60_000 ||
    now.getTime() - timestamp > 86_400_000) findings.add('EVIDENCE_STALE_MISSING_OR_FUTURE');
  if (!Array.isArray(snapshot.ancestorPolicies) || !snapshot.ancestorPolicies.length) {
    findings.add('ANCESTOR_EFFECTIVE_IAM_MISSING');
  } else {
    if (snapshot.ancestorPolicies.length > 50 ||
        !snapshot.ancestorPolicies.every(x => object(x) &&
          ['folder','organization'].includes(x.level) && policy(x.policy))) {
      return invalidResult('ANCESTOR_POLICY_MALFORMED', snapshot);
    }
  }
  const counters = { bindings: 0, members: 0, cloudRunServices: snapshot.runServices.length };
  collectPolicy(snapshot.projectPolicy, 'PROJECT', findings, counters);
  collectPolicy(snapshot.bucketPolicy, 'BUCKET', findings, counters);
  if (Array.isArray(snapshot.ancestorPolicies)) {
    for (const a of snapshot.ancestorPolicies) collectPolicy(a.policy, 'ANCESTOR', findings, counters);
  }
  if (!snapshot.runServices.some(s => /studio/i.test(s.name))) {
    findings.add('STUDIO_SERVICE_ABSENCE_NOT_PROVEN');
  }
  if (snapshot.runServices.some(s => /studio/i.test(s.name) && !s.serviceAccount)) {
    findings.add('STUDIO_RUNTIME_PRINCIPAL_UNVERIFIED');
  }
  // A non-Studio Cloud Run worker can also write private objects; do not hide
  // unidentified alternate workload principals behind a valid Studio identity.
  if (snapshot.runServices.some(s => !s.serviceAccount)) {
    findings.add('CLOUD_RUN_RUNTIME_PRINCIPAL_UNVERIFIED');
  }
  if (snapshot.runServices.some(s => typeof s.serviceAccount === 'string' &&
      /@(?:developer|appspot)\.gserviceaccount\.com$/.test(s.serviceAccount))) {
    findings.add('DEFAULT_SHARED_RUNTIME_IDENTITY_REQUIRES_REVIEW');
  }
  if (!Array.isArray(snapshot.revisionInventory) || !snapshot.revisionInventory.length) {
    findings.add('HISTORIC_STUDIO_REVISION_IDENTITIES_MISSING');
  } else if (snapshot.revisionInventory.length > 10000 ||
      !snapshot.revisionInventory.every(rev => object(rev) &&
        SERVICE.test(String(rev.name ?? '')) &&
        (rev.serviceAccount === null || SA.test(String(rev.serviceAccount ?? ''))))) {
    // A nonempty array of placeholders is not evidence of historical identities.
    return invalidResult('HISTORIC_REVISION_INVENTORY_MALFORMED', snapshot);
  } else {
    if (snapshot.revisionInventory.some(rev => !rev.serviceAccount)) {
      findings.add('HISTORIC_REVISION_PRINCIPAL_UNVERIFIED');
    }
    if (!snapshot.revisionInventory.some(rev => /studio/i.test(rev.name))) {
      findings.add('HISTORIC_STUDIO_REVISION_IDENTITIES_MISSING');
    }
  }
  // Unknown custom roles, inherited IAM, and service account impersonation
  // always require separate effective permissions testing.
  return {
    schemaVersion: 'urai-studio-iam-audit-output-v1',
    verdict: 'HOLD', productionAuthorized: false,
    liveEffectiveIamVerified: false, revokeAckPermitted: false,
    inputDigestSha256: inputDigest,
    findings: [...findings].sort(),
    totals: counters,
  };
}
function cli() {
  const args = process.argv.slice(2);
  if (args.length !== 6 || args[0] !== '--snapshot' ||
      args[2] !== '--project' || args[4] !== '--bucket') {
    process.stderr.write('HOLD: expected --snapshot <private-json> --project <id> --bucket <name>; no cloud calls performed\n');
    process.exitCode = 2; return;
  }
  try {
    const file = resolve(args[1]);
    if (lstatSync(file).isSymbolicLink()) throw new Error('unsafe file');
    const stat = statSync(file);
    if (!stat.isFile() || stat.size > 2_000_000 || stat.size === 0) throw new Error('invalid input');
    const snapshot = JSON.parse(readFileSync(file, 'utf8'));
    const result = auditStudioStorageIamSnapshot(snapshot, {
      projectId: args[3], bucket: args[5],
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.findings.some(x =>
      x === 'EVIDENCE_MALFORMED' || x === 'EVIDENCE_SCOPE_MISMATCH' ||
      x === 'PROJECT_OR_BUCKET_POLICY_MISSING') ? 3 : 2;
  } catch {
    // Do not echo private path, policy body, credentials or principal names.
    process.stderr.write('HOLD: private IAM evidence unreadable or invalid; no release authorization\n');
    process.exitCode = 3;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli();
