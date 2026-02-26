import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { Job } from "../../../../packages/types/src";

/**
 * Triggered on write to a job document in an organization.
 * Manages the public projection of the job in the `jobPublic` collection.
 */
export const onWrite = functions.firestore
  .document("orgs/{orgId}/jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { orgId, jobId } = context.params;
    const db = getFirestore();

    const jobPublicRef = db.collection("orgs").doc(orgId).collection("jobPublic").doc(jobId);

    const job = change.after.data() as Job | undefined;

    if (job && job.status === "open") {
      // If the job is open, create or update the public projection.
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
        updatedAt: job.updatedAt,
      };
      await jobPublicRef.set(publicJob, { merge: true });
    } else {
      // If the job is not open, delete the public projection.
      await jobPublicRef.delete();
    }
  });
