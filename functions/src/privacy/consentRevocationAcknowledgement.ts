import { getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const hex64=/^[a-f0-9]{64}$/;
const uidPattern=/^[A-Za-z0-9:_-]{8,160}$/;

export type NativePrivacyAck = {
  eventId: string; consumerId:'urai-jobs'; status:'applied';
  correlationId:string; detailHash:string;
};

/**
 * Firebase Auth ID token bound to the separately configured Jobs consumer.
 * No static user password, refresh token, or invented claims are admitted.
 * Production token signing requires a reviewed, scoped service account.
 */
export async function jobsPrivacyIdToken():Promise<string> {
  const project=process.env.URAI_PRIVACY_ACK_PROJECT_ID || '';
  const uid=process.env.URAI_PRIVACY_ACK_SERVICE_UID || '';
  if(!/^[a-z0-9-]{6,80}$/.test(project)||!uidPattern.test(uid))
    throw new Error('privacy-ack-identity-unconfigured');
  const actual=getApp().options.projectId || process.env.GCLOUD_PROJECT || '';
  if(actual!==project)throw new Error('privacy-ack-project-mismatch');

  const authEmulatorHost=process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
  const firestoreEmulatorHost=process.env.FIRESTORE_EMULATOR_HOST || '';
  const emulatorConfigured=Boolean(authEmulatorHost || firestoreEmulatorHost);
  const localEmulatorHost=(host:string)=>/^127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(host);
  const emulator=localEmulatorHost(authEmulatorHost)
    && localEmulatorHost(firestoreEmulatorHost);
  // Never sign and exchange a Firebase custom token with an arbitrary host
  // supplied through an emulator variable. Reject incomplete/remote emulator
  // configuration before minting any token, even without a test-token override.
  if(emulatorConfigured&&!emulator)
    throw new Error('privacy-ack-emulator-config-denied');
  const testToken=process.env.URAI_PRIVACY_ACK_TEST_ID_TOKEN || '';
  if(testToken) {
    if(!emulator || authEmulatorHost!=='127.0.0.1:9099')
      throw new Error('privacy-ack-test-token-production-denied');
    return testToken;
  }

  const apiKey=process.env.URAI_PRIVACY_ACK_FIREBASE_API_KEY || '';
  if(!apiKey || !/^[A-Za-z0-9_-]{16,160}$/.test(apiKey))
    throw new Error('privacy-ack-firebase-api-key-unconfigured');
  const customToken=await getAuth().createCustomToken(uid,{system:true,consumerId:'urai-jobs'});
  const endpoint=emulator
    ? new URL('http://'+authEmulatorHost+'/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken')
    : new URL('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken');
  endpoint.searchParams.set('key',apiKey);
  // A redirected identity exchange must never forward the signed custom token
  // (or Firebase API key) to a second, unverified endpoint.
  const response=await fetch(endpoint,{
    method:'POST',redirect:'error',headers:{'content-type':'application/json'},
    body:JSON.stringify({token:customToken,returnSecureToken:true}),
    signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw new Error('privacy-ack-identity-exchange-failed');
  const body=await response.json() as {idToken?:unknown};
  if(typeof body.idToken!=='string'||body.idToken.length<20)
    throw new Error('privacy-ack-identity-token-invalid');
  return body.idToken;
}

export function privacyAckUrl():URL {
  const raw=process.env.URAI_PRIVACY_ACK_CALLABLE_URL || '';
  if(!raw)throw new Error('privacy-ack-url-unconfigured');
  const url=new URL(raw);
  const emulatorConfigured=Boolean(process.env.FIRESTORE_EMULATOR_HOST)
    || Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  const emulator=Boolean(process.env.FIRESTORE_EMULATOR_HOST)
    && Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)
    && url.hostname==='127.0.0.1' && url.protocol==='http:';
  // Do not exchange an authenticated Jobs consumer bearer token with an
  // arbitrary Cloud Run or other project's Cloud Functions service. The
  // configured Firebase project is the authoritative Cloud Functions host
  // suffix; an opaque Cloud Run service hostname must be separately pinned
  // by deployment review before this endpoint can be enabled.
  const project=process.env.URAI_PRIVACY_ACK_PROJECT_ID || '';
  const validProject=/^[a-z][a-z0-9-]{5,79}$/.test(project);
  const functionSuffix='-'+project+'.cloudfunctions.net';
  const region=validProject && url.hostname.endsWith(functionSuffix)
    ? url.hostname.slice(0,-functionSuffix.length) : '';
  const scopedCloudFunction=validProject
    && /^(?:us|asia|europe|australia|northamerica|southamerica|africa|me)-(?:north|south|east|west|central|northeast|northwest|southeast|southwest)[1-9][0-9]*$/.test(region);
  const pinnedRunHost=process.env.URAI_PRIVACY_ACK_PINNED_RUN_HOST || '';
  const pinnedRunService=validProject
    && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.a\.run\.app$/.test(url.hostname)
    && pinnedRunHost===url.hostname;
  const production=url.protocol==='https:'
    && (scopedCloudFunction || pinnedRunService);
  // Local Firebase Functions emulator URLs may use
  // /<project>/<region>/acknowledgeConsentRevocation; live callables must
  // never accept that nested form. Keep the original local emulator route.
  const segments=url.pathname.split('/');
  const emulatorPath=url.pathname==='/acknowledgeConsentRevocation'
    || (segments.length===4 && validProject && segments[1]===project
      && /^(?:us|asia|europe|australia|northamerica|southamerica|africa|me)-(?:north|south|east|west|central|northeast|northwest|southeast|southwest)[1-9][0-9]*$/.test(segments[2])
      && segments[3]==='acknowledgeConsentRevocation');
  const endpointPath=emulator ? emulatorPath
    : url.pathname==='/acknowledgeConsentRevocation';
  // Reject query tokens, alternative live HTTPS ports, redirects or nested
  // production callbacks. Run-host pin is not independent provider IAM proof.
  if((emulatorConfigured&&!emulator)||(!emulator&&!production)||
    url.username||url.password||url.search||url.hash||url.port&&!emulator||
    !endpointPath)
    throw new Error('privacy-ack-url-denied');
  return url;
}

export async function acknowledgeJobsRevocationToPrivacy(
  eventId:string,receiptHash:string
):Promise<void> {
  if(!hex64.test(eventId)||!hex64.test(receiptHash))
    throw new Error('privacy-ack-canonical-receipt-required');
  const url=privacyAckUrl();
  const token=await jobsPrivacyIdToken();
  const payload:NativePrivacyAck={eventId,consumerId:'urai-jobs',status:'applied',
    correlationId:eventId,detailHash:receiptHash};
  const response=await fetch(url,{
    method:'POST',redirect:'error',
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({data:payload}),
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error('privacy-ack-callable-http-'+response.status);
  const body=await response.json() as Record<string,unknown>;
  const result=body.result;
  if(!result||typeof result!=='object')throw new Error('privacy-ack-callable-invalid');
  const ack=result as Record<string,unknown>;
  if(ack.eventId!==eventId||ack.consumerId!=='urai-jobs'||
     ack.status!=='applied'||typeof ack.idempotent!=='boolean')
    throw new Error('privacy-ack-callable-mismatch');
}

