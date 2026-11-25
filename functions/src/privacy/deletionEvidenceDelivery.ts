import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { CallableContext } from 'firebase-functions/v1/https';
import { z } from 'zod';
import { withAuthenticatedRole } from '../core/auth.js';
import { httpsError } from '../core/errors.js';
import { isCompletedDataRightsReplayReceipt } from './dataRightsReplayPolicy.js';
import { jobsPrivacyIdToken } from './consentRevocationAcknowledgement.js';
import { readPrivacyAuthorizedJobsBinding } from './centralDeletionBinding.js';
import { isBoundDeletionAcknowledgment } from './deletionEvidenceAcknowledgment.js';

const Input=z.object({requestId:z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),centralRequestId:z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/)}).strict();
const Ident=/^[A-Za-z0-9._:-]{8,160}$/;
const HASH=/^[a-f0-9]{64}$/;
const TERMINAL='PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED';

function privacyDestination():URL {
 const raw=process.env.URAI_JOBS_DELETION_PRIVACY_CALLABLE_URL || '';
 const project=process.env.URAI_JOBS_DELETION_PRIVACY_PROJECT || '';
 if (!/^[a-z][a-z0-9-]{5,79}$/.test(project) || !raw)
  throw new Error('privacy-deletion-destination-unconfigured');
 const url=new URL(raw);
 const local=process.env.FIRESTORE_EMULATOR_HOST==='127.0.0.1:8080'
   && process.env.FIREBASE_AUTH_EMULATOR_HOST==='127.0.0.1:9099'
   && process.env.GCLOUD_PROJECT==='urai-jobs-r1624-disposable'
   && project==='urai-privacy-r1512-disposable'
   && url.protocol==='http:' && url.hostname==='127.0.0.1'
   && url.port==='5001'
   && url.pathname==='/urai-privacy-r1512-disposable/us-central1/recordJobsDeletionParticipantEvidence';
 const cloudHost='us-central1-'+project+'.cloudfunctions.net';
 const cloud=url.protocol==='https:' && url.hostname===cloudHost
   && url.pathname==='/recordJobsDeletionParticipantEvidence' && !url.port;
 if (!local && !cloud || url.username || url.password || url.search || url.hash)
  throw new Error('privacy-deletion-destination-denied');
 return url;
}

async function serviceToken(local:boolean):Promise<string> {
 const testToken=process.env.URAI_JOBS_DELETION_TEST_ID_TOKEN || '';
 if (testToken && local &&
     /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.$/.test(testToken))
   return testToken;
 if (testToken) throw new Error('privacy-deletion-test-token-denied');
 // Reuse the reviewed Jobs-owned token issuer. It must independently pass
 // project/service-account/consumer approval; never create a token from a
 // private user credential, arbitrary caller payload or environment secret.
 return jobsPrivacyIdToken();
}

async function dispatch(data:unknown,_context:CallableContext) {
 const parsed=Input.safeParse(data);
 if (!parsed.success)throw httpsError('invalid-argument','Canonical Jobs requestId required.');
 const url=privacyDestination(); // reject malformed/unapproved destinations before fetching evidence
 const db=getFirestore();
 const requestRef=db.collection('dataRightsRequests').doc(parsed.data.requestId);
 const request=await requestRef.get();
 if (!request.exists)throw httpsError('not-found','Jobs request missing.');
 const row=request.data() || {};
 const ownerUid=row.ownerUid;
 const centralRequestId=parsed.data.centralRequestId;
 const path=row.executionReceiptPath;
 if (typeof ownerUid!=='string' || !Ident.test(ownerUid) ||
   typeof centralRequestId!=='string' || !Ident.test(centralRequestId) ||
   row.requestType!=='DELETE' || row.status!=='IN_REVIEW' ||
   row.executionState!==TERMINAL ||
   typeof path!=='string' ||
   !/^dataRightsRequests\/[A-Za-z0-9._:-]{8,160}\/audit\/execution-[a-f0-9]{24}$/.test(path) ||
   !path.startsWith(requestRef.path+'/audit/'))
  throw httpsError('failed-precondition','Jobs-to-Privacy deletion source is not server-bound and complete.');

 if (!await readPrivacyAuthorizedJobsBinding(ownerUid,centralRequestId,request.id))
  throw httpsError('failed-precondition','Canonical Privacy-owned Jobs deletion binding denied.');
 const snap=await db.doc(path).get();
 const receipt=snap.data();
 if (!snap.exists || !isCompletedDataRightsReplayReceipt(receipt,{
   requestId:request.id,ownerUid,requestType:'DELETE'
 }))
  throw httpsError('failed-precondition','Jobs execution terminal receipt is missing or invalid.');
 if (!receipt || typeof receipt.resultDigest!=='string'||!HASH.test(receipt.resultDigest))
  throw httpsError('failed-precondition','Canonical Jobs result digest required.');

 const immutable=Object.fromEntries([
  'schemaVersion','event','requestId','requestType','ownerHash',
  'resultDigest','terminalState','result'
 ].map(k=>[k,receipt[k]]));
 const local=url.protocol==='http:';
 const token=await serviceToken(local);
 const response=await fetch(url,{
  method:'POST',redirect:'error',headers:{
    authorization:'Bearer '+token,'content-type':'application/json'
  },body:JSON.stringify({data:{centralRequestId,jobsRequestId:request.id,receipt:immutable}}),
  signal:AbortSignal.timeout(12000)
 });
 if (!response.ok)throw httpsError('unavailable','Jobs deletion evidence delivery not acknowledged.');
 const body=await response.json() as {result?:Record<string,unknown>};
 const result=body.result;
 if (!isBoundDeletionAcknowledgment(result, immutable))
  throw httpsError('unavailable','Jobs deletion evidence acknowledgment invalid.');

 // Do not mutate canonical request or mark a deleted account completed.
 // This is a local delivery ledger ONLY. Privately scoped audit receipt remains source.
 await requestRef.collection('delivery').doc('privacy-evidence').set({
   centralRequestId,jobsRequestId:request.id,ownerHash:receipt.ownerHash,
   resultDigest:receipt.resultDigest,evidenceHash:result.evidenceHash,
   state:'evidence-received-verification-pending',
   receivedAt:FieldValue.serverTimestamp()
 },{merge:true});
 return {accepted:true,centralRequestId,jobsRequestId:request.id,
   evidenceHash:result.evidenceHash,idempotent:result.idempotent,
   globalDeletionComplete:false,deliveryState:'evidence-received-verification-pending'};
}

// Operator-authenticated and hard-staged, not owner/client-callable.
export const dispatchJobsDeletionEvidence=withAuthenticatedRole(['admin','operator'],dispatch);
