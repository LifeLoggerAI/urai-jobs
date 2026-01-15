import { firestore } from "firebase-functions/v2";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import { Application, Applicant } from "../models";
import {db} from '../lib/firebase';

// --- AUTOFIX: tolerate legacy string "source" fields ---
function __asObj(v: any): any {
  return (typeof v === "string") ? { type: v } : (v ?? {});
}



const getApplicantIdByEmail = async (email: string): Promise<string | null> => {
    const snapshot = await db.collection('applicants').where('primaryEmail', '==', email).limit(1).get();
    if (snapshot.empty) {
        return null;
    }
    return snapshot.docs[0].id;
}

export const onapplicationcreate = firestore.onDocumentCreated("applications/{applicationId}", async (event) => {
  const application = event.data?.data() as Application;
  const { applicantEmail, applicantId, jobId, source } = application;

  let finalApplicantId = applicantId;

  if (!finalApplicantId) {
    const existingApplicantId = await getApplicantIdByEmail(applicantEmail);
    if (existingApplicantId) {
        finalApplicantId = existingApplicantId;
        await db.collection('applicants').doc(finalApplicantId).update({ lastActivityAt: FieldValue.serverTimestamp() });
    } else {
        const newApplicantRef = db.collection('applicants').doc();
        const newApplicant: Partial<Applicant> = {
            primaryEmail: applicantEmail,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            lastActivityAt: FieldValue.serverTimestamp(),
        };
        await newApplicantRef.set(newApplicant, { merge: true });
        finalApplicantId = newApplicantRef.id;
    }
    await event.data?.ref.update({ applicantId: finalApplicantId });
  }

  // Event for application submission
  await db.collection('events').add({
      type: 'application_submitted',
      entityType: 'application',
      entityId: event.params.applicationId,
      metadata: { jobId, applicantId: finalApplicantId },
      createdAt: FieldValue.serverTimestamp(),
  });

  // Job rollups
  const jobRef = db.collection('jobs').doc(jobId);
  await jobRef.update({
      'stats.applicantsCount': FieldValue.increment(1),
      'stats.statusCounts.NEW': FieldValue.increment(1),
  });

  if (source?.type === 'referral' && __asObj(source).refCode) {
      const referralRef = db.collection('referrals').doc(__asObj(source).refCode);
      await referralRef.update({ submitsCount: FieldValue.increment(1) });
  }
});
