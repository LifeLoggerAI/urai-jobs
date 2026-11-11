import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const require = createRequire(import.meta.url);
const {
  inspectUntrustedPrivateOutputIntent,privateOutputBrokerCertified,
  submitPrivateOutputToExclusiveBroker,
} = require('../../workers/studio-worker/private-output-broker-boundary.js');
const source=readFileSync(new URL('../../workers/studio-worker/index.js',import.meta.url),'utf8');
const authority=readFileSync(new URL('../../workers/studio-worker/private-output-write-authority.js',import.meta.url),'utf8');
const DENIED=/life_movie_exclusive_storage_broker_intent_unverified/;
const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function claim(kind='studio.render.video',file) {
  const assembly=kind==='studio.assemble.video';
  const prefix='tenants/tenant1/life-movies/project1/'+(assembly?'final/':'render1/')+'attempt-'+uuid;
  const filename=file||(assembly?'life-movie-final.mp4':'life-movie.mp4');
  const mime={
    'life-movie.mp4':'video/mp4','life-movie.srt':'application/x-subrip',
    'life-movie.render-manifest.json':'application/json',
    'life-movie-final.mp4':'video/mp4','life-movie-final.srt':'application/x-subrip',
    'life-movie-final.assembly-manifest.json':'application/json',
  };
  return {
    ownerUid:'owner1',tenantId:'tenant1',projectId:'project1',jobId:'job1',
    jobType:kind,purpose:'life-movie.render',consentReceiptId:'a'.repeat(64),
    renderPlanDigest:'b'.repeat(64),sceneTruthDigest:'c'.repeat(64),
    sceneTruthReceiptRef:'str_'+'A'.repeat(16)+'_'+'a'.repeat(8)+'_'+'B'.repeat(40),
    attemptPrefix:prefix,bucketName:'synthetic-staging-private',
    destination:prefix+'/'+filename,localPath:'/tmp/synthetic-output.bin',
    contentType:mime[filename],expectedHash:'d'.repeat(64),
    signal:new AbortController().signal,
  };
}
const denied=x=>assert.throws(()=>inspectUntrustedPrivateOutputIntent(x),DENIED);
function allFalse(value) {
  assert.equal(value.evidenceClass,'REVIEW_ONLY_UNTRUSTED_WORKER_CLAIMS');
  assert.ok(Object.isFrozen(value));
  for(const key of ['productionAuthorized','storageWriteAuthorized','ownerConsentVerified',
    'currentRevocationEpochVerified','effectiveIamVerified','generationAcknowledged'])
    assert.equal(value[key],false,key);
}
test('R1066: six canonical render and assembly output shapes remain untrusted',()=>{
  for(const n of ['life-movie.mp4','life-movie.srt','life-movie.render-manifest.json'])
    allFalse(inspectUntrustedPrivateOutputIntent(claim('studio.render.video',n)));
  for(const n of ['life-movie-final.mp4','life-movie-final.srt','life-movie-final.assembly-manifest.json'])
    allFalse(inspectUntrustedPrivateOutputIntent(claim('studio.assemble.video',n)));
});
test('R1066: missing, extra, inherited, accessor and nonplain claims deny',()=>{
  denied({...claim(),positiveGrant:true});
  const missing=claim();delete missing.projectId;denied(missing);
  const getter=claim();Object.defineProperty(getter,'purpose',{get(){throw Error('secret');}});denied(getter);
  denied(Object.assign(Object.create({authorized:true}),claim()));
  denied(Object.assign([],{...claim()}));
});
test('R1066: owner, tenant, project, job and purpose are not trusted',()=>{
  for(const field of ['ownerUid','tenantId','projectId','jobId']){
    denied({...claim(),[field]:'../other'});
    denied({...claim(),[field]:''});
  }
  denied({...claim(),purpose:'other'});
  denied({...claim(),jobType:'studio.admin'});
});
test('R1066: malformed consent, render and scene digests deny',()=>{
  for(const field of ['consentReceiptId','renderPlanDigest','sceneTruthDigest','expectedHash']){
    denied({...claim(),[field]:'x'});
    denied({...claim(),[field]:'F'.repeat(64)});
  }
  denied({...claim(),sceneTruthReceiptRef:'forged'});
});
test('R1066: canonical output ownership, attempt and MIME must match claims',()=>{
  const x=claim();
  denied({...x,destination:'tenants/other/life-movies/project1/'+x.attemptPrefix.split('/').at(-1)+'/life-movie.mp4'});
  denied({...x,destination:x.attemptPrefix+'/../life-movie.mp4'});
  denied({...x,destination:x.attemptPrefix+'/life-movie-final.mp4'});
  denied({...x,attemptPrefix:'tenants/tenant1/life-movies/project1/../attempt-'+uuid});
  denied({...x,attemptPrefix:'tenants/tenant1/life-movies/project1/render1/attempt-invalid'});
  denied({...x,attemptPrefix:'tenants/tenant1/life-movies/project2/render1/attempt-'+uuid});
  denied({...x,contentType:'application/octet-stream'});
  denied({...claim('studio.assemble.video'),jobType:'studio.render.video'});
});
test('R1066: fake Storage locations and cancelled or spoofed signals fail',()=>{
  denied({...claim(),bucketName:'gs://outside'});
  denied({...claim(),localPath:'../../outside'});
  denied({...claim(),localPath:'/tmp/name\nforged'});
  const a=new AbortController();a.abort();
  denied({...claim(),signal:a.signal});
  denied({...claim(),signal:{aborted:false}});
});
test('R1066: two production worker call sites carry all untrusted scope fields',()=>{
  const parts=source.split('await submitPrivateOutputToExclusiveBroker({');
  assert.equal(parts.length,3);
  for(const p of parts.slice(1)){
    const end=p.indexOf('});');
    assert.ok(end>0);
    const intent=p.slice(0,end);
    for(const field of [
      'ownerUid: job.ownerUid','tenantId: job.tenantId','projectId: input.projectId',
      'jobId: job.jobId','jobType: job.jobType || job.type',
      "purpose: 'life-movie.render'",'consentReceiptId: job.consent?.decisionReceiptId',
      'renderPlanDigest: input.renderPlanDigest','sceneTruthDigest: input.sceneTruthDigest',
      'sceneTruthReceiptRef: input.sceneTruthReceiptRef','attemptPrefix','bucketName',
      'destination','localPath','contentType','expectedHash','signal: control.signal',
    ])assert.ok(intent.includes(field),'missing untrusted field '+field);
  }
  assert.equal((source.match(/file\.createWriteStream\s*\(/g)||[]).length,0);
  assert.match(authority,/return false;/);
});
test('R1066: valid shape and spoofed broker environment cannot enable writing',async()=>{
  const x=claim(),old=process.env.URAI_EXCLUSIVE_STORAGE_BROKER_READY;
  try{
    process.env.URAI_EXCLUSIVE_STORAGE_BROKER_READY='true';
    allFalse(inspectUntrustedPrivateOutputIntent(x));
    assert.equal(privateOutputBrokerCertified(),false);
    await assert.rejects(submitPrivateOutputToExclusiveBroker(x),
      {message:'life_movie_exclusive_storage_broker_unavailable'});
  }finally{
    if(old===undefined)delete process.env.URAI_EXCLUSIVE_STORAGE_BROKER_READY;
    else process.env.URAI_EXCLUSIVE_STORAGE_BROKER_READY=old;
  }
});
console.log('R1066_BROKER_INTENT_SHAPE_ONLY_NO_GRANTS tests=8');
