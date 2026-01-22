import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const onApplicationCreate = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const applicationData = snap.data();
    const { jobId, applicantId, applicantEmail, source } = applicationData;

    // 1. Create or update applicant
    let finalApplicantId = applicantId;
    if (!finalApplicantId) {
      // If no applicantId, try to find one by email or create a new one
      const applicantQuery = await db.collection("applicants").where("primaryEmail", "==", applicantEmail).limit(1).get();
      if (!applicantQuery.empty) {
        finalApplicantId = applicantQuery.docs[0].id;
        await applicantQuery.docs[0].ref.update({ lastActivityAt: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        // Create a new applicant
        const newApplicantRef = db.collection("applicants").doc(); // Auto-generate ID
        await newApplicantRef.set({
          primaryEmail: applicantEmail,
          // ... other applicant fields from application form ...
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        finalApplicantId = newApplicantRef.id;
      }
      // Update the application with the resolved applicantId
      await snap.ref.update({ applicantId: finalApplicantId });
    }

    // 2. Write event
    await db.collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: context.params.applicationId,
      metadata: { jobId, applicantId: finalApplicantId },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Increment job stats
    const jobRef = db.collection("jobs").doc(jobId);
    await db.runTransaction(async (transaction) => {
        const jobDoc = await transaction.get(jobRef);
        if (jobDoc.exists) {
            const currentStats = jobDoc.data()?.stats || { applicantsCount: 0, statusCounts: {} };
            const newApplicantsCount = (currentStats.applicantsCount || 0) + 1;
            const newStatusCounts = { ...currentStats.statusCounts, NEW: (currentStats.statusCounts?.NEW || 0) + 1 };
            transaction.update(jobRef, { 
                stats: { 
                    applicantsCount: newApplicantsCount,
                    statusCounts: newStatusCounts 
                } 
            });
        }
    });

    // 4. Update referral stats if applicable
    if (source && source.type === 'referral' && source.refCode) {
      const referralRef = db.collection("referrals").doc(source.refCode);
      await referralRef.update({ submitsCount: admin.firestore.FieldValue.increment(1) });
    }
  });
