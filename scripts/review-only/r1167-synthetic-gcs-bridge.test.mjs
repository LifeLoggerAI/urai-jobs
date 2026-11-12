import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require=createRequire(import.meta.url);
const {makeR1167SyntheticGcsBridge,DENIED,CANARY_BUCKET,PAYLOAD} =
  require('../../workers/storage-broker/r1167-synthetic-gcs-bridge.js');
const hash=createHash('sha256').update(PAYLOAD).digest('hex');
const claim=()=>({ownerUid:'synthetic-r1167-owner',tenantId:'synthetic-r1167-tenant',
 projectId:'synthetic-r1167-project',jobId:'synthetic-r1167-job-1234abcd',
 jobType:'studio.render.video',attemptId:'attempt-1234abcd',purpose:'life-movie.render',
 expectedEpoch:1,destination:'tenants/synthetic-r1167-tenant/life-movies/synthetic-r1167-project/review-only/attempt-1234abcd/life-movie.render-manifest.json',
 expectedHash:hash,consentReceiptId:'a'.repeat(64)});
const cap={productionAuthorized:false,storageWriteAuthorized:false,deletionAcknowledged:false};
const deny=(p)=>assert.rejects(p,{message:DENIED});
function fixture(opts={}){
 const calls=[]; let exists=false,gen=opts.generation??'1001';
 const file={
   save:async (bytes,options)=>{calls.push('save');assert.deepEqual(bytes,PAYLOAD);
     assert.equal(options.resumable,false);assert.equal(options.preconditionOpts.ifGenerationMatch,0);
     if(opts.failSave){exists=true;throw Error('provider-private-failure')} exists=true;},
   getMetadata:async()=>{calls.push('metadata');if(opts.failMetadata)throw Error('provider-secret-error');
     if(!exists){let e=Error('not found');e.code=404;throw e;}
     return [{generation:gen}];},
   delete:async options=>{calls.push('delete');assert.equal(options.ifGenerationMatch,String(gen));
     if(opts.failDelete)throw Error('provider delete failure');exists=false;
     if(opts.recreateAfterDelete)exists=true;}
 };
 const storage={bucket:name=>{calls.push('bucket');assert.equal(name,CANARY_BUCKET);return {file:path=>{
   calls.push('file');assert.equal(path,claim().destination);return file;}}}};
 const protocol={
 reserve:async()=>{calls.push('reserve');if(opts.failReserve)throw Error('reservation_denied');
    return {...cap,attemptState:'RESERVED'};},
 begin:async()=>{calls.push('begin');if(opts.failBegin)throw Error('epoch_revoked');
    return {...cap,attemptState:'IN_FLIGHT'};},
 observeLateGeneration:async(c,g)=>{calls.push('observe');assert.deepEqual(c,claim());
    assert.equal(g,String(gen));if(opts.failObserve)throw Error('epoch_changed');
    return {...cap,attemptState:'UNVERIFIED_GENERATION'};}
 };
 return {b:makeR1167SyntheticGcsBridge({protocol,storage}),calls,get exists(){return exists}};
}
test('trusted canary path: durable reserve -> begin -> nonresumable upload -> generation -> exact delete -> 404',async()=>{
 const f=fixture();const r=await f.b.probe(claim());assert.equal(r.stage,'LIVE_VERSION_404_OBSERVED_SOFT_DELETE_UNVERIFIED');
 for(const field of ['productionAuthorized','storageWriteAuthorized','allWritersDrained',
  'privateOutputDeletionAcknowledged','liveIamCertified']) assert.equal(r[field],false);
 assert.deepEqual(f.calls,['reserve','begin','bucket','file','save','metadata','observe','delete','metadata']);
 assert.equal(f.exists,false);
});
test('reject forged owner, tenant, project, path, hash and extra grant before protocol call',async()=>{
 for(const field of ['ownerUid','tenantId','projectId','destination','expectedHash']){
  const f=fixture();await deny(f.b.probe({...claim(),[field]:'unsafe'}));assert.deepEqual(f.calls,[]);
 }
 const f=fixture();await deny(f.b.probe({...claim(),approved:true}));assert.deepEqual(f.calls,[]);
});
test('reject accessor and proxy claims without invoking storage',async()=>{
 const f=fixture(),c=claim();Object.defineProperty(c,'purpose',{get(){throw Error('secret')}});
 await deny(f.b.probe(c));assert.deepEqual(f.calls,[]);
 const g=fixture();await deny(g.b.probe(new Proxy(claim(),{ownKeys(){throw Error('secret')}})));
 assert.deepEqual(g.calls,[]);
});
test('revocation between reserve and begin rejects without issuing upload',async()=>{
 const f=fixture({failBegin:true});await deny(f.b.probe(claim()));
 assert.deepEqual(f.calls,['reserve','begin']);
});
test('provider write failure does not record generation or claim absent',async()=>{
 const f=fixture({failSave:true});await deny(f.b.probe(claim()));
 assert.equal(f.calls.includes('observe'),false);assert.equal(f.calls.includes('delete'),false);
 assert.equal(f.exists,true); // Unknown orphan requires separate reconciliation.
});
test('revocation after upload triggers exact-generation cleanup, never ACK',async()=>{
 const f=fixture({failObserve:true});await deny(f.b.probe(claim()));
 assert.deepEqual(f.calls.slice(-2),['observe','delete']);assert.equal(f.exists,false);
});
test('invalid provider generation never triggers unpinned delete',async()=>{
 const f=fixture({generation:'invalid'});await deny(f.b.probe(claim()));
 assert.equal(f.calls.includes('delete'),false);assert.equal(f.exists,true);
});
test('deletion failure cannot produce success or false drain',async()=>{
 const f=fixture({failDelete:true});await deny(f.b.probe(claim()));assert.equal(f.exists,true);
});
test('recreated generation after delete remains a blocked result',async()=>{
 const f=fixture({recreateAfterDelete:true});await deny(f.b.probe(claim()));assert.equal(f.exists,true);
});
test('no Studio hook, IAM change, production unlock or deletion-ack function exported',()=>{
 const f=fixture();assert.equal(f.b.privateOutputBrokerCertified,false);
 assert.equal(f.b.productionAuthorized,false);
 assert.deepEqual(Object.keys(f.b).sort(),['canaryBucket','privateOutputBrokerCertified','probe','productionAuthorized']);
});
