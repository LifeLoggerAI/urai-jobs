import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const ts=createRequire(new URL('../workers/narrator-worker/package.json',import.meta.url))('typescript');
const source=readFileSync(new URL('../workers/narrator-worker/src/handlers/storytime-write-inventory.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.equal((compiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const scope={ownerUid:'owner-1',sessionId:'session-1',narratorScriptId:'script-1'};
const prefix='storytime/owner-1/session-1/script-1/';
const path=prefix+'11111111-1111-4111-8111-111111111111.mp3';
const obj={name:path,generation:'42',uploadId:'upload-1'};
const row={id:'journal-1',ownerUid:scope.ownerUid,sessionId:scope.sessionId,narratorScriptId:scope.narratorScriptId,bucket:'test-bucket',objectPath:path,state:'STORED_PENDING_JOB',artifactGeneration:'42',uploadId:'upload-1'};
function harness({docs=[],files=[],nextQuery=null,apiResponse={}}={}){
  const calls=[];const module={exports:{}};
  const Firestore=()=>({
    collection(name){
      assert.equal(name,'storytimeNarratorWriteReservations');
      return {where(key,operator,val){
        calls.push(['where',key,operator,val]);
        return {limit(n){
          calls.push(['limit',n]);
          return {get:async()=>({docs})};
        }};
      }};
    },
  });
  class FakeStorage {bucket(bucket){assert.equal(bucket,'test-bucket');return{getFiles:async options=>{calls.push(['getFiles',options]);return[files,nextQuery,apiResponse]}};}}
  const imports={
    'firebase-admin/app':{getApps:()=>[{}],initializeApp:()=>{}},
    'firebase-admin/firestore':{getFirestore:Firestore},
    '@google-cloud/storage':{Storage:FakeStorage},
    './storytime-write-ledger.js':{STORYTIME_NARRATOR_WRITES:'storytimeNarratorWriteReservations'},
  };
  vm.runInNewContext(compiled.outputText,{exports:module.exports,module,require:name=>{assert.ok(name in imports,'unknown dependency '+name);return imports[name]},process:{env:{GCS_BUCKET_NAME:'test-bucket'}},Object,Number,Map,Set,String,Array,Error});
  return {...module.exports,calls};
}
function doc(id,value){return{id,data:()=>value}};
const blankOwnerRows=()=>Array.from({length:101},(_,i)=>doc('other-'+i,{...row,id:'other-'+i,sessionId:'another-session',narratorScriptId:'other-script',objectPath:'storytime/owner-1/another-session/other-script/other-'+i+'.mp3'}));

test('incomplete owner journal scan cannot label a matching audio object orphaned',()=>{
  const h=harness();const out=h.classifyStorytimeInventory(scope,'test-bucket',[obj],[],{ledgerComplete:false,objectComplete:true});
  assert.equal(out[0].state,'UNRESOLVED');
  assert.equal(out[0].reason,'ledger_scan_incomplete');
});
test('complete journal scan can identify unknown canonical names as unjournaled',()=>{
  const h=harness();const out=h.classifyStorytimeInventory(scope,'test-bucket',[obj],[],{ledgerComplete:true,objectComplete:true});
  assert.equal(out[0].reason,'legacy_or_orphan_without_reservation');
});
test('incomplete physical object scan cannot claim a journal object is missing',()=>{
  const h=harness();const out=h.classifyStorytimeInventory(scope,'test-bucket',[],[row],{ledgerComplete:true,objectComplete:false});
  assert.equal(out[0].state,'UNRESOLVED');
  assert.equal(out[0].reason,'object_scan_incomplete');
});
test('complete scan can report missing journal object without deletion authority',()=>{
  const h=harness();const out=h.classifyStorytimeInventory(scope,'test-bucket',[],[row],{ledgerComplete:true,objectComplete:true});
  assert.equal(out[0].reason,'journal_without_current_object');
  assert.equal(out[0].state,'UNRESOLVED');
});
test('owner-wide 101 records from other sessions yields unknown, never orphan',async()=>{
  const h=harness({docs:blankOwnerRows(),files:[obj]});
  const report=await h.inspectStorytimeNarratorInventory(scope);
  assert.equal(report.truncated,true);
  assert.equal(report.entries.length,1);
  assert.equal(report.entries[0].reason,'ledger_scan_incomplete');
  assert.equal(report.complete,false);
  assert.equal(report.deletionAcknowledged,false);
});
test('Storage nextQuery marks scan incomplete even if page has fewer than 100 files',async()=>{
  const h=harness({docs:[doc('journal-1',row)],files:[],nextQuery:{pageToken:'next'}});
  const report=await h.inspectStorytimeNarratorInventory(scope);
  assert.equal(report.truncated,true);
  assert.equal(report.entries[0].reason,'object_scan_incomplete');
});
test('Storage API nextPageToken marks scan incomplete without a nextQuery',async()=>{
  const h=harness({docs:[doc('journal-1',row)],files:[],apiResponse:{nextPageToken:'next'}});
  const report=await h.inspectStorytimeNarratorInventory(scope);
  assert.equal(report.truncated,true);
  assert.equal(report.entries[0].reason,'object_scan_incomplete');
});
test('fully matched generation and upload ID still requires live rights review',()=>{
  const h=harness();const out=h.classifyStorytimeInventory(scope,'test-bucket',[obj],[row],{ledgerComplete:false,objectComplete:false});
  assert.equal(out[0].reason,'stored_requires_current_job_and_rights_validation');
  assert.equal(out[0].state,'REVIEW_REFERENCED');
});
test('foreign owner object and duplicate object both remain errors',()=>{
  const h=harness();
  assert.throws(()=>h.classifyStorytimeInventory(scope,'test-bucket',[{...obj,name:path.replace('owner-1','someone-else')}],[]),/storytime_inventory_object_boundary_unverified/);
  assert.throws(()=>h.classifyStorytimeInventory(scope,'test-bucket',[obj,obj],[]),/storytime_inventory_object_boundary_unverified/);
});
test('noncanonical legacy name remains unresolved regardless of journal coverage',()=>{
  const h=harness();
  const out=h.classifyStorytimeInventory(scope,'test-bucket',[{name:prefix+'old.wav'}],[],{ledgerComplete:false,objectComplete:false});
  assert.equal(out[0].reason,'legacy_or_unrecognized_object_name');
  assert.equal(out[0].state,'UNRESOLVED');
});
