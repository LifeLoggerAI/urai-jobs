import { firestore } from "firebase-functions";
import * as admin from "firebase-admin";

try {
  admin.initializeApp();
} catch (e) {
  // Gracefully handle repeated initializations
}

export const onJobWrite = firestore.document("jobs/{jobId}").onWrite(async (change, context) => {
  const { jobId } = context.params;
  const db = admin.firestore();

  const jobPublicRef = db.collection("jobPublic").doc(jobId);

  // If the job is deleted, ensure its public counterpart is also deleted.
  if (!change.after.exists) {
    return jobPublicRef.delete();
  }

  const jobData = change.after.data();

  // Only if the job status is 'open' should a public record exist.
  if (jobData?.status === "open") {
    const publicData = {
      title: jobData.title,
      department: jobData.department,
      locationType: jobData.locationType,
      locationText: jobData.locationText,
      employmentType: jobData.employmentType,
      descriptionMarkdown: jobData.descriptionMarkdown,
      requirements: jobData.requirements || [],
      niceToHave: jobData.niceToHave || [],
      compensationRange: jobData.compensationRange || {},
      createdAt: jobData.createdAt,
      updatedAt: jobData.updatedAt,
    };
    // Create or update the public job document.
    return jobPublicRef.set(publicData, { merge: true });
  } else {
    // If the job is not 'open' (e.g., 'draft', 'closed'), delete the public record.
    return jobPublicRef.delete();
  }
});
