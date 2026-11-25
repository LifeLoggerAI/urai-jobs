import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateGrant, assertGrantApplicationAuthority, grantDigest, documentId } from './private-source-grant-provision.mjs';
const fixture=JSON.parse(fs.readFileSync('scripts/fixtures/private-source-grant.synthetic.json','utf8'));
let passed=0;
const test=(name,run)=>{run();passed++;console.log('[PASS] '+name);};
test('synthetic fixture validates only as explicit dry-run review material',()=>{
  assert.equal(validateGrant(fixture).fixtureOnly,true);assert.equal(grantDigest(fixture),grantDigest({...fixture}));
  assert.match(documentId(fixture.sourceReceiptRef),/^[a-f0-9]{64}$/);
});
for(const [name,patch] of [
  ['schema',{schemaVersion:'foreign'}],['owner',{ownerUid:'../foreign'}],['receipt',{sourceReceiptRef:'foreign'}],
  ['handle',{sourceHandle:'foreign'}],['status',{status:'REVOKED'}],['synthetic',{synthetic:true}],
  ['evidence',{sourceEvidenceClass:'UNKNOWN'}],['fixity',{sourceFixityRef:'https://public.invalid/bytes'}],
  ['checksum',{sourceSha256:'wrong'}],['bytes',{sourceByteLength:0}],['byte budget',{sourceByteLength:2*1024**3+1}],
  ['revision',{sourceRevision:0}],['purposes',{purposes:['unknown']}],['duplicates',{purposes:['reconstruct-place','reconstruct-place']}],
  ['dual consent',{consents:[fixture.consents[0]]}],['duplicate consent',{consents:[fixture.consents[0],fixture.consents[0]]}],
  ['transcription storage',{purposes:['transcribe']}],
])test('invalid '+name+' denied',()=>assert.throws(()=>validateGrant({...fixture,...patch})));
test('fixture application denied even with feature and project configured',()=>{
  assert.throws(()=>assertGrantApplicationAuthority(fixture,{URAI_PRIVATE_SOURCE_GRANT_PROVISION_ENABLED:'true',FIREBASE_PROJECT_ID:'demo-synthetic'}),/dry-run-only/);
});
test('real application remains feature and project gated',()=>{
  const real={...fixture,fixtureOnly:false};assert.throws(()=>assertGrantApplicationAuthority(real,{}));
  assert.throws(()=>assertGrantApplicationAuthority(real,{URAI_PRIVATE_SOURCE_GRANT_PROVISION_ENABLED:'true'}));
});
test('actual CLI dry-run loads no Firebase or ADC',()=>{
  const r=spawnSync(process.execPath,['scripts/private-source-grant-provision.mjs','--input','scripts/fixtures/private-source-grant.synthetic.json'],{encoding:'utf8',env:{...process.env,NODE_PATH:''},timeout:5000});
  assert.equal(r.status,0,r.stderr);const receipt=JSON.parse(r.stdout);assert.equal(receipt.mode,'dry-run');assert.equal(receipt.fixtureOnly,true);
});
test('actual CLI configured apply refuses synthetic input before SDK or ADC',()=>{
  const r=spawnSync(process.execPath,['scripts/private-source-grant-provision.mjs','--input','scripts/fixtures/private-source-grant.synthetic.json','--apply'],{encoding:'utf8',env:{...process.env,NODE_PATH:'',URAI_PRIVATE_SOURCE_GRANT_PROVISION_ENABLED:'true',FIREBASE_PROJECT_ID:'demo-synthetic'},timeout:5000});
  assert.notEqual(r.status,0);assert.match(r.stderr,/synthetic fixture is dry-run-only/);assert.doesNotMatch(r.stderr,/Cannot find module|credential|network/i);
});
console.log(JSON.stringify({kind:'actual-private-source-grant-validator-and-CLI',passed,providerCalls:0,cloudWrites:0,syntheticApplyAuthorized:false}));

// Exercise the actual CLI retained-write path, including transactional withdrawal.
await import('./private-source-grant-admission-races.test.mjs');
