import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const onApplicationCreate = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const applicationData = snap.data();
    const { jobId, applicantId, applicantEmail, source } = applicationData;

    // Create or merge applicant
    let applicantRef;
    if (applicantId) {
      applicantRef = admin.firestore().collection("applicants").doc(applicantId);
      await applicantRef.update({ lastActivityAt: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      // Create a deterministic applicantId from the email
      const newApplicantId = Buffer.from(applicantEmail).toString("base64");
      applicantRef = admin.firestore().collection("applicants").doc(newApplicantId);
      await applicantRef.set({ primaryEmail: applicantEmail, lastActivityAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }

    // Write event
    await admin.firestore().collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: context.params.applicationId,
      metadata: { jobId, applicantId: applicantRef.id },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Increment job stats
    const jobRef = admin.firestore().collection("jobs").doc(jobId);
    await jobRef.update({
      "stats.applicantsCount": admin.firestore.FieldValue.increment(1),
    });

    // If referral, increment referral stats
    if (source && source.type === "referral" && source.refCode) {
      const referralRef = admin.firestore().collection("referrals").doc(source.refCode);
      await referralRef.update({ submitsCount: admin.firestore.FieldValue.increment(1) });
    }
  });
