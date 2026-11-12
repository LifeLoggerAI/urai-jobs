/**
 * R1113 review-only: static, conservative preflight for a disposable GCS
 * private-output canary bucket. No network, credentials, GCP calls or grants.
 * This CANNOT prove effective IAM, deny policies, principal identity,
 * impersonation restrictions, or object write denial. Never release-authorizes.
 */
import { createHash } from 'node:crypto';

export const DENIED = 'R1113_PRIVATE_WRITER_POLICY_PREFLIGHT_UNVERIFIED';
const PROJECT = /^urai-security-canary-[a-z0-9][a-z0-9-]{5,39}$/;
const PRINCIPAL = /^serviceAccount:[a-z0-9][a-z0-9._-]*@[a-z0-9][a-z0-9.-]*\.iam\.gserviceaccount\.com$/;
const WRITE = new Set([
  'roles/storage.admin', 'roles/storage.objectAdmin', 'roles/storage.objectCreator',
  // R1114 peer coverage: objectUser and legacyBucketWriter can write objects.
  'roles/storage.objectUser', 'roles/storage.legacyBucketWriter',
  'roles/storage.folderAdmin', 'roles/storage.expressModeUserAccess',
  'roles/storage.legacyBucketOwner', 'roles/storage.legacyObjectOwner',
  'roles/editor', 'roles/owner'
]);
const READ = new Set([
  'roles/storage.objectViewer', 'roles/storage.legacyBucketReader',
  'roles/storage.legacyObjectReader', 'roles/viewer', 'roles/browser'
]);
// R1117: the write-only preflight must not silently accept independent
// principals who can view private media bytes or enumerate object metadata.
// Basic project Viewer may propagate Legacy Object Reader via convenience IAM.
const SENSITIVE_READ_OR_LIST = new Set([
  'roles/storage.objectViewer', 'roles/storage.legacyBucketReader',
  'roles/storage.legacyObjectReader', 'roles/viewer'
]);
const own = (v,k) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.hasOwn(v,k);
const digest = s => createHash('sha256').update(s).digest('hex');
const error = () => { throw new Error(DENIED); };
function checkPolicy(v) {
  if (!own(v,'bindings') || !Array.isArray(v.bindings) || v.bindings.length > 5000) error();
  return v.bindings.map(b => {
    if (!own(b,'role') || typeof b.role !== 'string' ||
        !own(b,'members') || !Array.isArray(b.members) || b.members.length > 5000 ||
        b.members.some(m => typeof m !== 'string' || m.length > 350)) error();
    return b;
  });
}

/** The only success possible here is a structural preflight, never a production grant. */
export function assessStagingWriterPolicy(raw) {
  if (!own(raw,'projectId') || !PROJECT.test(raw.projectId) ||
      !own(raw,'bucket') || raw.bucket !== `${raw.projectId}-private` ||
      !own(raw,'broker') || typeof raw.broker !== 'string' || !PRINCIPAL.test(raw.broker) ||
      !own(raw,'bucketConfig') || !own(raw,'projectPolicy') || !own(raw,'bucketPolicy')) error();
  const bc=raw.bucketConfig;
  if (!own(bc,'publicAccessPrevention') || !own(bc,'uniformBucketLevelAccess') ||
      typeof bc.publicAccessPrevention !== 'string' ||
      typeof bc.uniformBucketLevelAccess !== 'boolean') error();
  const grants=[
    // Trusted origin always overrides an untrusted exported binding's "source".
    ...checkPolicy(raw.projectPolicy).map(b=>({...b,source:'project'})),
    ...checkPolicy(raw.bucketPolicy).map(b=>({...b,source:'bucket'}))
  ];
  const problems=[];
  const publicNames=new Set(['allUsers','allAuthenticatedUsers']);
  let brokerWriterCount=0, brokerBucketObjectAdminCount=0;
  let brokerBucketObjectUserCount=0, brokerCanaryCount=0;
  let otherWriterCount=0, otherReaderCount=0, unknownRoleCount=0, conditionalCount=0;
  const writerDigests=new Set();
  for(const b of grants){
    const conditional=own(b,'condition');
    if(conditional){conditionalCount++;problems.push('IAM_CONDITIONS_REQUIRE_PROVIDER_EVALUATION');}
    if(WRITE.has(b.role)) {
      for(const member of b.members){
        writerDigests.add(digest(member));
        if(member===raw.broker){
          brokerWriterCount++;
          // The generation canary requires create, readback and exact-delete.
          // Both predefined objectAdmin and objectUser allow all three
          // when granted on this exact bucket (not across the project).
          if(b.source==='bucket' &&
             (b.role==='roles/storage.objectAdmin'||b.role==='roles/storage.objectUser')){
            brokerCanaryCount++;
            if(b.role==='roles/storage.objectAdmin')brokerBucketObjectAdminCount++;
            else brokerBucketObjectUserCount++;
          } else problems.push('BROKER_WRITE_ROLE_INSUFFICIENT_OR_OVERBROAD');
          if(b.source==='project')problems.push('BROKER_PROJECT_WIDE_WRITE_NOT_LEAST_PRIVILEGE');
        } else { otherWriterCount++; problems.push('NON_BROKER_WRITE_CAPABILITY'); }
        if(publicNames.has(member))problems.push('PUBLIC_WRITE_BINDING');
      }
    } else if (!READ.has(b.role)) {
      unknownRoleCount++;
      problems.push('UNKNOWN_ROLE_PERMISSIONS');
    }
    // Granting read/list permissions to any identity other than the broker
    // requires an explicit confidentiality review. This is conservative:
    // project Viewer convenience grants and bucket-scoped legacy bindings
    // may expose object names or bytes, depending on effective policy.
    if(SENSITIVE_READ_OR_LIST.has(b.role)){
      for(const member of b.members)if(member!==raw.broker){
        otherReaderCount++;
        problems.push('NON_BROKER_PRIVATE_OBJECT_READ_OR_LIST_UNREVIEWED');
      }
    }
    if(b.members.some(m=>publicNames.has(m)))problems.push('PUBLIC_PRINCIPAL_BINDING');
  }
  if(brokerWriterCount===0)problems.push('NO_BROKER_WRITE_BINDING');
  if(brokerCanaryCount===0){
    problems.push('BROKER_BUCKET_CREATE_READ_DELETE_REQUIRED');
    // Preserve peer R1114 reason code in reviewer snapshots.
    problems.push('BROKER_CANNOT_COMPLETE_BUCKET_SCOPED_CREATE_READ_DELETE');
  }
  if(bc.publicAccessPrevention!=='enforced')problems.push('PUBLIC_ACCESS_PREVENTION_NOT_ENFORCED');
  if(bc.uniformBucketLevelAccess!==true)problems.push('UNIFORM_BUCKET_ACCESS_NOT_ENABLED');
  const blockers=[...new Set(problems)].sort();
  return Object.freeze({
    schema:'R1113_GCS_STAGING_POLICY_PREFLIGHT_V1',
    scopeDigest:digest(raw.projectId+'\n'+raw.bucket),
    // Only anonymous counts/digests escape; no raw principal emails.
    writerPrincipalCount:writerDigests.size,
    brokerWriterBindings:brokerWriterCount,
    brokerBucketObjectAdminBindings:brokerBucketObjectAdminCount,
    brokerBucketObjectUserBindings:brokerBucketObjectUserCount,
    brokerCanaryBindings:brokerCanaryCount,
    otherWriterBindings:otherWriterCount,
    nonBrokerReaderBindings:otherReaderCount,
    unknownRoleBindings:unknownRoleCount,
    conditionalBindings:conditionalCount,
    structuralPreflightPass:blockers.length===0,
    blockers,
    effectiveIamExclusivityVerified:false,
    privateReadIsolationVerified:false,
    signedUrlAndCacheRevocationVerified:false,
    providerPrincipalIdentityVerified:false,
    deniedWriterHttp403Verified:false,
    authorizedBrokerCreateReadDeleteVerified:false,
    uploadDrainVerified:false,
    deletionAcknowledged:false,
    privateMediaWritesEnabled:false,
    productionAuthorized:false,
    launchApproved:false,
    independentProviderReview:'REQUIRED_NOT_PERFORMED'
  });
}
