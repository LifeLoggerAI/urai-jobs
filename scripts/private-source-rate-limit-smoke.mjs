import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { once } from 'node:events';
const baseRequire=createRequire(new URL('../functions/package.json',import.meta.url));
const ts=baseRequire('typescript');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
for(const workspace of ['private-source-worker','private-life-model-index-provider']){
  const require=createRequire(new URL(`../workers/${workspace}/package.json`,import.meta.url));
  const actualExpress=require('express');let server;
  const express=()=>{const app=actualExpress();const listen=app.listen.bind(app);app.listen=()=>{server=listen(0,'127.0.0.1');return server;};return app;};express.json=actualExpress.json;
  const env={URAI_ENV:'test',URAI_JOBS_WORKER_TOKEN:'synthetic-rate-limit-token',PRIVATE_SOURCE_INDEX_TOKEN:'synthetic-rate-limit-token'};
  const context={exports:{},process:{env},Buffer,URL,AbortController,AbortSignal,FormData,Blob,Uint8Array,setTimeout,clearTimeout,setInterval,clearInterval,
    console:{log(){},error(){}},fetch:()=>{throw new Error('rate-limit smoke must never contact a provider');},
    require:name=>name==='express'?express:name==='./protected-source-provider'?{
      registerProtectedSourceRoutes(app,deps){const exports={};vm.runInNewContext(compile(fs.readFileSync('workers/private-life-model-index-provider/src/protected-source-provider.ts','utf8')),
        {...context,exports,require});exports.registerProtectedSourceRoutes(app,deps);}
    }:require(name)};
  vm.runInNewContext(compile(fs.readFileSync(`workers/${workspace}/src/index.ts`,'utf8')),context);
  assert.ok(server);await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}${workspace==='private-source-worker'?'/execute-job':'/'}`;
  const body=workspace==='private-source-worker'?{jobId:'synthetic_job_01',jobType:'memory.private-source.transcribe',ownerUid:'synthetic_owner_01',leaseToken:'synthetic_lease_01',
    payload:{sourceReceiptRef:'psr_synthetic_receipt_000001',requestedPurpose:'transcribe'}}:
    {ownerUid:'synthetic_owner_01',jobId:'synthetic_job_01',leaseToken:'synthetic_lease_01',sourceReceiptRef:'psr_synthetic_receipt_000001',sourceHandle:'psh_synthetic_handle_000001',
      sourceEvidenceClass:'SOURCE_CAPTURED',sourceSha256:'a'.repeat(64),sourceByteLength:1234,sourceRevision:1,sourceFixityRef:'private:synthetic/fixity',
      transcriptRef:'private:synthetic/transcript',provenanceRef:'private:synthetic/provenance',requestedPurpose:'memory-index',idempotencyKey:'synthetic_job_01'};
  try{for(let i=0;i<60;i++){const result=await fetch(url,{method:'POST',headers:{authorization:'Bearer synthetic-rate-limit-token','content-type':'application/json'},body:JSON.stringify(body)});
      assert.equal(result.status,503,'admitted requests still fail readiness without grants/keys');await result.text();}
    const blocked=await fetch(url,{method:'POST',headers:{authorization:'Bearer synthetic-rate-limit-token','content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal(blocked.status,429);assert.equal((await blocked.json()).code,'PRIVATE_SOURCE_RATE_LIMIT');assert.ok(blocked.headers.get('ratelimit'));
  }finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  console.log(`[PASS] ${workspace}: actual HTTP admission capped at 60/minute before protected work; no provider/private execution`);
}
