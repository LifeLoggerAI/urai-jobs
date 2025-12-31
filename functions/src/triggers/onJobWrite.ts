import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const onJobWrite = functions.firestore
  .document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const jobPublicRef = db.collection("jobPublic").doc(jobId);

    const jobData = change.after.data();

    if (jobData && jobData.status === "open") {
      // The job is open, so create or update the public projection.
      const publicData = {
        title: jobData.title,
        department: jobData.department,
        locationType: jobData.locationType,
        locationText: jobData.locationText,
        employmentType: jobData.employmentType,
        descriptionMarkdown: jobData.descriptionMarkdown,
        requirements: jobData.requirements,
        niceToHave: jobData.niceToHave,
        compensationRange: jobData.compensationRange,
        status: jobData.status,
        createdAt: jobData.createdAt,
        updatedAt: jobData.updatedAt,
      };

      return jobPublicRef.set(publicData, { merge: true });
    } else {
      // The job is not open, so delete the public projection.
      return jobPublicRef.delete();
    }
  });
