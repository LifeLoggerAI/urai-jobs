/** R876 current source-backed synthetic regression; not Firebase emulator evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const requireFunctions=createRequire(new URL('../functions/package.json',import.meta.url));
const ts=requireFunctions('typescript');
const base=new URL('../functions/src/',import.meta.url);
const transpile=path=>ts.transpileModule(readFileSync(new URL(path,base),'utf8'),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(js,requires){const mod={exports:{}};new Function('require','module','exports',js)(name=>{if(!(name in requires))throw Error('Unexpected import '+name);return requires[name]},mod,mod.exports);return mod.exports}
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
const httpsError=(code,message)=>new HttpsError(code,message);
const z={object:()=>({safeParse:v=>typeof v?.jobId==='string'&&v.jobId?{success:true,data:v}:{success:false,error:{flatten:()=>({})}}}),string:()=>({min:()=>({})})};
const helper=load(transpile('jobs/currentJobCallerAuthority.ts'),{});
function mock(initialUser,job,changedUser){const reads=[];let count=0;
function snap(name){reads.push(name);if(name==='users'){count++;let u=count>1&&changedUser!==undefined?changedUser:initialUser;return {exists:!!u,data:()=>u}}return {exists:!!job,data:()=>job}}
const userRef={name:'users',async get(){return snap('users')}};
const jobRef={name:'jobs',async get(){return snap('jobs')}};
const db={collection(name){assert.equal(name,'users');return {doc(){return userRef}}},async runTransaction(fn){const tx={get:r=>r.get()};return fn(tx)}};
const auth=load(transpile('core/auth.ts'),{'firebase-functions/v1':{https:{onCall:fn=>fn}},'./errors.js':{httpsError},'./firestore-paths.js':{userDoc:()=>userRef}});
const status=load(transpile('jobs/getJobStatus.ts'),{'zod':{z},'firebase-admin/firestore':{getFirestore:()=>db},'../core/auth.js':auth,'../core/errors.js':{httpsError},'../core/firestore-paths.js':{jobDoc:()=>jobRef},'./currentJobCallerAuthority.js':helper});return {get:status.getJobStatus,reads}}
const ctx=uid=>({auth:{uid,token:{role:'operator'}}});
const denied=e=>e.code==='permission-denied';
test('R876 patched active user reads own job',async()=>{const m=mock({uid:'A',role:'user',disabled:false},{ownerUid:'A',status:'RUNNING'});assert.equal((await m.get({jobId:'job-1'},ctx('A'))).job.status,'RUNNING');assert.deepEqual(m.reads,['users','users','jobs'])});
test('R876 patched disabled owner denied',async()=>{const m=mock({uid:'A',role:'user',disabled:true},{ownerUid:'A',status:'RUNNING'});await assert.rejects(()=>m.get({jobId:'job-1'},ctx('A')),denied)});
test('R876 patched deletion-pending owner denied',async()=>{const m=mock({uid:'A',role:'user',dataRightsDeletionPendingCentralPrivacy:true},{ownerUid:'A',status:'RUNNING'});await assert.rejects(()=>m.get({jobId:'job-1'},ctx('A')),denied)});
test('R876 patched disabled operator denied even for foreign job',async()=>{const m=mock({uid:'A',role:'operator',disabled:true},{ownerUid:'B',status:'RUNNING'});await assert.rejects(()=>m.get({jobId:'job-1'},ctx('A')),denied)});
test('R876 patched role downgrade between wrapper and transaction denies foreign job',async()=>{const m=mock({uid:'A',role:'operator',disabled:false},{ownerUid:'B',status:'RUNNING'},{uid:'A',role:'user',disabled:false});await assert.rejects(()=>m.get({jobId:'job-1'},ctx('A')),denied)});
test('R876 patched deletion during wrapper-to-transaction window denied',async()=>{const m=mock({uid:'A',role:'user',disabled:false},{ownerUid:'A',status:'RUNNING'},null);await assert.rejects(()=>m.get({jobId:'job-1'},ctx('A')),denied)});
test('R876 patched current operator with lower-claim token can read foreign job',async()=>{const m=mock({uid:'A',role:'operator',disabled:false},{ownerUid:'B',status:'RUNNING'});assert.equal((await m.get({jobId:'job-1'},ctx('A'))).job.ownerUid,'B')});
test('R876 patched ordinary foreign user denied',async()=>{const m=mock({uid:'A',role:'user',disabled:false},{ownerUid:'B',status:'RUNNING'});await assert.rejects(()=>m.get({jobId:'job-1'},ctx('A')),denied)});
test('R876 patched missing Auth denied',async()=>{const m=mock({uid:'A',role:'user'},{ownerUid:'A'});await assert.rejects(()=>m.get({jobId:'job-1'},{auth:null}),e=>e.code==='unauthenticated')});
