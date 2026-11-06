import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';

// Exercise checked-in Storytime path and deletion functions, not a rewritten
// validator. Firestore and Cloud Storage are synthetic to test the side-effect
// boundary; the full Firebase emulator/production lifecycle is a separate gate.
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../functions/src/jobs/storytimeNarratorBridge.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('storytimeNarratorBridge.ts', source, ts.ScriptTarget.Latest, true);
const names = ['parseArtifactPath', 'pinnedNarratorGeneration', 'artifactLocation', 'deleteOutput'];
const clauses = names.map((name) => {
  const node = ast.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  assert.ok(node?.body, 'missing checked-in Storytime function: ' + name);
  return node.getText(ast);
});
const compiled = ts.transpileModule([...clauses, 'module.exports={artifactLocation,deleteOutput};'].join('\n'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const owner = {userId: 'synthetic-owner', sessionId: 'synthetic-session', narratorScriptId: 'script-1', jobId: 'synthetic-job'};
const pathFor = (script, user = owner.userId, session = owner.sessionId) =>
  `gs://synthetic-audio-bucket/storytime/${user}/${session}/${script}/synthetic.mp3`;
let currentPath = pathFor('script-1');
let currentStatus = 'SUCCESS';
let deletions = 0;
let updates = 0;
const module = { exports: {} };
vm.runInNewContext(compiled, {
  module, exports: module.exports, process: {env: {GCS_BUCKET_NAME: 'synthetic-audio-bucket'}},
  loadBoundJob: async () => ({ status: currentStatus, output: {artifactPath: currentPath,artifactGeneration:'42'} }),
  assertBoundJob: (job) => job,
  getFirestore: () => ({runTransaction: async (fn) => fn({
    get: async () => ({exists:true,data: () => ({status:currentStatus,output:{artifactPath:currentPath,artifactGeneration:'42'}})}),
    update: () => {updates++;},
  })}),
  getStorage: () => ({ bucket: () => ({file: () => ({
    delete: async () => {deletions++;},
    getMetadata: async () => {throw Object.assign(new Error('not-found'),{code:404});},
  })}) }),
  jobDoc: () => ({}),
  FieldValue: {serverTimestamp: () => 'now', delete: () => 'deleted'},
  String, Error, Object,
});
const {artifactLocation, deleteOutput} = module.exports;

test('exact owner/session/script narrator artifact is accepted', async () => {
  const r = await artifactLocation(owner);
  assert.equal(r.location.objectPath, 'storytime/synthetic-owner/synthetic-session/script-1/synthetic.mp3');
});
test('a sibling script artifact must not be deleted through a correctly bound job', async () => {
  currentPath = pathFor('script-2');
  const before = deletions;
  await assert.rejects(deleteOutput(owner), /narrator_artifact_boundary_mismatch/);
  assert.equal(deletions, before);
  assert.equal(updates, 0);
});
test('prefix-collision script identifiers are rejected', async () => {
  currentPath = pathFor('script-11');
  await assert.rejects(artifactLocation(owner), /narrator_artifact_boundary_mismatch/);
});
test('foreign-owner artifact is denied before storage deletion', async () => {
  currentPath = pathFor('script-1', 'foreign-owner');
  await assert.rejects(deleteOutput(owner), /narrator_artifact_boundary_mismatch/);
  assert.equal(deletions, 0);
});
test('foreign-session artifact is denied', async () => {
  currentPath = pathFor('script-1', owner.userId, 'foreign-session');
  await assert.rejects(artifactLocation(owner), /narrator_artifact_boundary_mismatch/);
});
test('foreign-bucket artifact is denied', async () => {
  currentPath = 'gs://foreign-bucket/storytime/synthetic-owner/synthetic-session/script-1/synthetic.mp3';
  await assert.rejects(artifactLocation(owner), /narrator_artifact_boundary_mismatch/);
});
test('noncanonical storage reference is denied', async () => {
  currentPath = 'http://synthetic-audio-bucket/storytime/synthetic-owner/synthetic-session/script-1/file.mp3';
  await assert.rejects(artifactLocation(owner), /narrator_artifact_missing/);
});
test('successful exact-script delete still uses existing owner-bound output operation', async () => {
  currentPath = pathFor('script-1');
  const r = await deleteOutput(owner);
  assert.equal(r.deleted, true);
  assert.equal(deletions, 1);
  assert.equal(updates, 1);
});
