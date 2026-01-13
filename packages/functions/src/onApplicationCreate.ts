import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createHash } from "crypto";

export const onApplicationCreate = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const application = snap.data();
    const { jobId, applicantEmail } = application;

    const applicantId = createHash("sha256").update(applicantEmail).digest("hex");

    const applicantRef = admin.firestore().collection("applicants").doc(applicantId);

    await applicantRef.set(
      {
        primaryEmail: applicantEmail,
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await snap.ref.update({ applicantId });

    const jobRef = admin.firestore().collection("jobs").doc(jobId);
    await jobRef.update({
      "stats.applicantsCount": admin.firestore.FieldValue.increment(1),
      "stats.statusCounts.NEW": admin.firestore.FieldValue.increment(1),
    });

    if (application.source?.type === "referral" && application.source?.refCode) {
      const referralRef = admin
        .firestore()
        .collection("referrals")
        .doc(application.source.refCode);
      await referralRef.update({
        submitsCount: admin.firestore.FieldValue.increment(1),
      });
    }

    await admin.firestore().collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: snap.id,
      metadata: {
        jobId,
        applicantId,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
