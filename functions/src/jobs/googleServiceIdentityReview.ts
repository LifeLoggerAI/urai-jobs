/**
 * R1722 HOLD: offline-reviewable Google OIDC verification adapter.
 * Production entrypoint creates Google's maintained OAuth2 verifier.
 * It fetches Google's trusted certificates; never accept a caller key.
 * No endpoint, workload identity binding, IAM policy, consent issuer, or
 * private-media authorization is registered here.
 */
import {OAuth2Client} from 'google-auth-library';
type Config=Readonly<{audience:string;serviceEmail:string;serviceSubject:string}>;
export type Outcome=Readonly<{status:'unavailable'}|{status:'google_service_identity_verified_render_unapproved'}>;
const deny=():Outcome=>({status:'unavailable'});
const URL_RE=/^https:\/\/[a-zA-Z0-9.-]+(?:\/[a-zA-Z0-9/_-]*)?$/;
const EMAIL_RE=/^[a-z0-9][a-z0-9._-]{0,110}@[a-z0-9.-]+\.iam\.gserviceaccount\.com$/;
function validConfig(c:Config):boolean{
 return !!c&&typeof c.audience==='string'&&URL_RE.test(c.audience)
  &&typeof c.serviceEmail==='string'&&EMAIL_RE.test(c.serviceEmail)
  &&typeof c.serviceSubject==='string'&&/^[0-9]{8,32}$/.test(c.serviceSubject);
}
/** Exposed solely for offline test injection, not service-call authority. */
export async function inspectVerifiedGoogleTokenReview(
 token:unknown, config:Config, verifier:Pick<OAuth2Client,'verifyIdToken'>,
 nowSeconds:number,
):Promise<Outcome>{
 try{
 if(typeof token!=='string'||token.length<24||token.length>12288
  ||!validConfig(config)||!Number.isSafeInteger(nowSeconds)||nowSeconds<1
  ||!verifier||typeof verifier.verifyIdToken!=='function')return deny();
 const ticket=await verifier.verifyIdToken({idToken:token,audience:config.audience});
 const claims=ticket.getPayload();
 if(!claims||claims.iss!=='https://accounts.google.com'
  ||claims.aud!==config.audience||claims.email!==config.serviceEmail
  ||claims.email_verified!==true||claims.sub!==config.serviceSubject
  ||!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)
  ||claims.iat>nowSeconds+60||claims.exp<=nowSeconds
  ||claims.exp<=claims.iat||claims.exp-claims.iat>3660)return deny();
 return {status:'google_service_identity_verified_render_unapproved'};
 }catch{return deny();}
}
/** This is the only production-shape entrypoint; its verifier is never injected. */
export async function verifyGoogleServiceIdentityReview(
 token:unknown,config:Config,nowSeconds=Math.floor(Date.now()/1000),
):Promise<Outcome>{
 return inspectVerifiedGoogleTokenReview(token,config,new OAuth2Client(),nowSeconds);
}
