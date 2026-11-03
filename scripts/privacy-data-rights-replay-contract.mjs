import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';

// Executes the actual maintained transaction block from Jobs, with read-only
// synthetic Firestore responses. Never calls Firebase or opens private data.
const sourceFile = new URL('../functions/src/privacy/dataRightsExecution.ts', import.meta.url);
const content = readFileSync(sourceFile, 'utf8');
const start = content.indexOf('  const request = await db.runTransaction(async (transaction) => {');
const stop = content.indexOf('  if (request.replay) return { replay: true, receipt: request.replay };', start);
assert.ok(start >= 0 && stop > start, 'Original protected-staging transaction must remain source-bound');
const fragment = content.slice(start, stop);
const requireFn = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = requireFn('typescript');
const digestStart = content.indexOf('function canonicalDigest(value: unknown) {');
const digestEnd = content.indexOf('\n}', digestStart) + 2;
assert.ok(digestStart >= 0 && digestEnd > digestStart, 'Original result digest function must remain source-bound');
const digestSource = content.slice(digestStart, digestEnd);
const timestampStart = content.indexOf('function timestamp(value: unknown): string | null {');
const timestampEnd = content.indexOf('\n}', timestampStart) + 2;
assert.ok(timestampStart >= 0 && timestampEnd > timestampStart, 'Original timestamp parser must remain source-bound');
const timestampSource = content.slice(timestampStart, timestampEnd);
const moduleText = `${digestSource}\n${timestampSource}\nasync function transactionFromSource(db, requestRef, executionRef, parsed, admission) {\n${fragment}\nreturn request;\n}\nmodule.exports.transactionFromSource = transactionFromSource;`;
const compiled = ts.transpileModule(moduleText, {
  fileName: 'JobsDataRightsTransaction.ts', reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
assert.equal(compiled.diagnostics?.length ?? 0, 0, 'Source-bound transaction transpiles');
const module = { exports: {} };
runInNewContext(compiled.outputText, {
  module, exports: module.exports, Promise, createHash,
  FieldValue: { serverTimestamp: () => 'SYNTHETIC_SERVER_TIMESTAMP' },
  EXECUTION_SCHEMA: 'urai-jobs-data-rights-execution-v1', MAX_OWNED_JOBS: 2000,
  httpsError: (code, message) => Object.assign(new Error(message), { code }),
}, {filename: 'JobsDataRightsTransaction.js', timeout: 2000});
const transactionFromSource = module.exports.transactionFromSource;

const ownerUid = 'synthetic-owner-01';
const ownerHash = createHash('sha256').update(ownerUid).digest('hex');
const request = { ownerUid, requestType: 'DELETE', status: 'IN_REVIEW',
  requestId: 'synthetic-request-01', retentionDecisionReceiptId: 'synthetic-retention-decision-0001' };
const receiptId = 'synthetic-retention-decision-0001';
const unresolvedDomains = [
  'firebase-auth-account', 'provider-side-derivatives',
  'external-artifacts-not-bound-to-jobs-storage',
  'cross-system-data-owned-by-other-urai-services',
];
const completeResult = {jobsAnonymized: 1, queueDeletes: 1, logDeletes: 2, unresolvedDomains};
const completed = {
  event: 'DATA_RIGHTS_EXECUTION_FINISHED', schemaVersion: 'urai-jobs-data-rights-execution-v1',
  requestType: 'DELETE', ownerHash, retentionDecisionReceiptId: receiptId,
  terminalState: 'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED',
  resultDigest: createHash('sha256').update(JSON.stringify(completeResult)).digest('hex'), result: completeResult,
  completedAt: {toDate: () => new Date('2026-11-02T16:00:00.000Z')},
};
const requestRef = {tag:'request'};
const executionRef = {tag:'execution'};
function setup({ prior = completed, record = request, exists = true } = {}) {
  const creates = [], sets = [], gets = [];
  const db = {
    async runTransaction(callback) {
      const transaction = {
        async get(ref) {
          gets.push(ref.tag);
          if (ref === requestRef) return { exists, data: () => record };
          if (ref === executionRef) return { exists: prior !== null, data: () => prior };
          throw new Error('unexpected private document read');
        },
        create(...args) { creates.push(args); },
        set(...args) { sets.push(args); },
      };
      return callback(transaction);
    },
  };
  const invoke = () => transactionFromSource(db, requestRef, executionRef, {
    data: { retentionDecisionReceiptId: receiptId, requestId:'synthetic-request-01' },
  }, {mode:'protected-staging',project:'synthetic-staging'});
  return { invoke, creates, sets, gets };
}

test('completed, owner-bound receipt may be replayed without executing deletion again', async () => {
  const h = setup(); const value = await h.invoke();
  assert.equal(value.replay.event, 'DATA_RIGHTS_EXECUTION_FINISHED');
  assert.equal(h.creates.length, 0); assert.equal(h.sets.length, 0);
});
for (const [label, prior] of [
  ['started execution', {...completed, event:'DATA_RIGHTS_EXECUTION_STARTED'}],
  ['failed execution', {...completed, event:'DATA_RIGHTS_EXECUTION_FAILED'}],
  ['wrong owner', {...completed, ownerHash:'0'.repeat(64)}],
  ['wrong request type', {...completed, requestType:'EXPORT'}],
  ['wrong retention decision', {...completed, retentionDecisionReceiptId:'different-synthetic-decision'}],
  ['missing schema version', {...completed, schemaVersion:undefined}],
  ['incorrect terminal state', {...completed, terminalState:'PROTECTED_STAGING_EXPORT_READY_CENTRAL_DELIVERY_REQUIRED'}],
  ['invalid result digest', {...completed, resultDigest:'truncated'}],
  ['missing result', {...completed, result:null}],
  ['well-formed but incorrect result checksum', {...completed, resultDigest:'b'.repeat(64)}],
  ['changed record count with unchanged digest', {...completed, result:{...completeResult,jobsAnonymized:999}}],
  ['changed unresolved domains with unchanged digest', {...completed, result:{...completeResult,unresolvedDomains:['deleted-everything']}}],
  ['missing fields with unchanged digest', {...completed, result:{}}],
]) {
  test(`existing ${label} must not assert successful replay`, async () => {
    const h = setup({prior});
    await assert.rejects(h.invoke(), /execution|receipt|reconciliation|complete/i);
    assert.equal(h.creates.length, 0); assert.equal(h.sets.length, 0);
  });
}
test('existing receipt never bypasses malformed request schema', async () => {
  const h = setup({record:{...request,ownerUid:null}});
  await assert.rejects(h.invoke(), /schema|reconciliation|receipt/i);
  assert.equal(h.creates.length,0); assert.equal(h.sets.length,0);
});
test('new explicitly approved request creates only a protected-staging STARTED receipt', async () => {
  const h = setup({prior:null,record:{...request,status:'APPROVED'}});
  const value = await h.invoke();
  assert.equal(value.replay,null);
  assert.equal(h.creates.length,1); assert.equal(h.sets.length,1);
  assert.equal(h.creates[0][1].event,'DATA_RIGHTS_EXECUTION_STARTED');
  assert.equal(h.sets[0][1].status,'IN_REVIEW');
  assert.equal(h.creates[0][1].retentionDecisionReceiptId,receiptId);
});
test('new unapproved request fails before audit writes',async()=>{
  const h=setup({prior:null});
  await assert.rejects(h.invoke(), /APPROVED/);
  assert.equal(h.creates.length,0); assert.equal(h.sets.length,0);
});
test('missing private request fails without writes',async()=>{
  const h=setup({exists:false});
  await assert.rejects(h.invoke(), /not found/);
  assert.equal(h.creates.length,0); assert.equal(h.sets.length,0);
});

const exportPayload = {
  schemaVersion: 'urai-jobs-data-rights-execution-v1',
  scope: 'urai-jobs-proven-owner-data', completeEcosystemExport: false,
  ownerUid, requestId: 'synthetic-request-01', user:null, jobs:[], unresolvedDomains,
};
const exportResult = {
  payload: exportPayload, recordCount:0,
  sha256:createHash('sha256').update(JSON.stringify(exportPayload)).digest('hex'),
  gcsRef:'gs://synthetic-bucket/privacy/data-rights/synthetic-owner/synthetic-request-01/export.json',
};
const validExportReceipt = {
  ...completed, requestType:'EXPORT',
  terminalState:'PROTECTED_STAGING_EXPORT_READY_CENTRAL_DELIVERY_REQUIRED',
  result: exportResult,
  resultDigest: createHash('sha256').update(JSON.stringify(exportResult)).digest('hex'),
};
function reseal(result, base=completed) {
  return {...base, result, resultDigest:createHash('sha256').update(JSON.stringify(result)).digest('hex')};
}
test('valid scoped export receipt still replays only its owner data', async () => {
  const h=setup({record:{...request,requestType:'EXPORT'},prior:validExportReceipt});
  const result=await h.invoke();
  assert.equal(result.replay.event,'DATA_RIGHTS_EXECUTION_FINISHED');
  assert.equal(h.creates.length,0); assert.equal(h.sets.length,0);
});
for (const [label, receipt, record] of [
  ['missing completion timestamp', {...completed,completedAt:undefined}, request],
  ['invalid completion timestamp', {...completed,completedAt:{toDate:()=>new Date('invalid')}}, request],
  ['empty but rehashed deletion result', reseal({}), request],
  ['deletion missing pending central domains', reseal({...completeResult,unresolvedDomains:[]}),request],
  ['deletion with fabricated global completion', reseal({...completeResult,completeEcosystemExport:true}),request],
  ['negative deleted job count', reseal({...completeResult,jobsAnonymized:-1}),request],
  ['fractional deleted job count', reseal({...completeResult,jobsAnonymized:0.5}),request],
  ['queue deletes exceed jobs anonymized', reseal({...completeResult,queueDeletes:2}),request],
  ['rehashed log count exceeds per-job deletion capacity', reseal({...completeResult,logDeletes:497}),request],
  ['rehashed logs with zero anonymized jobs', reseal({...completeResult,jobsAnonymized:0,queueDeletes:0,logDeletes:1}),request],
  ['export missing payload', reseal({recordCount:0,gcsRef:exportResult.gcsRef},validExportReceipt),{...request,requestType:'EXPORT'}],
  ['export owner mismatch', reseal({...exportResult,payload:{...exportPayload,ownerUid:'foreign-owner'}},validExportReceipt),{...request,requestType:'EXPORT'}],
  ['export claims complete ecosystem', reseal({...exportResult,payload:{...exportPayload,completeEcosystemExport:true}},validExportReceipt),{...request,requestType:'EXPORT'}],
  ['export GCS location unbound', reseal({...exportResult,gcsRef:'https://foreign.invalid/export'},validExportReceipt),{...request,requestType:'EXPORT'}],
  ['export payload SHA mismatch', reseal({...exportResult,sha256:'0'.repeat(64)},validExportReceipt),{...request,requestType:'EXPORT'}],
]) {
  test('finished receipt ' + label + ' requires reconciliation',async()=>{
    const h=setup({record,prior:receipt});
    await assert.rejects(h.invoke(),/execution|receipt|reconciliation|complete/i);
    assert.equal(h.creates.length,0); assert.equal(h.sets.length,0);
  });
}

// Authority is stored on the private request; caller-supplied receipt strings
// must not stand in for a centrally reviewed retention decision.
for (const [label, record, prior] of [
  ['missing bound retention receipt during initial execution',
    {...request, status: 'APPROVED', retentionDecisionReceiptId: undefined}, null],
  ['mismatched bound retention receipt during initial execution',
    {...request, status: 'APPROVED', retentionDecisionReceiptId: 'other-synthetic-decision'}, null],
  ['missing bound retention receipt during completed replay',
    {...request, retentionDecisionReceiptId: undefined}, completed],
  ['mismatched request record identity during completed replay',
    {...request, requestId:'foreign-synthetic-request'}, completed],
]) {
  test(label + ' denies authority before writes', async()=>{
    const h = setup({record,prior});
    await assert.rejects(h.invoke(), /retention|approval|reconciliation|identity/i);
    assert.equal(h.creates.length,0);
    assert.equal(h.sets.length,0);
  });
}


// Execute the original protected-staging delete implementation in a bounded
// synthetic Firestore double. This is NOT a deletion or Firebase emulator run.
const deleteSourceStart = content.indexOf('async function executeDelete(db: Firestore, requestId: string, ownerUid: string) {');
const deleteSourceStop = content.indexOf('\n}\n\nconst handler =',deleteSourceStart);
assert.ok(deleteSourceStart >= 0 && deleteSourceStop > deleteSourceStart,'Original delete routine must be source-bound');
const maxLogsMatch = content.match(/const MAX_LOGS_PER_DELETE_BATCH = ([0-9]+);/);
assert.ok(maxLogsMatch,'Exact bounded per-job deletion constant must exist');
assert.equal(Number(maxLogsMatch[1]),496,'The batch must reserve operations for job, queue and transforms');
const deleteModuleText = maxLogsMatch[0] + '\n' + content.slice(deleteSourceStart,deleteSourceStop+2)
  + '\nmodule.exports.executeDelete = executeDelete;';
const deleteCompiled = ts.transpileModule(deleteModuleText,{
  fileName:'JobsDataRightsDelete.ts',reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
});
assert.equal(deleteCompiled.diagnostics?.length??0,0);
const deleteModule={exports:{}};
let currentDeleteJobs=[];
const serverTimestampMarker=Symbol('server-timestamp');
runInNewContext(deleteCompiled.outputText,{
  module:deleteModule,exports:deleteModule.exports,createHash,
  EXECUTION_SCHEMA:'urai-jobs-data-rights-execution-v1',
  FieldValue:{delete:()=>Symbol('delete'),serverTimestamp:()=>serverTimestampMarker},
  httpsError:(code,message)=>Object.assign(new Error(message),{code}),
  ownedJobs:async()=>currentDeleteJobs,
},{filename:'JobsDataRightsDelete.js',timeout:2000});
const countServerTimestamps=value=>value===serverTimestampMarker?1
  :!value||typeof value!=='object'?0
  :Object.values(value).reduce((n,item)=>n+countServerTimestamps(item),0);
function deletionBudgetFixture(logCount,queueExists=true){
  const budget={batches:0,commits:0,writeCount:0,userMarkers:0};
  const logs=Array.from({length:logCount},(_,id)=>({ref:{id}}));
  const job={id:'synthetic-owned-job',ref:{collection:(name)=>{
    assert.equal(name,'logs');
    return {limit:n=>({get:async()=>({size:Math.min(n,logCount),docs:logs.slice(0,n)})})};
  }}};
  currentDeleteJobs=[job];
  const db={
    batch(){
      budget.batches++;
      let writes=0;
      return {
        delete(){writes++},
        set(_ref,data){writes+=1+countServerTimestamps(data)},
        async commit(){
          budget.writeCount=writes;
          if(writes>500)throw Error('synthetic-firestore-batch-overflow');
          budget.commits++;
        },
      };
    },
    collection(name){
      if(name==='jobQueue')return{doc:()=>({get:async()=>({exists:queueExists})})};
      if(name==='users')return{doc:()=>({set:async()=>{budget.userMarkers++}})};
      throw Error('unexpected-collection:'+name);
    },
  };
  return {run:()=>deleteModule.exports.executeDelete(db,'synthetic-request','synthetic-owner'),budget};
}
test('protected staging job deletion stays within 500 Firestore writes with 496 logs',async()=>{
  const f=deletionBudgetFixture(496,true);
  const result=await f.run();
  assert.equal(result.logDeletes,496);
  assert.equal(result.jobsAnonymized,1);
  assert.deepEqual(f.budget,{batches:1,commits:1,writeCount:500,userMarkers:1});
  assert.equal(result.unresolvedDomains.length,4);
});
test('497 logs with queue are refused before constructing any deletion batch',async()=>{
  const f=deletionBudgetFixture(497,true);
  await assert.rejects(f.run(),/too many logs|bounded deletion/);
  assert.deepEqual(f.budget,{batches:0,commits:0,writeCount:0,userMarkers:0});
});
test('497 logs without queue also fail conservatively before any writes',async()=>{
  const f=deletionBudgetFixture(497,false);
  await assert.rejects(f.run(),/too many logs|bounded deletion/);
  assert.deepEqual(f.budget,{batches:0,commits:0,writeCount:0,userMarkers:0});
});
test('small legitimate deletion still retains pending central privacy obligation',async()=>{
  const f=deletionBudgetFixture(3,false);
  const result=await f.run();
  assert.equal(result.logDeletes,3);
  assert.equal(result.jobsAnonymized,1);
  assert.equal(result.queueDeletes,0);
  assert.deepEqual(f.budget,{batches:1,commits:1,writeCount:6,userMarkers:1});
});
