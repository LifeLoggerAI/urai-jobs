import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";

export const onApplicationCreate = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const application = snap.data();
    const { jobId, applicantEmail } = application;

    // Create or merge applicant
    const applicantRef = firestore().collection("applicants").doc(); // Create a new applicant for now
    await applicantRef.set({
      primaryEmail: applicantEmail,
      lastActivityAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Create event
    await firestore().collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: snap.id,
      metadata: {
        jobId,
        applicantEmail,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    // Increment job rollups
    const jobRef = firestore().collection("jobs").doc(jobId);
    await jobRef.update({
      "stats.applicantsCount": FieldValue.increment(1),
      "stats.statusCounts.NEW": FieldValue.increment(1),
    });

    // If referral, increment referral submitsCount
    if (application.source?.type === "referral" && application.source?.refCode) {
      const referralRef = firestore().collection("referrals").doc(application.source.refCode);
      await referralRef.update({ submitsCount: FieldValue.increment(1) });
    }
  });
