import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDemoStudioIdentityWithoutGrant as inspect} from '../src/jobs/studioMemoryAuthPreflightEmulatorReview.ts';
const original=Object.fromEntries(['GCLOUD_PROJECT','FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST',
 'URAI_PRIVATE_MEMORY_WRITES_ENABLED','GOOGLE_APPLICATION_CREDENTIALS'].map(k=>[k,process.env[k]]));
function reset(){for(const [k,v] of Object.entries(original)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
const local={GCLOUD_PROJECT:'demo-urai-r1720',FIRESTORE_EMULATOR_HOST:'127.0.0.1:28791',
 FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:28792',URAI_PRIVATE_MEMORY_WRITES_ENABLED:'false'};
const token='not-a-real-firebase-id-token-1234567890';
test('no configuration cannot authorize',async()=>{
 reset();delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
 assert.deepEqual(await inspect(token,'tenantA'),{status:'unavailable'});
});
const cases=[
 ['wrong project',e=>e.GCLOUD_PROJECT='prod-real'],
 ['remote Firestore',e=>e.FIRESTORE_EMULATOR_HOST='remote.example:443'],
 ['remote Auth',e=>e.FIREBASE_AUTH_EMULATOR_HOST='remote.example:443'],
 ['private writes enabled',e=>e.URAI_PRIVATE_MEMORY_WRITES_ENABLED='true'],
 ['missing token',(_e,input)=>input.token=''],
 ['nonstring token',(_e,input)=>input.token={uid:'ownerA'}],
 ['invalid tenant',(_e,input)=>input.tenant='../foreign'],
 ['client asserted identity',(_e,input)=>input.token={uid:'ownerA',tenantId:'tenantA',approved:true}],
];
for(const [name,mutate] of cases)test('denies '+name,async()=>{
 reset();Object.assign(process.env,local);
 const env={...local},input={token,tenant:'tenantA'};mutate(env,input);
 Object.assign(process.env,env);
 assert.deepEqual(await inspect(input.token,input.tenant),{status:'unavailable'});
 reset();
});
test('matching emulator variables alone cannot supply issuer identity or grant',async()=>{
 reset();Object.assign(process.env,local);
 assert.deepEqual(await inspect(token,'tenantA'),{status:'unavailable'});
 reset();
});
test('untrusted credentials environment denies',async()=>{
 reset();Object.assign(process.env,{...local,GOOGLE_APPLICATION_CREDENTIALS:'/tmp/forbidden.json'});
 assert.deepEqual(await inspect(token,'tenantA'),{status:'unavailable'});
 reset();
});
process.on('exit',reset);
