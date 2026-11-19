import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const functionsRequire=createRequire(new URL('../functions/package.json',import.meta.url));
const { initializeApp }=functionsRequire('firebase-admin/app');
import { privacyAckUrl, acknowledgeJobsRevocationToPrivacy } from
  '../functions/lib/functions/privacy/consentRevocationAcknowledgement.js';

const project='urai-r1586-policy-disposable';
initializeApp({projectId:project});
const vars=['URAI_PRIVACY_ACK_PROJECT_ID','URAI_PRIVACY_ACK_CALLABLE_URL',
 'URAI_PRIVACY_ACK_PINNED_RUN_HOST','FIRESTORE_EMULATOR_HOST',
 'FIREBASE_AUTH_EMULATOR_HOST'];
const initial=Object.fromEntries(vars.map(k=>[k,process.env[k]]));
function reset(){
 for(const [key,value] of Object.entries(initial)){
  if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
 process.env.URAI_PRIVACY_ACK_PROJECT_ID=project;
 delete process.env.URAI_PRIVACY_ACK_PINNED_RUN_HOST;
 delete process.env.FIRESTORE_EMULATOR_HOST;
 delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
}
test.after(()=>{for(const [key,value] of Object.entries(initial)){
 if(value===undefined)delete process.env[key];else process.env[key]=value;
}});
const callable='acknowledgeConsentRevocation';
const valid='https://us-central1-'+project+'.cloudfunctions.net/'+callable;
const invalid=[
 ['arbitrary Cloud Run','https://untrusted-service.a.run.app/'+callable],
 ['other Firebase project','https://us-central1-other-project.cloudfunctions.net/'+callable],
 ['arbitrary cloudfunctions.net','https://attacker.cloudfunctions.net/'+callable],
 ['untrusted bare run.app','https://attacker.run.app/'+callable],
 ['hostname suffix attack','https://us-central1-'+project+'.cloudfunctions.net.bad.test/'+callable],
 ['embedded userinfo','https://us-central1-'+project+'.cloudfunctions.net@attacker.test/'+callable],
 ['nested callback path','https://us-central1-'+project+'.cloudfunctions.net/path/'+callable],
 ['wrong endpoint','https://us-central1-'+project+'.cloudfunctions.net/ingestConsentRevocation'],
 ['query parameters',valid+'?token=test'],
 ['fragment',valid+'#unexpected'],
 ['plain HTTP',valid.replace('https:','http:')],
 ['alternate HTTPS port','https://us-central1-'+project+'.cloudfunctions.net:8443/'+callable],
 ['wrong region','https://attacker-us-central1-'+project+'.cloudfunctions.net/'+callable]
];
for(const [label,url] of invalid){
 test('deny '+label+' before bearer issuance',async()=>{
  reset();process.env.URAI_PRIVACY_ACK_CALLABLE_URL=url;
  assert.throws(()=>privacyAckUrl(),/privacy-ack-url-denied/);
  await assert.rejects(
   acknowledgeJobsRevocationToPrivacy('a'.repeat(64),'b'.repeat(64)),
   /privacy-ack-url-denied/
  );
 });
}
test('accept configured project Cloud Functions endpoint',()=>{
 reset();process.env.URAI_PRIVACY_ACK_CALLABLE_URL=valid;
 assert.equal(privacyAckUrl().hostname,'us-central1-'+project+'.cloudfunctions.net');
});
test('accept exact pinned reviewed Cloud Run service hostname',()=>{
 reset();
 process.env.URAI_PRIVACY_ACK_PINNED_RUN_HOST='reviewed-abcdef-uc.a.run.app';
 process.env.URAI_PRIVACY_ACK_CALLABLE_URL='https://reviewed-abcdef-uc.a.run.app/'+callable;
 assert.equal(privacyAckUrl().hostname,process.env.URAI_PRIVACY_ACK_PINNED_RUN_HOST);
});
test('deny unpinned or mismatched Cloud Run host',()=>{
 reset();process.env.URAI_PRIVACY_ACK_PINNED_RUN_HOST='reviewed-abcdef-uc.a.run.app';
 process.env.URAI_PRIVACY_ACK_CALLABLE_URL='https://different-abcdef-uc.a.run.app/'+callable;
 assert.throws(()=>privacyAckUrl(),/privacy-ack-url-denied/);
});
test('deny invalid path even on pinned Cloud Run host',()=>{
 reset();process.env.URAI_PRIVACY_ACK_PINNED_RUN_HOST='reviewed-abcdef-uc.a.run.app';
 process.env.URAI_PRIVACY_ACK_CALLABLE_URL='https://reviewed-abcdef-uc.a.run.app/path/'+callable;
 assert.throws(()=>privacyAckUrl(),/privacy-ack-url-denied/);
});
test('deny when project is not configured',()=>{
 reset();delete process.env.URAI_PRIVACY_ACK_PROJECT_ID;
 process.env.URAI_PRIVACY_ACK_CALLABLE_URL=valid;
 assert.throws(()=>privacyAckUrl(),/privacy-ack-url-denied/);
});
test('preserve scoped Firebase Functions emulator project/region path',()=>{
 reset();
 process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
 process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
 process.env.URAI_PRIVACY_ACK_CALLABLE_URL='http://127.0.0.1:5001/'+project+'/us-central1/'+callable;
 assert.equal(privacyAckUrl().pathname,'/'+project+'/us-central1/'+callable);
});
test('deny cross-project Firebase Functions emulator callback',()=>{
 reset();
 process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
 process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
 process.env.URAI_PRIVACY_ACK_CALLABLE_URL='http://127.0.0.1:5001/other-project/us-central1/'+callable;
 assert.throws(()=>privacyAckUrl(),/privacy-ack-url-denied/);
});
test('deny emulator identity routed to live provider',()=>{
 reset();
 process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
 process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
 process.env.URAI_PRIVACY_ACK_CALLABLE_URL=valid;
 assert.throws(()=>privacyAckUrl(),/privacy-ack-url-denied/);
});
test('deny partially configured emulator identity routed live',()=>{
 reset();
 process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
 process.env.URAI_PRIVACY_ACK_CALLABLE_URL=valid;
 assert.throws(()=>privacyAckUrl(),/privacy-ack-url-denied/);
});
