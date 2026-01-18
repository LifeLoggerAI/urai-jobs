import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const onJobWrite = functions.firestore
  .document('jobs/{jobId}')
  .onWrite(async (change, context) => {
    const db = admin.firestore();
    const jobId = context.params.jobId;
    const jobPublicRef = db.collection('jobPublic').doc(jobId);

    const job = change.after.data();

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

export const onApplicationCreate = functions.firestore
  .document('applications/{applicationId}')
  .onCreate(async (snap, context) => {
    const db = admin.firestore();
    const application = snap.data();
    const { applicantEmail, jobId, source } = application;

    // 1. Find or create applicant
    let applicantId = application.applicantId;
    if (!applicantId) {
      const applicantQuery = await db.collection('applicants').where('primaryEmail', '==', applicantEmail).limit(1).get();
      if (!applicantQuery.empty) {
        applicantId = applicantQuery.docs[0].id;
        await db.collection('applicants').doc(applicantId).update({
          lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Create a new applicant
        const newApplicantRef = db.collection('applicants').doc();
        await newApplicantRef.set({
          primaryEmail: applicantEmail,
          name: '', // Will be updated from application form
          lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          source: {
            type: 'direct'
          }
        });
        applicantId = newApplicantRef.id;
      }
      // Update the application with the applicantId
      await snap.ref.update({ applicantId: applicantId });
    }


    // 2. Create event
    await db.collection('events').add({
      type: 'application_submitted',
      entityType: 'application',
      entityId: context.params.applicationId,
      metadata: {
        jobId: jobId,
        applicantId: applicantId,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Increment job stats
    const jobRef = db.collection('jobs').doc(jobId);
    await jobRef.set({
      stats: {
        applicantsCount: admin.firestore.FieldValue.increment(1),
        statusCounts: {
          NEW: admin.firestore.FieldValue.increment(1)
        }
      }
    }, { merge: true });

    // 4. Update referral stats if applicable
    if (source && source.type === 'referral' && source.refCode) {
      const referralRef = db.collection('referrals').doc(source.refCode);
      await referralRef.update({
        submitsCount: admin.firestore.FieldValue.increment(1)
      });
    }
  });
