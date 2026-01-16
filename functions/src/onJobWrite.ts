import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const onJobWrite = functions.firestore
  .document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const jobData = change.after.data();
    const jobId = context.params.jobId;
    const publicJobRef = admin.firestore().collection("jobPublic").doc(jobId);

    if (jobData && jobData.status === "open") {
      const publicJobData = {
        title: jobData.title,
        department: jobData.department,
        locationType: jobData.locationType,
        locationText: jobData.locationText,
        employmentType: jobData.employmentType,
        descriptionMarkdown: jobData.descriptionMarkdown,
        requirements: jobData.requirements,
        niceToHave: jobData.niceToHave,
        compensationRange: jobData.compensationRange,
      };
      await publicJobRef.set(publicJobData, { merge: true });
    } else {
      await publicJobRef.delete();
    }
  });
