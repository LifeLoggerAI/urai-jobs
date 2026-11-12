import test from 'node:test';
import assert from 'node:assert/strict';
import { assessStagingWriterPolicy as assess, DENIED } from './r1113-staging-writer-policy-preflight.mjs';
const project='urai-security-canary-test1234';
const broker=`serviceAccount:broker@${project}.iam.gserviceaccount.com`;
const other=`serviceAccount:oldworker@${project}.iam.gserviceaccount.com`;
const base=()=>({
  projectId:project, bucket:`${project}-private`, broker,
  bucketConfig:{publicAccessPrevention:'enforced',uniformBucketLevelAccess:true},
  projectPolicy:{bindings:[]},
  bucketPolicy:{bindings:[{role:'roles/storage.objectAdmin',members:[broker]}]}
});
const deny=fn=>assert.throws(fn,new RegExp(DENIED));
test('narrow canary writer is structurally clean but NEVER release-approved',()=>{
  const v=assess(base());
  assert.equal(v.structuralPreflightPass,true);
  assert.equal(v.writerPrincipalCount,1);
  assert.equal(v.brokerWriterBindings,1);
  assert.equal(v.brokerBucketObjectAdminBindings,1);
  for(const field of ['effectiveIamExclusivityVerified','providerPrincipalIdentityVerified','deniedWriterHttp403Verified','authorizedBrokerCreateReadDeleteVerified','uploadDrainVerified','deletionAcknowledged','privateMediaWritesEnabled','productionAuthorized','launchApproved'])assert.equal(v[field],false,field);
  assert.equal(v.independentProviderReview,'REQUIRED_NOT_PERFORMED');
  assert.equal(JSON.stringify(v).includes('broker@'),false);
});
test('project-wide storage.admin inherited by another identity is a blocker',()=>{
  const x=base();x.projectPolicy.bindings.push({role:'roles/storage.admin',members:[other]});
  const v=assess(x);assert.equal(v.structuralPreflightPass,false);
  assert.equal(v.otherWriterBindings,1);assert.ok(v.blockers.includes('NON_BROKER_WRITE_CAPABILITY'));
  assert.equal(JSON.stringify(v).includes('oldworker@'),false);
});
test('legacy basic project editor or bucket owner are both writer blockers',()=>{
  for(const role of ['roles/editor','roles/storage.legacyBucketOwner','roles/storage.legacyObjectOwner']){
    const x=base();x.projectPolicy.bindings.push({role,members:[other]});
    assert.ok(assess(x).blockers.includes('NON_BROKER_WRITE_CAPABILITY'),role);
  }
});
test('Firebase default staging and production projects are never approved canary targets',()=>{
  for(const id of ['urai-staging','urai-4dc1d','urai-security-canary-x']){
    const x=base();x.projectId=id;x.bucket=`${id}-private`;deny(()=>assess(x));
  }
});
test('public principal and disabled PAP / uniform setting are blockers',()=>{
  const x=base();x.bucketPolicy.bindings.push({role:'roles/storage.objectViewer',members:['allUsers']});
  x.bucketConfig={publicAccessPrevention:'inherited',uniformBucketLevelAccess:false};
  const v=assess(x);assert.ok(v.blockers.includes('PUBLIC_PRINCIPAL_BINDING'));
  assert.ok(v.blockers.includes('PUBLIC_ACCESS_PREVENTION_NOT_ENFORCED'));
  assert.ok(v.blockers.includes('UNIFORM_BUCKET_ACCESS_NOT_ENABLED'));
});
test('unknown custom/service roles are not assumed safe',()=>{
  const x=base();x.projectPolicy.bindings.push({role:'projects/test/roles/customStorageWriter',members:[other]});
  const v=assess(x);assert.equal(v.unknownRoleBindings,1);
  assert.ok(v.blockers.includes('UNKNOWN_ROLE_PERMISSIONS'));
});
test('conditional binding is not treated as conclusive exclusion',()=>{
  const x=base();x.bucketPolicy.bindings[0].condition={title:'business-hours',expression:'request.time < timestamp("2028-01-01T00:00:00Z")'};
  const v=assess(x);assert.equal(v.conditionalBindings,1);
  assert.ok(v.blockers.includes('IAM_CONDITIONS_REQUIRE_PROVIDER_EVALUATION'));
});
test('malformed role grants fail closed instead of hiding permission risk',()=>{
  for(const bad of [null,{bindings:null},{bindings:[{role:'roles/storage.admin'}]},{bindings:[{role:42,members:[]}]}]){
    const x=base();x.projectPolicy=bad;deny(()=>assess(x));
  }
});
test('missing broker write binding blocks even without alternate writers',()=>{
  const x=base();x.bucketPolicy={bindings:[]};
  assert.ok(assess(x).blockers.includes('NO_BROKER_WRITE_BINDING'));
});
test('project-wide broker Storage Admin cannot pass even if bucket-scoped objectAdmin exists',()=>{
  const x=base();x.projectPolicy.bindings.push({role:'roles/storage.admin',members:[broker]});
  const v=assess(x);assert.equal(v.structuralPreflightPass,false);
  assert.equal(v.writerPrincipalCount,1);assert.equal(v.brokerWriterBindings,2);
  assert.equal(v.brokerBucketObjectAdminBindings,1);
  assert.ok(v.blockers.includes('BROKER_PROJECT_WIDE_WRITE_NOT_LEAST_PRIVILEGE'));
  assert.equal(v.effectiveIamExclusivityVerified,false);
});
test('bucket objectCreator alone cannot satisfy generation-readback and delete',()=>{
  const x=base();x.bucketPolicy.bindings[0].role='roles/storage.objectCreator';
  const v=assess(x);assert.equal(v.structuralPreflightPass,false);
  assert.equal(v.brokerWriterBindings,1);
  assert.equal(v.brokerBucketObjectAdminBindings,0);
  assert.ok(v.blockers.includes('BROKER_BUCKET_CREATE_READ_DELETE_REQUIRED'));
  assert.ok(v.blockers.includes('BROKER_WRITE_ROLE_INSUFFICIENT_OR_OVERBROAD'));
  assert.equal(v.productionAuthorized,false);
});
test('project-wide broker grant alone never substitutes for narrow bucket writer',()=>{
  const x=base();x.bucketPolicy.bindings=[];
  x.projectPolicy.bindings.push({role:'roles/storage.admin',members:[broker]});
  const v=assess(x);assert.equal(v.structuralPreflightPass,false);
  assert.equal(v.brokerWriterBindings,1);
  assert.equal(v.brokerBucketObjectAdminBindings,0);
  assert.ok(v.blockers.includes('BROKER_PROJECT_WIDE_WRITE_NOT_LEAST_PRIVILEGE'));
  assert.ok(v.blockers.includes('BROKER_BUCKET_CREATE_READ_DELETE_REQUIRED'));
});
test('untrusted binding source field cannot disguise a broad project grant',()=>{
  const x=base();
  x.projectPolicy.bindings.push({role:'roles/storage.admin',members:[broker],source:'bucket'});
  const v=assess(x);assert.equal(v.structuralPreflightPass,false);
  assert.ok(v.blockers.includes('BROKER_PROJECT_WIDE_WRITE_NOT_LEAST_PRIVILEGE'));
  assert.equal(v.brokerBucketObjectAdminBindings,1);
});
test('bucket-scoped legacy owner grant to broker remains overbroad',()=>{
  const x=base();x.bucketPolicy.bindings[0].role='roles/storage.legacyBucketOwner';
  const v=assess(x);assert.equal(v.structuralPreflightPass,false);
  assert.ok(v.blockers.includes('BROKER_WRITE_ROLE_INSUFFICIENT_OR_OVERBROAD'));
  assert.equal(v.providerPrincipalIdentityVerified,false);
});
