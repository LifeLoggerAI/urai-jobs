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
const moduleText = `async function transactionFromSource(db, requestRef, executionRef, parsed, admission) {\n${fragment}\nreturn request;\n}\nmodule.exports.transactionFromSource = transactionFromSource;`;
const compiled = ts.transpileModule(moduleText, {
  fileName: 'JobsDataRightsTransaction.ts', reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
assert.equal(compiled.diagnostics?.length ?? 0, 0, 'Source-bound transaction transpiles');
const module = { exports: {} };
runInNewContext(compiled.outputText, {
  module, exports: module.exports, Promise, createHash,
  FieldValue: { serverTimestamp: () => 'SYNTHETIC_SERVER_TIMESTAMP' },
  EXECUTION_SCHEMA: 'urai-jobs-data-rights-execution-v1',
  httpsError: (code, message) => Object.assign(new Error(message), { code }),
}, {filename: 'JobsDataRightsTransaction.js', timeout: 2000});
const transactionFromSource = module.exports.transactionFromSource;

const ownerUid = 'synthetic-owner-01';
const ownerHash = createHash('sha256').update(ownerUid).digest('hex');
const request = { ownerUid, requestType: 'DELETE', status: 'IN_REVIEW' };
const receiptId = 'synthetic-retention-decision-0001';
const completed = {
  event: 'DATA_RIGHTS_EXECUTION_FINISHED', schemaVersion: 'urai-jobs-data-rights-execution-v1',
  requestType: 'DELETE', ownerHash, retentionDecisionReceiptId: receiptId,
  terminalState: 'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED',
  resultDigest: 'a'.repeat(64), result: {jobsAnonymized: 1, unresolvedDomains:['synthetic-external']},
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
    data: { retentionDecisionReceiptId: receiptId },
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
