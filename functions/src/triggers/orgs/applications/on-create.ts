import { firestore } from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const onApplicationCreate = firestore.document('/orgs/{orgId}/applications/{applicationId}').onCreate(async (snap, context) => {
  const { orgId, applicationId } = context.params;
  const applicationData = snap.data();

  const db = admin.firestore();

  // Create or update applicant
  let applicantId = applicationData.applicantId;
  if (!applicantId) {
    const applicantRef = db.collection('orgs').doc(orgId).collection('applicants');
    const applicantQuery = await applicantRef.where('primaryEmail', '==', applicationData.applicantEmail).limit(1).get();
    if (applicantQuery.empty) {
      const newApplicant = {
        primaryEmail: applicationData.applicantEmail,
        name: applicationData.name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const newApplicantRef = await applicantRef.add(newApplicant);
      applicantId = newApplicantRef.id;
    } else {
      const applicantDoc = applicantQuery.docs[0];
      applicantId = applicantDoc.id;
      await applicantDoc.ref.update({ lastActivityAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    await snap.ref.update({ applicantId });
  }

  // Create event
  const eventRef = db.collection('orgs').doc(orgId).collection('events');
  const event = {
    type: 'application_submitted',
    entityType: 'application',
    entityId: applicationId,
    metadata: { ...applicationData },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await eventRef.add(event);

  // Update job stats
  const jobRef = db.collection('orgs').doc(orgId).collection('jobs').doc(applicationData.jobId);
  await jobRef.update({
    'stats.applicantsCount': admin.firestore.FieldValue.increment(1),
    [`stats.statusCounts.${applicationData.status}`]: admin.firestore.FieldValue.increment(1),
  });

  // Update referral stats
  if (applicationData.source?.type === 'referral' && applicationData.source?.refCode) {
    const referralRef = db.collection('orgs').doc(orgId).collection('referrals').doc(applicationData.source.refCode);
    await referralRef.update({ submitsCount: admin.firestore.FieldValue.increment(1) });
  }
});
