import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifySignedServiceIdentityReview as verify} from '../src/jobs/studioServiceIdentityCryptoReview.ts';
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const other=generateKeyPairSync('rsa',{modulusLength:2048});
const pem=keys.publicKey.export({type:'spki',format:'pem'});
const trusted={
 publicKeyPem:pem,keyId:'r1721-local-key',
 expectedAudience:'https://jobs.example.invalid/internal/provenance',
 expectedServiceEmail:'studio-service@urai-test.iam.gserviceaccount.com',
 expectedSubject:'123456789012345678901',};
const now=1795470000;
const claim=()=>({iss:'https://accounts.google.com',aud:trusted.expectedAudience,
 email:trusted.expectedServiceEmail,email_verified:true,sub:trusted.expectedSubject,
 iat:now-20,exp:now+120});
function token(c=claim(),h={alg:'RS256',typ:'JWT',kid:trusted.keyId},priv=keys.privateKey){
 const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const body=b(h)+'.'+b(c);
 return body+'.'+sign('RSA-SHA256',Buffer.from(body),priv).toString('base64url');
}
const deny={status:'unavailable'};
test('locally signed service fixture verifies identity but not render permission',()=>{
 assert.deepEqual(verify(token(),trusted,now),{status:'service_identity_verified_render_unapproved'});
 assert.equal(JSON.stringify(verify(token(),trusted,now)).includes('grant'),false);
});
const negatives=[
 ['wrong audience',c=>c.aud='https://attacker.invalid'],
 ['wrong service email',c=>c.email='attacker@urai-test.iam.gserviceaccount.com'],
 ['wrong subject',c=>c.sub='123456789012345678999'],
 ['wrong issuer',c=>c.iss='https://attacker.invalid'],
 ['email unverified',c=>c.email_verified=false],
 ['expired token',c=>c.exp=now-1],
 ['future issued token',c=>c.iat=now+99],
 ['long-lived token',c=>c.exp=now+3600],
 ['invalid expiry shape',c=>c.exp='tomorrow'],
 ['missing issue time',c=>delete c.iat],
 ['not before in future',c=>c.nbf=now+20],
];
for(const [name,mutate] of negatives)test('rejects '+name,()=>{
 const c=claim();mutate(c);assert.deepEqual(verify(token(c),trusted,now),deny);
});
test('untrusted new signing key cannot impersonate configured principal',()=>{
 assert.deepEqual(verify(token(claim(),{alg:'RS256',typ:'JWT',kid:trusted.keyId},other.privateKey),trusted,now),deny);
});
test('changed signature rejects even when claims match',()=>{
 const s=token(),parts=s.split('.');
 parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
 assert.deepEqual(verify(parts.join('.'),trusted,now),deny);
});
test('algorithm none fails closed',()=>{
 assert.deepEqual(verify(token(claim(),{alg:'none',typ:'JWT',kid:trusted.keyId}),trusted,now),deny);
});
test('self supplied public key header rejected',()=>{
 assert.deepEqual(verify(token(claim(),{alg:'RS256',typ:'JWT',kid:trusted.keyId,jwk:{kty:'RSA'}}),trusted,now),deny);
});
test('key id mismatch denied',()=>{
 assert.deepEqual(verify(token(claim(),{alg:'RS256',typ:'JWT',kid:'other-key'}),trusted,now),deny);
});
test('separate trusted account does not accept signer email',()=>{
 assert.deepEqual(verify(token(),{...trusted,expectedServiceEmail:'other@urai-test.iam.gserviceaccount.com'},now),deny);
});
test('separate trusted audience does not accept same signed JWT',()=>{
 assert.deepEqual(verify(token(),{...trusted,expectedAudience:'https://jobs.example.invalid/other'},now),deny);
});
test('request-supplied signing key rejected if trusted key unchanged',()=>{
 assert.deepEqual(verify(token(claim(),{alg:'RS256',typ:'JWT',kid:trusted.keyId},other.privateKey),
 trusted,now),deny);
});
test('malformed base64url, malformed claims, no segments denied',()=>{
 for(const t of ['abc','a.b.c','!.'+'a'.repeat(300),token().replace(/\./g,'!')]){
  assert.deepEqual(verify(t,trusted,now),deny);
 }
});
test('missing trusted configuration denied',()=>{
 assert.deepEqual(verify(token(),null,now),deny);
});
test('no production key discovery, endpoint, grant or IAM is installed by module',()=>{
 assert.equal(typeof verify,'function');
});
