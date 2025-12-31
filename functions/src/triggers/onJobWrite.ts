import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";

export const onJobWrite = functions.firestore
  .document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const job = change.after.data();

    const publicJobRef = firestore().collection("jobPublic").doc(jobId);

    if (job?.status === "open") {
      // If the job is open, create or update the public projection
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
      // If the job is not open, delete the public projection
      await publicJobRef.delete();
    }
  });
