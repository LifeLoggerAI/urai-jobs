import { firestore } from 'firebase-functions';
import * as admin from 'firebase-admin';

export const onJobWrite = firestore.document('jobs/{jobId}').onWrite(async (change, context) => {
  const { jobId } = context.params;
  const job = change.after.data();

  const jobPublicRef = admin.firestore().collection('jobPublic').doc(jobId);

  if (job && job.status === 'open') {
    const jobPublic = {
      title: job.title,
      department: job.department,
      locationType: job.locationType,
      locationText: job.locationText,
      employmentType: job.employmentType,
      descriptionMarkdown: job.descriptionMarkdown,
      requirements: job.requirements,
      niceToHave: job.niceToHave,
      compensationRange: job.compensationRange,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
    await jobPublicRef.set(jobPublic, { merge: true });
  } else {
    await jobPublicRef.delete();
  }
});
