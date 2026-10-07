import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const hash = input => crypto.createHash('sha256').update(input).digest('hex');
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object'
  ? '{' + Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',') + '}' : JSON.stringify(value);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const request = { ownerUid: 'synthetic_owner_01', jobId: 'synthetic_job_01', leaseToken: 'synthetic_lease_01', sourceReceiptRef: 'psr_synthetic_receipt_000001',
  sourceSha256:'a'.repeat(64),sourceFixityRef:'private:synthetic/fixity',sourceByteLength:1234,sourceRevision:1,
  sourceHandle: 'psh_synthetic_handle_000001', sourceEvidenceClass: 'DIRECT_SUBJECT_TESTIMONY', transcriptRef: 'private:synthetic/transcript-01',
  provenanceRef: 'private:synthetic/provenance-01', requestedPurpose: 'memory-index', correlationTrigger: 'initial-source', idempotencyKey: 'synthetic_job_01' };
const transcript = 'Synthetic control text for authority contract tests only.';
const provenance = { schemaVersion: 'synthetic-contract-only', source: 'private:synthetic/audio', timestamp: '2026-01-01T00:00:00Z' };
const resolved = { transcriptText: transcript, sourceFixityRef: 'private:synthetic/fixity', sourceSha256: 'a'.repeat(64), sourceByteLength: 1234,
  sourceRevision: 1, transcriptSha256: hash(transcript), provenanceSha256: hash(canonical(provenance)), transcriptByteLength: Buffer.byteLength(transcript) };
const resolverProof = { schemaVersion: 'urai-private-source-receipt-v2', ...request, leaseToken: undefined, leaseTokenHash: hash(request.leaseToken),
  authorized: true, currentConsent: true, currentCorrection: true, synthetic: false, ...resolved, provenance };
const extraction = { entities: [{ entityId: 'person_01', type: 'person', label: 'Synthetic person' }], claims: [{ claimId: 'claim_01', subject: 'person_01',
  predicate: 'testimony', object: 'Synthetic test statement', evidenceClass: request.sourceEvidenceClass, confidence: 0.7, sourceSpan: { startChar: 0, endChar: 9 } }],
  relationships: [], temporalStates: [], places: [], conflicts: [], negativeConstraints: [], sceneTruth: { decision: 'READY', reasons: [] } };
const consent = { purpose: 'memory.storage', policyVersion: 'synthetic-v1', decisionReceiptId: 'synthetic_decision_01' };
const receiptPath = `uraiPrivateSourceReceipts/${hash(request.sourceReceiptRef)}`;
const blockPath = `jobConsentBlocks/${hash(request.ownerUid+'\n'+consent.purpose)}`;
const fencePath = `uraiPrivateLifeModelOwnerFences/${hash(request.ownerUid)}`;
const rootPath = `uraiPrivateLifeModel/${hash(request.ownerUid+'\n'+request.sourceHandle).slice(0,40)}`;
const source = fs.readFileSync('workers/private-life-model-index-provider/src/index.ts','utf8');
const workerSource = fs.readFileSync('workers/private-source-worker/src/index.ts','utf8');
const privacySource = fs.readFileSync('functions/src/privacy/privateLifeModelDataRights.ts','utf8');

function database() {
  const records = new Map(), versions = new Map();
  let tail = Promise.resolve(), beforeCommit;
  const set = (path, data) => { records.set(path, clone(data)); versions.set(path,(versions.get(path)||0)+1); };
  const snapshot = path => ({ id: path.split('/').at(-1), ref: ref(path), exists: records.has(path), data: () => clone(records.get(path)) });
  const query = (path, filter, bound = Infinity) => ({ path, where: (key,op,value) => { assert.equal(op,'=='); return query(path,[key,value],bound); },
    limit: limit => query(path,filter,limit), get: async () => { const docs = [...records.keys()].filter(p=>p.startsWith(path+'/') && !p.slice(path.length+1).includes('/')
      && (!filter || records.get(p)?.[filter[0]]===filter[1])).slice(0,bound).map(snapshot); return { size: docs.length, docs }; }, doc: id => ref(path+'/'+id) });
  const ref = path => ({ path, id: path.split('/').at(-1), collection: name => query(path+'/'+name), get: async () => snapshot(path),
    set: async (data, options) => set(path,options?.merge ? { ...records.get(path), ...data } : data), update: async data => set(path,{ ...records.get(path), ...data }) });
  const db = { collection: name => query(name), doc: ref, recursiveDelete: async target => { for (const path of [...records.keys()]) if(path===target.path||path.startsWith(target.path+'/')) {
      records.delete(path); versions.set(path,(versions.get(path)||0)+1); } },
    batch: () => { const writes=[];return { update: (target,data)=>writes.push([target,data]),set:(target,data)=>writes.push([target,data]),
      commit: async()=>{for(const [target,data]of writes)await target.update(data);} }; },
    runTransaction: async fn => {
      let unlock; const next = new Promise(resolve=>unlock=resolve); const prior=tail;tail=next;await prior;
      try { for(let attempt=0;attempt<3;attempt++) {
        const reads=new Map(),writes=[];let wrote=false;
        const result=await fn({ get: async target => { assert.equal(wrote,false,'Firestore requires all reads before writes');reads.set(target.path,versions.get(target.path)||0);return snapshot(target.path); },
          create: (target,data)=>{wrote=true;writes.push([target,data,'create']);},set:(target,data,options)=>{wrote=true;writes.push([target,data,options?.merge?'merge':'set']);} });
        if(beforeCommit){const hook=beforeCommit;beforeCommit=undefined;await hook();}
        if([...reads].some(([path,version])=>(versions.get(path)||0)!==version))continue;
        for(const [target,data,mode]of writes){if(mode==='create')assert.equal(records.has(target.path),false,'create must be unique');set(target.path,mode==='merge'?{...records.get(target.path),...data}:data);}
        return result;
      }throw new Error('transaction conflict exhausted');}finally{unlock();}
    }
  };
  set('jobs/'+request.jobId,{ ownerUid: request.ownerUid, type: 'memory.private-source.index', status: 'RUNNING', execution: { leaseToken: request.leaseToken }, consent,
    payload: { sourceReceiptRef: request.sourceReceiptRef, transcriptRef: request.transcriptRef, provenanceRef: request.provenanceRef, requestedPurpose: request.requestedPurpose, correlationTrigger: request.correlationTrigger } });
  set(receiptPath,{schemaVersion:'urai-private-source-receipt-v2',ownerUid:request.ownerUid,sourceReceiptRef:request.sourceReceiptRef,sourceHandle:request.sourceHandle,
    status:'ACTIVE',synthetic:false,sourceEvidenceClass:request.sourceEvidenceClass,purposes:['memory-index'],consent,
    sourceFixityRef:resolved.sourceFixityRef,sourceSha256:resolved.sourceSha256,sourceByteLength:resolved.sourceByteLength,sourceRevision:1});
  set(receiptPath+'/transcripts/'+hash(request.transcriptRef),{schemaVersion:'urai-private-source-transcript-v2',ownerUid:request.ownerUid,sourceReceiptRef:request.sourceReceiptRef,status:'CURRENT',
    synthetic:false,requestedPurpose:'memory-index',transcriptRef:request.transcriptRef,provenanceRef:request.provenanceRef,sourceRevision:1,sourceSha256:resolved.sourceSha256,
    transcriptSha256:resolved.transcriptSha256,provenanceSha256:resolved.provenanceSha256,transcriptByteLength:resolved.transcriptByteLength});
  return { db, records, set, beforeCommit: hook=>{beforeCommit=hook;} };
}
function fixture({onExtract, resolver, env = {}, indexSource=source}={}) {
  const data = database(), routes=new Map(), logs=[],fetches=[];
  const app={use(){},get(path,...handlers){routes.set('GET '+path,handlers.at(-1));},post(path,...handlers){routes.set('POST '+path,handlers.at(-1));},listen(){}};
  const express=()=>app;express.json=()=>()=>{};
  const exports={};
  const process={env:{URAI_ENV:'test',PRIVATE_SOURCE_INDEX_TOKEN:'synthetic-token',PRIVATE_SOURCE_REF_RESOLVER_URL:'https://resolver.invalid',PRIVATE_SOURCE_REF_RESOLVER_TOKEN:'synthetic-token',
    URAI_SOURCE_SHA:'a'.repeat(40),K_REVISION:'synthetic-revision',OPENAI_API_KEY:'synthetic-key',URAI_LIFE_MODEL_EXTRACTOR_MODEL:'synthetic-model-01',FIREBASE_PROJECT_ID:'synthetic-project',
    URAI_PRIVATE_SOURCE_CONTRACT:'urai-private-source-receipt-v2',URAI_PRIVATE_LIFE_MODEL_EXECUTION_ENABLED:'true',URAI_PRIVATE_LIFE_MODEL_EXECUTION_AUTHORITY_REF:'private:synthetic/execution',...env}};
  vm.runInNewContext(compile(indexSource)+'\nObject.assign(exports,{assertRequest,resolvePrivateInputs,validateExtraction,readiness,...(typeof reserveExtraction === "function" ? {reserveExtraction,persistRevision,requireCurrentAuthority,quarantinedImport} : {})});',{
    exports,process,Buffer,URL,AbortSignal,Response,setTimeout,clearTimeout,console:{log:v=>logs.push(v),error:v=>logs.push(v)},
    require:name=>name==='express'?express:name==='./protected-source-provider'?{registerProtectedSourceRoutes(){}}:name==='firebase-admin/app'?{getApps:()=>[1],initializeApp(){},applicationDefault(){}}:
      name==='firebase-admin/firestore'?{getFirestore:()=>data.db,FieldValue:{serverTimestamp:()=> 'synthetic-time'}}:require(name),
    fetch:async(url,options)=>{fetches.push({url,body:JSON.parse(options.body)});if(url.includes('resolve-life-model-inputs'))return new Response(JSON.stringify(resolver?await resolver(data):resolverProof),{status:200});
      await onExtract?.(data);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(extraction)}}]}),{status:200});}
  });
  const execute=async(body=request)=>{const result={status:0,body:null};const res={status:n=>{result.status=n;return res;},send:body=>{result.body=body;return res;}};await routes.get('POST /')({body},res);return result;};
  return {...data,exports,fetches,logs,execute,routes};
}
if (process.argv.includes('--baseline')) {
  const indexSource = execFileSync('git', ['show', '16835a63b2152fde6ca9c9fa4e74af7f65ae0824:workers/private-life-model-index-provider/src/index.ts'], { encoding: 'utf8' });
  const f = fixture({ indexSource, resolver: () => ({ ...resolverProof, ownerUid: 'foreign_owner', requestedPurpose: 'transcribe', currentConsent: false, transcriptSha256: 'b'.repeat(64) }) });
  const legacy = { ...request }; for (const key of ['ownerUid','jobId','leaseToken','sourceReceiptRef','sourceSha256','sourceFixityRef','sourceByteLength','sourceRevision']) delete legacy[key];
  const first = await f.execute(legacy), second = await f.execute(legacy);
  assert.equal(first.status, 200); assert.equal(first.body.backlogState, 'INDEXED'); assert.equal(second.body.replayed, true);
  assert.equal(f.fetches.filter(v => v.url.includes('openai')).length, 2);
  const record = [...f.records].find(([path]) => path.includes('/revisions/'))[1]; assert.equal(record.ownerUid, undefined);
  console.log('[REPRODUCED] baseline 16835 accepts foreign-owner/wrong-purpose/revoked resolver proof and altered transcript hash; ownerless revision labelled INDEXED; exact replay spends a second provider call. Synthetic mock only.');
  process.exit(0);
}
let passed=0;
const check=async(label,fn)=>{await fn();passed++;console.log('[PASS] '+label);};
await check('missing trusted owner/lease rejected before provider execution',async()=>{const f=fixture();assert.throws(()=>f.exports.assertRequest({...request,ownerUid:''}),/owner/);assert.throws(()=>f.exports.assertRequest({...request,leaseToken:''}),/lease/);assert.equal(f.fetches.length,0);});
await check('resolver rejects missing or mismatched protected bindings and altered transcript/provenance bytes',async()=>{
  for(const patch of [{ownerUid:undefined},{ownerUid:'foreign_owner'},{jobId:'foreign_job'},{requestedPurpose:'transcribe'},{sourceReceiptRef:'psr_other_receipt_000001'},
    {leaseTokenHash:'b'.repeat(64)},{currentConsent:false},{currentCorrection:false},{sourceRevision:0},{transcriptText:'changed bytes'},{provenance:{different:true}},{sourceByteLength:0},{transcriptByteLength:1}]){
    const f=fixture({resolver:()=>({...resolverProof,...patch})});await assert.rejects(f.exports.resolvePrivateInputs(request));assert.equal(f.fetches.filter(v=>v.url.includes('openai')).length,0);
  }
});
await check('canonical authority defeats a forged authorized resolver declaration',async()=>{
  for(const mutate of [f=>f.set('jobs/'+request.jobId,{...f.records.get('jobs/'+request.jobId),ownerUid:'foreign_owner'}),
    f=>f.set('jobs/'+request.jobId,{...f.records.get('jobs/'+request.jobId),execution:{leaseToken:'stale_lease'}}),
    f=>f.set(blockPath,{active:true}),f=>f.set(fencePath,{deleted:true}),f=>f.records.delete(receiptPath),
    f=>f.set(receiptPath,{...f.records.get(receiptPath),sourceRevision:2}),
    f=>f.set(receiptPath+'/transcripts/'+hash(request.transcriptRef),{...f.records.get(receiptPath+'/transcripts/'+hash(request.transcriptRef)),provenanceSha256:'b'.repeat(64)})]){
    const f=fixture();mutate(f);const out=await f.execute();assert.equal(out.status,502);assert.equal(f.fetches.filter(v=>v.url.includes('openai')).length,0);assert.equal(f.records.has(rootPath),false);
  }
});
await check('quarantined revision is owner-bound with a blocked inert canonical import',async()=>{
  const f=fixture(),out=await f.execute();assert.equal(out.status,200);assert.equal(out.body.historicalSourceAuthority,false);assert.equal(out.body.reviewState,'OWNER_REVIEW_REQUIRED');
  assert.equal(out.body.backlogState,'QUARANTINED_OWNER_REVIEW');assert.equal(JSON.stringify(out.body).includes(transcript),false);
  const record=f.records.get(rootPath+'/revisions/00000001');assert.equal(record.ownerUid,request.ownerUid);assert.equal(record.jobId,request.jobId);
  assert.equal(record.lineage.transcriptSha256,hash(transcript));assert.equal(record.importCandidate.importExecutable,false);assert.equal(record.importCandidate.historicalSourceAuthority,false);
  assert.equal(record.importCandidate.claims[0].status,'disputed');assert.equal(record.importCandidate.claims[0].evidenceClass,'UNKNOWN');assert.equal(record.importCandidate.claims[0].synthetic,true);
  assert.equal(record.importCandidate.sceneTruth.decision,'BLOCKED');assert.equal([...f.records.keys()].some(p=>p.includes('/lifeClaims/')),false);
});
await check('exact replay avoids another paid extraction and changed inputs cannot reuse identity',async()=>{
  const f=fixture(),first=await f.execute(),replay=await f.execute();assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);assert.equal(replay.body.checksum,first.body.checksum);
  assert.equal(f.fetches.filter(v=>v.url.includes('openai')).length,1);
  const path=rootPath+'/idempotency/'+hash(request.idempotencyKey);f.set(path,{...f.records.get(path),requestDigest:'c'.repeat(64)});
  assert.equal((await f.execute()).status,502);assert.equal(f.fetches.filter(v=>v.url.includes('openai')).length,1);
  f.set(blockPath,{active:true});assert.equal((await f.execute()).status,502);
});
await check('index replay rehashes retained revision bytes and rejects a superseded current revision',async()=>{
  const f=fixture();await f.execute();const path=rootPath+'/revisions/00000001';const original=f.records.get(path);
  f.set(path,{...original,extraction:{...original.extraction,sceneTruth:{decision:'BLOCKED',reasons:['tampered']}}});assert.equal((await f.execute()).status,502);
  f.set(path,original);f.set(rootPath+'/state/current',{...f.records.get(rootPath+'/state/current'),revision:2});assert.equal((await f.execute()).status,502);
  assert.equal(f.fetches.filter(v=>v.url.includes('openai')).length,1);
});
await check('simultaneous identical submissions reserve exactly one provider call',async()=>{
  let release;const pending=new Promise(resolve=>release=resolve);let started;const signal=new Promise(resolve=>started=resolve);
  const f=fixture({onExtract:async()=>{started();await pending;}});const first=f.execute();await signal;const second=await f.execute();assert.equal(second.status,502);release();assert.equal((await first).status,200);
  assert.equal(f.fetches.filter(v=>v.url.includes('openai')).length,1);
});
await check('correction/revoke/delete while extractor returns prevents immutable revision',async()=>{
  for(const mutate of [f=>f.set(blockPath,{active:true}),f=>f.set(fencePath,{deleted:true}),
    f=>f.set(receiptPath,{...f.records.get(receiptPath),sourceRevision:2}),
    f=>f.set('jobs/'+request.jobId,{...f.records.get('jobs/'+request.jobId),status:'CANCELLED'})]){
    const f=fixture({onExtract:mutate});assert.equal((await f.execute()).status,502);assert.equal(f.records.has(rootPath+'/revisions/00000001'),false);
    assert.equal(f.records.get(rootPath+'/idempotency/'+hash(request.idempotencyKey)).state,'FAILED_RECONCILIATION_REQUIRED');
    assert.equal((await f.execute()).status,502);assert.equal(f.fetches.filter(v=>v.url.includes('openai')).length,1);
  }
});
await check('transaction conflict revalidates consent rather than committing stale authority',async()=>{
  const f=fixture();const admitted=await f.exports.reserveExtraction(request,resolved);
  f.beforeCommit(()=>f.set(blockPath,{active:true}));await assert.rejects(f.exports.persistRevision(request,extraction,resolved,admitted.reservation),/revoked/);
  assert.equal(f.records.has(rootPath+'/revisions/00000001'),false);
});
await check('unsupported lineage/span and excessive extraction input is rejected',async()=>{
  const f=fixture();for(const patch of [{subject:'foreign_person'},{sourceSpan:{startChar:0,endChar:999999}},{sourceSpan:undefined},{predicate:'bad predicate'},{object:'a'.repeat(8193)}])
    assert.throws(()=>f.exports.validateExtraction({...extraction,claims:[{...extraction.claims[0],...patch}]},request.sourceEvidenceClass,transcript.length));
  assert.throws(()=>f.exports.validateExtraction({...extraction,entities:Array(257).fill(extraction.entities[0])},request.sourceEvidenceClass));
});
await check('readiness remains hard-off without exact versioned contract and explicit execution authority',async()=>{
  for(const env of [{URAI_PRIVATE_LIFE_MODEL_EXECUTION_ENABLED:'false'},{URAI_PRIVATE_SOURCE_CONTRACT:'legacy'},{URAI_PRIVATE_LIFE_MODEL_EXECUTION_AUTHORITY_REF:''},{URAI_LIFE_MODEL_EXTRACTOR_MODEL:''}]){
    const f=fixture({env});assert.equal(f.exports.readiness().ok,false);assert.equal((await f.execute()).status,503);assert.equal(f.fetches.length,0);
  }
});
await check('provider errors never print private transcript, provider text or arbitrary exception detail',async()=>{
  const f=fixture({onExtract:()=>{throw new Error('PRIVATE_TEXT_SHOULD_NOT_APPEAR');}});assert.equal((await f.execute()).status,502);
  assert.equal(f.logs.join('\n').includes('PRIVATE_TEXT_SHOULD_NOT_APPEAR'),false);assert.equal(f.logs.join('\n').includes(transcript),false);
});

function loadPrivacy(f, { bucketPrivate=true, env={} }={}) {
  const exports={};vm.runInNewContext(compile(privacySource),{exports,Buffer,process:{env:{GCS_BUCKET_NAME:'synthetic-export-bucket',URAI_JOBS_DATA_RIGHTS_ALLOWED_EXPORT_BUCKET:'synthetic-export-bucket',...env}},require:name=>name==='firebase-admin/storage'?{getStorage:()=>({bucket:()=>({getMetadata:async()=>[{iamConfiguration:{uniformBucketLevelAccess:{enabled:true},publicAccessPrevention:bucketPrivate?'enforced':'inherited'}}]})})}:name==='firebase-admin/firestore'?{
    getFirestore:()=>f.db,FieldValue:{serverTimestamp:()=> 'synthetic-time',delete:()=> 'deleted'}}:require(name)});return exports;
}
await check('data-rights export denies an unadmitted or public storage destination',async()=>{
  const f=fixture();await loadPrivacy(f).assertPrivateDataRightsExportDestination();
  await assert.rejects(loadPrivacy(f,{bucketPrivate:false}).assertPrivateDataRightsExportDestination(),/not_private/);
  await assert.rejects(loadPrivacy(f,{env:{URAI_JOBS_DATA_RIGHTS_ALLOWED_EXPORT_BUCKET:''}}).assertPrivateDataRightsExportDestination(),/not_admitted/);
});
await check('protected export includes only the exact owned source and quarantined revision bytes',async()=>{
  const f=fixture();await f.execute();f.set('uraiPrivateLifeModel/foreign-root',{ownerUid:'foreign_owner',privateText:'must-not-export'});
  const out=await loadPrivacy(f).exportOwnedPrivateLifeModel(f.db,request.ownerUid);assert.equal(out.completeEcosystemExport,false);
  assert.ok(out.records.some(record=>record.path.endsWith('/revisions/00000001')));assert.equal(JSON.stringify(out).includes('must-not-export'),false);
});
await check('owner deletion removes all owned revisions and source records then permanently denies delayed admission',async()=>{
  const f=fixture();await f.execute();const out=await loadPrivacy(f).deleteOwnedPrivateLifeModel(f.db,request.ownerUid,'synthetic_delete_01');
  assert.equal(out.ownerAdmissionPermanentlyBlocked,true);assert.equal(f.records.get(fencePath).deleted,true);
  assert.equal([...f.records.keys()].some(p=>p.startsWith(rootPath)||p.startsWith(receiptPath)),false);assert.equal((await f.execute()).status,502);
  const unknown=fixture();await loadPrivacy(unknown).deleteOwnedPrivateLifeModel(unknown.db,'new_synthetic_owner','synthetic_delete_02');
  assert.equal(unknown.records.get('uraiPrivateLifeModelOwnerFences/'+hash('new_synthetic_owner')).deleted,true);
});
await check('delete racing extraction leaves no resurrection or failed-attempt record',async()=>{
  const f=fixture({onExtract:async data=>{await loadPrivacy(data).deleteOwnedPrivateLifeModel(data.db,request.ownerUid,'synthetic_delete_03');}});
  assert.equal((await f.execute()).status,502);assert.equal([...f.records.keys()].some(p=>p.startsWith(rootPath)),false);
});
await check('consent revocation scrubs job output and purges private revisions with explicit external boundary',async()=>{
  const f=fixture();await f.execute();f.set(blockPath,{active:true});const result=await loadPrivacy(f).invalidatePrivateLifeModelForConsent({ownerUid:request.ownerUid,purpose:'memory.storage',eventId:'synthetic_event_01'});
  assert.equal(result.jobsInvalidated,1);assert.equal(result.completePrivateSourceRevocation,false);assert.equal(f.records.get('jobs/'+request.jobId).status,'CANCELLED');
  assert.equal(f.records.get(receiptPath).status,'REVOKED');assert.equal([...f.records.keys()].some(p=>p.startsWith(rootPath)),false);assert.equal((await f.execute()).status,502);
});

// Exercise the actual worker handler so ownership cannot be lost between services.
function workerFixture({proofPatch={},providerPatch={},revokeAfterProvider=false,transcribe=false}={}) {
  const routes=new Map(),calls=[],logs=[];let providerRan=false;
  const app={use(){},get(){},post(path,...handlers){routes.set(path,handlers.at(-1));},listen(){}};const express=()=>app;express.json=()=>()=>{};
  const job={jobId:request.jobId,jobType:transcribe?'memory.private-source.transcribe':'memory.private-source.index',ownerUid:request.ownerUid,leaseToken:request.leaseToken,
    payload:transcribe?{sourceReceiptRef:request.sourceReceiptRef,requestedPurpose:'transcribe'}:{sourceReceiptRef:request.sourceReceiptRef,requestedPurpose:'memory-index',transcriptRef:request.transcriptRef,provenanceRef:request.provenanceRef}};
  const proof={...resolverProof,requestedPurpose:job.payload.requestedPurpose,evidenceClass:request.sourceEvidenceClass,...proofPatch};
  const provider={ok:true,ownerUid:request.ownerUid,jobId:request.jobId,sourceReceiptRef:request.sourceReceiptRef,requestedPurpose:job.payload.requestedPurpose,
    historicalSourceAuthority:false,reviewState:'OWNER_REVIEW_REQUIRED',lineageSha256:'b'.repeat(64),syntheticOutputMayBecomeHistoricalSource:false,
    sourceEvidenceClass:request.sourceEvidenceClass,sourceFixityRef:resolved.sourceFixityRef,sourceSha256:resolved.sourceSha256,sourceRevision:1,
    transcriptSha256:resolved.transcriptSha256,provenanceSha256:resolved.provenanceSha256,checksum:'c'.repeat(64),lifeModelSchemaVersion:'urai-life-model-v1',
    correlationRevision:1,correlationTrigger:'initial-source',backlogState:'QUARANTINED_OWNER_REVIEW',
    ...Object.fromEntries(['memoryIndexRef','entityGraphRef','temporalIndexRef','placeIndexRef','conflictSetRef','sceneTruthRef','dependencyGraphRef'].map(key=>[key,'private:synthetic/'+key])),
    transcriptRef:request.transcriptRef,provenanceRef:request.provenanceRef,...(transcribe?{schemaVersion:'urai-private-source-transcript-v2',synthetic:false,
      sourceSha256:resolved.sourceSha256,sourceRevision:1,leaseTokenHash:hash(request.leaseToken),transcriptSha256:resolved.transcriptSha256,provenanceSha256:resolved.provenanceSha256,transcriptByteLength:resolved.transcriptByteLength}:{}),...providerPatch};
  vm.runInNewContext(compile(workerSource),{exports:{},process:{env:{URAI_ENV:'test',URAI_JOBS_WORKER_TOKEN:'synthetic-token',PRIVATE_SOURCE_AUTHORITY_URL:'https://authority.invalid',
    PRIVATE_SOURCE_AUTHORITY_TOKEN:'synthetic-token',PRIVATE_SOURCE_TRANSCRIBE_URL:'https://transcribe.invalid',PRIVATE_SOURCE_TRANSCRIBE_TOKEN:'synthetic-token',
    PRIVATE_SOURCE_INDEX_URL:'https://index.invalid',PRIVATE_SOURCE_INDEX_TOKEN:'synthetic-token',URAI_PRIVATE_SOURCE_CONTRACT:'urai-private-source-receipt-v2',
    URAI_PRIVATE_SOURCE_EXECUTION_ENABLED:'true',URAI_PRIVATE_SOURCE_EXECUTION_AUTHORITY_REF:'private:synthetic/execution'}},URL,console:{log:v=>logs.push(v),error:v=>logs.push(v)},
    require:name=>name==='express'?express:name==='axios'?{post:async(url,body)=>{calls.push({url,body});if(url.includes('/authorize'))return{status:200,data:revokeAfterProvider&&providerRan?{...proof,currentConsent:false}:proof};providerRan=true;return{status:200,data:provider};}}:require(name)});
  return {calls,logs,execute:async()=>{const out={status:0,body:null};const res={status:n=>{out.status=n;return res;},send:body=>{out.body=body;return res;}};await routes.get('/execute-job')({body:job},res);return out;}};
}
await check('dispatcher final transaction rejects consent/correction/deletion after worker validation',async()=>{
  const f=fixture(),out=await f.execute();const response={result:{...out.body,sourceFixityRef:resolved.sourceFixityRef}};
  const final=()=>f.db.runTransaction(tx=>loadPrivacy(f).canFinalizePrivateSource(f.db,tx,f.records.get('jobs/'+request.jobId),response));
  assert.equal(await final(),true);f.set(blockPath,{active:true});assert.equal(await final(),false);f.set(blockPath,{active:false});
  f.set(receiptPath,{...f.records.get(receiptPath),sourceRevision:2});assert.equal(await final(),false);f.set(receiptPath,{...f.records.get(receiptPath),sourceRevision:1});
  f.set(fencePath,{deleted:true});assert.equal(await final(),false);
});
await check('worker forwards trusted owner/job/lease and opaque source receipt to index and transcription',async()=>{
  for(const transcribe of [false,true]){const f=workerFixture({transcribe});assert.equal((await f.execute()).status,200);const call=f.calls.find(v=>!v.url.includes('/authorize'));
    for(const key of ['ownerUid','jobId','leaseToken','sourceReceiptRef'])assert.equal(call.body[key],request[key]);assert.equal(f.calls.filter(v=>v.url.includes('/authorize')).length,2);}
});
await check('worker rejects owner/purpose/fixity substitutions and post-provider revocation',async()=>{
  for(const proofPatch of [{ownerUid:undefined},{ownerUid:'foreign_owner'},{requestedPurpose:'transcribe'},{sourceSha256:''},{currentCorrection:false}]){
    const f=workerFixture({proofPatch});assert.equal((await f.execute()).status,502);assert.equal(f.calls.some(v=>v.url==='https://index.invalid'),false);}
  for(const providerPatch of [{ownerUid:'foreign_owner'},{historicalSourceAuthority:true},{reviewState:'ACCEPTED'},{backlogState:'INDEXED'}])assert.equal((await workerFixture({providerPatch}).execute()).status,502);
  assert.equal((await workerFixture({revokeAfterProvider:true}).execute()).status,502);
  assert.equal((await workerFixture({transcribe:true,providerPatch:{sourceSha256:'f'.repeat(64)}}).execute()).status,502);
});
function protectedFixture({onProvider,bucketPrivate=true,badBytes=false,badGeneration=false,env={},providerPatch={}}={}) {
  const f=database(),routes=new Map(),calls=[],audio=Buffer.from('synthetic_audio_bytes_only');
  const transcribeRequest={...request,sourceSha256:hash(audio),sourceByteLength:audio.length,schemaVersion:'urai-private-source-transcript-v2',requestedPurpose:'transcribe'};
  delete transcribeRequest.transcriptRef;delete transcribeRequest.provenanceRef;delete transcribeRequest.correlationTrigger;
  f.set('jobs/'+request.jobId,{ownerUid:request.ownerUid,type:'memory.private-source.transcribe',status:'RUNNING',execution:{leaseToken:request.leaseToken},consent,
    payload:{sourceReceiptRef:request.sourceReceiptRef,requestedPurpose:'transcribe'}});
  f.set(receiptPath,{...f.records.get(receiptPath),purposes:['transcribe','memory-index'],sourceSha256:hash(audio),sourceByteLength:audio.length,
    storage:{bucket:'synthetic-private-bucket',object:'private-source/'+hash(request.ownerUid)+'/audio.wav',generation:'1',contentType:'audio/wav',durationSeconds:10}});
  const app={get:(path,...handlers)=>routes.set('GET '+path,handlers.at(-1)),post:(path,...handlers)=>routes.set('POST '+path,handlers.at(-1))};
  const exports={};
  vm.runInNewContext(compile(fs.readFileSync('workers/private-life-model-index-provider/src/protected-source-provider.ts','utf8')),{exports,Buffer,URL,FormData,Blob,Uint8Array,
    AbortController,AbortSignal,setTimeout,clearTimeout,setInterval,clearInterval,
    process:{env:{URAI_PRIVATE_SOURCE_CONTRACT:'urai-private-source-receipt-v2',FIREBASE_PROJECT_ID:'synthetic-project',URAI_SOURCE_SHA:'a'.repeat(40),K_REVISION:'synthetic-revision',
      PRIVATE_SOURCE_AUTHORITY_TOKEN:'synthetic-token',PRIVATE_SOURCE_REF_RESOLVER_TOKEN:'synthetic-token',PRIVATE_SOURCE_TRANSCRIBE_TOKEN:'synthetic-token',
      URAI_PRIVATE_SOURCE_TRANSCRIPTION_ENABLED:'true',URAI_PRIVATE_SOURCE_TRANSCRIPTION_AUTHORITY_REF:'private:synthetic/execution',
      PRIVATE_SOURCE_ALLOWED_BUCKET:'synthetic-private-bucket',OPENAI_API_KEY:'synthetic-key',URAI_PRIVATE_SOURCE_DIARIZATION_MODEL:'gpt-4o-transcribe-diarize',...env}},
    require:name=>name==='firebase-admin/firestore'?{FieldValue:{serverTimestamp:()=> 'synthetic-time'}}:name==='firebase-admin/storage'?{getStorage:()=>({bucket:name=>({
      getMetadata:async()=>[{iamConfiguration:{uniformBucketLevelAccess:{enabled:true},publicAccessPrevention:bucketPrivate?'enforced':'inherited'}}],
      file:(object,options)=>{calls.push({storage:true,name,object,generation:options.generation});return{
        getMetadata:async()=>[{generation:badGeneration?'2':'1',size:audio.length,contentType:'audio/wav'}],
        createReadStream:()=>Readable.from([badBytes?Buffer.alloc(audio.length):Buffer.from(audio)]),
      };}
    })})}:require(name),
    fetch:async(url,options)=>{calls.push({url,model:options.body.get('model'),format:options.body.get('response_format'),chunking:options.body.get('chunking_strategy'),
      knownSpeakers:options.body.has('known_speaker_names[]')});await onProvider?.(f);return new Response(JSON.stringify({text:'Synthetic audio transcript.',
        segments:[{speaker:'unreviewed_person_name',start:0,end:2,text:'Synthetic audio transcript.'}],...providerPatch}),{status:200});}
  });
  exports.registerProtectedSourceRoutes(app,{firestore:()=>f.db,stableHash:hash,canonicalJson:canonical,boundedResponse:async(response,max)=>{
    const text=await response.text();assert.ok(Buffer.byteLength(text)<=max);return text;
  }});
  const execute=async(path='/transcribe',body=transcribeRequest)=>{const result={status:0,body:null};const res={set(){return res;},status:n=>{result.status=n;return res;},send:body=>{result.body=body;return res;}};
    await routes.get('POST '+path)({body},res);return result;};
  return {...f,routes,calls,execute,transcribeRequest};
}
await check('bounded private GCS generation/hash produces diarized, anonymous, unreviewed transcript refs',async()=>{
  const f=protectedFixture(),out=await f.execute();assert.equal(out.status,200);assert.equal(out.body.historicalSourceAuthority,false);assert.equal(out.body.speakerIdentityAccepted,false);
  const call=f.calls.find(v=>v.url);assert.equal(call.url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(call.model,'gpt-4o-transcribe-diarize');
  assert.equal(call.format,'diarized_json');assert.equal(call.chunking,'auto');assert.equal(call.knownSpeakers,false);
  const record=f.records.get(receiptPath+'/transcripts/'+hash(out.body.transcriptRef));assert.equal(record.ownerUid,request.ownerUid);assert.equal(record.transcriptSha256,hash(record.transcriptText));
  assert.equal(record.provenance.segments[0].speakerId,'speaker_1');assert.equal(JSON.stringify(record).includes('unreviewed_person_name'),false);
  assert.equal(out.body.checksum,hash(canonical(Object.fromEntries(Object.entries(record).filter(([k])=>k!=='createdAt')))));
});
await check('protected resolver returns actual retained transcript/provenance bytes only for canonical owner and current correction',async()=>{
  const f=protectedFixture(),out=await f.execute();f.set('jobs/'+request.jobId,{ownerUid:request.ownerUid,type:'memory.private-source.index',status:'RUNNING',execution:{leaseToken:request.leaseToken},consent,
    payload:{sourceReceiptRef:request.sourceReceiptRef,requestedPurpose:'memory-index',transcriptRef:out.body.transcriptRef,provenanceRef:out.body.provenanceRef}});
  const body={...request,sourceSha256:hash(Buffer.from('synthetic_audio_bytes_only')),sourceByteLength:Buffer.byteLength('synthetic_audio_bytes_only'),schemaVersion:'urai-private-source-receipt-v2',transcriptRef:out.body.transcriptRef,provenanceRef:out.body.provenanceRef};delete body.correlationTrigger;
  const found=await f.execute('/resolve-life-model-inputs',body);assert.equal(found.status,200);assert.equal(found.body.transcriptSha256,hash(found.body.transcriptText));
  assert.equal(found.body.provenanceSha256,hash(canonical(found.body.provenance)));assert.equal(found.body.currentCorrection,true);
  assert.equal((await f.execute('/resolve-life-model-inputs',{...body,ownerUid:'foreign_owner'})).status,403);
  f.set(receiptPath,{...f.records.get(receiptPath),sourceRevision:2});assert.equal((await f.execute('/resolve-life-model-inputs',body)).status,403);
});
await check('private audio storage exposure, generation mismatch and actual byte hash mismatch prevent provider dispatch',async()=>{
  for(const config of [{bucketPrivate:false},{badGeneration:true},{badBytes:true}]){const f=protectedFixture(config);assert.equal((await f.execute()).status,403);assert.equal(f.calls.some(v=>v.url),false);}
  const f=protectedFixture();f.set(receiptPath,{...f.records.get(receiptPath),sourceByteLength:25_000_001});assert.equal((await f.execute()).status,403);assert.equal(f.calls.some(v=>v.url),false);
});
await check('diarized provider output cannot persist after revoke/correction/deletion and cannot retry ambiguously',async()=>{
  for(const mutate of [f=>f.set(blockPath,{active:true}),f=>f.set(receiptPath,{...f.records.get(receiptPath),sourceRevision:2}),
    async f=>loadPrivacy(f).deleteOwnedPrivateLifeModel(f.db,request.ownerUid,'synthetic_delete_04')]){
    const f=protectedFixture({onProvider:mutate});assert.equal((await f.execute()).status,403);assert.equal([...f.records.keys()].filter(p=>p.includes('/transcripts/')&&f.records.get(p).jobId===request.jobId).length,0);
    assert.equal((await f.execute()).status,403);assert.equal(f.calls.filter(v=>v.url).length,1);
  }
});
await check('transcription exact replay avoids upload/provider cost and fails if retained bytes are corrected',async()=>{
  const f=protectedFixture(),first=await f.execute(),replay=await f.execute();assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);
  assert.equal(replay.body.checksum,first.body.checksum);assert.equal(f.calls.filter(v=>v.url).length,1);assert.equal(f.calls.filter(v=>v.storage).length,1);
  const path=receiptPath+'/transcripts/'+hash(first.body.transcriptRef);f.set(path,{...f.records.get(path),transcriptText:'corrected text'});
  assert.equal((await f.execute()).status,403);assert.equal(f.calls.filter(v=>v.url).length,1);
});
await check('simultaneous transcription requests admit one provider attempt',async()=>{
  let release,started;const wait=new Promise(r=>release=r),signal=new Promise(r=>started=r);
  const f=protectedFixture({onProvider:async()=>{started();await wait;}});const first=f.execute();await signal;
  assert.equal((await f.execute()).status,403);release();assert.equal((await first).status,200);assert.equal(f.calls.filter(v=>v.url).length,1);
});
await check('ASR timing/span bounds, readiness and absent exact execution grant fail closed',async()=>{
  for(const providerPatch of [{segments:[{speaker:'test',start:0,end:601,text:'Synthetic audio transcript.'}]},{segments:[{speaker:'test',start:0,end:1,text:'invented missing text'}]},{segments:[]}])
    assert.equal((await protectedFixture({providerPatch}).execute()).status,403);
  for(const env of [{URAI_PRIVATE_SOURCE_TRANSCRIPTION_ENABLED:'false'},{URAI_PRIVATE_SOURCE_TRANSCRIPTION_AUTHORITY_REF:''},{URAI_SOURCE_SHA:''},{PRIVATE_SOURCE_ALLOWED_BUCKET:''},{URAI_PRIVATE_SOURCE_DIARIZATION_MODEL:'unknown_model'}]){
    const f=protectedFixture({env});assert.equal((await f.execute()).status,503);assert.equal(f.calls.length,0);
  }
});
console.log(`[PASS] PRIVATE_LIFE_MODEL_AUTHORITY ${passed} source contract scenarios; synthetic control tests only, no provider/private reconstruction acceptance`);
