import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const onJobWrite = functions.firestore
  .document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const job = change.after.data();

    const publicJobRef = admin.firestore().collection("jobPublic").doc(jobId);

    if (job && job.status === "open") {
      const publicJob = {
        title: job.title,
        department: job.department,
        locationType: job.locationType,
        locationText: job.locationText,
        employmentType: job.employmentType,
        descriptionMarkdown: job.descriptionMarkdown,
        requirements: job.requirements,
        niceToHave: job.niceToHave,
        compensationRange: job.compensationRange,
      };
      await publicJobRef.set(publicJob, { merge: true });
    } else {
      await publicJobRef.delete();
    }
  });
