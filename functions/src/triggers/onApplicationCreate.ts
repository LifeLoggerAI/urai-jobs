import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

const db = admin.firestore();

export const onApplicationCreate = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const application = snap.data();
    const { applicationId } = context.params;

    // 1. Create or merge the applicant.
    let applicantId = application.applicantId;
    if (!applicantId) {
      // If no applicantId is provided, find an applicant by email or create a new one.
      const applicantsRef = db.collection("applicants");
      const email = application.applicantEmail.toLowerCase();
      const existingApplicant = await applicantsRef.where("primaryEmail", "==", email).limit(1).get();

      if (!existingApplicant.empty) {
        applicantId = existingApplicant.docs[0].id;
        await existingApplicant.docs[0].ref.update({
          lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Create a deterministic applicantId to prevent duplicates in concurrent scenarios.
        applicantId = crypto.createHash('md5').update(email).digest('hex');
        await applicantsRef.doc(applicantId).set({
          primaryEmail: email,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      // Update the application with the resolved applicantId.
      await snap.ref.update({ applicantId });
    }

    // 2. Write an application submitted event.
    await db.collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: applicationId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        jobId: application.jobId,
        applicantId,
      },
    });

    // 3. Increment job rollup statistics.
    const jobRef = db.collection("jobs").doc(application.jobId);
    await db.runTransaction(async (transaction) => {
      const jobDoc = await transaction.get(jobRef);
      if (jobDoc.exists) {
        const stats = jobDoc.data().stats || { applicantsCount: 0, statusCounts: {} };
        const newApplicantsCount = (stats.applicantsCount || 0) + 1;
        const status = application.status || "NEW";
        const newStatusCounts = { ...stats.statusCounts, [status]: (stats.statusCounts[status] || 0) + 1 };
        transaction.update(jobRef, { 
          'stats.applicantsCount': newApplicantsCount, 
          'stats.statusCounts': newStatusCounts 
        });
      }
    });

    // 4. If a referral code was used, increment the submitsCount.
    if (application.source && application.source.type === "referral" && application.source.refCode) {
      const referralRef = db.collection("referrals").doc(application.source.refCode);
      await referralRef.update({ submitsCount: admin.firestore.FieldValue.increment(1) });
    }
  });
