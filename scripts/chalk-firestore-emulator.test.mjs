// Synthetic-data integration probe against a LOCAL Firestore emulator only.
// Does not admit engineering.verify into production or test auth/real dispatch.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile as callbackExecFile} from 'node:child_process';
import {promisify} from 'node:util';
import {engineeringCheckpointBridge} from './chalk-firestore-checkpoint.mjs';
const execFile=promisify(callbackExecFile);
const host=process.env.FIRESTORE_EMULATOR_HOST||'';
const local=/^(?:localhost|127\.0\.0\.1):[0-9]{2,5}$/.test(host);
if(host&&!local)throw Error('CHALK_REFUSES_NONLOCAL_FIRESTORE_TARGET');
if(!local&&process.env.CHALK_REQUIRE_FIRESTORE_EMULATOR==='1')
  throw Error('CHALK_FIRESTORE_EMULATOR_REQUIRED');
const projectId='demo-urai-jobs';
const actorUid='synthetic-founder-123';
const leaseA='synthetic-first-worker-token',leaseB='synthetic-recovery-worker-token';
function sdk(){
  const require=createRequire(new URL('../functions/package.json',import.meta.url));
  const {getApps,initializeApp}=require('firebase-admin/app');
  const {getFirestore,Timestamp}=require('firebase-admin/firestore');
  const app=getApps().find(a=>a.name==='chalk-emulator')||
    initializeApp({projectId},'chalk-emulator');
  return {db:getFirestore(app),Timestamp};
}
const bridge=db=>engineeringCheckpointBridge(db,{
  jobRef:id=>db.collection('jobs').doc(id),
  queueRef:id=>db.collection('jobQueue').doc(id),
});
test('local Firestore: fresh Node process resumes checkpoint under rotated Jobs lease',
  {skip:!local&&'Requires explicit local Firestore emulator'},async t=>{
  const {db,Timestamp}=sdk();
  const jobId='eng_'+randomUUID().replaceAll('-','');
  const job=db.collection('jobs').doc(jobId),queue=db.collection('jobQueue').doc(jobId);
  const expiresAt=Timestamp.fromMillis(Date.now()+120000);
  t.after(async()=>{await Promise.all([job.delete(),queue.delete()]);await db.terminate()});
  await Promise.all([
    job.set({jobId,ownerUid:actorUid,type:'engineering.verify',status:'RUNNING',
      payload:{repository:'LifeLoggerAI/urai-spatial',baseSha:'a'.repeat(40),
        requestDigest:'b'.repeat(64)},
      lease:{leaseToken:leaseA,expiresAt},
      execution:{leaseToken:leaseA,attemptCount:1}}),
    queue.set({jobId,ownerUid:actorUid,status:'RUNNING',
      lease:{leaseToken:leaseA,expiresAt}}),
  ]);
  const b=bridge(db);
  const initial=await b.persist({jobId,actorUid,leaseToken:leaseA,
    attempt:1,expectedRevision:0,phase:'SOURCE_PINNED',outputDigest:'c'.repeat(64)});
  assert.equal(initial.revision,1);
  await Promise.all([
    job.update({lease:{leaseToken:leaseB,expiresAt},
      'execution.leaseToken':leaseB,'execution.attemptCount':2}),
    queue.update({lease:{leaseToken:leaseB,expiresAt}}),
  ]);
  const moduleUrl=new URL('./chalk-firestore-checkpoint.mjs',import.meta.url).href;
  const packageUrl=new URL('../functions/package.json',import.meta.url).href;
  const child=[
    "import {createRequire} from 'node:module';",
    "import {engineeringCheckpointBridge} from "+JSON.stringify(moduleUrl)+";",
    "const require=createRequire("+JSON.stringify(packageUrl)+");",
    "const {initializeApp}=require('firebase-admin/app');",
    "const {getFirestore}=require('firebase-admin/firestore');",
    "const db=getFirestore(initializeApp({projectId:"+JSON.stringify(projectId)+"}));",
    "const b=engineeringCheckpointBridge(db,{jobRef:id=>db.collection('jobs').doc(id),queueRef:id=>db.collection('jobQueue').doc(id)});",
    "const old=await b.read({jobId:"+JSON.stringify(jobId)+",actorUid:"+JSON.stringify(actorUid)+"});",
    "if(old.revision!==1||old.phase!=='SOURCE_PINNED')process.exit(3);",
    "const next=await b.persist({jobId:"+JSON.stringify(jobId)+",actorUid:"+JSON.stringify(actorUid)+",leaseToken:"+JSON.stringify(leaseB)+",attempt:2,expectedRevision:1,phase:'TESTS_VERIFIED',outputDigest:'d'.repeat(64)});",
    "console.log(JSON.stringify({revision:next.revision,attempt:next.attempt}));",
    "await db.terminate();",
  ].join('\n');
  const proc=await execFile(process.execPath,['--input-type=module','-e',child],{
    timeout:20000,maxBuffer:32768,
    env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:process.env.HOME||'/tmp',
      FIRESTORE_EMULATOR_HOST:host,GOOGLE_CLOUD_PROJECT:projectId,GCLOUD_PROJECT:projectId},
  });
  assert.deepEqual(JSON.parse(proc.stdout.trim()),{revision:2,attempt:2});
  assert.equal((await b.read({jobId,actorUid})).phase,'TESTS_VERIFIED');
  await assert.rejects(b.persist({jobId,actorUid,leaseToken:leaseA,
    attempt:1,expectedRevision:2,phase:'PR_DRAFTED',outputDigest:'e'.repeat(64)}),/LEASE_STALE/);
  await assert.rejects(b.read({jobId,actorUid:'foreign-owner-123'}),/OWNER_OR_JOB/);
  await queue.update({status:'CANCELLED'});
  await assert.rejects(b.persist({jobId,actorUid,leaseToken:leaseB,
    attempt:2,expectedRevision:2,phase:'PR_DRAFTED',outputDigest:'f'.repeat(64)}),/LEASE_STALE/);
});
