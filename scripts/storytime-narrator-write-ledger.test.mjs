import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const ts = createRequire(new URL('../workers/narrator-worker/package.json',import.meta.url))('typescript');
function extract(file,constants,functions,context={}){
  const source=readFileSync(new URL(file,import.meta.url),'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  const snippets=[];
  for(const name of constants){
    const node=ast.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)===name));
    assert.ok(node,'missing const '+name);
    snippets.push(node.getText(ast));
  }
  for(const name of functions){
    const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
    assert.ok(node,'missing function '+name);
    snippets.push(node.getText(ast));
  }
  const sourceCode=snippets.join('\n')+'\nmodule.exports={'+functions.join(',')+'};';
  const built=ts.transpileModule(sourceCode,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
  const errors=(built.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,'TypeScript transpilation diagnostics');
  const module={exports:{}};
  vm.runInNewContext(built.outputText,{module,exports:module.exports,createHash,process:{env:{GCS_BUCKET_NAME:'test-narrator-bucket'}},String,Number,Object,Array,Set,Map,RegExp,Error,...context});
  return module.exports;
}
const writer=extract('../workers/narrator-worker/src/handlers/storytime-write-ledger.ts',
  ['SAFE_ID','UUID_AUDIO','GENERATION','PURPOSE'],
  ['record','validId','safeGeneration','storytimeNarratorWriteIdentity','authorizedLive']);
const inventory=extract('../workers/narrator-worker/src/handlers/storytime-write-inventory.ts',
  ['SAFE','AUDIO','GEN'],['validateScope','classifyStorytimeInventory']);
const uuid='11111111-1111-4111-8111-111111111111';
const path='storytime/owner1/session1/script1/'+uuid+'.mp3';
const job=()=>({jobId:'job1',type:'narrator.tts',sourceSystem:'urai-storytime',
  ownerUid:'owner1',sourceSessionId:'session1',sourceNarratorScriptId:'script1',
  leaseToken:'lease1',payload:{outputPrefix:'storytime/owner1/session1/script1'},
  consent:{purpose:'storytime.voiceover',policyVersion:'v1',decisionReceiptId:'receipt1'}});
const scope={ownerUid:'owner1',sessionId:'session1',narratorScriptId:'script1'};
const identity=()=>writer.storytimeNarratorWriteIdentity(job(),path,'upload1');
const row=()=>({...identity(),id:identity().reservationId,artifactGeneration:'42',state:'STORED_PENDING_JOB'});
function snap(value){return {exists:true,data:()=>value};}
function live({status='RUNNING',lease='lease1',deleted=false,disabled=false,pending=false,blocked=false,consent='receipt1'}={}){
  const j=job();
  return [
    snap({...j,status,execution:{leaseToken:lease},lease:{leaseToken:lease},consent:{...j.consent,decisionReceiptId:consent}}),
    snap({dataRightsDeletionPendingCentralPrivacy:deleted,disabled,deletionPending:pending}),
    snap({active:blocked}),
  ];
}
test('valid Storytime writer gets deterministic scoped reservation',()=>{
  const a=identity();assert.equal(a.objectPath,path);assert.equal(a.bucket,'test-narrator-bucket');
  assert.equal(a.reservationId,identity().reservationId);assert.match(a.reservationId,/^[a-f0-9]{64}$/);
});
test('non-Storytime remains outside new ledger',()=>{
  const j=job();j.sourceSystem='other';assert.equal(writer.storytimeNarratorWriteIdentity(j,path,'upload1'),null);
});
test('rejects malformed job, source, consent, lease, and file prefix',()=>{
  for(const mutate of [
    j=>j.ownerUid='bad/owner',j=>j.jobId='',j=>j.leaseToken='',
    j=>j.payload.outputPrefix='tts',j=>j.consent.purpose='life-movie.render',
    j=>j.consent.decisionReceiptId='',j=>j.type='other',
  ]){
    const j=job();mutate(j);
    assert.throws(()=>writer.storytimeNarratorWriteIdentity(j,path,'upload1'));
  }
  assert.throws(()=>writer.storytimeNarratorWriteIdentity(job(),path.replace(uuid,'foreign'), 'upload1'));
  assert.throws(()=>writer.storytimeNarratorWriteIdentity(job(),path.replace('.mp3','.txt'),'upload1'));
});
test('live lease and source admit in-flight result',()=>{
  assert.equal(writer.authorizedLive(identity(),live()),true);
});
test('cancelled, expired lease, revoked consent or deletion pending veto',()=>{
  for(const change of [{status:'CANCELLED'},{lease:'different'},{deleted:true},{disabled:true},{pending:true},{blocked:true},{consent:'other'}]){
    assert.equal(writer.authorizedLive(identity(),live(change)),false);
  }
});
test('missing or malformed source snapshots veto',()=>{
  assert.equal(writer.authorizedLive(identity(),[{exists:false},...live().slice(1)]),false);
  assert.equal(writer.authorizedLive(identity(),[live()[0],{exists:false},live()[2]]),false);
  assert.equal(writer.authorizedLive(identity(),[live()[0],live()[1],snap({active:'false'})]),false);
});
test('unsafe and unpinned generation rejected',()=>{
  for(const n of [null,undefined,0,'0','01','9007199254740992',42,''])assert.equal(writer.safeGeneration(n),false);
  assert.equal(writer.safeGeneration('42'),true);
});
test('matching journal still requires current rights check',()=>{
  const e=inventory.classifyStorytimeInventory(scope,'test-narrator-bucket',
    [{name:path,generation:'42',uploadId:'upload1'}],[row()]);
  assert.equal(e[0].state,'REVIEW_REFERENCED');
  assert.equal(e[0].reason,'stored_requires_current_job_and_rights_validation');
});
test('unknown legacy object never authorized for cleanup',()=>{
  const e=inventory.classifyStorytimeInventory(scope,'test-narrator-bucket',
    [{name:path,generation:'42',uploadId:'upload1'}],[]);
  assert.equal(e[0].state,'UNRESOLVED');
  assert.equal(e[0].reason,'legacy_or_orphan_without_reservation');
});
test('changed generation, missing metadata, altered upload identity are unresolved',()=>{
  for(const obj of [
    {name:path,generation:'43',uploadId:'upload1'},
    {name:path,generation:'42',uploadId:'other'},
    {name:path,generation:42,uploadId:'upload1'},
  ]){
    const e=inventory.classifyStorytimeInventory(scope,'test-narrator-bucket',[obj],[row()]);
    assert.equal(e[0].reason,'generation_or_upload_id_unverified');
  }
});
test('unsealed reservation and vanished objects are unresolved',()=>{
  const r=row();r.state='RESERVED';
  assert.equal(inventory.classifyStorytimeInventory(scope,'test-narrator-bucket',
    [{name:path,generation:'42',uploadId:'upload1'}],[r])[0].reason,'unresolved_write_state');
  assert.equal(inventory.classifyStorytimeInventory(scope,'test-narrator-bucket',[],[r])[0].reason,
    'journal_without_current_object');
});
test('foreign scope and duplicated ledger record cannot be adopted',()=>{
  const r=row();r.ownerUid='foreign';
  assert.throws(()=>inventory.classifyStorytimeInventory(scope,'test-narrator-bucket',
    [{name:path,generation:'42',uploadId:'upload1'}],[r]));
  assert.equal(inventory.classifyStorytimeInventory(scope,'test-narrator-bucket',
    [{name:path,generation:'42',uploadId:'upload1'}],[row(),row()])[0].reason,
    'ambiguous_multiple_reservations');
});
test('rejects foreign, unsafe or duplicate object paths',()=>{
  assert.throws(()=>inventory.classifyStorytimeInventory(scope,'test-narrator-bucket',
    [{name:'storytime/other/session1/script1/'+uuid+'.mp3'}],[]));
  assert.throws(()=>inventory.classifyStorytimeInventory(scope,'test-narrator-bucket',
    [{name:path},{name:path}],[]));
});
test('worker saves only after reservation and checks seal after metadata',()=>{
  const s=readFileSync(new URL('../workers/narrator-worker/src/handlers/narrator-tts.ts',import.meta.url),'utf8');
  const reserve=s.indexOf('await reserveStorytimeNarratorWrite(reservation)');
  const save=s.indexOf('await file.save(audioBuffer');
  const seal=s.indexOf('await sealStorytimeNarratorWrite(reservation, artifactGeneration)');
  assert.ok(reserve>=0&&reserve<save&&save<seal);
  assert.match(s,/ifGenerationMatch: artifactGeneration/);
  assert.match(s,/noteStorytimeNarratorWriteCompensation/);
});
