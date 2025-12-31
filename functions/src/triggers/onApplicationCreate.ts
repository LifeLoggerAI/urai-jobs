import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { Application, Applicant } from "../types";

export const onApplicationCreate = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const application = snap.data() as Application;
    const { jobId, applicantEmail } = application;

    // 1. Create or merge applicant
    const applicantsRef = firestore().collection("applicants");
    const applicantQuery = await applicantsRef.where("primaryEmail", "==", applicantEmail).get();
    
    let applicantId: string;

    if (applicantQuery.empty) {
      const newApplicantRef = applicantsRef.doc();
      const newApplicant: Applicant = {
        primaryEmail: applicantEmail,
        name: application.answers.name, // Assuming 'name' is a field in answers
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
        source: application.source,
      };
      await newApplicantRef.set(newApplicant);
      applicantId = newApplicantRef.id;
    } else {
      const existingApplicantRef = applicantQuery.docs[0].ref;
      await existingApplicantRef.update({
        lastActivityAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      applicantId = existingApplicantRef.id;
    }

    // Update application with applicantId
    await snap.ref.update({ applicantId });

    // 2. Create event
    await firestore().collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: snap.id,
      metadata: {
        jobId,
        applicantId,
        applicantEmail,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    // 3. Increment job rollups
    const jobRef = firestore().collection("jobs").doc(jobId);
    await jobRef.update({
      "stats.applicantsCount": FieldValue.increment(1),
      "stats.statusCounts.NEW": FieldValue.increment(1),
    });

    // 4. If referral, increment referral submitsCount
    if (application.source?.type === "referral" && application.source?.refCode) {
      const referralRef = firestore().collection("referrals").doc(application.source.refCode);
      await referralRef.update({ submitsCount: FieldValue.increment(1) });
    }
  });
