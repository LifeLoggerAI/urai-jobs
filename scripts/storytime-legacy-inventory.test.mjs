import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

// The code under test is extracted from the checked-in source, not a replica.
// No Firebase or GCS writes; classification is read-only.
const ts = createRequire(new URL('../workers/narrator-worker/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../workers/narrator-worker/src/handlers/storytime-write-inventory.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('storytime-write-inventory.ts', source, ts.ScriptTarget.Latest, true);
const constants = ['SAFE', 'AUDIO', 'GEN'];
const functions = ['validateScope', 'classifyStorytimeInventory'];
const declarations = constants.map(name => {
  const node = ast.statements.find(entry => ts.isVariableStatement(entry) && entry.declarationList.declarations.some(d => d.name.getText(ast) === name));
  assert.ok(node, `missing constant ${name}`);
  return node.getText(ast);
});
const bodies = functions.map(name => {
  const node = ast.statements.find(entry => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  assert.ok(node?.body, `missing function ${name}`);
  return node.getText(ast);
});
const built = ts.transpileModule([...declarations, ...bodies,
  'module.exports={classifyStorytimeInventory};'].join('\n'),
  {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.equal((built.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
const module = { exports: {} };
vm.runInNewContext(built.outputText, {module,exports:module.exports,String,Number,Object,Map,Set,Array,Error});
const classify = module.exports.classifyStorytimeInventory;
const scope = {ownerUid:'synthetic-owner',sessionId:'session1',narratorScriptId:'script1'};
const bucket = 'synthetic-audio-bucket';
const prefix='storytime/synthetic-owner/session1/script1/';
const uuid='11111111-1111-4111-8111-111111111111';
const valid=prefix+uuid+'.mp3';
const make = (name, generation='42', uploadId=undefined) => ({name,generation,uploadId});

test('recognizes the exactly pinned new object without granting cleanup authority', () => {
  const row={id:'reservation1',ownerUid:scope.ownerUid,sessionId:scope.sessionId,
    narratorScriptId:scope.narratorScriptId,bucket,objectPath:valid,
    uploadId:'upload1',artifactGeneration:'42',state:'STORED_PENDING_JOB'};
  const [v]=classify(scope,bucket,[make(valid,'42','upload1')],[row]);
  assert.equal(v.state,'REVIEW_REFERENCED');
  assert.equal(v.reason,'stored_requires_current_job_and_rights_validation');
});
test('legacy non-UUID mp3 inside owner/script scope is surfaced as unresolved, not discarded', () => {
  const name=prefix+'recording-2025-09.mp3';
  const [v]=classify(scope,bucket,[make(name)],[]);
  assert.equal(v.objectPath,name);
  assert.equal(v.state,'UNRESOLVED');
  assert.equal(v.reason,'legacy_or_unrecognized_object_name');
});
test('legacy audio in an older extension is inventoried but never treated as safe to delete', () => {
  const name=prefix+'voiceover-original.wav';
  const [v]=classify(scope,bucket,[make(name)],[]);
  assert.equal(v.state,'UNRESOLVED');
  assert.equal(v.reason,'legacy_or_unrecognized_object_name');
});
test('unusual nested object name under exact prefix is reported without granting authority', () => {
  const name=prefix+'older-export/audio.mp3';
  const [v]=classify(scope,bucket,[make(name)],[]);
  assert.equal(v.state,'UNRESOLVED');
  assert.equal(v.reason,'legacy_or_unrecognized_object_name');
});
test('foreign owner prefix is rejected instead of included in private inventory', () => {
  const foreign='storytime/foreign-owner/session1/script1/'+uuid+'.mp3';
  assert.throws(()=>classify(scope,bucket,[make(foreign)],[]),/storytime_inventory_object_boundary_unverified/);
});
test('duplicate physical object name cannot appear twice in a report', () => {
  assert.throws(()=>classify(scope,bucket,[make(valid),make(valid)],[]),/storytime_inventory_object_boundary_unverified/);
});
test('invalid ownership of ledger record remains rejected', () => {
  const row={id:'reservation1',ownerUid:'foreign-owner',sessionId:scope.sessionId,
    narratorScriptId:scope.narratorScriptId,bucket,objectPath:valid,
    uploadId:'upload1',artifactGeneration:'42',state:'STORED_PENDING_JOB'};
  assert.throws(()=>classify(scope,bucket,[make(valid)],[row]),/storytime_inventory_ledger_unverified/);
});
