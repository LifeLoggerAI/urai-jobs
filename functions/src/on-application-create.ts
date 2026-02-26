
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Application, Applicant, Event } from '../../lib/types';
import { v4 as uuidv4 } from 'uuid';

const db = admin.firestore();

export const onApplicationCreate = functions.firestore
  .document('applications/{applicationId}')
  .onCreate(async (snap, context) => {
    const application = snap.data() as Application;
    const { jobId, applicantEmail, applicantId } = application;

    let finalApplicantId = applicantId;

    // 1. Create or merge applicant
    if (!finalApplicantId) {
      const applicantQuery = await db.collection('applicants').where('primaryEmail', '==', applicantEmail).limit(1).get();
      if (!applicantQuery.empty) {
        finalApplicantId = applicantQuery.docs[0].id;
        const applicantRef = db.collection('applicants').doc(finalApplicantId);
        await applicantRef.update({ lastActivityAt: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        // Create a new applicant
        finalApplicantId = uuidv4();
        const newApplicant: Applicant = {
          id: finalApplicantId,
          primaryEmail: applicantEmail,
          name: ' ', // Placeholder, to be updated by user
          createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
          updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
          lastActivityAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
          source: { type: 'direct' } // Default source
        };
        await db.collection('applicants').doc(finalApplicantId).set(newApplicant);
      }
      // Update the application with the new applicantId
      await snap.ref.update({ applicantId: finalApplicantId });
    } else {
      // Applicant ID was provided, just update their last activity
      const applicantRef = db.collection('applicants').doc(finalApplicantId);
      await applicantRef.update({ lastActivityAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    // 2. Write `events` entry
    const event: Event = {
      id: uuidv4(),
      type: 'application_submitted',
      entityType: 'application',
      entityId: snap.id,
      metadata: { jobId, applicantId: finalApplicantId },
      createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    };
    await db.collection('events').add(event);

    // 3. Increment job rollup
    const jobRef = db.collection('jobs').doc(jobId);
    await jobRef.update({ 'stats.applicantsCount': admin.firestore.FieldValue.increment(1) });

    // 4. If referral refCode exists, increment referrals.submitsCount
    if (application.source && application.source.type === 'referral' && application.source.refCode) {
      const referralRef = db.collection('referrals').doc(application.source.refCode);
      await referralRef.update({ submitsCount: admin.firestore.FieldValue.increment(1) });
    }
  });
