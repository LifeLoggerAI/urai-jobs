import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const fromFunctions=createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp }=fromFunctions('firebase-admin/app');
import {
  privacyAckUrl, jobsPrivacyIdToken, acknowledgeJobsRevocationToPrivacy
} from '../functions/lib/functions/privacy/consentRevocationAcknowledgement.js';

initializeApp({projectId:'urai-r1586-policy-disposable'});
const original=Object.fromEntries([
 'URAI_PRIVACY_ACK_PROJECT_ID','URAI_PRIVACY_ACK_SERVICE_UID',
 'URAI_PRIVACY_ACK_TEST_ID_TOKEN','URAI_PRIVACY_ACK_CALLABLE_URL',
 'FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST',
 'URAI_PRIVACY_ACK_FIREBASE_API_KEY'
].map(k=>[k,process.env[k]]));
function restore(){for(const [k,v] of Object.entries(original)){
 if(v===undefined)delete process.env[k];else process.env[k]=v;
}}
test.after(restore);
test('rejects missing consumer identity before network',async()=>{
 restore();delete process.env.URAI_PRIVACY_ACK_PROJECT_ID;
 await assert.rejects(jobsPrivacyIdToken(),/identity-unconfigured/);
});
test('rejects mismatched Firebase project',async()=>{
 restore();process.env.URAI_PRIVACY_ACK_PROJECT_ID='another-project';
 process.env.URAI_PRIVACY_ACK_SERVICE_UID='synthetic-jobs-test';
 await assert.rejects(jobsPrivacyIdToken(),/project-mismatch/);
});
test('never permits synthetic ID token outside emulator',async()=>{
 restore();process.env.URAI_PRIVACY_ACK_PROJECT_ID='urai-r1586-policy-disposable';
 process.env.URAI_PRIVACY_ACK_SERVICE_UID='synthetic-jobs-test';
 process.env.URAI_PRIVACY_ACK_TEST_ID_TOKEN='synthetic-token-only';
 delete process.env.FIRESTORE_EMULATOR_HOST;delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
 await assert.rejects(jobsPrivacyIdToken(),/production-denied/);
});
test('untrusted URLs fail closed',()=>{
 restore();for(const bad of [
 'http://example.com/acknowledgeConsentRevocation',
 'https://example.com/acknowledgeConsentRevocation',
 'https://allowed.cloudfunctions.net/ingestConsentRevocation',
 'https://user:pw@allowed.cloudfunctions.net/acknowledgeConsentRevocation',
 'https://allowed.cloudfunctions.net/acknowledgeConsentRevocation?debug=1'
 ]){process.env.URAI_PRIVACY_ACK_CALLABLE_URL=bad;
  assert.throws(privacyAckUrl,/url-denied/,bad);}
});
test('approved provider HTTPS path is parsed without network',()=>{
 restore();process.env.URAI_PRIVACY_ACK_CALLABLE_URL=
 'https://us-central1-urai-r1586-policy-disposable.cloudfunctions.net/acknowledgeConsentRevocation';
 assert.equal(privacyAckUrl().protocol,'https:');
});
test('malformed integrity identity is rejected before any callback',async()=>{
 restore();process.env.URAI_PRIVACY_ACK_CALLABLE_URL=
 'https://us-central1-urai-r1586-policy-disposable.cloudfunctions.net/acknowledgeConsentRevocation';
 await assert.rejects(acknowledgeJobsRevocationToPrivacy('bad','c'.repeat(64)),/canonical-receipt-required/);
});

