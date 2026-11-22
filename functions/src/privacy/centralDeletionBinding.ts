import { createHash } from 'node:crypto';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function readPrivacyAuthorizedJobsBinding(
  ownerUid:string,centralRequestId:string,jobsRequestId:string
):Promise<boolean> {
  const project=process.env.URAI_JOBS_DELETION_PRIVACY_PROJECT || '';
  const jobsProject=process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT ||
    (getApps().length ? getApp().options.projectId : '') || '';
  if (!/^[a-z][a-z0-9-]{5,79}$/.test(project) || !jobsProject || project===jobsProject)
    return false;
  const host=process.env.FIRESTORE_EMULATOR_HOST;
  if (host && (host!=='127.0.0.1:8080' ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099' ||
      jobsProject!=='urai-jobs-r1624-disposable' ||
      project!=='urai-privacy-r1512-disposable')) return false;
  try {
    const name='urai-privacy-deletion-binding-readonly';
    const app=getApps().find(a=>a.name===name) || initializeApp({projectId:project},name);
    const db=getFirestore(app);
    const subject=db.collection('deletionRequests').doc(centralRequestId);
    const binding=subject.collection('participantBindings').doc('urai-jobs');
    const [owner,link]=await Promise.all([subject.get(),binding.get()]);
    const row=owner.data()||{},record=link.data()||{};
    return owner.exists && link.exists &&
      row.uid===ownerUid && row.status==='processing' &&
      row.deletionCompletionVerified!==true &&
      record.schemaVersion==='urai-privacy-jobs-deletion-binding-v1' &&
      record.centralRequestId===centralRequestId &&
      record.jobsRequestId===jobsRequestId &&
      record.ownerHash===hash(ownerUid) &&
      record.sourceProject===jobsProject &&
      record.state==='authorized-pending-verification' &&
      record.globalDeletionComplete===false;
  } catch { return false; }
}
