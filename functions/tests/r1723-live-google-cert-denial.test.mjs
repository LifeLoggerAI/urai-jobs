/**
 * R1723 — optional networked, negative-only test.
 * Fetches the REAL Google OIDC signing certificates through Google's own
 * verifier. Uses an independently generated PRIVATE fixture key solely to
 * prove that matching issuer/audience/email claims do not bypass signatures.
 * No credentials, no service token minting, no private output, no grant.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {verifyGoogleServiceIdentityReview} from '../src/jobs/googleServiceIdentityReview.ts';

const audience='https://jobs.example.invalid/internal/provenance';
const email='studio-service@urai-demo.iam.gserviceaccount.com';
const subject='123456789012345678901';
const fixtureKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey;
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const fakeToken=(kid,now)=>{
 const header={alg:'RS256',typ:'JWT',kid};
 const claims={iss:'https://accounts.google.com',aud:audience,email,email_verified:true,sub:subject,iat:now-30,exp:now+120};
 const body=encode(header)+'.'+encode(claims);
 return body+'.'+sign('RSA-SHA256',Buffer.from(body),fixtureKey).toString('base64url');
};
const config={audience,serviceEmail:email,serviceSubject:subject};

test('live Google certificates are retrieved from maintained trusted endpoint, not request input',async()=>{
 const client=new OAuth2Client();
 const result=await client.getFederatedSignonCertsAsync();
 const certs=result.certs;
 assert.equal(typeof certs,'object');
 const ids=Object.keys(certs);
 assert.ok(ids.length>=1 && ids.length<=20,'must contain a bounded nonempty keyset');
 for(const kid of ids)assert.ok(/^[A-Za-z0-9_-]{4,200}$/.test(kid));
 assert.ok(Object.values(certs).every(v=>typeof v==='string'&&v.length>300));
});
test('valid-looking claims signed by attacker fail against actual Google signing certificates',async()=>{
 const client=new OAuth2Client();
 const result=await client.getFederatedSignonCertsAsync();
 const kid=Object.keys(result.certs)[0];
 assert.ok(kid);
 const now=Math.floor(Date.now()/1000);
 const forged=fakeToken(kid,now);
 await assert.rejects(client.verifyIdToken({idToken:forged,audience}),/signature|Invalid token/i);
 assert.deepEqual(await verifyGoogleServiceIdentityReview(forged,config,now),{status:'unavailable'});
});
test('missing bearer rejects without attempting any private operation',async()=>{
 assert.deepEqual(await verifyGoogleServiceIdentityReview(null,config),{status:'unavailable'});
});
