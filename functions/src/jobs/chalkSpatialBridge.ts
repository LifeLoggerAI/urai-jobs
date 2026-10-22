import {getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {currentJobActor,requireJobOperator} from '../core/currentJobActor.js';
import {assertChalkLocalEmulatorGate,buildChalkDiagnosticIntake} from './chalkDiagnosticIntakeAuthority.js';
import {authorizeChalkCrossProject,assertChalkBridgeLeaseUnchanged,type ChalkBridgeAction} from './chalkCrossProjectAuthority.js';
import {persistChalkHeldIntake,type MinimalTransaction} from './chalkHeldIntakeTransaction.js';
import {redactChalkJobDocuments} from './chalkReadbackAuthority.js';

// Requires TWO independently authenticated emulator project identities.
// Never mints or exchanges tokens. No production admission.
const PROJECT='demo-urai-auth-journey',APP='chalk-spatial-origin-emulator';
const plain=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function operator(x:unknown){if(!plain(x))return false;return x.role==='admin'||x.role==='operator'||
 x.uraiSpatialAdmin===true||(Array.isArray(x.roles)&&(x.roles.includes('admin')||x.roles.includes('operator')));}
function spatialAuth(){const app=getApps().find(a=>a.name===APP)||initializeApp({projectId:PROJECT},APP);return getAuth(app);}
function guard(){try{assertChalkLocalEmulatorGate(process.env);}catch{throw new HttpsError('failed-precondition','Emulator-only bridge unavailable.');}}
async function authorize(request:Parameters<typeof currentJobActor>[0],token:string,scope:ChalkBridgeAction,tx?:Parameters<typeof currentJobActor>[1]){
 const jobs=await currentJobActor(request,tx);requireJobOperator(jobs);
 if(typeof token!=='string'||token.length<50||token.length>8192)throw new HttpsError('unauthenticated','Spatial token required.');
 let spatial;
 try{
  const auth=spatialAuth(),decoded=await auth.verifyIdToken(token,true),live=await auth.getUser(decoded.uid);
  if(live.disabled||live.uid!==decoded.uid)throw Error('inactive');
  const value=(v:unknown)=>typeof v==='string'&&v?v:null;
  const tokenTenant=value(decoded.tenantId),tokenOrg=value(decoded.orgId);
  const liveTenant=value(live.customClaims?.tenantId),liveOrg=value(live.customClaims?.orgId);
  if(tokenTenant!==liveTenant||tokenOrg!==liveOrg)throw Error('scope changed');
  spatial={uid:decoded.uid,audience:String(decoded.aud),issuer:String(decoded.iss),
   tokenOperator:operator(decoded),liveOperator:operator(live.customClaims),
   disabled:live.disabled,tenantId:liveTenant,orgId:liveOrg};
 }catch{throw new HttpsError('unauthenticated','Spatial identity not verified.');}
 const bindingRef=getFirestore().collection('chalkIdentityBindings').doc(jobs.uid);
 const snap=tx?await tx.get(bindingRef):await bindingRef.get();
 try{return authorizeChalkCrossProject({jobs,spatial,binding:snap.exists?snap.data()??null:null,action:scope,nowMs:Date.now()});}
 catch{throw new HttpsError('permission-denied','Engineering identity binding unavailable.');}
}
export const chalkSpatialJobsBridge=onCall({region:'us-central1',cors:true,timeoutSeconds:30},async request=>{
 guard();
 const d=request.data;
 if(!plain(d)||!['read','submit'].includes(String(d.operation))||typeof d.spatialIdToken!=='string')
  throw new HttpsError('invalid-argument','Operation and independent Spatial token required.');
 const operation=d.operation as 'read'|'submit';
 const allowed=operation==='read'?['operation','spatialIdToken','limit']:['operation','spatialIdToken','requestId','problem','diagnostic'];
 if(Object.keys(d).some(k=>!allowed.includes(k)))throw new HttpsError('invalid-argument','Unexpected input.');
 const scope:ChalkBridgeAction=operation==='read'?'engineering:read':'engineering:intake';
 const actor=await authorize(request,d.spatialIdToken,scope);
 if(operation==='read'){
  const limit=d.limit??20;
  if(!Number.isSafeInteger(limit)||Number(limit)<1||Number(limit)>40)
   throw new HttpsError('invalid-argument','Limit out of bounds.');
  const snap=await getFirestore().collection('jobs').where('ownerUid','==',actor.jobsUid).limit(Number(limit))
   .select('ownerUid','type','jobType','status','admission.state','admission.workerAdmitted','payload.repository','payload.baseSha').get();
  const after=await authorize(request,d.spatialIdToken,scope);
  try{assertChalkBridgeLeaseUnchanged(actor,after,Date.now());}
  catch{throw new HttpsError('permission-denied','Engineering approval expired or changed during read.');}
  const validated=redactChalkJobDocuments(snap.docs,actor.jobsUid);
  const byId=new Map(snap.docs.map(doc=>[doc.id,doc.data()]));
  return {jobs:validated.map(job=>{
   const raw=byId.get(job.jobId),record=plain(raw)?raw:{},admission=plain(record.admission)?record.admission:{};
   const payload=plain(record.payload)?record.payload:{};
   const held=admission.state==='HELD_UNQUEUED'&&admission.workerAdmitted===false;
   return {jobId:job.jobId,status:job.status,admission:held?'HELD_UNQUEUED':'UNVERIFIED',
    queued:held?false:null,repository:payload.repository==='LifeLoggerAI/urai-spatial'?payload.repository:null,
    sourceSha:typeof payload.baseSha==='string'&&/^[a-f0-9]{40}$/.test(payload.baseSha)?payload.baseSha:null};
  }),windowLimited:snap.size>=Number(limit)};
 }
 let record;
 try{record=buildChalkDiagnosticIntake({requestId:d.requestId,problem:d.problem,diagnostic:d.diagnostic},
  {ownerUid:actor.jobsUid,pinnedSourceSha:process.env.CHALK_PINNED_SPATIAL_SHA||''});}
 catch{throw new HttpsError('invalid-argument','Exact pinned nonprivate diagnostic required.');}
 const db=getFirestore(),masterRef=db.collection('jobs').doc(record.jobId),queueRef=db.collection('jobQueue').doc(record.jobId);
 const logRef=masterRef.collection('logs').doc('chalk-intake-created'),quotaRef=db.collection('chalkIntakeQuota').doc(record.ownerUid);
 try{return await db.runTransaction(async tx=>{
  const current=await authorize(request,d.spatialIdToken,scope,tx);
  try{assertChalkBridgeLeaseUnchanged(actor,current,Date.now());}
  catch{throw new HttpsError('permission-denied','Engineering approval expired or changed during intake.');}
  return persistChalkHeldIntake({transaction:tx as unknown as MinimalTransaction,
   masterRef,queueRef,logRef,quotaRef,record,nowMs:Date.now(),timestamp:FieldValue.serverTimestamp(),
   originSpatialUid:current.spatialUid,bindingRevision:current.bindingRevision});
 });}catch(e){
  if(e instanceof HttpsError)throw e;
  if(e instanceof Error&&e.message==='CHALK_HELD_INTAKE_RATE_LIMIT')throw new HttpsError('resource-exhausted','Intake rate limit.');
  if(e instanceof Error&&e.message.startsWith('CHALK_HELD_INTAKE_'))throw new HttpsError('failed-precondition','Held intake conflict.');
  throw new HttpsError('internal','Intake unavailable.');
 }
});
