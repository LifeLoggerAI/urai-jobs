/**
 * R1736: REVIEW-ONLY signature-verification contract for broker evidence.
 * A locally trusted signer is NOT a Google Cloud attestation or provider receipt.
 * No network, secret files, GCS, Firebase or production use.
 */
import {createHash, verify, constants, createPublicKey} from 'node:crypto';

const deny=code=>{throw new Error(code)};
const need=(x,code)=>{if(!x)deny(code)};
const b64=/^[A-Za-z0-9_-]+$/;
const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{4,160}$/.test(x);
const pos=x=>Number.isSafeInteger(x)&&x>0;
const exactKeys=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)
 &&Object.keys(obj).sort().join(',')===keys.slice().sort().join(',');
const canon=value=>JSON.stringify(value,Object.keys(value).sort());
function decode(part) {
 need(typeof part==='string'&&b64.test(part)&&part.length<8192,'invalid_compact_encoding');
 const bytes=Buffer.from(part,'base64url');
 need(bytes.toString('base64url')===part,'noncanonical_base64url');
 let value;
 try{value=JSON.parse(bytes.toString('utf8'))}catch{deny('invalid_signed_json')}
 need(value&&typeof value==='object'&&!Array.isArray(value),'invalid_signed_json');
 need(Buffer.from(canon(value)).toString('base64url')===part,'noncanonical_signed_json');
 return value;
}
export const BROKER_AUDIENCE='urai-private-output-retirement-review';
export const BROKER_ISSUER='urai-review-broker';
export const BROKER_TYPE='URAI-REVIEW-EVIDENCE';
const HEADER_KEYS=['alg','typ','kid'];
const CLAIM_KEYS=['iss','aud','sub','tenantId','uploadId','epoch','sessionDigest',
 'objectNameDigest','generation','providerState','providerSessionTerminated',
 'generationDeletedOrNeverCreated','objectAbsentVerified','iat','nbf','exp','jti'];
export function createReviewReceiptVerifier({publicKeys,nowSeconds,consumedJti}={}) {
 need(publicKeys instanceof Map&&publicKeys.size>0,'pinned_keys_required');
 need(Number.isSafeInteger(nowSeconds)&&nowSeconds>0,'trusted_clock_required');
 need(consumedJti instanceof Set,'replay_store_required');
 const pinned=new Map();
 for(const [kid,pem] of publicKeys){
   need(safeId(kid)&&typeof pem==='string','invalid_pinned_key');
   const key=createPublicKey(pem);
   need(key.asymmetricKeyType==='rsa'&&key.asymmetricKeyDetails?.modulusLength>=2048,'invalid_key_type');
   pinned.set(kid,key);
 }
 return function verifyReviewReceipt(token,expected) {
   need(typeof token==='string'&&token.length<16000,'invalid_compact_token');
   const parts=token.split('.');
   need(parts.length===3,'invalid_compact_token');
   const [a,b,c]=parts,header=decode(a),claims=decode(b);
   need(exactKeys(header,HEADER_KEYS)&&header.alg==='RS256'&&header.typ===BROKER_TYPE,'unapproved_token_header');

   need(pinned.has(header.kid),'untrusted_signing_key');
   need(b64.test(c)&&Buffer.from(c,'base64url').toString('base64url')===c,'invalid_signature_encoding');
   need(verify('RSA-SHA256',Buffer.from(a+'.'+b),{
     key:pinned.get(header.kid),padding:constants.RSA_PKCS1_PADDING
   },Buffer.from(c,'base64url')),'bad_signature');
   need(exactKeys(claims,CLAIM_KEYS),'unapproved_claim_shape');
   need(claims.iss===BROKER_ISSUER&&claims.aud===BROKER_AUDIENCE,'invalid_issuer_or_audience');
   need(safeId(claims.sub)&&safeId(claims.tenantId)&&safeId(claims.uploadId)
     &&safeId(claims.jti),'invalid_claim_identity');
   need(pos(claims.epoch)&&Number.isSafeInteger(claims.iat)&&Number.isSafeInteger(claims.nbf)
     &&Number.isSafeInteger(claims.exp),'invalid_time_or_epoch');
   need(claims.iat<=nowSeconds+30&&claims.nbf<=nowSeconds&&claims.exp>nowSeconds
     &&claims.exp-claims.iat<=300,'expired_or_invalid_lifetime');
   need(typeof claims.sessionDigest==='string'&&/^[a-f0-9]{64}$/.test(claims.sessionDigest)
     &&typeof claims.objectNameDigest==='string'&&/^[a-f0-9]{64}$/.test(claims.objectNameDigest),
     'invalid_bound_digests');
   need(['session-cancelled','session-completed'].includes(claims.providerState),'invalid_provider_state');
   need(claims.providerSessionTerminated===true&&claims.generationDeletedOrNeverCreated===true
     &&claims.objectAbsentVerified===true,'incomplete_provider_cleanup');
   need(claims.generation===null ||
     (typeof claims.generation==='string'&&/^[1-9][0-9]{0,19}$/.test(claims.generation)),
     'invalid_generation');
   if(claims.providerState==='session-completed')need(claims.generation!==null,'missing_completed_generation');
   need(expected&&claims.sub===expected.ownerUid&&claims.tenantId===expected.tenantId
      &&claims.uploadId===expected.uploadId&&claims.epoch===expected.epoch
      &&claims.sessionDigest===expected.sessionDigest
      &&claims.objectNameDigest===expected.objectNameDigest
      &&claims.generation===expected.generation,'receipt_binding_mismatch');
   need(!consumedJti.has(claims.jti),'receipt_replay');
   consumedJti.add(claims.jti);
   // A valid signature establishes ONLY that a pinned signer signed these claims.
   // It is not proof that GCS did any of the claimed provider operations.
   return Object.freeze({reviewSignatureVerified:true,issuer:claims.iss,
     audience:claims.aud,ownerUid:claims.sub,tenantId:claims.tenantId,
     uploadId:claims.uploadId,epoch:claims.epoch,sessionDigest:claims.sessionDigest,
     objectNameDigest:claims.objectNameDigest,generation:claims.generation,
     providerState:claims.providerState,jti:claims.jti});
 };
}

export const sha256Hex=value=>createHash('sha256').update(value).digest('hex');


