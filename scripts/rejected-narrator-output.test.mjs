import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../functions/src/jobs/rejectedNarratorOutput.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('rejectedNarratorOutput.ts', source, ts.ScriptTarget.Latest, true);
const declarations = ['SAFE_ID', 'GCS_GENERATION', 'NARRATOR_FILE'].map(name => {
  const node = ast.statements.find(x => ts.isVariableStatement(x) && x.declarationList.declarations.some(d => d.name.getText(ast) === name));
  assert.ok(node, 'missing ' + name);
  return node.getText(ast);
});
const funcs = ['rejectedNarratorOutputLocation','cleanupRejectedNarratorOutput'].map(name => {
  const node = ast.statements.find(x => ts.isFunctionDeclaration(x) && x.name?.text === name);
  assert.ok(node?.body, 'missing ' + name);
  return node.getText(ast);
});
const compiled = ts.transpileModule([...declarations,...funcs,
  'module.exports={rejectedNarratorOutputLocation,cleanupRejectedNarratorOutput};'].join('\n'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const uuid = '11111111-1111-4111-8111-111111111111';
const path = 'storytime/owner-1/session-1/script-1/' + uuid + '.mp3';
const job = () => ({jobId:'job-1',jobType:'narrator.tts',sourceSystem:'urai-storytime',ownerUid:'owner-1',
  sourceSessionId:'session-1',sourceNarratorScriptId:'script-1',payload:{outputPrefix:'storytime/owner-1/session-1/script-1'}});
const output = () => ({artifactPath:'gs://audio-test-bucket/' + path,artifactGeneration:'42'});
const fail = code => Object.assign(new Error('GCS_' + code),{code});
function fixture({stored='42',replaceAfter=null,deleteError=null}={}){
  let live = stored, deletes = 0, metadataReads = 0;
  const module = {exports:{}};
  const getStorage = () => ({bucket:bucket=>{
    assert.equal(bucket,'audio-test-bucket');
    return {file:(name,options={})=>{
      assert.equal(name,path);
      return {
        delete:async()=>{
          deletes++;
          assert.equal(options.preconditionOpts?.ifGenerationMatch,'42');
          if(deleteError)throw fail(deleteError);
          if(live===null)throw fail(404);
          if(live!=='42')throw fail(412);
          live=replaceAfter;
        },
        getMetadata:async()=>{
          metadataReads++;
          if(live===null)throw fail(404);
          return [{generation:live}];
        },
      };
    }};
  }});
  vm.runInNewContext(compiled,{module,exports:module.exports,process:{env:{GCS_BUCKET_NAME:'audio-test-bucket'}},getStorage,String,Number,Error,Array,Object,RegExp});
  return {...module.exports,metrics:()=>({deletes,metadataReads,live})};
}
test('conditionally removes rejected narrator generation',async()=>{
  const f=fixture();assert.equal(await f.cleanupRejectedNarratorOutput(job(),output()),'deleted');
  assert.deepEqual(f.metrics(),{deletes:1,metadataReads:1,live:null});
});
test('unrelated job type performs no Storage action',async()=>{
  const f=fixture(), j=job();j.jobType='other';
  assert.equal(await f.cleanupRejectedNarratorOutput(j,output()),'not-applicable');
  assert.equal(f.metrics().deletes,0);
});
test('foreign owner, script, output prefix, source cannot authorize deletion',async()=>{
  for(const edit of [j=>{j.ownerUid='foreign';},j=>{j.sourceNarratorScriptId='script-2';},
    j=>{j.payload.outputPrefix='other';},j=>{j.sourceSystem='other';}]){
    const f=fixture(),j=job();edit(j);
    await assert.rejects(f.cleanupRejectedNarratorOutput(j,output()),/narrator_orphan_authority_unverified/);
    assert.equal(f.metrics().deletes,0);
  }
});
test('foreign bucket, script, non-UUID or non-audio path rejected',async()=>{
  for(const edit of [o=>{o.artifactPath=o.artifactPath.replace('audio-test-bucket','foreign');},
    o=>{o.artifactPath=o.artifactPath.replace('script-1','script-2');},
    o=>{o.artifactPath=o.artifactPath.replace('.mp3','.txt');},
    o=>{o.artifactPath=o.artifactPath.replace(uuid,'untrusted');}]){
    const f=fixture(),o=output();edit(o);
    await assert.rejects(f.cleanupRejectedNarratorOutput(job(),o),/narrator_orphan_result_unverified/);
    assert.equal(f.metrics().deletes,0);
  }
});
test('missing, forged or unsafe generations rejected before Storage',async()=>{
  for(const generation of [null,undefined,42,'0','01','9007199254740992',{}]){
    const f=fixture(),o=output();o.artifactGeneration=generation;
    await assert.rejects(f.cleanupRejectedNarratorOutput(job(),o),/narrator_orphan_result_unverified/);
    assert.equal(f.metrics().deletes,0);
  }
});
test('replaced generation cannot be deleted or counted',async()=>{
  const f=fixture({stored:'43'});
  await assert.rejects(f.cleanupRejectedNarratorOutput(job(),output()),/narrator_orphan_generation_changed/);
  assert.equal(f.metrics().live,'43');
});
test('a replacement appearing after conditional delete is not acknowledged',async()=>{
  const f=fixture({replaceAfter:'43'});
  await assert.rejects(f.cleanupRejectedNarratorOutput(job(),output()),/narrator_orphan_generation_changed/);
});
test('missing object returns absent only when still missing',async()=>{
  const f=fixture({stored:null});
  assert.equal(await f.cleanupRejectedNarratorOutput(job(),output()),'absent');
  assert.equal(f.metrics().metadataReads,1);
});
test('permission failures remain unresolved',async()=>{
  const f=fixture({deleteError:403});
  await assert.rejects(f.cleanupRejectedNarratorOutput(job(),output()),/GCS_403/);
  assert.equal(f.metrics().metadataReads,0);
});
