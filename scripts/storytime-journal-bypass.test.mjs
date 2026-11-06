import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

// Execute the current checked-in Storytime upload identity validator. Only
// its TypeScript AST declarations are compiled; no cloud account is touched.
const ts = createRequire(new URL('../workers/narrator-worker/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../workers/narrator-worker/src/handlers/storytime-write-ledger.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('storytime-write-ledger.ts', source, ts.ScriptTarget.Latest, true);
const constants = ['SAFE_ID', 'UUID_AUDIO', 'GENERATION', 'PURPOSE'];
const functions = ['record', 'validId', 'storytimeNarratorWriteIdentity'];
const declarations = constants.map(name => {
  const node = ast.statements.find(x => ts.isVariableStatement(x) &&
    x.declarationList.declarations.some(d => d.name.getText(ast) === name));
  assert.ok(node, `missing checked-in constant: ${name}`);
  return node.getText(ast);
});
const bodies = functions.map(name => {
  const node = ast.statements.find(x => ts.isFunctionDeclaration(x) && x.name?.text === name);
  assert.ok(node?.body, `missing checked-in function: ${name}`);
  return node.getText(ast);
});
const transpiled = ts.transpileModule([...declarations, ...bodies,
  'module.exports = { storytimeNarratorWriteIdentity };'].join('\n'),
{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.equal((transpiled.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
const module = {exports:{}};
vm.runInNewContext(transpiled.outputText, {module, exports:module.exports,
  createHash, String, Number, Object, Array, Error,
  process:{env:{GCS_BUCKET_NAME:'synthetic-audio-bucket'}}});
const identity = module.exports.storytimeNarratorWriteIdentity;
const uuid='11111111-1111-4111-8111-111111111111';
const path='storytime/owner-1/session-1/script-1/'+uuid+'.mp3';
const job = () => ({jobId:'job-1',type:'narrator.tts',sourceSystem:'urai-storytime',
  ownerUid:'owner-1',sourceSessionId:'session-1',sourceNarratorScriptId:'script-1',
  leaseToken:'synthetic-lease',
  consent:{purpose:'storytime.voiceover',policyVersion:'1.0',decisionReceiptId:'synthetic-receipt'},
  payload:{outputPrefix:'storytime/owner-1/session-1/script-1'}});

test('properly bound Storytime output reserves the exact owner and lease',()=>{
  const r=identity(job(),path,'upload-1');
  assert.equal(r.ownerUid,'owner-1');
  assert.equal(r.objectPath,path);
  assert.match(r.reservationId,/^[0-9a-f]{64}$/);
});
test('missing sourceSystem must not bypass a Storytime output-prefix journal',()=>{
  const j=job();delete j.sourceSystem;
  assert.throws(()=>identity(j,path,'upload-1'), /storytime_narrator_write_identity_unverified/);
});
test('foreign sourceSystem cannot bypass the Storytime output-prefix journal',()=>{
  const j=job();j.sourceSystem='foreign';
  assert.throws(()=>identity(j,path,'upload-1'), /storytime_narrator_write_identity_unverified/);
});
test('Storytime consent marker alone requires journal despite stripped outputPrefix',()=>{
  const j=job();delete j.sourceSystem;j.payload.outputPrefix='tts';
  assert.throws(()=>identity(j,'tts/'+uuid+'.mp3','upload-1'), /storytime_narrator_write_identity_unverified/);
});
test('Storytime script/session markers cannot silently downgrade to generic narration',()=>{
  const j=job();delete j.sourceSystem;j.payload.outputPrefix='tts';
  j.consent={purpose:'generic.narration'};
  assert.throws(()=>identity(j,'tts/'+uuid+'.mp3','upload-1'), /storytime_narrator_write_identity_unverified/);
});
test('Storytime object path cannot bypass journal with a forged generic payload',()=>{
  const j=job();delete j.sourceSystem;delete j.sourceSessionId;delete j.sourceNarratorScriptId;
  j.payload.outputPrefix='tts';j.consent={purpose:'generic.narration'};
  assert.throws(()=>identity(j,path,'upload-1'), /storytime_narrator_write_identity_unverified/);
});
test('genuine generic narrator output remains outside Storytime-specific ledger',()=>{
  const j={jobId:'generic',type:'narrator.tts',sourceSystem:'generic',payload:{outputPrefix:'tts'}};
  assert.equal(identity(j,'tts/'+uuid+'.mp3','upload-1'),null);
});
test('recognized Storytime source missing required lease is rejected',()=>{
  const j=job();delete j.leaseToken;
  assert.throws(()=>identity(j,path,'upload-1'), /storytime_narrator_write_identity_unverified/);
});
