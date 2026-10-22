// Fresh Node process proof: reauthenticate, read the held master, replay request.
// Parent passes synthetic test-only login in a bounded stdin message, never CLI argv.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {requireChalkDualEmulators,checkChalkHeldProof} from './chalk-dual-emulator-contract.mjs';
const gate=requireChalkDualEmulators(process.env);
const json=readFileSync(0,'utf8');
if(json.length>5000)throw Error('CHALK_RESTART_OVERSIZED');
const input=JSON.parse(json);
if(input.sourceSha!==gate.sourceSha||!/^[a-f0-9]{40}$/.test(input.sourceSha))throw Error('CHALK_RESTART_SOURCE_DRIFT');
const load=createRequire(new URL('../functions/package.json',import.meta.url));
const web=createRequire(new URL('../web/package.json',import.meta.url));
const {initializeApp}=load('firebase-admin/app'),{getFirestore}=load('firebase-admin/firestore');
const {initializeApp:clientApp}=web('firebase/app');
const {getAuth,connectAuthEmulator,signInWithEmailAndPassword,inMemoryPersistence,setPersistence}=web('firebase/auth');
const {getFunctions,connectFunctionsEmulator,httpsCallable}=web('firebase/functions');
const marker='chalk-restart-'+process.pid;
const db=getFirestore(initializeApp({projectId:gate.jobsProject},marker+'-admin'));
function session(project,kind){
 const a=clientApp({projectId:project,apiKey:'chalk-test-only',authDomain:project+'.firebaseapp.com',appId:'test'},marker+kind);
 const auth=getAuth(a);connectAuthEmulator(auth,'http://'+gate.auth,{disableWarnings:true});return {a,auth};
}
const jobs=session(gate.jobsProject,'jobs'),spatial=session(gate.spatialProject,'spatial');
await Promise.all([setPersistence(jobs.auth,inMemoryPersistence),setPersistence(spatial.auth,inMemoryPersistence)]);
await Promise.all([signInWithEmailAndPassword(jobs.auth,input.jobsEmail,input.jobsPassword),signInWithEmailAndPassword(spatial.auth,input.spatialEmail,input.spatialPassword)]);
const token=await spatial.auth.currentUser.getIdToken(true);
const f=getFunctions(jobs.a,'us-central1'),[host,port]=gate.functions.split(':');
connectFunctionsEmulator(f,host,Number(port));
const callable=httpsCallable(f,'chalkSpatialJobsBridge',{timeout:22000});
const invoke=async data=>(await callable({...data,spatialIdToken:token})).data;
const read=await invoke({operation:'read',limit:40});
if(!read.jobs?.some(x=>x.jobId===input.jobId&&x.admission==='HELD_UNQUEUED'&&x.queued===false))throw Error('CHALK_RESTART_READBACK_FAILED');
const replay=await invoke(input.request);
if(replay.jobId!==input.jobId||replay.deduplicated!==true||replay.queued!==false)throw Error('CHALK_RESTART_IDEMPOTENCY_FAILED');
const master=await db.collection('jobs').doc(input.jobId).get(),queue=await db.collection('jobQueue').doc(input.jobId).get(),log=await db.collection('jobs').doc(input.jobId).collection('logs').doc('chalk-intake-created').get(),quota=await db.collection('chalkIntakeQuota').doc(master.data().ownerUid).get();
checkChalkHeldProof(master.data(),queue.exists,log.exists,quota.data()?.count,gate.sourceSha,input.jobId);
process.stdout.write('CHALK_RESTART_CHILD_VERIFIED\n');
