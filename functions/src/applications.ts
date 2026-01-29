import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";
import { Application, Applicant, Event, Job } from "./models.js";
import { v4 as uuidv4 } from "uuid";

export const onApplicationCreate = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const db = firestore();
    const application = snap.data() as Application;
    const { applicantEmail, jobId, source } = application;

    let applicantId = application.applicantId;

    // 1. Create or merge applicant
    if (!applicantId) {
      const applicantsRef = db.collection("applicants");
      const query = applicantsRef.where("primaryEmail", "==", applicantEmail);
      const snapshot = await query.get();

      if (snapshot.empty) {
        applicantId = uuidv4();
        const newApplicant: Applicant = {
          primaryEmail: applicantEmail,
          name: "", // This should be populated from the application form
          source: source,
          createdAt: firestore.Timestamp.now(),
          updatedAt: firestore.Timestamp.now(),
          lastActivityAt: firestore.Timestamp.now(),
        };
        await applicantsRef.doc(applicantId).set(newApplicant);
      } else {
        const applicantDoc = snapshot.docs[0];
        applicantId = applicantDoc.id;
        await applicantDoc.ref.update({
          lastActivityAt: firestore.Timestamp.now(),
        });
      }
      await snap.ref.update({ applicantId: applicantId });
    } else {
        await db.collection("applicants").doc(applicantId).update({
            lastActivityAt: firestore.Timestamp.now(),
        });
    }

    // 2. Write `events` entry: "application_submitted"
    const event: Event = {
      type: "application_submitted",
      entityType: "application",
      entityId: context.params.applicationId,
      metadata: { jobId, applicantId },
      createdAt: firestore.Timestamp.now(),
    };
    await db.collection("events").add(event);

    // 3. Increment job rollup
    const jobRef = db.collection("jobs").doc(jobId);
    await db.runTransaction(async (transaction) => {
      const jobDoc = await transaction.get(jobRef);
      if (!jobDoc.exists) {
        return;
      }

      const job = jobDoc.data() as Job;
      const newStats = {
        applicantsCount: (job.stats?.applicantsCount || 0) + 1,
        statusCounts: {
          ...(job.stats?.statusCounts || {}),
          NEW: ((job.stats?.statusCounts?.NEW || 0) + 1),
        },
      };

      transaction.update(jobRef, { stats: newStats });
    });

    // 4. If referral refCode exists, increment referrals.submitsCount
    if (source?.type === "referral" && source.refCode) {
      const referralsRef = db.collection("referrals").where("code", "==", source.refCode);
      const snapshot = await referralsRef.get();

      if (!snapshot.empty) {
        const referralDoc = snapshot.docs[0];
        await referralDoc.ref.update({
            submitsCount: firestore.FieldValue.increment(1)
        });
      }
    }
  });
