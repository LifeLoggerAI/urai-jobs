import { firestore } from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const onJobWrite = firestore.document('/orgs/{orgId}/jobs/{jobId}').onWrite(async (change, context) => {
  const { jobId } = context.params;
  const jobData = change.after.data();

  const db = admin.firestore();
  const jobPublicRef = db.collection('jobPublic').doc(jobId);

  if (jobData?.status === 'open') {
    const publicData = {
      title: jobData.title,
      department: jobData.department,
      locationType: jobData.locationType,
      locationText: jobData.locationText,
      employmentType: jobData.employmentType,
      descriptionMarkdown: jobData.descriptionMarkdown,
      requirements: jobData.requirements,
      niceToHave: jobData.niceToHave,
      compensationRange: jobData.compensationRange,
      createdAt: jobData.createdAt,
      updatedAt: jobData.updatedAt,
    };
    return jobPublicRef.set(publicData, { merge: true });
  } else {
    return jobPublicRef.delete();
  }
});
