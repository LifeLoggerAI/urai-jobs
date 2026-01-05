// @ts-nocheck
import {firestore} from "firebase-functions";
import {db} from "../firebase";
import {Application, Applicant} from "../types";
import * as admin from "firebase-admin";

export const onApplicationCreate = firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap) => {
    const application = snap.data() as Application;
    const {jobId, applicantEmail, applicantId} = application;
    const now = admin.firestore.FieldValue.serverTimestamp();

    // 1. Create or merge applicant
    let finalApplicantId = applicantId;
    if (!finalApplicantId) {
      // Deterministic applicant ID based on email hash
      const hash = Buffer.from(applicantEmail).toString("base64");
      finalApplicantId = hash;
      const applicantRef = db.collection("applicants").doc(finalApplicantId);
      const applicantSnap = await applicantRef.get();

      if (!applicantSnap.exists) {
        // Create new applicant
        const newApplicant: Partial<Applicant> = {
          primaryEmail: applicantEmail,
          createdAt: now as admin.firestore.Timestamp,
          updatedAt: now as admin.firestore.Timestamp,
          lastActivityAt: now as admin.firestore.Timestamp,
        };
        await applicantRef.set(newApplicant, {merge: true});
      }
    }
    // Update the application with the applicantId
    await snap.ref.update({applicantId: finalApplicantId, updatedAt: now});


    // 2. Write application submitted event
    await db.collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: snap.id,
      metadata: {
        jobId,
        applicantId: finalApplicantId,
      },
      createdAt: now,
    });

    // 3. Increment job stats
    const jobRef = db.collection("jobs").doc(jobId);
    await jobRef.update({
      "stats.applicantsCount": admin.firestore.FieldValue.increment(1),
      "stats.statusCounts.NEW": admin.firestore.FieldValue.increment(1),
      "updatedAt": now,
    });

    // 4. Handle referral
    const applicantRef = db.collection("applicants").doc(finalApplicantId);
    const applicantSnap = await applicantRef.get();
    const applicant = applicantSnap.data() as Applicant;

    const source = applicant.source;
    if (source && source.type === "referral" && source.refCode) {
      const referralRef = db.collection("referrals").doc(source.refCode);
      await referralRef.update({
        submitsCount: admin.firestore.FieldValue.increment(1),
      });
    }
  });
