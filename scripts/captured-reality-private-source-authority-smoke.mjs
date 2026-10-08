import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = fs.readFileSync('workers/private-life-model-index-provider/src/protected-source-provider.ts','utf8');
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

const ownerUid='synthetic_owner_capture';
const jobId='synthetic_capture_job_01';
const leaseToken='synthetic_capture_lease_01';
const sourceReceiptRef='psr_synthetic_captured_000001';
const sourceHandle='psh_synthetic_captured_000001';
const memoryConsent={purpose:'memory.storage',policyVersion:'synthetic-v1',decisionReceiptId:'memory_decision_01'};
const locationConsent={purpose:'location.context',policyVersion:'synthetic-v1',decisionReceiptId:'location_decision_01'};
const request={schemaVersion:'urai-private-source-receipt-v2',ownerUid,jobId,leaseToken,sourceReceiptRef,
  requestedPurpose:'reconstruct-place',idempotencyKey:jobId,requestReceipt:jobId};

function fixture({jobPatch={},grantPatch={},blockedPurpose=null}={}) {
  const records=new Map();
  const ref=path=>({path});
  const db={
    collection(name){return {doc(id){return ref(name+'/'+id);}};},
    async runTransaction(fn){return fn({get:async target=>({data:()=>clone(records.get(target.path))})});}
  };
  const receiptPath='uraiPrivateSourceReceipts/'+hash(sourceReceiptRef);
  records.set('jobs/'+jobId,{
    jobId,ownerUid,type:'memory.private-source.reconstruct-place',status:'RUNNING',execution:{leaseToken},
    payload:{sourceReceiptRefs:[sourceReceiptRef],requestedPurpose:'reconstruct-place'},
    consents:[memoryConsent,locationConsent],...jobPatch
  });
  records.set(receiptPath,{
    schemaVersion:'urai-private-source-receipt-v2',ownerUid,sourceReceiptRef,sourceHandle,status:'ACTIVE',synthetic:false,
    sourceEvidenceClass:'SOURCE_CAPTURED',sourceFixityRef:'private:synthetic/capture-fixity',
    sourceSha256:'a'.repeat(64),sourceByteLength:1234,sourceRevision:1,purposes:['reconstruct-place'],
    consents:[memoryConsent,locationConsent],...grantPatch
  });
  if (blockedPurpose) records.set('jobConsentBlocks/'+hash(ownerUid+'\n'+blockedPurpose),{active:true});
  const routes=new Map();
  const app={
    get(path,...handlers){routes.set('GET '+path,handlers);},
    post(path,...handlers){routes.set('POST '+path,handlers);}
  };
  const exports={};
  const process={env:{
    URAI_PRIVATE_SOURCE_CONTRACT:'urai-private-source-receipt-v2',
    FIREBASE_PROJECT_ID:'synthetic-project',
    URAI_SOURCE_SHA:'a'.repeat(40),
    K_REVISION:'synthetic-revision',
    PRIVATE_SOURCE_AUTHORITY_TOKEN:'synthetic-authority-token',
    PRIVATE_SOURCE_REF_RESOLVER_TOKEN:'synthetic-resolver-token'
  }};
  vm.runInNewContext(js+'\nexports.registerProtectedSourceRoutes = registerProtectedSourceRoutes;',{
    exports,process,Buffer,console,crypto,
    require:name=>name==='firebase-admin/storage'?{getStorage(){throw new Error('unexpected_storage');}}
      : name==='firebase-admin/firestore'?{FieldValue:{serverTimestamp:()=> 'synthetic-time'}}:require(name)
  });
  exports.registerProtectedSourceRoutes(app,{firestore:()=>db,stableHash:hash,canonicalJson:JSON.stringify,boundedResponse:async()=>''});
  async function authorize(body=request){
    const handlers=routes.get('POST /authorize');
    const result={status:200,body:null};
    const req={body,get:name=>name==='Authorization'?'Bearer synthetic-authority-token':''};
    const res={set(){return res;},status(n){result.status=n;return res;},send(body){result.body=body;return res;}};
    let index=0;
    const next=async()=>{const handler=handlers[index++];if(handler) return handler(req,res,next);};
    await next();
    return result;
  }
  return {authorize,records};
}

{
  const f=fixture();
  const out=await f.authorize();
  assert.equal(out.status,200);
  assert.equal(out.body.authorized,true);
  assert.equal(out.body.requestedPurpose,'reconstruct-place');
  assert.equal(out.body.sourceHandle,sourceHandle);
}
{
  const f=fixture({jobPatch:{consents:[memoryConsent]}});
  const out=await f.authorize();
  assert.equal(out.status,403);
}
{
  const f=fixture({blockedPurpose:'location.context'});
  const out=await f.authorize();
  assert.equal(out.status,403);
}
{
  const f=fixture({grantPatch:{consents:[memoryConsent]}});
  const out=await f.authorize();
  assert.equal(out.status,403);
}
{
  const f=fixture({jobPatch:{payload:{sourceReceiptRefs:['psr_synthetic_other_000001'],requestedPurpose:'reconstruct-place'}}});
  const out=await f.authorize();
  assert.equal(out.status,403);
}

const indexSource=fs.readFileSync('workers/private-life-model-index-provider/src/index.ts','utf8');
assert.match(indexSource,/const sourceConsents = Array\.isArray\(source\?\.consents\)/);
assert.match(indexSource,/source\?\.consent \? \[source\.consent\] : \[\]/);
assert.match(indexSource,/sourceConsents\.find\(\(entry:any\) => entry\?\.purpose === consent\.purpose\)/);

console.log('[PASS] captured reality private-source authority requires exact reconstruction job, source membership and dual current consent');
