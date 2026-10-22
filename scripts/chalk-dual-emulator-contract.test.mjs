import test from 'node:test';
import assert from 'node:assert/strict';
import {requireChalkDualEmulators, checkChalkHeldProof} from './chalk-dual-emulator-contract.mjs';
const okay=()=>({CHALK_EMULATOR_PROOF:'1',CHALK_NONPRODUCTION_INTAKE:'true',
 CHALK_PINNED_SPATIAL_SHA:'a'.repeat(40),FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',
 FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',CHALK_FUNCTIONS_EMULATOR_HOST:'127.0.0.1:5001',
 GOOGLE_CLOUD_PROJECT:'demo-urai-jobs',GCLOUD_PROJECT:'demo-urai-jobs',NODE_ENV:'test'});
test('explicit local dual-project guard',()=>{const x=requireChalkDualEmulators(okay(),'22.16.0');assert.equal(x.jobsProject,'demo-urai-jobs');assert.equal(x.spatialProject,'demo-urai-auth-journey')});
const bad=[['live-project',{GCLOUD_PROJECT:'urai-jobs'}],['prod',{NODE_ENV:'production'}],['missing-optin',{CHALK_EMULATOR_PROOF:undefined}],['wrong-SHA',{CHALK_PINNED_SPATIAL_SHA:'main'}],['remote-auth',{FIREBASE_AUTH_EMULATOR_HOST:'evil.test:9099'}],['remote-firestore',{FIRESTORE_EMULATOR_HOST:'192.168.1.2:8080'}],['remote-functions',{CHALK_FUNCTIONS_EMULATOR_HOST:'evil.test:5001'}],['cloud-creds',{GOOGLE_APPLICATION_CREDENTIALS:'/home/me/key.json'}]];
for(const [name,delta] of bad)test('refuses '+name,()=>assert.throws(()=>requireChalkDualEmulators({...okay(),...delta},'22.16.0'),/CHALK_DUAL_EMULATOR_/));
test('reject Node 20',()=>assert.throws(()=>requireChalkDualEmulators(okay(),'20.19.0'),/NODE22_ONLY/));
const job=()=>({jobId:'chalk_'+'a'.repeat(32),ownerUid:'founder_test',status:'PENDING',type:'engineering.verify',jobType:'engineering.verify',payload:{baseSha:'a'.repeat(40)},admission:{state:'HELD_UNQUEUED',workerAdmitted:false,providerSpendUsd:0}});
test('accepts held unqueued complete emulator receipt',()=>assert.equal(checkChalkHeldProof(job(),false,true,1,'a'.repeat(40),job().jobId),true));
for(const [name,f] of [['queued', j=>j.queued=true],['wrong SHA',j=>j.payload.baseSha='b'.repeat(40)],['running',j=>j.status='RUNNING'],['worker',j=>j.admission.workerAdmitted=true],['spending',j=>j.admission.providerSpendUsd=10]])test('rejects '+name,()=>{const j=job();f(j);assert.throws(()=>checkChalkHeldProof(j,name==='queued'?true:false,true,1,'a'.repeat(40),j.jobId),/BAD_HELD_RECEIPT/)});
test('missing audit fails',()=>assert.throws(()=>checkChalkHeldProof(job(),false,false,1,'a'.repeat(40),job().jobId),/BAD_HELD_RECEIPT/));
test('duplicate quota fails',()=>assert.throws(()=>checkChalkHeldProof(job(),false,true,2,'a'.repeat(40),job().jobId),/BAD_HELD_RECEIPT/));
