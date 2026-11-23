import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {inspectVerifiedGoogleTokenReview as check,verifyGoogleServiceIdentityReview as prod} from '../src/jobs/googleServiceIdentityReview.ts';
const now=Math.floor(Date.now()/1000),kid='offline-r1722-local-cert';
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const rogue=generateKeyPairSync('rsa',{modulusLength:2048});
const pem=keys.publicKey.export({type:'spki',format:'pem'});
const config={audience:'https://jobs.example.invalid/internal/provenance',
 serviceEmail:'studio-service@urai-demo.iam.gserviceaccount.com',
 serviceSubject:'123456789012345678901'};
const payload=()=>({iss:'https://accounts.google.com',aud:config.audience,
 email:config.serviceEmail,email_verified:true,sub:config.serviceSubject,
 iat:now-10,exp:now+3500});
function jwt(p=payload(),key=keys.privateKey,h={alg:'RS256',typ:'JWT',kid}){
 const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const msg=b(h)+'.'+b(p);
 return msg+'.'+sign('RSA-SHA256',Buffer.from(msg),key).toString('base64url');
}
const googleCrypto=new OAuth2Client();
const trustedTransport={verifyIdToken:async({idToken,audience})=>
 googleCrypto.verifySignedJwtWithCertsAsync(idToken,{[kid]:pem},audience,['https://accounts.google.com'],3660)};
const checkToken=(v,c=config)=>check(v,c,trustedTransport,now);
const deny={status:'unavailable'},accepted={status:'google_service_identity_verified_render_unapproved'};
test('Google-maintained library verifies local RSA fixture and returns no render grant',async()=>{
 assert.deepEqual(await checkToken(jwt()),accepted);
 assert.ok(!JSON.stringify(await checkToken(jwt())).includes('jobId'));
});
test('Google cryptographic verifier rejects foreign key signature',async()=>{
 assert.deepEqual(await checkToken(jwt(payload(),rogue.privateKey)),deny);
});
test('Google cryptographic verifier rejects modified payload and signature',async()=>{
 const parts=jwt().split('.');parts[1]=Buffer.from(JSON.stringify({...payload(),sub:'98765432100'})).toString('base64url');
 assert.deepEqual(await checkToken(parts.join('.')),deny);
 const parts2=jwt().split('.');parts2[2]='B'+parts2[2].slice(1);
 assert.deepEqual(await checkToken(parts2.join('.')),deny);
});
const claimCases=[
 ['wrong issuer',p=>p.iss='https://attacker.invalid'],
 ['wrong audience',p=>p.aud='https://attacker.invalid'],
 ['wrong service email',p=>p.email='other@urai-demo.iam.gserviceaccount.com'],
 ['email not verified',p=>p.email_verified=false],
 ['wrong subject',p=>p.sub='123456789000'],
 ['expired',p=>p.exp=now-1],
 ['expiry beyond one hour',p=>p.exp=now+7000],
 ['future issue',p=>p.iat=now+200],
 ['no issue time',p=>delete p.iat],
 ['noninteger expiry',p=>p.exp='later'],
 ['expiry before issue',p=>p.exp=now-20],
];
for(const [label,mutate] of claimCases)test('deny '+label,async()=>{
 const p=payload();mutate(p);assert.deepEqual(await checkToken(jwt(p)),deny);
});
test('a fixture with a valid new key is not accepted without trusted certificate rotation',async()=>{
 const kid2='other-key';const token=jwt(payload(),rogue.privateKey,{alg:'RS256',typ:'JWT',kid:kid2});
 assert.deepEqual(await checkToken(token),deny);
});
test('unexpected intended service account and audience fail closed',async()=>{
 assert.deepEqual(await checkToken(jwt(),{...config,serviceEmail:'other@urai-demo.iam.gserviceaccount.com'}),deny);
 assert.deepEqual(await checkToken(jwt(),{...config,audience:'https://jobs.example.invalid/other'}),deny);
});
test('malformed bearer and configuration never call verifier',async()=>{
 let called=0;
 const v={verifyIdToken:async()=>{called++;throw Error('should not run')}};
 for(const token of ['',null,{},'short']){
  assert.deepEqual(await check(token,config,v,now),deny);
 }
 assert.deepEqual(await check(jwt(),{...config,serviceSubject:'bad'},v,now),deny);
 assert.equal(called,0);
});
test('verifier outage or missing payload never returns identity',async()=>{
 const down={verifyIdToken:async()=>{throw Error('offline')}};
 const absent={verifyIdToken:async()=>({getPayload:()=>undefined})};
 assert.deepEqual(await check(jwt(),config,down,now),deny);
 assert.deepEqual(await check(jwt(),config,absent,now),deny);
});
test('real entrypoint rejects invalid input without certificate retrieval',async()=>{
 assert.deepEqual(await prod('invalid',config,now),deny);
});
