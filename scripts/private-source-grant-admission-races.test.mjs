import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const sourcePath = process.env.JOBS_GRANT_PROVISION_SOURCE || new URL('./private-source-grant-provision.mjs', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(process.env.JOBS_GRANT_PROVISION_FIXTURE || new URL('./fixtures/private-source-grant.synthetic.json', import.meta.url),'utf8'));
const grant = {...fixture, fixtureOnly:false};
const sha = value=>crypto.createHash('sha256').update(value).digest('hex');
const grantPath='uraiPrivateSourceReceipts/'+sha(grant.sourceReceiptRef);
function harness(records = new Map(), options = {}) {
 const state = { reads:[], writes:0, defaultAppUsed:false, sdkLoads:0, beforeCommit:null, afterRead:null, output:'', error:'' };
 const db={projectId:options.dbProject||'demo-urai-jobs-grant-proof',collection:name=>({doc:id=>({path:name+'/'+id})}),async runTransaction(callback){
  const reads=new Map(),writes=[];const tx={async get(ref){
   const value=structuredClone(records.get(ref.path));reads.set(ref.path,JSON.stringify(value));state.reads.push(ref.path);await state.afterRead?.(ref.path,records);
   return{exists:value!==undefined,data:()=>structuredClone(value)};
  },create(ref,value){writes.push([ref.path,structuredClone(value)]);}};
  const value=await callback(tx);await state.beforeCommit?.(records);
  for(const [path,fingerprint] of reads)if(JSON.stringify(records.get(path))!==fingerprint)throw new Error('synthetic transaction read conflict');
  for(const [path,record]of writes){assert.equal(records.has(path),false);records.set(path,record);state.writes++;}return value;
 }};
 const mocks={
  'firebase-admin/firestore':{getFirestore:()=>{state.sdkLoads++;return db;}},
  'firebase-admin/app':{applicationDefault:()=>({synthetic:true}),getApps:()=>[],initializeApp:()=>({options:{projectId:db.projectId}})},
 };
 // Execute the actual production main body with explicit synthetic Firebase
 // adapters. No paid provider, credential lookup, cloud write or network runs.
 const original=fs.readFileSync(sourcePath,'utf8');
 const wrapper=original.replace(/^import .*;\n/gm,'').replace(/export function /g,'function ').replace(/export async function /g,'async function ')
  .replace(/const require = createRequire\(new URL\('\.\.\/functions\/package\.json', import\.meta\.url\)\);/,'')
  .replace(/if\(process\.argv\[1\] && import\.meta\.url===pathToFileURL\(process\.argv\[1\]\)\.href\)\{[\s\S]*$/,'')+'\nexports.main=main;';
 const exports={};
 const mockProcess={argv:['node','synthetic-source-grant-cli','--input','synthetic-private-review.json','--apply'],env:{URAI_PRIVATE_SOURCE_GRANT_PROVISION_ENABLED:'true',FIREBASE_PROJECT_ID:'demo-urai-jobs-grant-proof'},stdout:{write:text=>state.output+=text}};
 const syntheticFs={readFileSync:()=>JSON.stringify(grant)};
 vm.runInNewContext(wrapper,{exports,crypto,Date,fs:syntheticFs,process:mockProcess,structuredClone,require:name=>{assert.ok(mocks[name],'unprovided SDK boundary '+name);return mocks[name];},console},{filename:String(sourcePath)});
 return{records,state,call:()=>exports.main()};
}
const tests=[];const check=(name,callback)=>tests.push({name,callback});
const ownerFencePath='uraiPrivateLifeModelOwnerFences/'+sha(grant.ownerUid);
const deletionPath='privacyDeletionTombstones/'+grant.ownerUid;
const blockPath=purpose=>'jobConsentBlocks/'+sha(grant.ownerUid+'\n'+purpose);
const inactiveFence={schemaVersion:'urai-private-life-model-owner-fence-v1',ownerHash:sha(grant.ownerUid),deleted:false,deletionEpoch:0};
check('unfenced real review preserves exact grant creation',async()=>{const h=harness();await h.call();assert.equal(h.state.writes,1);assert.deepEqual(h.records.get(grantPath),grant);});
check('current exact grant replay creates no replacement',async()=>{const records=new Map([[grantPath,grant]]);const h=harness(records);await h.call();assert.equal(h.state.writes,0);assert.deepEqual(records.get(grantPath),grant);});
check('foreign or corrected existing grant remains immutable',async()=>{const records=new Map([[grantPath,{...grant,sourceRevision:2}]]);const h=harness(records);await assert.rejects(h.call());assert.equal(h.state.writes,0);assert.equal(records.get(grantPath).sourceRevision,2);});
check('permanent private owner fence prevents newly retained ACTIVE grant',async()=>{const records=new Map([[ownerFencePath,{...inactiveFence,deleted:true,deletionEpoch:1,requestId:'synthetic-original-deletion'}]]);const h=harness(records);await assert.rejects(h.call());assert.equal(records.has(grantPath),false);assert.equal(h.state.writes,0);});
for(const purpose of ['memory.storage','location.context'])check('canonical '+purpose+' block prevents newly retained ACTIVE grant',async()=>{const records=new Map([[blockPath(purpose),{ownerUid:grant.ownerUid,purpose,active:true}]]);const h=harness(records);await assert.rejects(h.call());assert.equal(records.has(grantPath),false);});
check('canonical active deletion beats absent private owner fence',async()=>{const records=new Map([[deletionPath,{uid:grant.ownerUid,active:true}]]);const h=harness(records);await assert.rejects(h.call());assert.equal(records.has(grantPath),false);});
check('exact inactive marker and purpose blocks preserve reviewed compatible creation',async()=>{const records=new Map([[ownerFencePath,inactiveFence],[deletionPath,{uid:grant.ownerUid,active:false}],...['memory.storage','location.context'].map(purpose=>[blockPath(purpose),{ownerUid:grant.ownerUid,purpose,active:false}])]);const h=harness(records);await h.call();assert.equal(h.state.writes,1);});
for(const [name,marker]of Object.entries({'missing-owner':{deleted:false,deletionEpoch:0},'foreign-owner':{...inactiveFence,ownerHash:'f'.repeat(64)},'missing-deleted':{ownerHash:sha(grant.ownerUid),deletionEpoch:0},'string-deleted':{...inactiveFence,deleted:'false'},'null-deleted':{...inactiveFence,deleted:null},'missing-epoch':{ownerHash:sha(grant.ownerUid),deleted:false},'unsafe-epoch':{...inactiveFence,deletionEpoch:Number.MAX_SAFE_INTEGER+1},'positive-cleared-epoch':{...inactiveFence,deletionEpoch:1}}))check('malformed private deletion '+name+' remains fail-closed',async()=>{const records=new Map([[ownerFencePath,marker]]);const h=harness(records);await assert.rejects(h.call());assert.equal(records.has(grantPath),false);});
for(const [name,marker]of Object.entries({'foreign-owner':{uid:'synthetic-foreign-owner',active:false},'missing-owner':{active:false},'missing-active':{uid:grant.ownerUid},'string-active':{uid:grant.ownerUid,active:'false'}}))check('malformed canonical deletion '+name+' remains fail-closed',async()=>{const records=new Map([[deletionPath,marker]]);const h=harness(records);await assert.rejects(h.call());assert.equal(records.has(grantPath),false);});
for(const [name,marker]of Object.entries({'foreign-owner':{ownerUid:'synthetic-foreign-owner',purpose:'memory.storage',active:false},'foreign-purpose':{ownerUid:grant.ownerUid,purpose:'location.context',active:false},'missing-active':{ownerUid:grant.ownerUid,purpose:'memory.storage'},'string-active':{ownerUid:grant.ownerUid,purpose:'memory.storage',active:'false'}}))check('malformed current purpose '+name+' remains fail-closed',async()=>{const records=new Map([[blockPath('memory.storage'),marker]]);const h=harness(records);await assert.rejects(h.call());assert.equal(records.has(grantPath),false);});
for(const [name,path,marker]of [['private deletion',ownerFencePath,{...inactiveFence,deleted:true,deletionEpoch:1}],['canonical deletion',deletionPath,{uid:grant.ownerUid,active:true}],['memory consent',blockPath('memory.storage'),{ownerUid:grant.ownerUid,purpose:'memory.storage',active:true}],['location consent',blockPath('location.context'),{ownerUid:grant.ownerUid,purpose:'location.context',active:true}]])check('withdrawal after transaction read conflicts before retention: '+name,async()=>{const h=harness();let withdrawn=false;h.state.afterRead=async observed=>{if(observed!==grantPath||withdrawn)return;withdrawn=true;h.records.set(path,marker);};await assert.rejects(h.call());assert.equal(withdrawn,true);assert.equal(h.records.has(grantPath),false);h.state.afterRead=null;await assert.rejects(h.call());assert.equal(h.state.writes,0);});
for(const [name,path,marker]of [['private deletion',ownerFencePath,{...inactiveFence,deleted:true,deletionEpoch:1}],['memory consent',blockPath('memory.storage'),{ownerUid:grant.ownerUid,purpose:'memory.storage',active:true}]])check('withdrawal immediately before commit leaves no retained grant: '+name,async()=>{const h=harness();h.state.beforeCommit=async()=>h.records.set(path,marker);await assert.rejects(h.call());assert.equal(h.records.has(grantPath),false);assert.equal(h.state.writes,0);});
check('revoked terminal replay returns no stale successful receipt',async()=>{const records=new Map([[grantPath,grant],[ownerFencePath,{...inactiveFence,deleted:true,deletionEpoch:1}]]);const h=harness(records);await assert.rejects(h.call());assert.equal(h.state.output,'');assert.equal(h.state.writes,0);assert.deepEqual(records.get(grantPath),grant);});
check('configured project cannot silently use a foreign default Firestore instance',async()=>{const h=harness(new Map(),{dbProject:'demo-synthetic-foreign-project'});await assert.rejects(h.call());assert.equal(h.state.reads.length,0);assert.equal(h.state.writes,0);});
check('exact released planning marker preserves compatible reviewed creation',async()=>{const records=new Map([[deletionPath,{uid:grant.ownerUid,updatedAt:new Date()}]]);const h=harness(records);await h.call();assert.equal(h.state.writes,1);});
for(const [name,marker]of Object.entries({'string-timestamp':{uid:grant.ownerUid,updatedAt:'synthetic-unverified-time'},'unknown-field':{uid:grant.ownerUid,updatedAt:new Date(),requestId:'synthetic-ambiguous-retained-state'},'live-planning':{uid:grant.ownerUid,updatedAt:new Date(),deletionPlanningLeaseToken:'synthetic-current-lease'},'live-planning-explicit-inactive':{uid:grant.ownerUid,active:false,updatedAt:new Date(),deletionPlanningLeaseUntil:new Date(Date.now()+60000)}}))check('canonical '+name+' marker remains fail-closed',async()=>{const records=new Map([[deletionPath,marker]]);const h=harness(records);await assert.rejects(h.call());assert.equal(records.has(grantPath),false);});
let passed=0,failed=0;for(const item of tests){try{await item.callback();passed++;console.log('[PASS] '+item.name);}catch(error){failed++;console.log('[FAIL] '+item.name+': '+error.message);}}
console.log(JSON.stringify({kind:'actual-private-source-grant-CLI-with-explicit-Firebase-adapters',node:process.version,registeredCases:tests.length,passed,failed,loadedFunctions:false,providerCalls:0,cloudWrites:0,syntheticOnly:true}));if(failed)process.exitCode=1;
