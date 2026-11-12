import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSeparationScope,probeWriterSeparation,DENIED} from './r1088-writer-separation-canary.mjs';
import {APPROVAL as N} from './r1040-gcs-negative-data-plane-proof.mjs';
import {APPROVAL as P} from './r1075-gcs-positive-generation-canary.mjs';
const project='urai-security-canary-test1234',bucket=project+'-private';
const broker='broker@'+project+'.iam.gserviceaccount.com';
const principal=name=>name+'@'+project+'.iam.gserviceaccount.com';
const scope=()=>({
  positive:{approval:P,projectId:project,bucket,claimedBrokerPrincipal:broker},
  legacy:{approval:N,projectId:project,bucket,claimedPrincipal:principal('oldwriter'),role:'legacy'},
  alternate:{approval:N,projectId:project,bucket,claimedPrincipal:principal('otherwriter'),role:'alternate'}
});
const tokens={brokerToken:'synthetic-broker-token',legacyToken:'synthetic-legacy-token',alternateToken:'synthetic-alternate-token'};
const nonces=['a'.repeat(32),'b'.repeat(32),'c'.repeat(32)];
const fail=x=>assert.rejects(x,new RegExp(DENIED));
function transport(override={}){
  const calls=[];
  const send=async(url,opt)=>{
    calls.push({url,method:opt.method,token:opt.headers.Authorization,body:opt.body});
    const n=calls.length;
    if(override.throwAt===n)throw Error('secret '+tokens.brokerToken);
    if(n<=2)return {status:override[n]??403};
    const path='security-broker-positive/'+nonces[2]+'/generation-proof.bin';
    const meta={bucket,name:path,generation:'123456789012345678',size:'0'};
    if(n===3)return {status:override[n]??200,text:async()=>JSON.stringify(meta)};
    if(n===4)return {status:override[n]??200,text:async()=>JSON.stringify(meta)};
    if(n>=5&&n<=8)return {status:override[n]??403};
    if(n===9)return {status:override[n]??204};
    if(n===10)return {status:override[n]??404};
    throw Error('extra provider call');
  };
  return {send,calls};
}
const args=()=>({scope:scope(),...tokens,nonces});
test('all three staging scopes must share one disposable project/bucket and distinct principals',()=>{
  assert.equal(validateSeparationScope(scope()).positive.bucket,bucket);
  for(const edit of [
    s=>s.legacy.role='broker', s=>s.alternate.role='legacy',
    s=>s.alternate.projectId='urai-security-canary-different',
    s=>s.alternate.claimedPrincipal=s.legacy.claimedPrincipal,
    s=>s.legacy.bucket='urai-4dc1d.appspot.com',
    s=>s.positive.projectId='urai-4dc1d',
    s=>s.positive.claimedBrokerPrincipal=s.legacy.claimedPrincipal,
    s=>s.productionAuthorized=true
  ]){const s=scope();edit(s);assert.throws(()=>validateSeparationScope(s),new RegExp(DENIED));}
});
test('denied legacy + denied alternate precede broker create/read/delete/absence',async()=>{
  const t=transport();
  const r=await probeWriterSeparation({...args(),transport:t.send});
  assert.deepEqual(t.calls.map(x=>x.method),['POST','POST','POST','GET','GET','GET','GET','GET','DELETE','GET']);
  assert.deepEqual(t.calls.map(x=>x.token),[
    'Bearer '+tokens.legacyToken,'Bearer '+tokens.alternateToken,
    'Bearer '+tokens.brokerToken,'Bearer '+tokens.brokerToken,
    'Bearer '+tokens.legacyToken,'Bearer '+tokens.legacyToken,
    'Bearer '+tokens.alternateToken,'Bearer '+tokens.alternateToken,
    'Bearer '+tokens.brokerToken,'Bearer '+tokens.brokerToken]);
  assert.equal(t.calls[0].body.byteLength,0);
  assert.equal(t.calls[1].body.byteLength,0);
  assert.equal(t.calls[2].body.byteLength,0);
  for(const c of t.calls.slice(0,3)){
    const url=new URL(c.url);assert.equal(url.searchParams.get('ifGenerationMatch'),'0');
    assert.equal(url.hostname,'storage.googleapis.com');
  }
  assert.equal(r.verdict,'OBSERVED_STAGING_CANARY_SEQUENCE_IDENTITY_AND_IAM_UNVERIFIED');
  assert.equal(r.providerAuditReconciliation,'REQUIRED_NOT_PERFORMED');
  assert.equal(r.schema,'R1088_DISPOSABLE_WRITER_SEPARATION_V2');
  assert.equal(r.privateReadIsolationVerified,false);
  assert.equal(r.signedUrlAndCacheRevocationVerified,false);
  for(const key of ['legacyMetadataHttp403Observed','legacyMediaHttp403Observed',
    'alternateMetadataHttp403Observed','alternateMediaHttp403Observed'])
    assert.equal(r[key],true,key);
  assert.match(r.legacyClaimScopeDigest,/^[a-f0-9]{64}$/);
  assert.match(r.alternateClaimScopeDigest,/^[a-f0-9]{64}$/);
  assert.match(r.brokerClaimScopeDigest,/^[a-f0-9]{64}$/);
  assert.equal(new Set([r.legacyClaimScopeDigest,r.alternateClaimScopeDigest,r.brokerClaimScopeDigest]).size,3);
  assert.equal(r.brokerCanaryObjectName,'security-broker-positive/'+nonces[2]+'/generation-proof.bin');
  assert.equal(r.brokerCanaryObjectGeneration,'123456789012345678');
  for(const [k,v] of Object.entries(r)){
    if(typeof v==='boolean')assert.equal(v,/Observed$/.test(k),k);
  }
  for(const v of Object.values(tokens))assert.equal(JSON.stringify(r).includes(v),false);
});
test('legacy 200 or 201 halts before other probe or broker upload',async()=>{
  for(const status of [200,201]){const t=transport({1:status});await fail(probeWriterSeparation({...args(),transport:t.send}));assert.equal(t.calls.length,1);}
});
test('alternate writer unexpected authorization stops before broker',async()=>{
  const t=transport({2:201});await fail(probeWriterSeparation({...args(),transport:t.send}));
  assert.equal(t.calls.length,2);
});
test('403 may be missing bucket or identity mismatch and never certifies IAM',async()=>{
  const t=transport();const r=await probeWriterSeparation({...args(),transport:t.send});
  assert.equal(r.effectiveIamExclusivityVerified,false);
  assert.equal(r.providerPrincipalIdentityVerified,false);
  assert.equal(r.allInFlightUploadsDrained,false);
});
test('unexpected HTTP status at any step means HOLD',async()=>{
  for(const [n,status] of [[1,401],[2,404],[3,403],[4,500],
    [5,200],[6,404],[7,401],[8,200],[9,412],[10,200]]){
    const t=transport({[n]:status});await fail(probeWriterSeparation({...args(),transport:t.send}));
    assert.equal(t.calls.length,n);
  }
});
test('thrown upstream error never reveals credential value',async()=>{
  for(let i=1;i<=10;i++){
    const t=transport({throwAt:i});
    await assert.rejects(probeWriterSeparation({...args(),transport:t.send}),
      e=>e.message===DENIED&&!JSON.stringify(e).includes(tokens.brokerToken));
  }
});
test('missing, repeated, malformed credentials and nonce reuse stop all network calls',async()=>{
  const cases=[
    {brokerToken:''},{legacyToken:tokens.brokerToken},{alternateToken:'bad value'},
    {nonces:[nonces[0],nonces[0],nonces[2]]},
    {nonces:['bad',nonces[1],nonces[2]]},
    {nonces:[...nonces,'d'.repeat(32)]}
  ];
  for(const c of cases){const t=transport();await fail(probeWriterSeparation({...args(),...c,transport:t.send}));assert.equal(t.calls.length,0);}
});

test('external retired principal is allowed but remains an unverified identity claim',async()=>{
  const s=scope();
  // A retired service account can legitimately be owned by another GCP project.
  s.legacy.claimedPrincipal='retired@external-writer-project.iam.gserviceaccount.com';
  assert.equal(validateSeparationScope(s).legacy.claimedPrincipal,s.legacy.claimedPrincipal);
  const t=transport();
  const r=await probeWriterSeparation({...args(),scope:s,transport:t.send});
  assert.equal(t.calls.length,10);
  assert.equal(r.providerPrincipalIdentityVerified,false);
  assert.equal(r.effectiveIamExclusivityVerified,false);
  assert.equal(r.providerAuditReconciliation,'REQUIRED_NOT_PERFORMED');
  assert.notEqual(r.legacyClaimScopeDigest,r.brokerClaimScopeDigest);
});


test('retired and alternate metadata and media reads target one pinned live generation',async()=>{
  const t=transport(),r=await probeWriterSeparation({...args(),transport:t.send});
  const brokerRead=new URL(t.calls[3].url),generation=brokerRead.searchParams.get('generation');
  assert.equal(generation,'123456789012345678');
  for(const idx of [4,5,6,7]){
    const call=t.calls[idx],u=new URL(call.url);
    assert.equal(call.method,'GET');
    assert.equal(u.pathname,brokerRead.pathname);
    assert.equal(u.searchParams.get('generation'),generation);
    assert.equal(u.searchParams.get('alt'),idx===5||idx===7?'media':null);
    assert.equal(u.searchParams.has('ifGenerationMatch'),false);
  }
  assert.equal(t.calls[8].method,'DELETE');
  assert.equal(t.calls[9].method,'GET');
  assert.equal(r.privateReadIsolationVerified,false);
  assert.equal(r.signedUrlAndCacheRevocationVerified,false);
});
test('unauthorized metadata or media read 200/206/302/404/500 halts before deletion',async()=>{
  for(const idx of [5,6,7,8]){
    for(const status of [200,206,302,404,500]){
      const t=transport({[idx]:status});
      await fail(probeWriterSeparation({...args(),transport:t.send}));
      assert.equal(t.calls.length,idx);
      assert.equal(t.calls.some(c=>c.method==='DELETE'),false);
    }
  }
});
test('retired and alternate reader transport errors cannot leak bearer tokens',async()=>{
  for(const idx of [5,6,7,8]){
    const t=transport({throwAt:idx});
    await assert.rejects(probeWriterSeparation({...args(),transport:t.send}),e=>
      e.message===DENIED&&!JSON.stringify(e).includes(tokens.legacyToken)&&
      !JSON.stringify(e).includes(tokens.alternateToken));
    assert.equal(t.calls.length,idx);
    assert.equal(t.calls.some(c=>c.method==='DELETE'),false);
  }
});
