/** R1736 locally signed fixtures only. No Google Cloud or provider claims proven. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createReviewReceiptVerifier,sha256Hex,BROKER_AUDIENCE,BROKER_ISSUER,BROKER_TYPE}
 from './signed-broker-evidence-review.mjs';

const now=1900000000;
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const rogue=generateKeyPairSync('rsa',{modulusLength:2048});
const pub=pair.publicKey.export({format:'pem',type:'spki'});
const expectRef={ownerUid:'syntheticOwner',tenantId:'syntheticTenant',uploadId:'uploadIdA',
 epoch:7,sessionDigest:sha256Hex('synthetic bearer URL'),objectNameDigest:sha256Hex('synthetic object'),
 generation:'567'};
const base={iss:BROKER_ISSUER,aud:BROKER_AUDIENCE,sub:expectRef.ownerUid,
 tenantId:expectRef.tenantId,uploadId:expectRef.uploadId,epoch:7,
 sessionDigest:expectRef.sessionDigest,objectNameDigest:expectRef.objectNameDigest,
 generation:'567',providerState:'session-completed',providerSessionTerminated:true,
 generationDeletedOrNeverCreated:true,objectAbsentVerified:true,
 iat:now-20,nbf:now-20,exp:now+100,jti:'uniqueReceiptA'};
const header={alg:'RS256',typ:BROKER_TYPE,kid:'reviewSignerA'};
const enc=x=>Buffer.from(JSON.stringify(x,Object.keys(x).sort())).toString('base64url');
function mint(claims=base,head=header,key=pair.privateKey) {
 const body=enc(head)+'.'+enc(claims);
 return body+'.'+sign('RSA-SHA256',Buffer.from(body),key).toString('base64url');
}
function verifier(jti=new Set(),keys=new Map([['reviewSignerA',pub]])) {
 return createReviewReceiptVerifier({publicKeys:keys,nowSeconds:now,consumedJti:jti});
}
const deny=(fn,code)=>assert.throws(fn,e=>e.message===code);

test('pinned signer and exact bound clean receipt accepted only once',()=>{
 const seen=new Set(),f=verifier(seen),token=mint();
 assert.equal(f(token,expectRef).reviewSignatureVerified,true);
 assert.equal(seen.size,1);
 deny(()=>f(token,expectRef),'receipt_replay');
});
test('rogue key cannot forge pinned signer',()=>{
 deny(()=>verifier()(mint(base,header,rogue.privateKey),expectRef),'bad_signature');
});
test('unknown key id is rejected before signature acceptance',()=>{
 deny(()=>verifier()(mint(base,{...header,kid:'otherSignerA'}),expectRef),'untrusted_signing_key');
});
test('algorithm substitution and remote key hint are rejected',()=>{
 deny(()=>verifier()(mint(base,{...header,alg:'none'}),expectRef),'unapproved_token_header');

 deny(()=>verifier()(mint(base,{...header,jku:'https://evil.example/jwks'}),expectRef),'unapproved_token_header');
});
test('wrong audience or issuer refused even with valid signature',()=>{
 for(const claim of [{aud:'wrong-audience'},{iss:'wrong-issuer'}])
  deny(()=>verifier()(mint({...base,...claim}),expectRef),'invalid_issuer_or_audience');
});
test('wrong owner tenant epoch upload and session digest refused',()=>{
 for(const claim of [{sub:'otherOwner'},{tenantId:'otherTenant'},{epoch:8},
  {uploadId:'otherUpload'},{sessionDigest:sha256Hex('other-session')},
  {objectNameDigest:sha256Hex('other-object')},{generation:'568'}])
  deny(()=>verifier()(mint({...base,...claim}),expectRef),'receipt_binding_mismatch');
});
test('expired, not yet valid and overlong lifetime denied',()=>{
 for(const claim of [{exp:now-1},{nbf:now+10},{iat:now+40},{exp:now+400}])
  deny(()=>verifier()(mint({...base,...claim}),expectRef),'expired_or_invalid_lifetime');
});
test('missing provider cleanup flags denied even with valid signature',()=>{
 for(const name of ['providerSessionTerminated','generationDeletedOrNeverCreated','objectAbsentVerified'])
  deny(()=>verifier()(mint({...base,[name]:false}),expectRef),'incomplete_provider_cleanup');
});
test('completed upload requires a generation',()=>{
 deny(()=>verifier()(mint({...base,generation:null}),{...expectRef,generation:null}),'missing_completed_generation');
});
test('malformed generation and identity refused',()=>{
 deny(()=>verifier()(mint({...base,generation:'0001'}),expectRef),'invalid_generation');
 deny(()=>verifier()(mint({...base,jti:''}),expectRef),'invalid_claim_identity');
});
test('missing or added claims rejected',()=>{
 const {jti,...without}=base;
 deny(()=>verifier()(mint(without),expectRef),'unapproved_claim_shape');
 deny(()=>verifier()(mint({...base,privateMedia:true}),expectRef),'unapproved_claim_shape');
});
test('noncanonical JSON, duplicate signed keys and base64url are rejected',()=>{
 const weird='{"alg":"RS256","typ":"'+BROKER_TYPE+'","kid":"reviewSignerA"}';
 const body=Buffer.from(weird).toString('base64url')+'.'+enc(base);
 const token=body+'.'+sign('RSA-SHA256',Buffer.from(body),pair.privateKey).toString('base64url');
 deny(()=>verifier()(token,expectRef),'noncanonical_signed_json');
 const dup='{"aud":"'+BROKER_AUDIENCE+'","aud":"evil"}';
 const body2=enc(header)+'.'+Buffer.from(dup).toString('base64url');
 const t2=body2+'.'+sign('RSA-SHA256',Buffer.from(body2),pair.privateKey).toString('base64url');
 deny(()=>verifier()(t2,expectRef),'noncanonical_signed_json');
});

test('tampered signature is rejected',()=>{
 const x=mint().split('.');const bytes=Buffer.from(x[2],'base64url');bytes[0]^=1;x[2]=bytes.toString('base64url');
 deny(()=>verifier()(x.join('.'),expectRef),'bad_signature');
});
test('unapproved key length and type are refused',()=>{
 const ecc=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const p=ecc.publicKey.export({type:'spki',format:'pem'});
 deny(()=>verifier(new Set(),new Map([['reviewSignerA',p]])),'invalid_key_type');
});
test('missing key pin or replay store is refused',()=>{
 deny(()=>createReviewReceiptVerifier({publicKeys:new Map(),nowSeconds:now,consumedJti:new Set()}),'pinned_keys_required');
 deny(()=>createReviewReceiptVerifier({publicKeys:new Map([['reviewSignerA',pub]]),nowSeconds:now}),'replay_store_required');
});
test('receipt has no raw bearer URL and output never claims actual GCS proof',()=>{
 const token=mint(),v=verifier()(token,expectRef);
 assert.equal(JSON.stringify(v).includes('authentic'),false);
 assert.equal(JSON.stringify(v).includes('storage.googleapis.com'),false);
 assert.equal(v.reviewSignatureVerified,true);
});
test('module is review-only with no GCS, Firebase or network calls',async()=>{
 const {readFileSync}=await import('node:fs');
 const s=readFileSync(new URL('./signed-broker-evidence-review.mjs',import.meta.url),'utf8');
 for(const forbidden of ["fetch(","createWriteStream(","firebase-admin","@google-cloud/storage"])
  assert.equal(s.includes(forbidden),false);
});


