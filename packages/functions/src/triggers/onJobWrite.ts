// @ts-nocheck
import {firestore} from "firebase-functions";
import {db} from "../firebase";
import {Job, JobPublic} from "../types";

export const onJobWrite = firestore.document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const {jobId} = context.params;
    const job = change.after.exists ? (change.after.data() as Job) : null;

    const publicJobRef = db.collection("jobPublic").doc(jobId);

    if (job && job.status === "open") {
      console.log(`Job ${jobId} is open, updating public listing.`);
      const publicJob: JobPublic = {
        title: job.title,
        department: job.department,
        locationType: job.locationType,
        locationText: job.locationText,
        employmentType: job.employmentType,
        descriptionMarkdown: job.descriptionMarkdown,
        requirements: job.requirements,
        niceToHave: job.niceToHave,
        compensationRange: job.compensationRange,
        status: "open",
        updatedAt: job.updatedAt,
      };
      await publicJobRef.set(publicJob, {merge: true});
    } else {
      console.log(`Job ${jobId} is not open, deleting public listing.`);
      await publicJobRef.delete();
    }
  });
