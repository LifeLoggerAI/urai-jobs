import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

// Execute the maintained TypeScript worker-log writer, not an imitation.
const source=readFileSync(new URL('../functions/src/jobs/executeJob.ts',import.meta.url),'utf8');
const start=source.indexOf('async function appendJobLog(jobId: string,');
const end=source.indexOf('\n}\n\nasync function handleJobFailure',start)+2;
assert.ok(start>=0 && end>start,'Original worker-log writer must remain source-bound');
const requireFn=createRequire(new URL('../functions/package.json',import.meta.url));
const ts=requireFn('typescript');
const isolated=source.slice(start,end)+'\nmodule.exports.appendJobLog=appendJobLog;';
const compiled=ts.transpileModule(isolated,{
  fileName:'JobsLateLogGuard.ts',reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
});
assert.equal(compiled.diagnostics?.length??0,0,'Maintained worker-log TypeScript must transpile');

function fixture(data,{conflict=false}={}){
  const logs=[],reads=[],errors=[];
  const master={type:'master'};
  const jobRef={
    ...master,
    collection:name=>{
      assert.equal(name,'logs');
      return {
        doc:()=>({type:'log'}),
        add:async record=>logs.push(record),
      };
    },
  };
  let writesStarted=0;
  const db={
    async runTransaction(callback){
      const pending=[];
      const result=await callback({
        async get(ref){
          assert.equal(ref,jobRef);
          reads.push(ref);
          return {exists:data!==null,data:()=>data};
        },
        create(ref,record){
          assert.equal(ref.type,'log');
          writesStarted++;
          pending.push(record);
        },
      });
      if(conflict)throw new Error('synthetic Firestore serialization conflict');
      logs.push(...pending);
      return result;
    },
  };
  const module={exports:{}};
  runInNewContext(compiled.outputText,{
    module,exports:module.exports,
    getFirestore:()=>db,
    jobDoc:()=>jobRef,
    FieldValue:{serverTimestamp:()=> 'synthetic-server-timestamp'},
    console:{error:(...args)=>errors.push(args)},
  },{filename:'JobsLateLogGuard.js',timeout:2000});
  return {
    invoke:()=>module.exports.appendJobLog('synthetic-job-id',{
      level:'info',source:'executeJob',message:'synthetic completion'}),
    logs,reads,errors,get writesStarted(){return writesStarted;},
  };
}
test('normal owned job emits one source-bound worker log',async()=>{
  const h=fixture({ownerUid:'synthetic-owner-01',status:'SUCCESS'});
  await h.invoke();
  assert.equal(h.reads.length,1);
  assert.equal(h.logs.length,1);
  assert.equal(h.writesStarted,1);
  assert.equal(h.logs[0].message,'synthetic completion');
  assert.equal(h.logs[0].createdAt,'synthetic-server-timestamp');
});
for(const [label,record] of [
  ['deleted owner hash',{ownerUid:'deleted:synthetic-hash',deletionReceipt:{requestId:'request-1'}}],
  ['present deletion tombstone',{ownerUid:'synthetic-owner-01',deletionReceipt:{requestId:'request-1'}}],
  ['missing master job',null],
  ['ownerless legacy job',{status:'SUCCESS'}],
]){
  test('late worker log denied for '+label,async()=>{
    const h=fixture(record);
    await h.invoke();
    assert.equal(h.reads.length,1);
    assert.equal(h.writesStarted,0);
    assert.equal(h.logs.length,0);
  });
}
test('synthetic transaction conflict never writes a resurrected log',async()=>{
  const h=fixture({ownerUid:'synthetic-owner-01',status:'SUCCESS'},{conflict:true});
  await h.invoke();
  assert.equal(h.logs.length,0);
  assert.equal(h.writesStarted,1);
  assert.equal(h.errors.length,1);
});
