import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";
import { Job, JobPublic } from "./models";

export const onJobWrite = functions.firestore
  .document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const db = firestore();

    const job = change.after.data() as Job | undefined;

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
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };

      await db.collection("jobPublic").doc(jobId).set(jobPublic);
    } else {
      await db.collection("jobPublic").doc(jobId).delete();
    }
  });
