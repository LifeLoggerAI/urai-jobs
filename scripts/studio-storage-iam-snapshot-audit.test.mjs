import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditStudioStorageIamSnapshot as audit, SCHEMA } from './review-only/studio-storage-iam-snapshot-audit.mjs';

const now = new Date('2026-11-04T05:00:00.000Z');
const projectId = 'urai-review-1';
const bucket = 'urai-review-private-bucket';
const privatePrincipal = 'some-private-principal@example.com';
const baseline = () => ({
  schemaVersion: SCHEMA,
  projectId, bucket, collectionRegion: 'us-central1',
  collectorCoverage: 'ONE_REGION_ONLY_RETAINED_EXECUTIONS_NOT_EFFECTIVE_IAM_OR_DRAIN_PROOF',
  collectedAt: '2026-11-04T04:58:00.000Z',
  bucketPolicy: { version: 3, bindings: [] },
  projectPolicy: { version: 3, bindings: [] },
  ancestorPolicies: [
    { level: 'organization', policy: { version: 3, bindings: [] } },
  ],
  runServices: [
    { name: 'urai-studio-worker', serviceAccount: 'worker@urai-review-1.iam.gserviceaccount.com' },
  ],
  revisionInventory: [
    { name: 'urai-studio-worker-00001-x', serviceAccount: 'worker@urai-review-1.iam.gserviceaccount.com' },
  ],
});
const run = input => audit(input, { projectId, bucket, region: 'us-central1', now });
const has = (result, code) => assert.ok(result.findings.includes(code),
  'expected finding: ' + code + ', got ' + JSON.stringify(result.findings));
const denied = x => {
  assert.equal(x.verdict, 'HOLD');
  assert.equal(x.productionAuthorized, false);
  assert.equal(x.liveEffectiveIamVerified, false);
  assert.equal(x.revokeAckPermitted, false);
};

test('R526: missing evidence cannot produce release authorization', () => {
  const r = run(null);
  denied(r);
  has(r, 'EVIDENCE_MALFORMED');
});

test('R526: empty direct policies still never imply safe effective Cloud IAM', () => {
  const r = run(baseline());
  denied(r);
  has(r, 'LIVE_EFFECTIVE_IAM_NOT_VERIFIED');
  has(r, 'AFTER_REVOKE_OLD_IDENTITY_NEGATIVE_GCS_TEST_REQUIRED');
  has(r, 'EXISTING_CREDENTIALS_AND_SIGNED_URLS_NOT_REVOKED');
});

test('R526: storage objectAdmin in bucket policy is a blocker', () => {
  const s = baseline();
  s.bucketPolicy.bindings.push({
    role:'roles/storage.objectAdmin',
    members:['serviceAccount:old-writer@urai-review-1.iam.gserviceaccount.com'],
  });
  const r = run(s);
  denied(r); has(r, 'POTENTIAL_DIRECT_STORAGE_WRITE_BUCKET');
  assert.equal(r.totals.bindings, 1);
});

test('R526: project-wide storage.admin and inherited owner are unsafe', () => {
  const s=baseline();
  s.projectPolicy.bindings.push({
    role:'roles/storage.admin',
    members:['serviceAccount:deployer@urai-review-1.iam.gserviceaccount.com'],
  });
  s.ancestorPolicies[0].policy.bindings.push({
    role:'roles/owner',members:['group:infra@example.net'],
  });
  const r=run(s); denied(r);
  has(r,'POTENTIAL_DIRECT_STORAGE_WRITE_PROJECT');
  has(r,'POTENTIAL_DIRECT_STORAGE_WRITE_ANCESTOR');
  has(r,'INDIRECT_GROUP_OR_FEDERATION_MEMBERSHIP_ANCESTOR');
});

test('R529: folderAdmin and Express Mode roles can write private objects', () => {
  const s = baseline();
  s.bucketPolicy.bindings.push({
    role:'roles/storage.folderAdmin',
    members:['serviceAccount:folder-writer@urai-review-1.iam.gserviceaccount.com'],
  });
  s.projectPolicy.bindings.push({
    role:'roles/storage.expressModeUserAccess',
    members:['serviceAccount:express-writer@urai-review-1.iam.gserviceaccount.com'],
  });
  const r = run(s); denied(r);
  has(r,'POTENTIAL_DIRECT_STORAGE_WRITE_BUCKET');
  has(r,'POTENTIAL_DIRECT_STORAGE_WRITE_PROJECT');
});

test('R529: service account key and IAM admin roles need credential review', () => {
  const s = baseline();
  s.projectPolicy.bindings.push({
    role:'roles/iam.serviceAccountKeyAdmin',
    members:['group:credential-operators@example.test'],
  });
  s.ancestorPolicies[0].policy.bindings.push({
    role:'roles/iam.serviceAccountAdmin',
    members:['group:account-operators@example.test'],
  });
  const r = run(s); denied(r);
  has(r,'IAM_IMPERSONATION_OR_ADMIN_REVIEW_PROJECT');
  has(r,'IAM_IMPERSONATION_OR_ADMIN_REVIEW_ANCESTOR');
});

test('R529: HMAC key creation and broad IAM admins cannot be ignored', () => {
  const s = baseline();
  s.projectPolicy.bindings.push({
    role:'roles/storage.hmacKeyAdmin',
    members:['user:synthetic-hmac-admin@example.test'],
  });
  s.bucketPolicy.bindings.push({
    role:'roles/iam.admin',
    members:['group:synthetic-iam-admins@example.test'],
  });
  s.ancestorPolicies[0].policy.bindings.push({
    role:'roles/iam.editor',
    members:['group:synthetic-iam-editors@example.test'],
  });
  const r = run(s); denied(r);
  has(r,'IAM_IMPERSONATION_OR_ADMIN_REVIEW_PROJECT');
  has(r,'IAM_IMPERSONATION_OR_ADMIN_REVIEW_BUCKET');
  has(r,'IAM_IMPERSONATION_OR_ADMIN_REVIEW_ANCESTOR');
});

test('R526: token impersonation and workload federation remain unresolved', () => {
  const s=baseline();
  s.projectPolicy.bindings.push({
    role:'roles/iam.serviceAccountTokenCreator',
    members:['principalSet://iam.googleapis.com/projects/000/locations/global/workloadIdentityPools/reviewer/*'],
  });
  const r=run(s); denied(r);
  has(r,'IAM_IMPERSONATION_OR_ADMIN_REVIEW_PROJECT');
  has(r,'INDIRECT_GROUP_OR_FEDERATION_MEMBERSHIP_PROJECT');
});

test('R526: custom role permissions and conditional bindings require separate review', () => {
  const s=baseline();
  s.bucketPolicy.bindings.push({
    role:'projects/urai-review-1/roles/mysteryStorageWriter',
    members:['serviceAccount:worker@urai-review-1.iam.gserviceaccount.com'],
    condition:{title:'conditional',expression:'request.time < timestamp("2099-01-01T00:00:00Z")'},
  });
  const r=run(s);denied(r);
  has(r,'CUSTOM_ROLE_PERMISSIONS_UNRESOLVED_BUCKET');
  has(r,'CONDITIONAL_POLICY_EFFECTIVENESS_UNVERIFIED_BUCKET');
});

test('R526: allUsers and allAuthenticatedUsers cannot be ignored', () => {
  const s=baseline();s.bucketPolicy.bindings.push({
    role:'roles/storage.objectViewer',members:['allUsers','allAuthenticatedUsers'],
  });
  const r=run(s);denied(r);
  has(r,'PUBLIC_OR_DOMAIN_WIDE_MEMBER_BUCKET');
});

test('R526: missing project or bucket evidence and mismatched scope fail closed', () => {
  const s=baseline();delete s.projectPolicy;
  let r=run(s);denied(r);has(r,'PROJECT_OR_BUCKET_POLICY_MISSING');
  const t=baseline();t.bucket='another-private-bucket';
  r=run(t);denied(r);has(r,'EVIDENCE_SCOPE_MISMATCH');
});

test('R526: missing ancestor policies cannot constitute an effective IAM inventory', () => {
  const s=baseline();delete s.ancestorPolicies;
  const r=run(s);denied(r);has(r,'ANCESTOR_EFFECTIVE_IAM_MISSING');
});

test('R526: stale and future evidence is flagged', () => {
  for (const collectedAt of ['2026-10-30T01:00:00Z','2099-01-01T00:00:00Z','not-a-date']) {
    const s=baseline();s.collectedAt=collectedAt;
    const r=run(s);denied(r);has(r,'EVIDENCE_STALE_MISSING_OR_FUTURE');
  }
});

test('R532: nonempty placeholders are not historical Cloud Run identity evidence', () => {
  for (const revisionInventory of [[{}], [null], [{name:'urai-studio-worker-00001-x'}],
    [{name:'urai-studio-worker-00001-x',serviceAccount:'not-a-service-account'}]]) {
    const s=baseline();s.revisionInventory=revisionInventory;
    const r=run(s);denied(r);has(r,'HISTORIC_REVISION_INVENTORY_MALFORMED');
    assert.equal(r.liveEffectiveIamVerified,false);
  }
});

test('R532: unknown alternate runtime and revision principal are separately flagged', () => {
  const s=baseline();
  s.runServices.push({name:'urai-alt-writer',serviceAccount:null});
  s.revisionInventory[0].serviceAccount=null;
  const r=run(s);denied(r);
  has(r,'CLOUD_RUN_RUNTIME_PRINCIPAL_UNVERIFIED');
  has(r,'HISTORIC_REVISION_PRINCIPAL_UNVERIFIED');
});

test('R532: historical non-Studio-only entries cannot imply Studio history complete', () => {
  const s=baseline();
  s.revisionInventory=[{name:'urai-alt-worker-00001-x',
    serviceAccount:'other@urai-review-1.iam.gserviceaccount.com'}];
  const r=run(s);denied(r);
  has(r,'HISTORIC_STUDIO_REVISION_IDENTITIES_MISSING');
});

test('R526: missing Studio service and revision histories must not certify absence', () => {
  const s=baseline();s.runServices=[];
  s.revisionInventory=[];
  const r=run(s);denied(r);
  has(r,'STUDIO_SERVICE_ABSENCE_NOT_PROVEN');
  has(r,'HISTORIC_STUDIO_REVISION_IDENTITIES_MISSING');
});

test('R526: default shared Cloud Run identity is recognized but never treated as safe', () => {
  const s=baseline();
  s.runServices[0].serviceAccount='123456789-compute@developer.gserviceaccount.com';
  const r=run(s);
  denied(r);
  has(r,'DEFAULT_SHARED_RUNTIME_IDENTITY_REQUIRES_REVIEW');
});

test('R526: reviewer output contains only counts/digests, never principal identities', () => {
  const s=baseline();
  s.projectPolicy.bindings.push({
    role:'roles/storage.admin',members:['user:'+privatePrincipal],
  });
  const r=run(s);denied(r);
  assert.match(r.inputDigestSha256,/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(r).includes(privatePrincipal));
  assert.ok(!JSON.stringify(r).includes('worker@urai-review-1'));
});

test('R526: CLI reads an offline snapshot and never gives exit zero or prints principals', () => {
  const dir=mkdtempSync(join(tmpdir(),'urai-r526-'));
  try {
    const path=join(dir,'iam-private.json');
    const s=baseline();s.bucketPolicy.bindings.push({
      role:'roles/storage.objectAdmin',members:['user:'+privatePrincipal],
    });
    writeFileSync(path,JSON.stringify(s));
    const script=fileURLToPath(new URL('./review-only/studio-storage-iam-snapshot-audit.mjs',import.meta.url));
    const result=spawnSync(process.execPath,[script,'--snapshot',path,'--project',projectId,'--bucket',bucket,'--region','us-central1'],
      {encoding:'utf8',timeout:10000});
    assert.equal(result.status,2,result.stderr);
    assert.match(result.stdout,/"verdict": "HOLD"/);
    assert.doesNotMatch(result.stdout, new RegExp(privatePrincipal.replaceAll('.','\\.')));
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('R526: malformed JSON CLI is hold, not a release GO', () => {
  const dir=mkdtempSync(join(tmpdir(),'urai-r526-corrupt-'));
  try {
    const path=join(dir,'invalid.json');writeFileSync(path,'{ secret-but-invalid');
    const script=fileURLToPath(new URL('./review-only/studio-storage-iam-snapshot-audit.mjs',import.meta.url));
    const r=spawnSync(process.execPath,[script,'--snapshot',path,'--project',projectId,'--bucket',bucket,'--region','us-central1'],
      {encoding:'utf8',timeout:10000});
    assert.equal(r.status,3);
    assert.doesNotMatch(r.stderr,/secret-but-invalid/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});


test('R535: malformed or whitespace-padded IAM roles cannot disappear from review diagnostics', () => {
  for (const role of [' roles/storage.objectAdmin', 'roles/storage.objectAdmin ', '\troles/storage.objectAdmin', 'not-a-role', '']) {
    const s=baseline();s.projectPolicy.bindings.push({role,members:['serviceAccount:worker@urai-review-1.iam.gserviceaccount.com']});
    const r=run(s);denied(r);has(r,'IAM_ROLE_SYNTAX_UNVERIFIED_PROJECT');
  }
});
test('R535: empty or malformed IAM member identifiers are rejected from evidence', () => {
  for (const member of ['serviceAccount:', 'group:', 'user: ', 'serviceAccount:invalid member']) {
    const s=baseline();s.bucketPolicy.bindings.push({role:'roles/storage.objectViewer',members:[member]});
    const r=run(s);denied(r);has(r,'UNRECOGNIZED_IAM_MEMBER_FORMAT_BUCKET');
  }
});
test('R535: well-formed custom role remains unresolved without spurious syntax finding', () => {
  const s=baseline();s.bucketPolicy.bindings.push({role:'projects/urai-review-1/roles/mysteryStorageWriter',members:['serviceAccount:worker@urai-review-1.iam.gserviceaccount.com']});
  const r=run(s);denied(r);has(r,'CUSTOM_ROLE_PERMISSIONS_UNRESOLVED_BUCKET');
  assert.ok(!r.findings.includes('IAM_ROLE_SYNTAX_UNVERIFIED_BUCKET'));
});

test('R537: missing Cloud Run Job inventory is explicit review blocker', () => {
  const r=run(baseline());denied(r);has(r,'CLOUD_RUN_JOB_INVENTORY_MISSING');
});
test('R537: malformed or duplicate Job identities fail closed', () => {
  for (const runJobs of [[{}],[null],[{name:'job1'}],
    [{name:'job1',serviceAccount:'invalid'}],
    [{name:'same-job',serviceAccount:null},{name:'same-job',serviceAccount:null}]]) {
    const s=baseline();s.runJobs=runJobs;const r=run(s);denied(r);
    has(r,'CLOUD_RUN_JOB_INVENTORY_MALFORMED');
  }
});
test('R537: unknown Cloud Run Job principal cannot be silently ignored', () => {
  const s=baseline();s.runJobs=[{name:'urai-job',serviceAccount:null}];
  const r=run(s);denied(r);has(r,'CLOUD_RUN_JOB_PRINCIPAL_UNVERIFIED');
  assert.equal(r.totals.cloudRunJobs,1);
});
test('R537: shared default Cloud Run Job principal still requires review', () => {
  const s=baseline();s.runJobs=[{name:'urai-job',serviceAccount:'123456789-compute@developer.gserviceaccount.com'}];
  const r=run(s);denied(r);has(r,'DEFAULT_SHARED_RUNTIME_IDENTITY_REQUIRES_REVIEW');
});
test('R537: valid Cloud Run Job identity is counted but not cloud permission proof', () => {
  const s=baseline();s.runJobs=[{name:'urai-job',serviceAccount:'job@urai-review-1.iam.gserviceaccount.com'}];
  const r=run(s);denied(r);
  assert.equal(r.totals.cloudRunJobs,1);
  assert.ok(!r.findings.includes('CLOUD_RUN_JOB_INVENTORY_MISSING'));
  has(r,'LIVE_EFFECTIVE_IAM_NOT_VERIFIED');
});

console.log('R526_OFFLINE_IAM_AUDIT_TESTS_REGISTERED productionAuthorized=false cloudCalls=0');

test('R544: well-formed but unclassified Firebase role gets explicit permissions review finding', () => {
  const s = baseline();
  s.bucketPolicy.bindings.push({role:'roles/firebase.admin', members:['serviceAccount:synthetic@urai-review-1.iam.gserviceaccount.com']});
  const r=run(s); denied(r);
  has(r, 'PREDEFINED_ROLE_PERMISSIONS_UNRESOLVED_BUCKET');
  assert.ok(!r.findings.includes('IAM_ROLE_SYNTAX_UNVERIFIED_BUCKET'));
});

test('R544: unclassified predefined roles on project and ancestors are never silently omitted', () => {
  const s=baseline();
  s.projectPolicy.bindings.push({role:'roles/cloudfunctions.admin', members:['group:synthetic@example.test']});
  s.ancestorPolicies[0].policy.bindings.push({role:'roles/unknownservice.unknownRole', members:['group:synthetic@example.test']});
  const r=run(s); denied(r);
  has(r, 'PREDEFINED_ROLE_PERMISSIONS_UNRESOLVED_PROJECT');
  has(r, 'PREDEFINED_ROLE_PERMISSIONS_UNRESOLVED_ANCESTOR');
});

test('R544: known storage and impersonation roles keep specific findings without generic noise', () => {
  const s=baseline();
  s.bucketPolicy.bindings.push({role:'roles/storage.objectViewer', members:['serviceAccount:synthetic@urai-review-1.iam.gserviceaccount.com']});
  s.projectPolicy.bindings.push({role:'roles/storage.objectAdmin', members:['serviceAccount:synthetic@urai-review-1.iam.gserviceaccount.com']});
  s.ancestorPolicies[0].policy.bindings.push({role:'roles/iam.serviceAccountTokenCreator', members:['group:synthetic@example.test']});
  const r=run(s); denied(r);
  has(r, 'POTENTIAL_DIRECT_STORAGE_WRITE_PROJECT');
  has(r, 'IAM_IMPERSONATION_OR_ADMIN_REVIEW_ANCESTOR');
  assert.ok(!r.findings.some(x=>x.startsWith('PREDEFINED_ROLE_PERMISSIONS_UNRESOLVED_')),
    'known role meanings should not produce generic unknown-role diagnostics');
});

test('R584: missing execution inventory is explicitly incomplete, not a job drain receipt',()=>{
  const s=baseline();
  s.runJobs=[{name:'urai-job',serviceAccount:'job@urai-review-1.iam.gserviceaccount.com'}];
  const r=run(s);denied(r);
  has(r,'CLOUD_RUN_EXECUTION_INVENTORY_MISSING');
  has(r,'RETAINED_JOB_EXECUTIONS_NOT_FULL_HISTORICAL_OR_UPLOAD_DRAIN_PROOF');
});
test('R584: retained active and unknown executions are explicit blockers',()=>{
  const s=baseline();
  s.runJobs=[{name:'urai-job',serviceAccount:'job@urai-review-1.iam.gserviceaccount.com'}];
  s.runJobExecutions=[
    {jobName:'urai-job',name:'urai-job-00001',lifecycle:'RECORDED_TERMINAL'},
    {jobName:'urai-job',name:'urai-job-00002',lifecycle:'ACTIVE_OR_UNVERIFIED'}
  ];
  const r=run(s);denied(r);has(r,'CLOUD_RUN_EXECUTION_ACTIVE_OR_UNVERIFIED');
  assert.equal(r.totals.cloudRunExecutions,2);
  assert.ok(!JSON.stringify(r).includes('urai-job-00002'));
});
test('R584: terminal-only retained history never becomes completed GCS drain',()=>{
  const s=baseline();
  s.runJobs=[{name:'urai-job',serviceAccount:'job@urai-review-1.iam.gserviceaccount.com'}];
  s.runJobExecutions=[{jobName:'urai-job',name:'urai-job-00001',lifecycle:'RECORDED_TERMINAL'}];
  const r=run(s);denied(r);
  assert.equal(r.totals.cloudRunExecutions,1);
  assert.ok(!r.findings.includes('CLOUD_RUN_EXECUTION_ACTIVE_OR_UNVERIFIED'));
  has(r,'ACTUAL_UPLOAD_DRAIN_AND_GCS_GENERATION_PROOF_REQUIRED');
});
test('R584: forged, malformed, cross-job and duplicate execution evidence denied',()=>{
  for(const executions of [
    null,[{}],[{jobName:'urai-job',name:'invalid name',lifecycle:'RECORDED_TERMINAL'}],
    [{jobName:'urai-job',name:'run1',lifecycle:'COMPLETE'}],
    [{jobName:'urai-job',name:'run1',lifecycle:'RECORDED_TERMINAL'},
     {jobName:'urai-job',name:'run1',lifecycle:'ACTIVE_OR_UNVERIFIED'}]
  ]){
    const s=baseline();s.runJobs=[{name:'urai-job',serviceAccount:'job@urai-review-1.iam.gserviceaccount.com'}];s.runJobExecutions=executions;
    const r=run(s);denied(r);has(r,'CLOUD_RUN_EXECUTION_INVENTORY_MALFORMED');
  }
  const s=baseline();s.runJobs=[{name:'urai-job',serviceAccount:'job@urai-review-1.iam.gserviceaccount.com'}];
  s.runJobExecutions=[{jobName:'unrelated-job',name:'unrelated-job-001',lifecycle:'RECORDED_TERMINAL'}];
  const r=run(s);denied(r);has(r,'CLOUD_RUN_EXECUTION_JOB_OUTSIDE_INVENTORY');
});

// R586: original regional validation tests, combined with retained execution checks.
test('R584: wrong-region collection cannot stand in for approved region',()=>{
  const s=baseline();s.collectionRegion='us-east1';const r=run(s);denied(r);has(r,'EVIDENCE_REGION_MISMATCH_OR_MISSING');
});
test('R584: missing region in snapshot or expected scope fails closed',()=>{
  const s=baseline();delete s.collectionRegion;let r=run(s);denied(r);has(r,'EVIDENCE_REGION_MISMATCH_OR_MISSING');
  r=audit(baseline(),{projectId,bucket,now});denied(r);has(r,'EXPECTED_REGION_REQUIRED');
});
test('R584: fabricated global collection coverage cannot pass a regional audit',()=>{
  const s=baseline();s.collectorCoverage='ALL_REGIONS_EFFECTIVE_IAM_VERIFIED';
  const r=run(s);denied(r);has(r,'COLLECTOR_COVERAGE_UNVERIFIED');
});
test('R584: duplicate Cloud Run services and revisions are denied',()=>{
  const s=baseline();s.runServices.push({...s.runServices[0]});let r=run(s);denied(r);has(r,'DUPLICATE_CLOUD_RUN_SERVICE_INVENTORY');
  const t=baseline();t.revisionInventory.push({...t.revisionInventory[0]});r=run(t);denied(r);has(r,'DUPLICATE_HISTORIC_REVISION_INVENTORY');
});
test('R584: correctly bound region still cannot approve effective IAM',()=>{
  const r=run(baseline());denied(r);
  has(r,'REGIONAL_CAPTURE_CANNOT_PROVE_GLOBAL_RUNTIME_OR_IAM');
  has(r,'AFTER_REVOKE_OLD_IDENTITY_NEGATIVE_GCS_TEST_REQUIRED');
});
test('R584: region-required CLI never returns success for fake evidence',()=>{
  const dir=mkdtempSync(join(tmpdir(),'urai-r584-'));
  try{
    const path=join(dir,'snapshot.json');writeFileSync(path,JSON.stringify(baseline()));
    const script=fileURLToPath(new URL('./review-only/studio-storage-iam-snapshot-audit.mjs',import.meta.url));
    const missing=spawnSync(process.execPath,[script,'--snapshot',path,'--project',projectId,'--bucket',bucket],{encoding:'utf8'});
    assert.equal(missing.status,2);assert.match(missing.stderr,/--region/);
    const wrong=spawnSync(process.execPath,[script,'--snapshot',path,'--project',projectId,'--bucket',bucket,'--region','us-east1'],{encoding:'utf8'});
    assert.equal(wrong.status,2);assert.match(wrong.stdout,/EVIDENCE_REGION_MISMATCH_OR_MISSING/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('R586: actual retained-execution collector marker with matching region is recognized but never authorizes',()=>{
 const s=baseline(); s.runJobs=[{name:'urai-job',serviceAccount:'job@urai-review-1.iam.gserviceaccount.com'}];
 s.runJobExecutions=[{jobName:'urai-job',name:'urai-job-00001',lifecycle:'ACTIVE_OR_UNVERIFIED'}];
 const r=run(s);denied(r);
 has(r,'CLOUD_RUN_EXECUTION_ACTIVE_OR_UNVERIFIED');
 has(r,'REGIONAL_CAPTURE_CANNOT_PROVE_GLOBAL_RUNTIME_OR_IAM');
 has(r,'RETAINED_JOB_EXECUTIONS_NOT_FULL_HISTORICAL_OR_UPLOAD_DRAIN_PROOF');
 assert.equal(r.totals.cloudRunExecutions,1);
 assert.ok(!r.findings.includes('COLLECTOR_COVERAGE_UNVERIFIED'));
});
