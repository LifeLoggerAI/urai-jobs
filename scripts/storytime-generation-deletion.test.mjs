import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import vm from 'node:vm';

const ts=createRequire(new URL('../functions/package.json',import.meta.url))('typescript');
function originalFunctions(path,names,context){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
  const clauses=names.map(name=>{
    const node=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text===name);
    assert.ok(node?.body,'missing checked-in function '+name);
    return node.getText(ast);
  });
  const compiled=ts.transpileModule([...clauses,'module.exports={'+names.join(',')+'};'].join('\n'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const module={exports:{}};
  vm.runInNewContext(compiled,{...context,module,exports:module.exports,String,Number,Error,Object}, {timeout:2000});
  return {exports:module.exports,source};
}
const owner={userId:'synthetic-owner',sessionId:'synthetic-session',narratorScriptId:'script-1',jobId:'synthetic-job-123'};
const objectPath='storytime/synthetic-owner/synthetic-session/script-1/audio.mp3';
const artifactPath='gs://synthetic-audio-bucket/'+objectPath;
function fixture({pinned='42',stored='42',replacedAfterDelete=null,jobChanged=null,deleteFailure=null}={}){
  let live=stored, deletions=0, updates=0, reads=0, inspected=0;
  const current={jobId:owner.jobId,ownerUid:owner.userId,sourceSessionId:owner.sessionId,
    sourceNarratorScriptId:owner.narratorScriptId,sourceSystem:'urai-storytime',jobType:'narrator.tts',
    status:'SUCCESS',output:{artifactPath,artifactGeneration:pinned}};
  const fail=(code)=>Object.assign(new Error('synthetic_storage_'+code),{code});
  const storage={bucket:(name)=>{
    assert.equal(name,'synthetic-audio-bucket');
    return {file:(path,options={})=>{
      assert.equal(path,objectPath);
      if(options.preconditionOpts){
        assert.equal(options.preconditionOpts.ifGenerationMatch,pinned);
      }
      return {
        delete:async()=>{
          deletions++;
          if(deleteFailure)throw fail(deleteFailure);
          if(live===null)throw fail(404);
          if(live!==options.preconditionOpts?.ifGenerationMatch)throw fail(412);
          live=replacedAfterDelete;
        },
        getMetadata:async()=>{
          inspected++;
          if(live===null)throw fail(404);
          return [{generation:live}];
        },
      };
    }};
  }};
  const {exports}=originalFunctions('../functions/src/jobs/storytimeNarratorBridge.ts',
    ['parseArtifactPath','pinnedNarratorGeneration','artifactLocation','deleteOutput'],{
    loadBoundJob:async()=>({...current,output:{...current.output}}),
    assertBoundJob:(job,input)=>{
      if(job.ownerUid!==input.userId||job.sourceSessionId!==input.sessionId
        ||job.sourceNarratorScriptId!==input.narratorScriptId)throw Error('storytime_narrator_boundary_mismatch');
      return job;
    },
    getStorage:()=>storage,
    getFirestore:()=>({runTransaction:async fn=>fn({
      get:async()=>{
        reads++;
        const snapshot={...current,output:{...current.output}};
        if(jobChanged==='path')snapshot.output.artifactPath='gs://synthetic-audio-bucket/'+objectPath.replace('script-1','script-2');
        if(jobChanged==='generation')snapshot.output.artifactGeneration='43';
        if(jobChanged==='status')snapshot.status='CANCELLED';
        return {exists:true,data:()=>snapshot};
      },
      update:()=>{updates++;},
    })}),
    jobDoc:()=>({}),FieldValue:{serverTimestamp:()=> 'now',delete:()=> 'deleted'},
    process:{env:{GCS_BUCKET_NAME:'synthetic-audio-bucket'}},
  });
  return {...exports,metrics:()=>({live,deletions,updates,reads,inspected})};
}

test('pinned generation deletes only the selected byte version and acknowledges after absent recheck',async()=>{
  const f=fixture();
  assert.equal((await f.deleteOutput(owner)).deleted,true);
  assert.deepEqual(f.metrics(),{live:null,deletions:1,updates:1,reads:1,inspected:1});
});
test('missing legacy generation fails closed before Storage',async()=>{
  const f=fixture({pinned:null});
  await assert.rejects(f.deleteOutput(owner),/narrator_artifact_generation_unverified/);
  assert.equal(f.metrics().deletions,0);
});
test('invalid or unsafe generation formats fail closed',async()=>{
  for(const generation of ['0','01','-1','1.0','9007199254740992','1'.repeat(21),42,null,{},'']){
    const f=fixture({pinned:generation});
    await assert.rejects(f.deleteOutput(owner),/narrator_artifact_generation_unverified/);
    assert.equal(f.metrics().deletions,0);
  }
});
test('replacement before deletion rejects version mismatch and does not ACK',async()=>{
  const f=fixture({stored:'43'});
  await assert.rejects(f.deleteOutput(owner),/narrator_artifact_generation_changed/);
  assert.equal(f.metrics().updates,0);
  assert.equal(f.metrics().live,'43');
});
test('replacement after conditional delete but before final metadata recheck rejects ACK',async()=>{
  const f=fixture({replacedAfterDelete:'43'});
  await assert.rejects(f.deleteOutput(owner),/narrator_artifact_generation_changed/);
  assert.equal(f.metrics().updates,0);
  assert.equal(f.metrics().live,'43');
});
test('missing original object is idempotent only when path remains absent',async()=>{
  const f=fixture({stored:null});
  assert.equal((await f.deleteOutput(owner)).deleted,true);
  assert.equal(f.metrics().updates,1);
});
test('storage permission or transient failures do not become successful deletion',async()=>{
  const f=fixture({deleteFailure:403});
  await assert.rejects(f.deleteOutput(owner),/synthetic_storage_403/);
  assert.equal(f.metrics().updates,0);
});
test('concurrent job output path change cannot be ACKed as deleted',async()=>{
  const f=fixture({jobChanged:'path'});
  await assert.rejects(f.deleteOutput(owner),/narrator_artifact_output_changed/);
  assert.equal(f.metrics().updates,0);
});
test('concurrent job generation change cannot be ACKed as deleted',async()=>{
  const f=fixture({jobChanged:'generation'});
  await assert.rejects(f.deleteOutput(owner),/narrator_artifact_output_changed/);
  assert.equal(f.metrics().updates,0);
});
test('cancellation during deletion cannot be ACKed as successful completed output',async()=>{
  const f=fixture({jobChanged:'status'});
  await assert.rejects(f.deleteOutput(owner),/narrator_artifact_output_changed/);
  assert.equal(f.metrics().updates,0);
});

function workerFixture({generation='42',matchingUpload=true}={}){
  let saves=0, reads=0, saved;
  let idIndex=0;
  const {exports}=originalFunctions('../workers/narrator-worker/src/handlers/narrator-tts.ts',
    ['handleNarratorTts'],{
    BUCKET_NAME:'synthetic-audio-bucket',
    normalizePayload:value=>value,
    normalizeAudioEncoding: format => format === 'OGG_OPUS' ? 'OGG_OPUS' : 'MP3',
    storytimeNarratorWriteIdentity: () => null,
    reserveStorytimeNarratorWrite: async () => {},
    assertStorytimeNarratorWriteActiveBeforeUpload: async () => {},
    sealStorytimeNarratorWrite: async () => {},
    synthesizeGoogle:async()=>({audioBuffer:Buffer.from('synthetic'),fileExtension:'mp3',
      mimeType:'audio/mpeg',provider:'google',modelId:'synthetic-model',voiceId:'synthetic-voice'}),
    randomUUID:()=>['synthetic-object','synthetic-upload-id'][idIndex++],
    storage:{bucket:()=>({file:()=>({
      save:async(_bytes,options)=>{
        saves++;
        saved=options;
        assert.equal(options.preconditionOpts?.ifGenerationMatch,0);
      },
      getMetadata:async()=>{
        reads++;
        return [{generation,metadata:{uraiUploadId:matchingUpload?'synthetic-upload-id':'foreign-upload-id'}}];
      },
    })})},
    console:{log:()=>{}},
    Buffer,
    process:{env:{}},
  });
  return {...exports,metrics:()=>({saves,reads,saved})};
}
test('narrator worker saves create-only and retains the exact verified generation',async()=>{
  const f=workerFixture();
  const result=await f.handleNarratorTts({jobId:'synthetic-job',payload:{
    text:'synthetic',provider:'google',outputPrefix:'storytime/synthetic-owner/synthetic-session/script-1',
  }});
  assert.equal(result.artifactGeneration,'42');
  assert.equal(f.metrics().saves,1);
  assert.equal(f.metrics().reads,1);
  assert.equal(f.metrics().saved.metadata.metadata.uraiUploadId,'synthetic-upload-id');
});
test('worker rejects metadata for a replaced upload before accepting a generation',async()=>{
  const f=workerFixture({matchingUpload:false});
  await assert.rejects(f.handleNarratorTts({jobId:'synthetic-job',payload:{
    text:'synthetic',provider:'google',outputPrefix:'storytime/synthetic-owner/synthetic-session/script-1',
  }}),/narrator_artifact_generation_unverified/);
});
test('worker rejects missing or invalid cloud object version',async()=>{
  for(const generation of [null,'0','01','9007199254740992',42]){
    const f=workerFixture({generation});
    await assert.rejects(f.handleNarratorTts({jobId:'synthetic-job',payload:{
      text:'synthetic',provider:'google',outputPrefix:'storytime/synthetic-owner/synthetic-session/script-1',
    }}),/narrator_artifact_generation_unverified/);
  }
});
