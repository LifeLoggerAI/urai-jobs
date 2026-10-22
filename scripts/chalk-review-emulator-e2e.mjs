// Authenticated Chalk acceptance against REAL local Auth, Firestore and Functions emulators.
// Never invoke against production: this script refuses non-loopback services and real projects.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const PROJECT='demo-urai-auth-journey';
function deny(code){throw Error('CHALK_E2E_'+code)}
export function requireLocalChalkEmulators(env){
 if(env.CHALK_INTAKE_E2E!=='1'||env.URAI_CHALK_INTAKE_ENABLED!=='true'||
    env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'||
    env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||
    env.GCLOUD_PROJECT!==PROJECT||
    (env.GOOGLE_CLOUD_PROJECT&&env.GOOGLE_CLOUD_PROJECT!==PROJECT)||
    (env.GCP_PROJECT&&env.GCP_PROJECT!==PROJECT)||
    ['prod','production','staging'].includes((env.URAI_ENV||'').toLowerCase())||
    !/^[a-f0-9]{40}$/.test(env.URAI_CHALK_SPATIAL_SOURCE_SHA||''))deny('ISOLATION_REQUIRED');
 if(env.FIREBASE_CONFIG){
   let x;
   try{x=JSON.parse(env.FIREBASE_CONFIG)}catch{deny('CONFIG_INVALID')}
   if(x?.projectId!==PROJECT)deny('CONFIG_PROJECT');
 }
 return Object.freeze({projectId:PROJECT,sourceSha:env.URAI_CHALK_SPATIAL_SOURCE_SHA});
}
const isMain=process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]);
if(isMain){requireLocalChalkEmulators(process.env);await run();}
async function run(){
 const require=createRequire(new URL('../functions/package.json',import.meta.url));
 const {initializeApp,getApps}=require('firebase-admin/app');
 const {getAuth}=require('firebase-admin/auth'),{getFirestore}=require('firebase-admin/firestore');
 const app=getApps()[0]||initializeApp({projectId:PROJECT});
 if(app.options.projectId!==PROJECT)deny('ADMIN_PROJECT_DRIFT');
 const auth=getAuth(app),db=getFirestore(app),salt=randomBytes(6).toString('hex');
 const people=['chalk-e2e-owner-'+salt,'chalk-e2e-other-'+salt];
 const pass=randomBytes(24).toString('hex'),receipts=[],checks=[];
 const sha=process.env.URAI_CHALK_SPATIAL_SOURCE_SHA;
 const diagnostic=()=>({kind:'chalk-spatial-diagnostic-v1',repository:'LifeLoggerAI/urai-spatial',
   sourceSha:sha,component:'focus',route:'/focus',selectedStar:null,frameSamples:4,p95Ms:16.3,
   status:'LOCAL_UNSUBMITTED',authority:'client-observation-not-server-verified'});
 const verify=(label,got,want)=>{assert.equal(got,want,label);checks.push(label)};
 async function call(name,data,token){
   const url='http://127.0.0.1:5001/'+PROJECT+'/us-central1/'+name;
   const res=await fetch(url,{method:'POST',
     headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
     body:JSON.stringify({data}),signal:AbortSignal.timeout(15000)});
   const json=await res.json();return {http:res.status,data:json.result,error:json.error?.status};
 }
 async function signIn(uid){
   const url='http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo';
   const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},
     body:JSON.stringify({email:uid+'@example.invalid',password:pass,returnSecureToken:true}),
     signal:AbortSignal.timeout(8000)});
   const x=await res.json();if(!res.ok||!x.idToken)deny('SIGNIN_FAILED');return x.idToken;
 }
 try{
   for(const uid of people){
     await auth.createUser({uid,email:uid+'@example.invalid',password:pass,disabled:false});
     await auth.setCustomUserClaims(uid,{role:'operator'});
     await db.collection('users').doc(uid).create({uid,role:'operator',status:'active',disabled:false});
   }
   const owner=await signIn(people[0]),other=await signIn(people[1]);
   const beforeJobs=(await db.collection('jobs').count().get()).data().count;
   const beforeQueue=(await db.collection('jobQueue').count().get()).data().count;
   const input={requestId:randomUUID(),diagnostic:diagnostic()};
   verify('anonymous denied',(await call('submitChalkDiagnosticReview',input)).error,'UNAUTHENTICATED');
   const created=await call('submitChalkDiagnosticReview',input,owner);
   verify('authenticated callable HTTP',created.http,200);
   verify('receipt is review-only',created.data?.state,'REVIEW_ONLY_NOT_QUEUED');
   verify('new receipt persisted',created.data?.result,'RECORDED');
   receipts.push(created.data.reviewId);
   const read=await call('getChalkDiagnosticReview',{reviewId:created.data.reviewId},owner);
   verify('owner readback',read.data?.reviewId,created.data.reviewId);
   verify('source pinned',read.data?.sourceSha,sha);
   const exactDigest=createHash('sha256').update(JSON.stringify(diagnostic())).digest('hex');
   verify('exact SHA256 evidence digest',read.data?.digest,exactDigest);
   const stored=(await db.collection('chalkDiagnosticReviews').doc(created.data.reviewId).get()).data();
   verify('durable Firestore state',stored?.state,'REVIEW_ONLY_NOT_QUEUED');
   verify('persisted owner identity',stored?.ownerUid,people[0]);
   verify('persisted evidence integrity',stored?.digest,exactDigest);
   verify('no private media stored',Object.hasOwn(stored?.diagnostic||{},'privateMedia'),false);
   const conflict={requestId:input.requestId,diagnostic:{...diagnostic(),p95Ms:22.7}};
   verify('conflicting idempotency request rejected',
     (await call('submitChalkDiagnosticReview',conflict,owner)).error,'ALREADY_EXISTS');
   verify('idempotent duplicate',(await call('submitChalkDiagnosticReview',input,owner)).data?.result,'EXISTING');
   verify('foreign owner denied',(await call('getChalkDiagnosticReview',{reviewId:created.data.reviewId},other)).error,'NOT_FOUND');
   const second=await call('submitChalkDiagnosticReview',input,other);
   verify('second owner independent',second.data?.state,'REVIEW_ONLY_NOT_QUEUED');
   assert.notEqual(second.data.reviewId,created.data.reviewId);receipts.push(second.data.reviewId);
   const bad={requestId:randomUUID(),diagnostic:{...diagnostic(),privateMedia:'secret'}};
   verify('private fields denied',(await call('submitChalkDiagnosticReview',bad,owner)).error,'INVALID_ARGUMENT');
   const drift={requestId:randomUUID(),diagnostic:{...diagnostic(),sourceSha:'b'.repeat(40)}};
   verify('source drift denied',(await call('submitChalkDiagnosticReview',drift,owner)).error,'INVALID_ARGUMENT');
   await db.collection('users').doc(people[0]).update({role:'user'});
   verify('role revoked',(await call('getChalkDiagnosticReview',{reviewId:created.data.reviewId},owner)).error,'PERMISSION_DENIED');
   await db.collection('users').doc(people[0]).update({role:'operator'});
   await auth.updateUser(people[0],{disabled:true});
   verify('disabled account denied',(await call('getChalkDiagnosticReview',{reviewId:created.data.reviewId},owner)).error,'UNAUTHENTICATED');
   await auth.updateUser(people[0],{disabled:false});
   const renewed=await signIn(people[0]);
   for(let i=0;i<7;i++){
      const x=await call('submitChalkDiagnosticReview',{requestId:randomUUID(),diagnostic:diagnostic()},renewed);
      verify('quota admission '+(i+2),x.data?.result,'RECORDED');receipts.push(x.data.reviewId);
   }
   verify('ninth blocked by quota',(await call('submitChalkDiagnosticReview',{requestId:randomUUID(),diagnostic:diagnostic()},renewed)).error,'RESOURCE_EXHAUSTED');
   verify('rejected quota does not create receipt',
     (await db.collection('chalkDiagnosticReviews').where('ownerUid','==',people[0]).count().get()).data().count,8);
   verify('no Jobs master admission',(await db.collection('jobs').count().get()).data().count,beforeJobs);
   verify('no Jobs queue admission',(await db.collection('jobQueue').count().get()).data().count,beforeQueue);
   console.log(JSON.stringify({suite:'chalk-authenticated-review-emulator',project:PROJECT,
     sourceSha:sha,passed:checks.length,total:checks.length,checks,realEmulators:true,
     jobExecution:false,providerSpend:false},null,2));
 }finally{
   for(const id of receipts)await db.collection('chalkDiagnosticReviews').doc(id).delete();
   for(const uid of people){
      await db.collection('chalkDiagnosticReviewThrottle').doc(uid).delete();
      await db.collection('users').doc(uid).delete();
      try{await auth.deleteUser(uid)}catch{/* interrupted setup */}
   }
 }
}
