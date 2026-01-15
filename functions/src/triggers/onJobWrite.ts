
import * as functions from "firebase-functions";
import { firestore } from "../lib/firebase";
import { Job, JobPublic } from "../types";

export const onJobWrite = functions.firestore
  .document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const job = change.after.data() as Job;

    if (job && job.status === "open") {
      const jobPublic: JobPublic = {
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

      await firestore.collection("jobPublic").doc(jobId).set(jobPublic);
    } else {
      await firestore.collection("jobPublic").doc(jobId).delete();
    }
  });
