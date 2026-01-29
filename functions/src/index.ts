import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Main API gateway for all HTTP requests.
export const api = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*"); // Allow CORS for health check
  if (req.path.startsWith("/health")) {
    res.status(200).json({ok: true, service: "urai-jobs", ts: new Date().toISOString()});
    return;
  }
  // All other routes are 404
  res.status(404).json({error: "Not Found"});
});

/**
 * Trigger to maintain the public projection of a job posting.
 * If a job is 'open', its public data is copied to `jobPublic`.
 * Otherwise, the public doc is deleted.
 */
export const onJobWrite = functions.firestore
    .document("jobs/{jobId}")
    .onWrite(async (change, context) => {
      const {jobId} = context.params;
      const jobPublicRef = db.collection("jobPublic").doc(jobId);

      const jobData = change.after.data();

      // If job is deleted or status is not 'open', delete the public doc.
      if (!change.after.exists || jobData?.status !== "open") {
        return jobPublicRef.delete();
      }

      // If job is 'open', create/update the public doc.
      const publicData = {
        title: jobData.title,
        department: jobData.department,
        locationType: jobData.locationType,
        employmentType: jobData.employmentType,
        descriptionMarkdown: jobData.descriptionMarkdown?.substring(0, 200) || "",
        updatedAt: jobData.updatedAt,
      };

      return jobPublicRef.set(publicData, {merge: true});
    });

// Placeholder for future callable function
export const createResumeUploadUrl = functions.https.onCall(async (data, context) => {
    // Check auth, validate data, generate signed URL, return it
    // Example: https://firebase.google.com/docs/storage/admin/generate-signed-url
    return {message: "Not implemented yet"};
});


export { health } from "./health";
export { health } from "./health";
