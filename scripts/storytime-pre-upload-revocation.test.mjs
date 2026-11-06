import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

// Execute the full checked-in Storytime ledger with a synthetic transactional
// Firestore. This is not an actual Firebase or Cloud Storage emulator run.
const ts=createRequire(new URL('../workers/narrator-worker/package.json',import.meta.url))('typescript');
const source=readFileSync(new URL('../workers/narrator-worker/src/handlers/storytime-write-ledger.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}, reportDiagnostics:true,
});
assert.equal((compiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const job=()=>({jobId:'job1',type:'narrator.tts',jobType:'narrator.tts',sourceSystem:'urai-storytime',
  ownerUid:'owner1',sourceSessionId:'session1',sourceNarratorScriptId:'script1',
  leaseToken:'lease1',status:'RUNNING',execution:{leaseToken:'lease1'},lease:{leaseToken:'lease1'},
  payload:{outputPrefix:'storytime/owner1/session1/script1'},
  consent:{purpose:'storytime.voiceover',policyVersion:'v1',decisionReceiptId:'receipt1'}});
const path='storytime/owner1/session1/script1/11111111-1111-4111-8111-111111111111.mp3';
const blockId=createHash('sha256').update('owner1\nstorytime.voiceover').digest('hex');

function fixture(){
  const rows=new Map([
    ['jobs/job1',job()],
    ['users/owner1',{disabled:false,deletionPending:false,dataRightsDeletionPendingCentralPrivacy:false}],
    ['jobConsentBlocks/'+blockId,{active:false}],
  ]);
  const module={exports:{}};
  const db={collection(name){return{doc(id){return{path:name+'/'+id};}};},
    async runTransaction(callback){
      const writes=[];
      const tx={
        async get(ref){const value=rows.get(ref.path);return{exists:value!==undefined,data:()=>value};},
        create(ref,data){writes.push(['create',ref.path,data]);},
        update(ref,data){writes.push(['update',ref.path,data]);},
      };
      const result=await callback(tx);
      for(const [kind,key,data] of writes){
        if(kind==='create'&&rows.has(key))throw Error('precondition_exists');
        if(kind==='update'&&!rows.has(key))throw Error('precondition_missing');
        rows.set(key,kind==='create'?data:{...rows.get(key),...data});
      }
      return result;
    },
  };
  const fakeRequire=name=>{
    if(name==='node:crypto')return{createHash};
    if(name==='firebase-admin/app')return{getApps:()=>[{}],initializeApp:()=>{}};
    if(name==='firebase-admin/firestore')return{getFirestore:()=>db,FieldValue:{serverTimestamp:()=> 'synthetic-time'}};
    throw Error('unexpected import '+name);
  };
  vm.runInNewContext(compiled.outputText,{module,exports:module.exports,require:fakeRequire,
    process:{env:{GCS_BUCKET_NAME:'synthetic-bucket'}},Object,String,Number,Array,Map,Set,Error});
  const ledger=module.exports;
  const identity=()=>ledger.storytimeNarratorWriteIdentity(job(),path,'upload1');
  const ledgerRow=()=>rows.get('storytimeNarratorWriteReservations/'+identity().reservationId);
  return{ledger,identity,ledgerRow,rows};
}

test('valid reserved upload passes the second authority gate',async()=>{
  const f=fixture();await f.ledger.reserveStorytimeNarratorWrite(f.identity());
  await f.ledger.assertStorytimeNarratorWriteActiveBeforeUpload(f.identity());
  assert.equal(f.ledgerRow().state,'RESERVED');
});
test('consent withdrawn during provider work prevents upload',async()=>{
  const f=fixture();await f.ledger.reserveStorytimeNarratorWrite(f.identity());
  f.rows.set('jobConsentBlocks/'+blockId,{active:true});
  await assert.rejects(f.ledger.assertStorytimeNarratorWriteActiveBeforeUpload(f.identity()),/revoked_before_upload/);
  assert.equal(f.ledgerRow().state,'RECONCILE_REQUIRED');
  assert.equal(f.ledgerRow().reason,'pre_upload_authority_changed');
});
test('owner deletion pending after reservation prevents upload',async()=>{
  const f=fixture();await f.ledger.reserveStorytimeNarratorWrite(f.identity());
  f.rows.set('users/owner1',{dataRightsDeletionPendingCentralPrivacy:true});
  await assert.rejects(f.ledger.assertStorytimeNarratorWriteActiveBeforeUpload(f.identity()),/revoked_before_upload/);
  assert.equal(f.ledgerRow().state,'RECONCILE_REQUIRED');
});
test('lease cancellation after provider response prevents upload',async()=>{
  const f=fixture();await f.ledger.reserveStorytimeNarratorWrite(f.identity());
  f.rows.set('jobs/job1',{...job(),status:'CANCELLED',execution:{leaseToken:'other'},lease:{leaseToken:'other'}});
  await assert.rejects(f.ledger.assertStorytimeNarratorWriteActiveBeforeUpload(f.identity()),/revoked_before_upload/);
  assert.equal(f.ledgerRow().state,'RECONCILE_REQUIRED');
});
test('forged uploadId, output path and lease identity cannot reuse a reservation',async()=>{
  const f=fixture();await f.ledger.reserveStorytimeNarratorWrite(f.identity());
  for(const spoof of [
    {...f.identity(),uploadId:'other'},
    {...f.identity(),objectPath:'storytime/owner1/session1/script1/other.mp3'},
    {...f.identity(),leaseToken:'other'},
  ])await assert.rejects(f.ledger.assertStorytimeNarratorWriteActiveBeforeUpload(spoof),/reservation_unverified/);
  assert.equal(f.ledgerRow().state,'RESERVED');
});
test('genuine generic narration has no Storytime journal authority',async()=>{
  const f=fixture();await f.ledger.assertStorytimeNarratorWriteActiveBeforeUpload(null);
  assert.equal(f.rows.size,3);
});

test('an inherited false active field is not a valid revocation clearance',async()=>{
  const f=fixture();
  f.rows.set('jobConsentBlocks/'+blockId,Object.create({active:false}));
  await assert.rejects(f.ledger.reserveStorytimeNarratorWrite(f.identity()),/storytime_narrator_write_authority_revoked/);
  assert.equal(f.ledgerRow(),undefined);
});
test('an accessor active field cannot act as consent authority or execute its getter',async()=>{
  const f=fixture();let invoked=0;
  const block={};Object.defineProperty(block,'active',{enumerable:true,get(){invoked++;return false;}});
  f.rows.set('jobConsentBlocks/'+blockId,block);
  await assert.rejects(f.ledger.reserveStorytimeNarratorWrite(f.identity()),/storytime_narrator_write_authority_revoked/);
  assert.equal(invoked,0);
  assert.equal(f.ledgerRow(),undefined);
});
test('missing and malformed active fields are refused by the worker',async()=>{
  for(const block of [{}, {active:'false'}, {active:null}, {active:0}, {active:undefined}]){
    const f=fixture();f.rows.set('jobConsentBlocks/'+blockId,block);
    await assert.rejects(f.ledger.reserveStorytimeNarratorWrite(f.identity()),/storytime_narrator_write_authority_revoked/);
    assert.equal(f.ledgerRow(),undefined);
  }
});
test('a literal own false field is the only existing-block clear state',async()=>{
  const f=fixture();f.rows.set('jobConsentBlocks/'+blockId,{active:false});
  await f.ledger.reserveStorytimeNarratorWrite(f.identity());
  assert.equal(f.ledgerRow().state,'RESERVED');
});
test('explicit active=true revocation must refuse provider admission',async()=>{
  const f=fixture();f.rows.set('jobConsentBlocks/'+blockId,{active:true});
  await assert.rejects(f.ledger.reserveStorytimeNarratorWrite(f.identity()),/storytime_narrator_write_authority_revoked/);
  assert.equal(f.ledgerRow(),undefined);
});
test('no existing consent block remains clear without being a positive grant',async()=>{
  const f=fixture();f.rows.delete('jobConsentBlocks/'+blockId);
  await f.ledger.reserveStorytimeNarratorWrite(f.identity());
  assert.equal(f.ledgerRow().state,'RESERVED');
});
