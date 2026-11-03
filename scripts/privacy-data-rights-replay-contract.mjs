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
  process: {env: {GCS_BUCKET_NAME: 'synthetic-bucket'}},
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
  gcsRef:`gs://synthetic-bucket/privacy/data-rights/${ownerHash}/synthetic-request-01/export.json`,
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
  ['export missing payload', reseal({recordCount:0,gcsRef:exportResult.gcsRef},validExportReceipt),{...request,requestType:'EXPORT'}],
  ['export owner mismatch', reseal({...exportResult,payload:{...exportPayload,ownerUid:'foreign-owner'}},validExportReceipt),{...request,requestType:'EXPORT'}],
  ['export claims complete ecosystem', reseal({...exportResult,payload:{...exportPayload,completeEcosystemExport:true}},validExportReceipt),{...request,requestType:'EXPORT'}],
  ['export wrong GCS bucket despite valid receipt digest', reseal({...exportResult,gcsRef:`gs://foreign-bucket/privacy/data-rights/${ownerHash}/synthetic-request-01/export.json`},validExportReceipt),{...request,requestType:'EXPORT'}],
  ['export wrong owner hash despite valid receipt digest', reseal({...exportResult,gcsRef:`gs://synthetic-bucket/privacy/data-rights/${'f'.repeat(64)}/synthetic-request-01/export.json`},validExportReceipt),{...request,requestType:'EXPORT'}],
  ['export wrong request directory despite valid receipt digest', reseal({...exportResult,gcsRef:`gs://synthetic-bucket/privacy/data-rights/${ownerHash}/other-synthetic-request/export.json`},validExportReceipt),{...request,requestType:'EXPORT'}],
  ['export extra unbound directory despite valid receipt digest', reseal({...exportResult,gcsRef:`gs://synthetic-bucket/privacy/data-rights/extra/${ownerHash}/synthetic-request-01/export.json`},validExportReceipt),{...request,requestType:'EXPORT'}],
  ['export wrong object name despite valid receipt digest', reseal({...exportResult,gcsRef:`gs://synthetic-bucket/privacy/data-rights/${ownerHash}/synthetic-request-01/export.json.bak`},validExportReceipt),{...request,requestType:'EXPORT'}],
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


// Execute the maintained DELETE function itself with an in-memory Firestore
// double: replay-only testing cannot detect private fields surviving merge.
const deleteStart = content.indexOf('async function executeDelete(db: Firestore, requestId: string, ownerUid: string) {');
const deleteEnd = content.indexOf('\n}\n\nconst handler', deleteStart) + 2;
assert.ok(deleteStart >= 0 && deleteEnd > deleteStart,
  'Original Jobs deletion function must remain source-bound');
const deleteModuleText = content.slice(deleteStart, deleteEnd)
  + '\nmodule.exports.executeDeleteFromSource = executeDelete;';
const deleteCompiled = ts.transpileModule(deleteModuleText, {
  fileName: 'JobsDataRightsDelete.ts', reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
assert.equal(deleteCompiled.diagnostics?.length ?? 0, 0, 'Source-bound deletion transpiles');
const deletedSentinel = Symbol('synthetic-FieldValue-delete');
const deletionModule = { exports: {} };
runInNewContext(deleteCompiled.outputText, {
  module: deletionModule, exports: deletionModule.exports, Promise, createHash,
  ownedJobs: async db => db.syntheticOwnedJobs,
  FieldValue: {
    delete: () => deletedSentinel,
    serverTimestamp: () => 'SYNTHETIC_SERVER_TIMESTAMP',
  },
  EXECUTION_SCHEMA: 'urai-jobs-data-rights-execution-v1',
  httpsError: (code, message) => Object.assign(new Error(message), { code }),
}, { filename: 'JobsDataRightsDelete.js', timeout: 2000 });
const executeDeleteFromSource = deletionModule.exports.executeDeleteFromSource;

function deletionHarness({ logCount = 2, hasQueue = true, jobCount = 1 } = {}) {
  const jobs = Array.from({ length: jobCount }, (_, i) => ({
    ownerUid, type: 'private-movie', status: 'DONE',
    payload: { privateNarration: 'synthetic secret' },
    output: { privatePreview: 'synthetic-video-path' },
    consent: {privateGrant: 'synthetic-grant'},
    customPrivateMetadata: { sensitive: 'must-not-survive' },
    providerAuth: 'synthetic-provider-private-id',
    unrestrictedFutureField: { private: true },
    id: i,
  }));
  const deletedRefs = [], writes = [], userPatches = [];
  let committed = 0;
  const docs = jobs.map((_, i) => {
    const jobRef = {
      type: 'job', i,
      collection(name) {
        assert.equal(name, 'logs');
        return {
          limit: bound => {
            assert.equal(bound, 500);
            return {get: async () => ({
              size: logCount,
              docs: Array.from({length:logCount}, (_, j) =>
                ({ref:{type:'log',job:i,log:j}})),
            })};
          },
        };
      },
    };
    return {id:'synthetic-job-' + i, ref:jobRef};
  });
  const db = {
    syntheticOwnedJobs: docs,
    batch() {
      const operations = [];
      return {
        delete(ref) {operations.push({kind:'delete',ref});},
        set(ref, data, opts) {operations.push({kind:'set',ref,data,opts});},
        async commit() {
          committed++;
          for (const op of operations) {
            if (op.kind === 'delete') {deletedRefs.push(op.ref); continue;}
            writes.push(op);
            const current = jobs[op.ref.i];
            const next = op.opts?.merge ? {...current, ...op.data} : {...op.data};
            for (const [key,value] of Object.entries(next)) {
              if (value === deletedSentinel) delete next[key];
            }
            jobs[op.ref.i] = next;
          }
        },
      };
    },
    collection(name) {
      if (name === 'jobQueue') return {
        doc: id => ({
          type: 'queue', id,
          get: async () => ({exists: hasQueue}),
        }),
      };
      if (name === 'users') return {
        doc: id => {
          assert.equal(id, ownerUid);
          return {set: async (data,opts) => userPatches.push({data,opts})};
        },
      };
      throw new Error('unexpected private collection ' + name);
    },
  };
  return {db,jobs,deletedRefs,writes,userPatches,get commits(){return committed;}};
}

test('DELETE replaces each owner job with a receipt-only tombstone, never retains unknown private fields', async () => {
  const h=deletionHarness({jobCount:2});
  const result=await executeDeleteFromSource(h.db,'synthetic-request-01',ownerUid);
  assert.equal(result.jobsAnonymized,2);
  assert.equal(result.queueDeletes,2);
  assert.equal(result.logDeletes,4);
  assert.equal(h.commits,2);
  for (const job of h.jobs) {
    assert.deepEqual(Object.keys(job).sort(),['ownerUid','deletionReceipt','updatedAt'].sort());
    assert.equal(job.ownerUid,'deleted:'+ownerHash);
    assert.equal(job.deletionReceipt.requestId,'synthetic-request-01');
    assert.equal(job.deletionReceipt.ownerHash,ownerHash);
  }
  assert.ok(h.writes.every(write => write.opts?.merge !== true),
    'an anonymization receipt must never be merged with private original fields');
  assert.equal(h.deletedRefs.length,6);
  assert.equal(h.userPatches.length,1);
  assert.equal(h.userPatches[0].data.dataRightsDeletionPendingCentralPrivacy,true);
  assert.equal(h.userPatches[0].opts.merge,true);
  assert.ok(result.unresolvedDomains.includes('cross-system-data-owned-by-other-urai-services'));
});

test('DELETE refuses 500 logs before job tombstone, cannot claim bounded job deletion', async () => {
  const h=deletionHarness({logCount:500});
  await assert.rejects(
    executeDeleteFromSource(h.db,'synthetic-request-01',ownerUid),
    /too many logs|bounded deletion/i
  );
  assert.equal(h.commits,0);
  assert.equal(h.userPatches.length,0);
  assert.equal(h.writes.length,0);
});

test('DELETE with zero owned jobs reports central privacy pending, not ecosystem completion', async () => {
  const h=deletionHarness({jobCount:0});
  const r=await executeDeleteFromSource(h.db,'synthetic-request-01',ownerUid);
  assert.equal(r.jobsAnonymized,0);
  assert.equal(r.queueDeletes,0);
  assert.equal(r.logDeletes,0);
  assert.equal(h.writes.length,0);
  assert.equal(h.userPatches.length,1);
  assert.equal(h.userPatches[0].data.dataRightsDeletionPendingCentralPrivacy,true);
  assert.ok(!Object.prototype.hasOwnProperty.call(r,'crossSystemComplete'));
});
