import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  SCHEMA, CONSENT, validateStagingManifest, assertExplicitStagingOptIn,
  makeSentinel, buildGcsInsertUrl, runStagingDenialReview,
} from './review-only/staging-gcs-write-denial-probe.mjs';

const NOW=1794050000000;
const SOURCE='a197350875182deaf5202872436816e0bbd36cf4';
const legacy='legacy-worker@urai-private-staging-test.iam.gserviceaccount.com';
const alt='alternate-writer@other-staging-test.iam.gserviceaccount.com';
function manifest() {
  return {schemaVersion:SCHEMA,environment:'STAGING',projectId:'urai-private-staging-test',
    bucket:'urai-private-staging-test-bucket',probePrefix:'__urai_security_staging__/post-revocation-denial/',
    authorizationRef:'R865-review-approved-123',withdrawalEventId:'withdraw-event-123',
    withdrawalCommittedAt:'2026-11-07T05:00:00.000Z',expectedJobsSourceSha:SOURCE,
    serviceAccounts:[{email:legacy,kind:'retired-writer',identityEvidenceRef:'IAM-LEGACY-001'},
      {email:alt,kind:'alternate-writer',identityEvidenceRef:'IAM-ALT-001'}]};
}
function options(fetchImpl, getCredential=async()=> 'ya29.'+'x'.repeat(60)) {
  return { nowMs:NOW, sourceSha:SOURCE, execute:true, env:{URAI_GCS_STAGING_NEGATIVE_PROBE_CONSENT:CONSENT},
    random:()=>Buffer.alloc(16,7), getCredential, fetchImpl };
}
function response(status) { return {status}; }

test('requires staging project, staging bucket, exact opt-in and committed withdrawal',()=>{
  assert.equal(validateStagingManifest(manifest(),NOW).serviceAccounts.length,2);
  for(const key of ['projectId','bucket']){
    let m=manifest();m[key]='urai-production';assert.throws(()=>validateStagingManifest(m,NOW),/INVALID_STAGING_MANIFEST/);
    m=manifest();m[key]='urai-4dc1d';assert.throws(()=>validateStagingManifest(m,NOW),/INVALID_STAGING_MANIFEST/);
  }
  for(const bad of ['PRODUCTION','DEV','']){const m=manifest();m.environment=bad;assert.throws(()=>validateStagingManifest(m,NOW),/INVALID_STAGING_MANIFEST/)}
  const m=manifest();m.withdrawalCommittedAt='2026-11-08T05:00:00.000Z';assert.throws(()=>validateStagingManifest(m,NOW),/REVOCATION_NOT_COMMITTED_BEFORE_PROBE/);
  assert.throws(()=>assertExplicitStagingOptIn({execute:true},{}),/NOT_AUTHORIZED/);
  assert.throws(()=>assertExplicitStagingOptIn({execute:false},{URAI_GCS_STAGING_NEGATIVE_PROBE_CONSENT:CONSENT}),/NOT_AUTHORIZED/);
});

test('rejects duplicate, foreign-form, incomplete or proto-mutated service account inventories',()=>{
  for(const bad of [[],[{email:alt,kind:'alternate-writer',identityEvidenceRef:'IAM-ALT-001'}],
    [{email:'user@gmail.com',kind:'retired-writer',identityEvidenceRef:'IAM-LEGACY-001'}],
    [{email:legacy,kind:'retired-writer',identityEvidenceRef:'IAM-LEGACY-001'},{email:legacy,kind:'alternate-writer',identityEvidenceRef:'IAM-ALT-001'}]]){
    const m=manifest();m.serviceAccounts=bad;assert.throws(()=>validateStagingManifest(m,NOW),/INVALID_PRINCIPAL_INVENTORY/);
  }
  const m=manifest();m.serviceAccounts[0]={...m.serviceAccounts[0],canWrite:true};assert.throws(()=>validateStagingManifest(m,NOW),/INVALID_STAGING_MANIFEST/);
  const proto=Object.create({authorized:true});Object.assign(proto,manifest());assert.throws(()=>validateStagingManifest(proto,NOW),/INVALID_STAGING_MANIFEST/);
});

test('builds only zero-generation conditional unique staging object names',()=>{
  const m=validateStagingManifest(manifest(),NOW);
  const name=makeSentinel(m,NOW,()=>Buffer.alloc(16,5));
  assert.match(name,/^__urai_security_staging__\/post-revocation-denial\/1794050000000-05050505[0-9a-f]+\.empty$/);
  assert.ok(!name.includes('tenants/'));
  const url=new URL(buildGcsInsertUrl(m.bucket,name));
  assert.equal(url.hostname,'storage.googleapis.com');
  assert.equal(url.pathname,'/upload/storage/v1/b/'+m.bucket+'/o');
  assert.equal(url.searchParams.get('uploadType'),'media');
  assert.equal(url.searchParams.get('ifGenerationMatch'),'0');
  assert.equal(url.searchParams.get('name'),name);
  assert.throws(()=>makeSentinel(m,NOW,()=>Buffer.alloc(1)),/INVALID_PROBE_NONCE/);
});

test('two authenticated 403s are scoped observations and NEVER an IAM certification or GO',async()=>{
  const seen=[];
  const res=await runStagingDenialReview(manifest(),options(async(url,request)=>{
    seen.push({url,request});return response(403);
  }));
  assert.equal(seen.length,2);
  for(const r of seen){
    assert.equal(r.request.method,'POST');assert.equal(r.request.redirect,'error');
    assert.equal(r.request.body.length,0);assert.equal(r.request.headers['content-length'],'0');
    assert.match(r.request.headers.authorization,/^Bearer ya29/);
    assert.match(r.url,/ifGenerationMatch=0/);
  }
  assert.equal(res.status,'STAGING_403_OBSERVED_HOLD');
  assert.deepEqual(res.results.map(x=>x.outcome),['DENIED_OBSERVED','DENIED_OBSERVED']);
  assert.equal(res.productionAuthorized,false);assert.equal(res.productionGo,false);
  assert.equal(res.storageWriteFenceVerified,false);assert.equal(res.privateOutputDeletionAcknowledged,false);
  assert.equal(res.effectiveIamVerified,false);assert.equal(res.principalCoverage,'MANIFEST_ONLY_NOT_EXHAUSTIVE');
  assert.ok(!JSON.stringify(res).includes('ya29.'));
  assert.ok(!JSON.stringify(res).includes(legacy));
});

test('credential failure and authentication/route failures never become 403 proof',async()=>{
  let calls=0;
  const r=await runStagingDenialReview(manifest(),options(async()=>{calls++;return response(401);},
    async(email)=>{if(email===legacy)throw Error('SECRET fail');return 'ya29.'+'x'.repeat(60)}));
  assert.equal(calls,1);
  assert.deepEqual(r.results.map(x=>x.outcome),['TOKEN_UNAVAILABLE','UNVERIFIED_RESPONSE']);
  assert.equal(r.status,'BLOCKED_HOLD');
  assert.ok(!JSON.stringify(r).includes('SECRET'));
  assert.equal(r.productionGo,false);
});

test('an unexpected successful zero-byte upload remains a critical HOLD and demands cleanup',async()=>{
  const res=await runStagingDenialReview(manifest(),options(async()=>response(200)));
  assert.equal(res.status,'BLOCKED_HOLD');
  assert.equal(res.results[0].outcome,'WRITE_WAS_ALLOWED');
  assert.equal(res.results[0].cleanupRequired,true);
  assert.equal(res.privateOutputDeletionAcknowledged,false);
  assert.equal(res.productionAuthorized,false);
});

test('failed network or malformed GCS response cannot be confused with denial',async()=>{
  const net=await runStagingDenialReview(manifest(),options(async()=>{throw Error('credential details');}));
  assert.deepEqual(net.results.map(x=>x.outcome),['TRANSPORT_UNVERIFIED']);
  assert.equal(net.results[0].cleanupRequired,true);
  assert.ok(!JSON.stringify(net).includes('credential details'));
  const mal=await runStagingDenialReview(manifest(),options(async()=>({status:'403'})));
  assert.deepEqual(mal.results.map(x=>x.outcome),['UNVERIFIED_RESPONSE']);
  assert.equal(mal.results[0].cleanupRequired,true);
});

test('source mismatch and missing explicit gate make zero credential and HTTP calls',async()=>{
  let calls=0;
  const deps=options(async()=>{calls++;return response(403)},async()=>{calls++;return 'ya29.'+'x'.repeat(60)});
  deps.sourceSha='f'.repeat(40);
  await assert.rejects(runStagingDenialReview(manifest(),deps),/SOURCE_OR_PROBE_DEPENDENCIES_UNVERIFIED/);
  deps.sourceSha=SOURCE;deps.env={};
  await assert.rejects(runStagingDenialReview(manifest(),deps),/STAGING_NETWORK_PROBE_NOT_AUTHORIZED/);
  assert.equal(calls,0);
});

test('CLI with no approved private manifest and opt-in fails closed before network',()=>{
  const file=fileURLToPath(new URL('./review-only/staging-gcs-write-denial-probe.mjs',import.meta.url));
  const p=spawnSync(process.execPath,[file],{encoding:'utf8',env:{PATH:process.env.PATH},timeout:10000});
  assert.equal(p.status,2);
  assert.match(p.stderr,/EXPLICIT_CLI_SCOPE_REQUIRED/);
  assert.doesNotMatch(p.stdout+p.stderr,/Bearer |ya29\./);
});

test('durable onPrepared is invoked before any credential or network access',async()=>{
  const stages=[];
  const deps=options(async()=>{stages.push('network');return response(403);},async()=>{stages.push('token');return 'ya29.'+'x'.repeat(60)});
  deps.onPrepared=async a=>{assert.match(a.objectName,/\.empty$/);stages.push('durable:'+a.objectName);};
  deps.onResult=async a=>{assert.equal(a.outcome,'DENIED_OBSERVED');stages.push('result');};
  const out=await runStagingDenialReview(manifest(),deps);
  assert.equal(out.status,'STAGING_403_OBSERVED_HOLD');
  assert.equal(stages.length,8);
  assert.match(stages[0],/^durable:/);assert.equal(stages[1],'token');assert.equal(stages[2],'network');assert.equal(stages[3],'result');
});

test('failure to durably record attempt prevents all credential and HTTP operations',async()=>{
  let count=0;
  const deps=options(async()=>{count++;return response(403)},async()=>{count++;return 'ya29.'+'x'.repeat(60)});
  deps.onPrepared=async()=>{throw Error('DISK_FULL');};
  await assert.rejects(runStagingDenialReview(manifest(),deps),/DISK_FULL/);
  assert.equal(count,0);
});

test('unexpected allowed write short-circuits other principals',async()=>{
  let called=0;
  const result=await runStagingDenialReview(manifest(),options(async()=>{called++;return response(201)}));
  assert.equal(called,1);
  assert.equal(result.results.length,1);
  assert.equal(result.results[0].cleanupRequired,true);
  assert.equal(result.status,'BLOCKED_HOLD');
});

test('R866 append-only audit journal retains prepared sentinel after forced process death',async()=>{
  const { mkdtempSync, readFileSync, rmSync }=await import('node:fs');
  const { tmpdir }=await import('node:os');
  const { join }=await import('node:path');
  const dir=mkdtempSync(join(tmpdir(),'urai-r866-journal-'));
  const file=join(dir,'one-attempt.jsonl');
  const moduleUrl=new URL('./review-only/staging-gcs-write-denial-probe.mjs',import.meta.url).href;
  try{
    const child=spawnSync(process.execPath,['--input-type=module','-e',`
      import {openSync,closeSync,constants} from 'node:fs';
      import {appendReviewOnlyAuditEvent} from ${JSON.stringify(moduleUrl)};
      const fd=openSync(${JSON.stringify(file)},constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_APPEND,0o600);
      appendReviewOnlyAuditEvent(fd,{type:'STARTED_INCOMPLETE',sequence:1,productionGo:false});
      appendReviewOnlyAuditEvent(fd,{type:'PREPARED_BEFORE_NETWORK',sequence:2,objectName:'__urai_security_staging__/post-revocation-denial/known-empty.empty',productionGo:false});
      process.kill(process.pid,'SIGKILL');
    `],{encoding:'utf8',timeout:10000});
    assert.equal(child.signal,'SIGKILL');
    const rows=readFileSync(file,'utf8').trimEnd().split('\n').map(x=>JSON.parse(x));
    assert.deepEqual(rows.map(x=>x.type),['STARTED_INCOMPLETE','PREPARED_BEFORE_NETWORK']);
    assert.match(rows[1].objectName,/known-empty\.empty$/);
    assert.equal(rows.every(x=>x.productionGo===false),true);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('R866 later audit appends never replace earlier sentinel evidence',async()=>{
  const { mkdtempSync, openSync, closeSync, readFileSync, rmSync, constants }=await import('node:fs');
  const { tmpdir }=await import('node:os');
  const { join }=await import('node:path');
  const { appendReviewOnlyAuditEvent }=await import('./review-only/staging-gcs-write-denial-probe.mjs');
  const dir=mkdtempSync(join(tmpdir(),'urai-r866-append-'));
  try{
    const file=join(dir,'journal.jsonl');
    const fd=openSync(file,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_APPEND,0o600);
    appendReviewOnlyAuditEvent(fd,{type:'PREPARED_BEFORE_NETWORK',sequence:1,objectName:'survives'});
    appendReviewOnlyAuditEvent(fd,{type:'HTTP_RESULT',sequence:2,outcome:'WRITE_WAS_ALLOWED',cleanupRequired:true});
    appendReviewOnlyAuditEvent(fd,{type:'INCOMPLETE_BLOCKED',sequence:3,productionGo:false});
    closeSync(fd);
    const rows=readFileSync(file,'utf8').trim().split('\n').map(s=>JSON.parse(s));
    assert.equal(rows.length,3);
    assert.equal(rows[0].objectName,'survives');
    assert.equal(rows[1].cleanupRequired,true);
    assert.equal(rows[2].productionGo,false);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('R866 production CLI uses append-only fsync journal and refuses rewrite',async()=>{
  const {readFileSync}=await import('node:fs');
  const src=readFileSync(new URL('./review-only/staging-gcs-write-denial-probe.mjs',import.meta.url),'utf8');
  assert.match(src,/constants\.O_APPEND/);
  assert.match(src,/constants\.O_EXCL/);
  assert.match(src,/fsyncSync\(fd\)/);
  assert.match(src,/append\('PREPARED_BEFORE_NETWORK'/);
  assert.match(src,/append\('FINISHED_HOLD'/);
  assert.doesNotMatch(src,/ftruncateSync\(/);
  assert.match(src,/info\.isSymbolicLink\(\)/);
});


test('R867 after-request network loss may have committed bytes; record cleanup and stop immediately',async()=>{
  let sent=0, prepared=[],recorded=[];
  const deps=options(async(_url,request)=>{
    sent++;
    assert.equal(request.method,'POST');
    assert.equal(request.body.length,0);
    // A real endpoint can persist the object and then the connection dies.
    throw new Error('ECONNRESET after possible object commit');
  });
  deps.onPrepared=async rec=>prepared.push(rec);
  deps.onResult=async rec=>recorded.push(rec);
  const out=await runStagingDenialReview(manifest(),deps);
  assert.equal(sent,1,'do not risk more probes after ambiguous remote write');
  assert.equal(prepared.length,1);
  assert.equal(recorded.length,1);
  assert.equal(recorded[0].objectName,prepared[0].objectName);
  assert.equal(recorded[0].outcome,'TRANSPORT_UNVERIFIED');
  assert.equal(recorded[0].cleanupRequired,true);
  assert.equal(out.productionGo,false);
  assert.equal(out.privateOutputDeletionAcknowledged,false);
  assert.equal(out.status,'BLOCKED_HOLD');
  assert.ok(!JSON.stringify(out).includes('ECONNRESET'));
});

test('R867 any successful 2xx upload means WRITE_WAS_ALLOWED and requires cleanup',async()=>{
  for(const status of [200,201,202,204,206,299]){
    let seen=0;
    const out=await runStagingDenialReview(manifest(),options(async()=>{seen++;return response(status)}));
    assert.equal(seen,1,'must stop after write: '+status);
    assert.deepEqual(out.results.map(r=>r.outcome),['WRITE_WAS_ALLOWED']);
    assert.equal(out.results[0].cleanupRequired,true);
    assert.equal(out.status,'BLOCKED_HOLD');
    assert.equal(out.privateOutputDeletionAcknowledged,false);
  }
});

test('R867 412 or 401 may not prove a new object; require inspection and never probe more',async()=>{
  for(const status of [401,404,409,412,429,500]){
    let seen=0;
    const result=await runStagingDenialReview(manifest(),options(async()=>{seen++;return response(status)}));
    assert.equal(seen,1,'stop after ambiguous response: '+status);
    assert.equal(result.results[0].outcome,'UNVERIFIED_RESPONSE');
    assert.equal(result.results[0].cleanupRequired,true);
    assert.equal(result.storageWriteFenceVerified,false);
    assert.equal(result.privateOutputDeletionAcknowledged,false);
  }
});

test('R867 confirmed 403 is the only post-request status permitting next identity',async()=>{
  let count=0;
  const result=await runStagingDenialReview(manifest(),options(async()=>{count++;return response(403)}));
  assert.equal(count,2);
  assert.equal(result.status,'STAGING_403_OBSERVED_HOLD');
  assert.deepEqual(result.results.map(r=>r.cleanupRequired),[false,false]);
  assert.equal(result.productionGo,false);
});
