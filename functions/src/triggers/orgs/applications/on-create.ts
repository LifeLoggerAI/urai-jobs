import * as functions from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "crypto";
import { Application } from "../../../../packages/types/src";

// Placeholder for a function that calls an AI model to generate a summary.
async function generateAiSummary(application: Application): Promise<string> {
  try {
    const summary = `AI Summary for ${application.applicantEmail}: This is a placeholder summary.`;
    return Promise.resolve(summary);
  } catch (error) {
    functions.logger.error("AI summary generation failed", { error });
    return "AI summary could not be generated."; // Fallback summary
  }
}

export const onCreate = functions.firestore
  .document("orgs/{orgId}/applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const { orgId, applicationId } = context.params;
    const db = getFirestore();
    const application = snap.data() as Application;

    const batch = db.batch();

    // 1. Generate AI Summary
    const summary = await generateAiSummary(application);
    batch.update(snap.ref, { "internal.aiSummary": summary });

    // 2. Create or merge applicant
    const email = application.applicantEmail.toLowerCase();
    // Create an org-specific applicant ID to prevent cross-org data leakage
    const applicantId = createHash("sha256").update(`${orgId}_${email}`).digest("hex");

    const applicantRef = db.collection("orgs").doc(orgId).collection("applicants").doc(applicantId);
    const applicantSnap = await applicantRef.get();

    if (applicantSnap.exists) {
      batch.update(applicantRef, { lastActivityAt: FieldValue.serverTimestamp() });
    } else {
      batch.set(applicantRef, {
        primaryEmail: email,
        name: "", // Name should be part of the applicant profile, not application answers
        lastActivityAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        source: application.source,
      });
    }
    // Ensure the application document has the correct applicantId
    batch.update(snap.ref, { applicantId });

    // 3. Write event entry
    const eventRef = db.collection("orgs").doc(orgId).collection("events").doc();
    batch.set(eventRef, {
      type: "application_submitted",
      entityType: "application",
      entityId: applicationId,
      metadata: { jobId: application.jobId },
      createdAt: FieldValue.serverTimestamp(),
    });

    // 4. Increment job stats
    const jobRef = db.collection("orgs").doc(orgId).collection("jobs").doc(application.jobId);
    batch.update(jobRef, {
      "stats.applicantsCount": FieldValue.increment(1),
      [`stats.statusCounts.NEW`]: FieldValue.increment(1),
    });

    // 5. Handle referral
    if (application.source?.type === "referral" && application.source?.refCode) {
      const referralRef = db.collection("orgs").doc(orgId).collection("referrals").doc(application.source.refCode);
      batch.update(referralRef, { submitsCount: FieldValue.increment(1) });
    }

    await batch.commit();
  });
