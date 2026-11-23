/**
 * R1721 HOLD: pure signed-service-identity contract, NOT registered.
 * TRUSTED public-key provisioning, Google key rotation, IAM and real
 * service-to-service transport are not supplied. Tests sign local RSA
 * fixtures, NOT genuine Google-issued tokens.
 * Success never authorizes Jobs, Memory, consent or private rendering.
 */
import {verify,createPublicKey} from 'node:crypto';
type Config=Readonly<{publicKeyPem:string;keyId:string;expectedAudience:string;expectedServiceEmail:string;expectedSubject:string}>;
type Outcome=Readonly<{status:'unavailable'}|{status:'service_identity_verified_render_unapproved'}>;
const deny=():Outcome=>({status:'unavailable'});
const EMAIL=/^[a-z0-9][a-z0-9._-]{0,110}@[a-z0-9.-]+\.iam\.gserviceaccount\.com$/;
const AUD=/^https:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9/_-]*)?$/;
const B64=/^[A-Za-z0-9_-]+$/;
const bytes=(s:string):Buffer|null=>{
 if(!B64.test(s)||s.length>8192||s.length===0)return null;
 try{const b=Buffer.from(s,'base64url');return b.toString('base64url')===s?b:null}
 catch{return null}
};
const obj=(a:unknown):a is Record<string,unknown>=>{
 if(!a||typeof a!=='object'||Array.isArray(a))return false;
 const p=Object.getPrototypeOf(a);return p===Object.prototype||p===null;
};
export function verifySignedServiceIdentityReview(token:unknown,trusted:Config,nowSeconds:number):Outcome{
 try{
 if(typeof token!=='string'||token.length>12288||!obj(trusted)
  ||!Number.isSafeInteger(nowSeconds)||nowSeconds<1
  ||typeof trusted.publicKeyPem!=='string'||trusted.publicKeyPem.length>5000
  ||typeof trusted.keyId!=='string'||!/^[A-Za-z0-9._-]{1,80}$/.test(trusted.keyId)
  ||typeof trusted.expectedAudience!=='string'||!AUD.test(trusted.expectedAudience)
  ||typeof trusted.expectedServiceEmail!=='string'||!EMAIL.test(trusted.expectedServiceEmail)
  ||typeof trusted.expectedSubject!=='string'||!/^[0-9]{8,32}$/.test(trusted.expectedSubject))return deny();
 const parts=token.split('.');if(parts.length!==3)return deny();
 const [h,p,s]=parts.map(bytes);
 if(!h||!p||!s||s.length!==256||h.length>512||p.length>2048)return deny();
 const header=JSON.parse(h.toString('utf8')) as unknown;
 const claims=JSON.parse(p.toString('utf8')) as unknown;
 if(!obj(header)||!obj(claims)||header.alg!=='RS256'
  ||header.typ!=='JWT'||header.kid!==trusted.keyId)return deny();
 if(Reflect.ownKeys(header).some(k=>!['alg','typ','kid'].includes(String(k))))return deny();
 const key=createPublicKey(trusted.publicKeyPem);
 if(key.asymmetricKeyType!=='rsa'||key.asymmetricKeyDetails?.modulusLength!==2048)return deny();
 if(!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,s))return deny();
 if(claims.iss!=='https://accounts.google.com'
  ||claims.aud!==trusted.expectedAudience
  ||claims.email!==trusted.expectedServiceEmail
  ||claims.email_verified!==true
  ||claims.sub!==trusted.expectedSubject)return deny();
 if(!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)
  ||typeof claims.iat!=='number'||typeof claims.exp!=='number'
  ||claims.iat>nowSeconds+30||claims.exp<=nowSeconds
  ||claims.exp-claims.iat>300||claims.exp<=claims.iat)return deny();
 if(claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)
  ||typeof claims.nbf!=='number'||claims.nbf>nowSeconds))return deny();
 return {status:'service_identity_verified_render_unapproved'};
 }catch{return deny()}
}
