import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCombinedCanaryScope,probeCombinedDisposableGcsCanary,DENIED} from './r1221-combined-disposable-gcs-canary.mjs';
import {APPROVAL as NA} from './r1040-gcs-negative-data-plane-proof.mjs';
import {APPROVAL as PA} from './r1075-gcs-positive-generation-canary.mjs';
import {APPROVAL as SA,makeSessionCanaryTargets} from './r1122-gcs-session-cancel-canary.mjs';
const project='urai-security-canary-test1234',bucket=project+'-private';
const identity=n=>n+'@'+project+'.iam.gserviceaccount.com';
const scope=()=>({
 writerSeparation:{
  positive:{approval:PA,projectId:project,bucket,claimedBrokerPrincipal:identity('broker')},
  legacy:{approval:NA,projectId:project,bucket,claimedPrincipal:identity('retired'),role:'legacy'},
  alternate:{approval:NA,projectId:project,bucket,claimedPrincipal:identity('alternate'),role:'alternate'}
 },
 session:{approval:SA,projectId:project,bucket,claimedBrokerPrincipal:identity('broker')}
});
const tokens=()=>({broker:'synthetic-broker-bearer-not-real',legacy:'synthetic-retired-bearer-not-real',alternate:'synthetic-alt-bearer-not-real'});
const nonces=['a','b','c','d'].map(c=>c.repeat(32));
const fail=promise=>assert.rejects(promise,new RegExp(DENIED));
const meta=()=>({bucket,name:'security-broker-positive/'+nonces[2]+'/generation-proof.bin',generation:'123456789012345678',size:'0'});
function fakeTransport(overrides={}){
 const calls=[];const urlSession=makeSessionCanaryTargets(scope().session,nonces[3]).startUrl+'&upload_id=SYNTHETIC_UPLOAD_ID_12345';
 const scriptedMethods=['POST','POST','POST','GET','GET','GET','GET','GET','DELETE','GET','POST','DELETE','PUT','PUT','GET'];
 const defaultStatuses=[403,403,200,200,403,403,403,403,204,404,200,499,410,410,404];
 const transport=async(url,opts)=>{
  const n=calls.length;calls.push({url,method:opts?.method,headers:opts?.headers,body:opts?.body});
  if(overrides.throwAt===n)throw Error('Provider response included TOKEN SECRET and '+urlSession);
  if(opts?.method!==scriptedMethods[n])throw Error('mismatched probe sequencing');
  const status=Object.hasOwn(overrides,n)?overrides[n]:defaultStatuses[n];
  return {status,text:async()=>JSON.stringify(meta()),headers:{get:key=>key==='location'?urlSession:null}};
 };
 return {calls,transport};
}
function args(overrides={}){return {scope:scope(),tokens:tokens(),nonces, ...overrides};}
test('matching disposable project, bucket and broker identity validate',()=>{
 const v=validateCombinedCanaryScope(scope());
 assert.equal(v.writerSeparation.positive.bucket,v.session.bucket);
 assert.equal(v.session.claimedBrokerPrincipal,v.writerSeparation.positive.claimedBrokerPrincipal);
});
test('cross-project, cross-bucket, and cross-broker session never authorize requests',async()=>{
 for(const edit of [
 s=>s.session.projectId='urai-security-canary-different',
 s=>s.session.bucket='unrelated-bucket',
 s=>s.session.claimedBrokerPrincipal=identity('other'),
 s=>s.writerSeparation.positive.projectId='urai-4dc1d',
 s=>s.writerSeparation.alternate.claimedPrincipal=s.writerSeparation.positive.claimedBrokerPrincipal,
 s=>s.session.productionAuthorized=true,
 ]){
  const s=scope();edit(s);const t=fakeTransport();
  await fail(probeCombinedDisposableGcsCanary(args({scope:s,transport:t.transport})));
  assert.equal(t.calls.length,0);
 }
});
test('all credentials and distinct nonces checked before network access',async()=>{
 for(const edit of [
 t=>t.broker='too-short',t=>t.legacy=t.broker,t=>t.alternate='bad\ncredential'
 ]){
  const tks=tokens();edit(tks);const tr=fakeTransport();
  await fail(probeCombinedDisposableGcsCanary(args({tokens:tks,transport:tr.transport})));
  assert.equal(tr.calls.length,0);
 }
 for(const bad of [[...nonces.slice(0,3),nonces[2]],nonces.slice(0,3),['bad',...nonces.slice(1)]]){
  const tr=fakeTransport();await fail(probeCombinedDisposableGcsCanary(args({nonces:bad,transport:tr.transport})));
  assert.equal(tr.calls.length,0);
 }
});
test('writer separation completes before disposable session cancellation, all fifteen statuses checked',async()=>{
 const f=fakeTransport();const r=await probeCombinedDisposableGcsCanary(args({transport:f.transport}));
 assert.deepEqual(f.calls.map(x=>x.method),['POST','POST','POST','GET','GET','GET','GET','GET','DELETE','GET','POST','DELETE','PUT','PUT','GET']);
 assert.equal(f.calls[10].headers.Authorization,'Bearer '+tokens().broker);
 for(const i of [11,12,13])assert.equal(f.calls[i].headers.Authorization,undefined);
 assert.equal(f.calls[13].body.byteLength,1);
 assert.equal(r.schema,'R1221_COMBINED_DISPOSABLE_GCS_CANARY_V1');
 assert.equal(r.verdict,'OBSERVED_TWO_STAGING_CANARIES_NOT_PRODUCTION_CERTIFIED');
 assert.match(r.scopeDigest,/^[a-f0-9]{64}$/);
});
test('even successful mocked provider statuses never grant IAM, writes, deletion or release',async()=>{
 const f=fakeTransport();const r=await probeCombinedDisposableGcsCanary(args({transport:f.transport}));
 for(const [k,v] of Object.entries(r))if(typeof v==='boolean')
  assert.equal(v,k.startsWith('observedSynthetic')||k==='observedZeroByteBrokerGenerationAndPinnedDelete'||k==='observedSingleResumableSessionCancelled'||k==='observedSingleSessionResumeDenied',k);
 assert.equal(r.providerIamPolicyReconciled,false);
 assert.equal(r.preexistingResumableSessionsEnumerated,false);
 assert.equal(r.independentIdentityAttestation,false);
 assert.equal(r.customerGenerationDeletionAcknowledged,false);
 assert.equal(r.productionAuthorized,false);
 assert.equal(r.launchApproved,false);
 for(const t of Object.values(tokens()))assert.ok(!JSON.stringify(r).includes(t));
 assert.ok(!JSON.stringify(r).includes('upload_id'));
});
test('retired or alternate writer unexpectedly permitted aborts before broker and session',async()=>{
 for(const [n,status] of [[0,200],[0,201],[1,200],[1,201]]){
  const f=fakeTransport({[n]:status});await fail(probeCombinedDisposableGcsCanary(args({transport:f.transport})));
  assert.equal(f.calls.length,n+1);
 }
});
test('broker failed create/read/delete/absent or denied legacy object read aborts before session',async()=>{
 for(const [idx,code] of [[2,403],[3,404],[4,200],[5,200],[6,200],[7,200],[8,403],[9,200]]){
  const f=fakeTransport({[idx]:code});await fail(probeCombinedDisposableGcsCanary(args({transport:f.transport})));
  assert.ok(f.calls.length<=10);
 }
});
test('session initiation, cancellation or stale byte failure aborts fail closed',async()=>{
 for(const [idx,code] of [[10,403],[11,204],[11,404],[12,308],[12,200],[13,201],[13,200],[14,200],[14,403]]){
  const f=fakeTransport({[idx]:code});await fail(probeCombinedDisposableGcsCanary(args({transport:f.transport})));
  assert.equal(f.calls[0].method,'POST');
  assert.ok(f.calls.length>=11);
 }
});
test('transport exceptions never print credential or provider session location',async()=>{
 for(const idx of [0,8,10,12]){
  const f=fakeTransport({throwAt:idx});
  await assert.rejects(probeCombinedDisposableGcsCanary(args({transport:f.transport})),e=>{
   assert.equal(e.message,DENIED);
   for(const t of Object.values(tokens()))assert.ok(!e.message.includes(t));
   assert.ok(!e.message.includes('upload_id'));
   return true;
  });
 }
});
test('no production project, extra input fields or spoofed object scopes accepted',async()=>{
 const original=scope(),f=fakeTransport();
 for(const bad of [
  {...original,extra:true},
  {...original,session:{...original.session,bucket:'urai-4dc1d.appspot.com'}},
  {...original,writerSeparation:{...original.writerSeparation,positive:{...original.writerSeparation.positive,projectId:'urai-4dc1d'}}}
 ])await fail(probeCombinedDisposableGcsCanary(args({scope:bad,transport:f.transport})));
 assert.equal(f.calls.length,0);
});
