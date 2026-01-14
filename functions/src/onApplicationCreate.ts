import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Application, Applicant } from "./models";

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

export const onApplicationCreate = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const application = snap.data() as Application;
    const { applicantEmail, jobId, source } = application;
    const now = FieldValue.serverTimestamp();

    // Use a transaction to safely find/create the applicant and update stats.
    await db.runTransaction(async (transaction) => {
      // 1. Find or create the applicant
      const applicantsRef = db.collection("applicants");
      const applicantQuery = applicantsRef.where("primaryEmail", "==", applicantEmail).limit(1);
      const applicantSnap = await transaction.get(applicantQuery);

      let applicantId: string;
      if (applicantSnap.empty) {
        // Create a new applicant
        const newApplicantRef = applicantsRef.doc(); // Auto-generate ID
        applicantId = newApplicantRef.id;
        const newApplicant: Applicant = {
          primaryEmail: applicantEmail,
          name: "", // Name can be updated later by admin
          source: application.source || { type: "direct" },
          createdAt: now,
          updatedAt: now,
          lastActivityAt: now,
        };
        transaction.set(newApplicantRef, newApplicant);
        functions.logger.info(`New applicant created: ${applicantId} for ${applicantEmail}`);
      } else {
        // Update existing applicant
        const applicantRef = applicantSnap.docs[0].ref;
        applicantId = applicantRef.id;
        transaction.update(applicantRef, { lastActivityAt: now });
        functions.logger.info(`Existing applicant found: ${applicantId}`);
      }

      // We must update the newly created application with the final applicantId
      transaction.update(snap.ref, { applicantId });

      // 2. Increment job stats
      const jobRef = db.collection("jobs").doc(jobId);
      transaction.update(jobRef, {
        "stats.applicantCount": FieldValue.increment(1),
        [`stats.statusCounts.NEW`]: FieldValue.increment(1),
      });

      // 3. Increment referral stats if applicable
      if (source?.type === 'referral' && source.refCode) {
        const referralRef = db.collection("referrals").doc(source.refCode);
        transaction.update(referralRef, { submitsCount: FieldValue.increment(1) });
      }
    });

    // 4. Write tracking event (outside of transaction)
    await db.collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: snap.id,
      metadata: { jobId },
      createdAt: now,
    });
  });
