import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash, timingSafeEqual } from 'node:crypto';
import vm from 'node:vm';
import { test } from 'node:test';

// Exercise actual checked-in Storytime HTTP callback via TypeScript AST.
// External Firestore, provider, and schema components are synthetic doubles;
// this does not certify authenticated cloud or Firebase emulator behavior.
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../functions/src/jobs/storytimeNarratorBridge.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('storytimeNarratorBridge.ts', source, ts.ScriptTarget.Latest, true);
const names = ['productionRuntime', 'configuredToken', 'authorized', 'bodyBytes'];
const declarations = names.map((name) => {
  const node = ast.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  assert.ok(node?.body, 'missing checked-in Storytime function: ' + name);
  return node.getText(ast);
});
const registration = ast.statements.find((node) => ts.isVariableStatement(node) &&
  node.declarationList.declarations.some((d) => d.name.getText(ast) === 'storytimeNarratorBridge'));
assert.ok(registration, 'missing checked-in Storytime HTTP registration');
const compiled = ts.transpileModule([
  'const MAX_BODY_BYTES = 24 * 1024;',
  ...declarations,
  registration.getText(ast),
  'module.exports = { handler: storytimeNarratorBridge };',
].join('\n'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

let reads = 0, createCount = 0, deleteCount = 0;
const token = 'synthetic-storytime-review-token';
const module = { exports: {} };
const runtime = {
  module, exports: module.exports,
  process: { env: { NODE_ENV: 'development', FUNCTIONS_EMULATOR: 'true',
    URAI_STORYTIME_JOBS_BRIDGE_TOKEN: token } },
  bridgeTokenSecret: { value: () => '' },
  createHash, timingSafeEqual, Error, String, Set, Buffer, JSON, Date,
  onRequest: (_options, callback) => callback,
  RequestSchema: { safeParse: (value) => ({
    success: !!value && ['create', 'status', 'cancel', 'playback', 'delete-output'].includes(value.action),
    data: value,
  }) },
  createNarratorJob: async () => {createCount++; return {jobId:'synthetic-job',deduplicated:false};},
  loadBoundJob: async () => ({status:'SUCCESS'}),
  safeProjection: (job) => ({status:job.status}),
  cancelJob: async () => ({status:'CANCELLED'}),
  deleteOutput: async () => {deleteCount++; return {deleted:true};},
  getStorage: () => { reads++; throw Error('signed or direct storage reached'); },
};
vm.runInNewContext(compiled, runtime, { timeout: 2000 });
const handler = module.exports.handler;
assert.equal(typeof handler, 'function');

async function call(action = 'playback', bearer = 'Bearer ' + token, payload = null, method = 'POST') {
  let status = 200, response;
  const req = { method, get: () => bearer,
    body: payload ?? {action,userId:'synthetic-owner',sessionId:'synthetic-session',
      narratorScriptId:'synthetic-script',jobId:'synthetic-job'} };
  const res = { set: () => res, status: (value) => {status=value;return res;},
    json: (value) => {response=value;return res;} };
  await handler(req,res);
  return { status, response };
}

test('missing or wrong Studio/Storytime bridge identity cannot fetch private audio', async () => {
  const r=await call('playback','Bearer forged');
  assert.equal(r.status,401);
  assert.equal(r.response.error,'unauthorized');
  assert.equal(reads,0);
});
test('legacy signed playback is explicitly denied before private storage operations', async () => {
  const r=await call('playback');
  assert.equal(r.status,503);
  assert.equal(r.response.ok,false);
  assert.equal(r.response.error,'storytime_authenticated_delivery_required');
  assert.equal(reads,0);
});
test('unknown bridge action is rejected before storage access', async () => {
  const r=await call('something-else');
  assert.equal(r.status,400);
  assert.equal(r.response.ok,false);
  assert.equal(reads,0);
});
test('oversized request denied before private data access',async()=>{
  const r=await call('playback','Bearer '+token,{action:'playback',payload:'x'.repeat(24577)});
  assert.equal(r.status,413);
  assert.equal(reads,0);
});
test('authorized create remains present, with consent enforcement delegated to original create',async()=>{
  const r=await call('create');
  assert.equal(r.status,202);
  assert.equal(r.response.ok,true);
  assert.equal(createCount,1);
});
test('authorized output deletion action still dispatches its existing owner-bound handler',async()=>{
  const r=await call('delete-output');
  assert.equal(r.status,200);
  assert.equal(r.response.deletion.deleted,true);
  assert.equal(deleteCount,1);
});
test('non-POST method denied',async()=>{
  const r=await call('playback','',null,'GET');
  assert.equal(r.status,405);
  assert.equal(r.response.error,'method_not_allowed');
});
test('production source must not mint unrevocable Storytime audio signed URLs',()=>{
  assert.equal(source.includes('.getSignedUrl('),false);
  assert.equal(source.includes('async function playback('),false);
});
