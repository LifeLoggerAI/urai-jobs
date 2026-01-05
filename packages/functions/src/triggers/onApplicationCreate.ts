import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { Application, Applicant } from "../../../types";
import { createHash } from "crypto";

const db = getFirestore();

export const onapplicationcreate = onDocumentCreated("applications/{applicationId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    return;
  }

  const application = snap.data() as Application;
  const { jobId, applicantEmail } = application;
  let { applicantId } = application;

  const now = FieldValue.serverTimestamp();

  // 1. Create or merge applicant
  if (!applicantId) {
    const hash = createHash('sha256').update(applicantEmail.toLowerCase()).digest('hex');
    applicantId = hash;
    const applicantRef = db.collection("applicants").doc(applicantId);
    const applicantSnap = await applicantRef.get();

    if (!applicantSnap.exists) {
      const newApplicant: Partial<Applicant> = {
        primaryEmail: applicantEmail,
        createdAt: now as any,
        updatedAt: now as any,
        lastActivityAt: now as any,
      };
      await applicantRef.set(newApplicant, { merge: true });
    }
    // Update the application with the applicantId
    await snap.ref.update({ applicantId: applicantId, updatedAt: now });
  }

  // 2. Write application submitted event
  await db.collection("events").add({
    type: "application_submitted",
    entityType: "application",
    entityId: snap.id,
    metadata: {
      jobId,
      applicantId: applicantId,
    },
    createdAt: now,
  });

  // 3. Increment job stats
  const jobRef = db.collection("jobs").doc(jobId);
  await jobRef.update({
    "stats.applicantsCount": FieldValue.increment(1),
    "stats.statusCounts.NEW": FieldValue.increment(1),
    "updatedAt": now,
  });

  // 4. Handle referral
  const applicantRef = db.collection("applicants").doc(applicantId);
  const applicantSnap = await applicantRef.get();
  const applicant = applicantSnap.data() as Applicant;

  if (applicant.source && applicant.source.type === "referral" && applicant.source.refCode) {
    const referralRef = db.collection("referrals").doc(applicant.source.refCode);
    await referralRef.update({
      submitsCount: FieldValue.increment(1),
    });
  }
});
