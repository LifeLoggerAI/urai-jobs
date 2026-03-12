import { firestore } from "firebase-functions";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

// admin.initializeApp() is called in index.ts or at the top level, so not needed here unless running in isolation.

export const onApplicationCreate = firestore.document("applications/{applicationId}").onCreate(async (snap, context) => {
  const { applicationId } = context.params;
  const applicationData = snap.data();
  const db = admin.firestore();

  if (!applicationData) {
    logger.error(`Application ${applicationId} created with no data.`);
    return;
  }

  const { applicantEmail, jobId, name, source } = applicationData;

  try {
    // 1. Create or merge applicant
    let applicantId = applicationData.applicantId;
    if (!applicantId) {
      const applicantsRef = db.collection("applicants");
      const applicantQuery = await applicantsRef.where("primaryEmail", "==", applicantEmail).limit(1).get();

      if (applicantQuery.empty) {
        const newApplicantRef = await applicantsRef.add({
          primaryEmail: applicantEmail,
          name: name, // Assuming name is collected on the application form
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
          source: source || { type: "direct" },
        });
        applicantId = newApplicantRef.id;
      } else {
        const applicantDoc = applicantQuery.docs[0];
        applicantId = applicantDoc.id;
        await applicantDoc.ref.update({ lastActivityAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      // Update the application with the resolved applicantId
      await snap.ref.update({ applicantId });
    }

    // 2. Write "application_submitted" event
    await db.collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: applicationId,
      metadata: { 
        jobId,
        applicantId,
        applicantEmail
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Increment job stats
    const jobRef = db.collection("jobs").doc(jobId);
    await db.runTransaction(async (transaction) => {
        const jobDoc = await transaction.get(jobRef);
        if (!jobDoc.exists) {
            logger.error(`Job ${jobId} not found for application ${applicationId}`);
            return;
        }
        const oldStats = jobDoc.data()?.stats || { applicantsCount: 0, statusCounts: {} };
        const newStatusCount = (oldStats.statusCounts?.NEW || 0) + 1;

        transaction.update(jobRef, {
            "stats.applicantsCount": admin.firestore.FieldValue.increment(1),
            "stats.statusCounts.NEW": newStatusCount
        });
    });

    // 4. Increment referral stats if applicable
    if (source?.type === "referral" && source?.refCode) {
      const referralRef = db.collection("referrals").doc(source.refCode);
      const referralDoc = await referralRef.get();
      if(referralDoc.exists){
          await referralRef.update({ submitsCount: admin.firestore.FieldValue.increment(1) });
      } else {
          logger.warn(`Referral code ${source.refCode} not found.`);
      }
    }

    logger.info(`Processed new application ${applicationId} for job ${jobId}`);

  } catch (error) {
    logger.error(`Error processing application ${applicationId}:`, error);
  }
});
