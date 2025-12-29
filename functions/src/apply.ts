// This file defines the backend function for handling job applications.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Ensure Firebase is initialized, but only once.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// This is a v2 HTTP Callable function.
export const secureApply = onCall(async (request) => {
  const { jobId, name, email, resume } = request.data;
  if (!jobId || !name || !email || !resume) {
    throw new HttpsError('invalid-argument', 'Missing required application fields.');
  }

  console.log(`Received application for job ${jobId} from ${email}`);

  try {
    // 1. Save the application to a new 'applications' collection.
    const applicationRef = await db.collection("applications").add({
      jobId: jobId,
      name: name,
      email: email,
      resume: resume,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'new',
    });

    console.log(`Application saved with ID: ${applicationRef.id}`);

    // 2. Trigger the resume analysis job.
    const runRef = db.collection("jobRuns").doc();
    await runRef.set({
      jobId: "resume-analysis-job", // The ID of the job definition in Firestore
      state: "queued",
      attempt: 1,
      idempotencyKey: runRef.id,
      triggeredBy: "human",
      payload: {
        applicationId: applicationRef.id, // Pass the ID to link back
        resumeText: resume,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      scheduledAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Queued resume analysis job with run ID: ${runRef.id}`);

    return { status: "success", message: "Application received!", applicationId: applicationRef.id };

  } catch (error) {
    console.error("Error processing application:", error);
    throw new HttpsError('internal', 'Failed to process application.');
  }
});
