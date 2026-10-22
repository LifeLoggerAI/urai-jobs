// Execute ONLY against already-running isolated Auth, Firestore, Functions emulators.
// Run from urai-jobs with Node22: CHALK_EMULATOR_PROOF=1 CHALK_NONPRODUCTION_INTAKE=true
// GOOGLE_CLOUD_PROJECT=demo-urai-jobs GCLOUD_PROJECT=demo-urai-jobs
// FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
// CHALK_PINNED_SPATIAL_SHA=<exact-spatial-commit-sha> node scripts/chalk-dual-emulator-proof.mjs
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {requireChalkDualEmulators,checkChalkHeldProof} from './chalk-dual-emulator-contract.mjs';
const gate=requireChalkDualEmulators(process.env);
const load=createRequire(new URL('../functions/package.json',import.meta.url));
const web=createRequire(new URL('../web/package.json',import.meta.url));
const {initializeApp}=load('firebase-admin/app');
const {getAuth:adminAuth}=load('firebase-admin/auth');
const {getFirestore}=load('firebase-admin/firestore');
const {initializeApp:clientApp}=web('firebase/app');
const {getAuth,connectAuthEmulator,signInWithEmailAndPassword,signOut,inMemoryPersistence,setPersistence}=web('firebase/auth');
const {getFunctions,connectFunctionsEmulator,httpsCallable}=web('firebase/functions');
const marker=randomBytes(8).toString('hex'),jobsUid='chalkjobs_'+marker,spatialUid='chalkspatial_'+marker;
const jobsAdmin=initializeApp({projectId:gate.jobsProject},'chalk-jobs-'+marker);
const spatialAdmin=initializeApp({projectId:gate.spatialProject},'chalk-spatial-'+marker);
const db=getFirestore(jobsAdmin);
async function verifyService(){
 const r=await fetch('http://'+gate.firestore+'/v1/projects/demo-urai-jobs/databases/(default)/documents/chalkReadinessProbe?pageSize=1',{signal:AbortSignal.timeout(3000)});
 if(!r.ok||!r.headers.get('content-type')?.includes('json'))throw Error('CHALK_FIRESTORE_EMULATOR_REQUIRED');
 const x=await r.json();
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!['documents','nextPageToken'].includes(k)))throw Error('CHALK_FIRESTORE_EMULATOR_REQUIRED');
}
function client(project,suffix){
 const app=clientApp({projectId:project,apiKey:'chalk-demo-key',authDomain:project+'.firebaseapp.com',
  appId:'chalk-'+marker},project+'-'+marker+'-'+suffix);
 const auth=getAuth(app);connectAuthEmulator(auth,'http://'+gate.auth,{disableWarnings:true});
 return {app,auth};
}
async function freshLogin(){
 const j=client(gate.jobsProject,randomBytes(3).toString('hex'));
 const s=client(gate.spatialProject,randomBytes(3).toString('hex'));
 await Promise.all([setPersistence(j.auth,inMemoryPersistence),setPersistence(s.auth,inMemoryPersistence)]);
 await signInWithEmailAndPassword(j.auth,jobsEmail,jobsPassword);
 await signInWithEmailAndPassword(s.auth,spatialEmail,spatialPassword);
 const f=getFunctions(j.app,'us-central1');
 const [host,port]=gate.functions.split(':');connectFunctionsEmulator(f,host,Number(port));
 return {j,s,spatialToken:await s.auth.currentUser.getIdToken(true),call:httpsCallable(f,'chalkSpatialJobsBridge',{timeout:22000})};
}
async function close(x){await Promise.all([signOut(x.j.auth),signOut(x.s.auth)])}
async function evidence(id){
 const master=await db.collection('jobs').doc(id).get(),queue=await db.collection('jobQueue').doc(id).get();
 const log=await db.collection('jobs').doc(id).collection('logs').doc('chalk-intake-created').get();
 if(!master.exists)throw Error('CHALK_MISSING_JOB_MASTER');
 const quota=await db.collection('chalkIntakeQuota').doc(jobsUid).get();
 checkChalkHeldProof(master.data(),queue.exists,log.exists,quota.data()?.count,gate.sourceSha,id);
}
async function guardedCall(x,operation){return (await x.call({...operation,spatialIdToken:x.spatialToken})).data}
async function verifyRealRestart(input){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('./chalk-dual-emulator-restart.mjs',import.meta.url))],{
   stdio:['pipe','pipe','pipe'],shell:false,env:{...process.env},windowsHide:true});
  let stdout='',stderr='';
  const timeout=setTimeout(()=>child.kill(),35000);
  child.stdout.on('data',x=>{stdout+=(String(x)).slice(0,2048)});
  child.stderr.on('data',x=>{stderr+=(String(x)).slice(0,2048)});
  child.on('error',reject);
  child.on('close',code=>{clearTimeout(timeout);if(code===0&&stdout.includes('CHALK_RESTART_CHILD_VERIFIED'))resolve(true);
   else reject(Error('CHALK_REAL_RESTART_FAILED '+String(code)+' '+stderr.slice(-300)))});
  child.stdin.end(JSON.stringify(input));
 });
}

const jobsEmail='jobs-'+marker+'@synthetic.test',spatialEmail='spatial-'+marker+'@synthetic.test';
const jobsPassword=randomBytes(18).toString('base64url'),spatialPassword=randomBytes(18).toString('base64url');
try{
 await verifyService();
 await adminAuth(jobsAdmin).createUser({uid:jobsUid,email:jobsEmail,password:jobsPassword});
 await adminAuth(spatialAdmin).createUser({uid:spatialUid,email:spatialEmail,password:spatialPassword});
 await adminAuth(jobsAdmin).setCustomUserClaims(jobsUid,{role:'admin'});
 await adminAuth(spatialAdmin).setCustomUserClaims(spatialUid,{role:'admin'});
 await db.collection('users').doc(jobsUid).set({uid:jobsUid,role:'admin',permissions:['engineering:operate'],
  status:'active',disabled:false,deleted:false,suspended:false,tenantId:null,orgId:null});
 const binding=db.collection('chalkIdentityBindings').doc(jobsUid);
 await binding.set({jobsUid,spatialUid,status:'approved',purpose:'chalk-engineering',revoked:false,
  scopes:['engineering:read','engineering:intake'],expiresAtMs:Date.now()+600000,revision:1,tenantId:null,orgId:null});
 let x=await freshLogin();
 let blocked=false;
 try{await x.call({operation:'read',spatialIdToken:'not-a-spatial-token',limit:10})}catch{blocked=true}
 if(!blocked)throw Error('CHALK_UNVERIFIED_SPATIAL_TOKEN_ACCEPTED');
 const request={operation:'submit',requestId:'diagnostic_'+marker,problem:'Investigate rendering transition lag in the Life Map scene at this exact source.',
  diagnostic:{kind:'chalk-spatial-diagnostic-v1',repository:'LifeLoggerAI/urai-spatial',
   sourceSha:gate.sourceSha,component:'life-map',route:'/life-map',selectedStar:null,
   frameSamples:12,p95Ms:44.4,status:'LOCAL_UNSUBMITTED',
   authority:'client-observation-not-server-verified'}};
 const first=await guardedCall(x,request);
 if(first.queued!==false||first.deduplicated!==false||first.admission!=='HELD_UNQUEUED')throw Error('CHALK_BAD_INTAKE_RECEIPT');
 await evidence(first.jobId);await close(x);
 // Re-authenticate and prove durability from a genuinely new Node process.
 await verifyRealRestart({jobsEmail,jobsPassword,spatialEmail,spatialPassword,
  sourceSha:gate.sourceSha,request,jobId:first.jobId});
 await evidence(first.jobId);
 x=await freshLogin();
 await binding.update({revoked:true});
 blocked=false;try{await guardedCall(x,{operation:'read',limit:40})}catch{blocked=true}
 if(!blocked)throw Error('CHALK_REVOKED_BINDING_ACCEPTED');
 await close(x);
 console.log(JSON.stringify({kind:'chalk-dual-emulator-receipt-v1',sourceSha:gate.sourceSha,jobId:first.jobId,
  held:true,queued:false,duplicatePrevented:true,reconnected:true,processRestartProof:true,revocationDenied:true,
  actualEmulator:true,paidCalls:0},null,2));
}catch(e){console.error('CHALK_DUAL_EMULATOR_PROOF_BLOCKED_OR_FAILED:',e instanceof Error?e.message:String(e));process.exitCode=1}
