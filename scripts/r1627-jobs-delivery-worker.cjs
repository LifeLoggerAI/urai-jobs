'use strict';
const assert=require('node:assert/strict');
const root='/workspace/r1627-jobs-canonical-link-review/functions';
const {getApp,getApps,initializeApp,deleteApp}=require(require.resolve('firebase-admin/app',{paths:[root]}));
const {getFirestore}=require(require.resolve('firebase-admin/firestore',{paths:[root]}));
const {dispatchJobsDeletionEvidence}=require(root+'/lib/functions/privacy/deletionEvidenceDelivery.js');
const [uid,jobsRequestId,centralRequestId]=process.argv.slice(2);
assert.ok(uid && jobsRequestId && centralRequestId);
assert.equal(process.env.GCLOUD_PROJECT,'urai-jobs-r1624-disposable');
const app=getApps().length ? getApp() : initializeApp();
const db=getFirestore(app);
(async()=>{
 const crypto=require('node:crypto');
 const operator='r1625-operator-'+crypto.createHash('sha256').update(uid).digest('hex').slice(0,12);
 const ctx={auth:{uid:operator,token:{uid:operator,role:'admin'}}};
 const privacyApp=initializeApp({projectId:'urai-privacy-r1512-disposable'},'r1627-privacy-binding-fixture');
 const privacyDb=getFirestore(privacyApp);
 const link=privacyDb.collection('deletionRequests').doc(centralRequestId).collection('participantBindings').doc('urai-jobs');
 const savedLink=(await link.get()).data();
 assert.ok(savedLink);
 const badURL=process.env.URAI_JOBS_DELETION_PRIVACY_CALLABLE_URL;
 process.env.URAI_JOBS_DELETION_PRIVACY_CALLABLE_URL='https://example.invalid/recordJobsDeletionParticipantEvidence';
 await assert.rejects(dispatchJobsDeletionEvidence.run({requestId:jobsRequestId,centralRequestId},ctx),/privacy-deletion-destination-denied/);
 process.env.URAI_JOBS_DELETION_PRIVACY_CALLABLE_URL=badURL;
 const sameProject=process.env.URAI_JOBS_DELETION_PRIVACY_PROJECT;
 process.env.URAI_JOBS_DELETION_PRIVACY_PROJECT=process.env.GCLOUD_PROJECT;
 await assert.rejects(dispatchJobsDeletionEvidence.run({requestId:jobsRequestId,centralRequestId},ctx),/privacy-deletion-destination-denied/);
 process.env.URAI_JOBS_DELETION_PRIVACY_PROJECT=sameProject;
 await link.delete();
 await assert.rejects(dispatchJobsDeletionEvidence.run({requestId:jobsRequestId,centralRequestId},ctx),/Canonical Privacy-owned Jobs deletion binding denied/);
 await link.set(savedLink);
 await assert.rejects(dispatchJobsDeletionEvidence.run({requestId:jobsRequestId+'-foreign',centralRequestId},ctx),/Jobs request missing/);
 console.log('R1626_DELIVERY_NEGATIVE_PASS',JSON.stringify({checks:4,hostDenied:true,crossProjectDenied:true,missingCentralLinkDenied:true,foreignRequestDenied:true}));
 const first=await dispatchJobsDeletionEvidence.run({requestId:jobsRequestId,centralRequestId},ctx);
 assert.equal(first.accepted,true);
 assert.equal(first.globalDeletionComplete,false);
 assert.equal(first.idempotent,false);
 const again=await dispatchJobsDeletionEvidence.run({requestId:jobsRequestId,centralRequestId},ctx);
 assert.equal(again.idempotent,true);
 assert.equal(again.evidenceHash,first.evidenceHash);
 const stored=(await db.collection('dataRightsRequests').doc(jobsRequestId).collection('delivery').doc('privacy-evidence').get()).data();
 assert.equal(stored.centralRequestId,centralRequestId);
 assert.equal(stored.state,'evidence-received-verification-pending');
 await deleteApp(privacyApp);
 console.log('R1626_JOBS_DELIVERY_PASS',JSON.stringify({
  idempotent:again.idempotent,globalDeletionComplete:first.globalDeletionComplete,
  evidenceHash:first.evidenceHash,source:'compiled-Jobs-dispatchJobsDeletionEvidence.run',
  via:'authenticated-Privacy-Functions-callable-HTTP'
 }));
})().catch(error=>{console.error('R1626_JOBS_DELIVERY_FAIL',error.stack||error);process.exitCode=1})
.finally(async()=>{await deleteApp(app)});
