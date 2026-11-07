/** R881: execute original Jobs handlers under controlled Firestore/Functions substitutes.
 * These tests are NOT authenticated Firebase emulator, live IAM or production evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const root = new URL('../', import.meta.url);
const requireFunctions = createRequire(new URL('../functions/package.json',import.meta.url));
const ts = requireFunctions('typescript');

class HttpsError extends Error { constructor(code,message){super(message);this.code=code;} }
const denied=e=>e?.code==='permission-denied';
function compile(path) {
  const url=new URL(path,root);
  const result=ts.transpileModule(readFileSync(url,'utf8'),{
    fileName:url.pathname,reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
  });
  const problems=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.deepEqual(problems.map(d=>`TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`),[],path);
  return result.outputText;
}
function loadCode(source,imports) {
  const mod={exports:{}};
  new Function('require','module','exports',source)(name=>{
    if(!Object.hasOwn(imports,name))throw Error(`Unknown stub: ${name}`);
    return imports[name];
  },mod,mod.exports);
  return mod.exports;
}
const helper=loadCode(compile('functions/src/jobs/currentJobCallerAuthority.ts'),{});
const owner=(tenantId='tenant-A',orgId='org-A')=>({uid:'owner',role:'user',disabled:false,tenantId,orgId});
const job=(tenantId='tenant-A',orgId='org-A')=>({ownerUid:'owner',status:'RUNNING',tenantId,orgId,jobId:'job-1'});
const auth={uid:'owner',token:{role:'operator',uraiJobsAdmin:true}};

function fixture({initial=owner(),current=initial,existingJob=job()}={}){
  const state={initial,current,job:existingJob,reads:[],writes:[],commits:[],logReads:0,transactionCount:0,initialReads:0};
  const ref=(name,id)=>({name,id,
    async get(){state.initialReads++;return snapshot(name,id,true);},
    collection(sub){assert.equal(name,'jobs');assert.equal(sub,'logs');return query('logs',id);}
  });
  const query=(name,id)=>({name,id,doc(){return ref('logs','audit-id')},orderBy(){return this;},limit(){return this;},async get(){throw Error('query read outside transaction');}});
  const snapshot=(name,id,entry=false)=>{
    const data=name==='users'?(entry?state.initial:state.current):name==='jobs'?state.job:null;
    return {id,exists:data!==null&&data!==undefined,data:()=>data};
  };
  const db={collection(name){return {doc(id){return ref(name,id)},where(){return this;},limit(){return this;}}},async runTransaction(fn){
    state.transactionCount++;
    const pending=[];
    const transaction={
      get:async r=>{
        state.reads.push(`${r.name}/${r.id}`);
        if(r.name==='logs'){
          state.logReads++;
          return {docs:[{id:'log-1',data:()=>({message:'synthetic-only'})}]};
        }
        return snapshot(r.name,r.id);
      },
      set:(r,patch)=>pending.push({kind:'set',path:`${r.name}/${r.id}`,patch}),
      create:(r,patch)=>pending.push({kind:'create',path:`${r.name}/${r.id}`,patch})
    };
    const output=await fn(transaction);
    state.writes.push(...pending);
    if(pending.some(x=>x.path==='jobs/job-1'&&x.patch.status==='CANCELLED'))state.job.status='CANCELLED';
    return output;
  }};
  return {state,db};
}
function load(name,db) {
  const app={'getApps':()=>[{}],initializeApp(){}};
  const firestore={getFirestore:()=>db,FieldValue:{serverTimestamp:()=>({timestamp:'synthetic'})}};
  const modules={
    'firebase-admin/app':app,
    'firebase-admin/firestore':firestore,
    'firebase-functions/v2/https':{HttpsError,onCall:(_opts,fn)=>fn},
    './currentJobCallerAuthority.js':helper
  };
  if(name==='getJobStatus'){
    const errors={httpsError:(code,msg)=>new HttpsError(code,msg)};
    const userDoc=uid=>db.collection('users').doc(uid);
    const shared=loadCode(compile('functions/src/core/auth.ts'),{
      'firebase-functions/v1':{https:{onCall:fn=>fn}},
      './errors.js':errors,
      './firestore-paths.js':{userDoc}
    });
    Object.assign(modules,{
      'zod':{z:{object:()=>({safeParse:data=>typeof data?.jobId==='string'&&data.jobId?{success:true,data}:{success:false,error:{flatten:()=>({})}}}),string:()=>({min:()=>({})})}},
      '../core/auth.js':shared,
      '../core/errors.js':errors,
      '../core/firestore-paths.js':{jobDoc:id=>db.collection('jobs').doc(id)}
    });
  }
  return loadCode(compile(`functions/src/jobs/${name}.ts`),modules)[name];
}
const invoke=(name,handler)=>name==='getJobStatus'?handler({jobId:'job-1'},{auth}):handler({data:{jobId:'job-1'},auth});

for(const name of ['getJob','getJobStatus','cancelJob']){
  test(`R881 ${name} permits current exact tenant/org owner`,async()=>{
    const {state,db}=fixture();
    const result=await invoke(name,load(name,db));
    assert.equal(result.job?.ownerUid==='owner'||result.status==='CANCELLED',true);
    if(name==='getJob')assert.equal(result.logs[0].message,'synthetic-only');
    if(name==='cancelJob')assert.ok(state.writes.some(w=>w.path==='jobs/job-1'&&w.patch.status==='CANCELLED'));
    assert.equal(state.transactionCount,1);
  });
  test(`R881 ${name} denies same-UID previous tenant before private data/mutation`,async()=>{
    const {state,db}=fixture({current:owner('tenant-B'),existingJob:job('tenant-A')});
    await assert.rejects(()=>invoke(name,load(name,db)),denied);
    assert.equal(state.writes.length,0);
    assert.equal(state.logReads,0);
  });
  test(`R881 ${name} denies same-UID previous organization before private data/mutation`,async()=>{
    const {state,db}=fixture({current:owner('tenant-A','org-B'),existingJob:job('tenant-A','org-A')});
    await assert.rejects(()=>invoke(name,load(name,db)),denied);
    assert.equal(state.writes.length,0);
    assert.equal(state.logReads,0);
  });
  test(`R881 ${name} ignores stale operator token and denies inactive owner`,async()=>{
    const {state,db}=fixture({current:{...owner(),disabled:true}});
    await assert.rejects(()=>invoke(name,load(name,db)),denied);
    assert.equal(state.writes.length,0);
    assert.equal(state.logReads,0);
  });
  test(`R881 ${name} denies legacy job when current owner has nonlegacy scope`,async()=>{
    const {state,db}=fixture({existingJob:{jobId:'job-1',ownerUid:'owner',status:'RUNNING'}});
    await assert.rejects(()=>invoke(name,load(name,db)),denied);
    assert.equal(state.writes.length,0);
    assert.equal(state.logReads,0);
  });
}
test('R881 status wrapper checks transaction-time role after stale operator downgraded',async()=>{
  const {state,db}=fixture({initial:{...owner(),role:'operator'},current:owner('tenant-B')});
  await assert.rejects(()=>invoke('getJobStatus',load('getJobStatus',db)),denied);
  assert.equal(state.initialReads,1);
  assert.equal(state.writes.length,0);
});
