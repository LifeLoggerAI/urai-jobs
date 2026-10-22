import test from 'node:test';import assert from 'node:assert/strict';
import {validateChalkLaunch} from './chalk-review-emulator-local.mjs';
const cfg=()=>({CHALK_INTAKE_E2E:'1',URAI_CHALK_INTAKE_ENABLED:'true',CHALK_JOBS_SOURCE_SHA:'a'.repeat(40),URAI_CHALK_SPATIAL_SOURCE_SHA:'b'.repeat(40)});
test('isolated project explicit exact-source allow',()=>assert.equal(validateChalkLaunch(cfg()).projectId,'demo-urai-auth-journey'));
const blocks=[
 ['opt in',{CHALK_INTAKE_E2E:undefined}],['intake opt in',{URAI_CHALK_INTAKE_ENABLED:undefined}],
 ['jobs sha absent',{CHALK_JOBS_SOURCE_SHA:undefined}],['spatial sha absent',{URAI_CHALK_SPATIAL_SOURCE_SHA:undefined}],
 ['branch name',{CHALK_JOBS_SOURCE_SHA:'main'}],['production project',{GCLOUD_PROJECT:'urai-4dc1d'}],
 ['contradictory project',{GCP_PROJECT:'bad'}],['real auth host',{FIREBASE_AUTH_EMULATOR_HOST:'remote:9099'}],
 ['real firestore host',{FIRESTORE_EMULATOR_HOST:'remote:8080'}],['production env',{URAI_ENV:'production'}],
 ['staging env',{URAI_ENV:'staging'}],['production config',{FIREBASE_CONFIG:JSON.stringify({projectId:'urai-4dc1d'})}],
 ['bad config',{FIREBASE_CONFIG:'{'}],['cloud creds',{GOOGLE_APPLICATION_CREDENTIALS:'/tmp/key.json'}],
 ['cloud access token',{GOOGLE_OAUTH_ACCESS_TOKEN:'test'}],
];
for(const [name,change] of blocks)test('refuse '+name,()=>assert.throws(()=>validateChalkLaunch({...cfg(),...change}),/CHALK_LOCAL_/));
test('matching emulator config allowed',()=>assert.equal(validateChalkLaunch({...cfg(),FIREBASE_CONFIG:JSON.stringify({projectId:'demo-urai-auth-journey'})}).projectId,'demo-urai-auth-journey'));
