
import * as logger from "firebase-functions/logger";
import { firestore } from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Application, Applicant } from "../../../packages/types/src";
import * as crypto from "crypto";

const db = getFirestore();

// Function to create a deterministic applicantId from an email address.
const createApplicantId = (email: string) => {
  return crypto.createHash("md5").update(email.toLowerCase()).digest("hex");
};

export const onapplicationcreate = onDocumentCreated(
  "applications/{applicationId}",
  async (event) => {
    const application = event.data?.data() as Application;
    const { applicantEmail, jobId, source } = application;

    if (!applicantEmail || !jobId) {
      logger.error("Application missing critical data", { event });
      return;
    }

    const applicantId = createApplicantId(applicantEmail);
    const applicantRef = db.collection("applicants").doc(applicantId);
    const now = firestore.Timestamp.now();

    logger.info(`Processing new application for ${applicantEmail} for job ${jobId}`);

    // 1. Create or merge applicant
    const applicantDoc = await applicantRef.get();
    if (applicantDoc.exists) {
      await applicantRef.update({ lastActivityAt: now });
    } else {
      const newApplicant: Applicant = {
        primaryEmail: applicantEmail.toLowerCase(),
        name: application.answers["name"] || "", // Assuming name is a form answer
        links: {},
        source: source || { type: "direct" },
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };
      await applicantRef.set(newApplicant);
      logger.info(`Created new applicant profile for ${applicantEmail}`);
    }

    // 2. Write "application_submitted" event
    await db.collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: event.params.applicationId,
      metadata: { jobId, applicantId },
      createdAt: now,
    });

    // 3. Increment job stats using a transaction
    const jobRef = db.collection("jobs").doc(jobId);
    await db.runTransaction(async (transaction) => {
      transaction.update(jobRef, {
        "stats.applicantsCount": FieldValue.increment(1),
        "stats.statusCounts.NEW": FieldValue.increment(1),
      });
    });

    // 4. If it was a referral, increment the referral counter
    if (source?.type === "referral" && source.refCode) {
      const referralRef = db.collection("referrals").doc(source.refCode);
      const referralDoc = await referralRef.get();
      if (referralDoc.exists) {
        await referralRef.update({ submitsCount: FieldValue.increment(1) });
        logger.info(`Incremented submitsCount for referral code: ${source.refCode}`);
      }
    }
  }
);
