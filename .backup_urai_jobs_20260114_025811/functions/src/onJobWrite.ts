import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Job, JobPublic } from "./models";

const db = admin.firestore();

/**
 * Triggered on write to a job document.
 * Syncs the job to the `jobPublic` collection for public read access.
 */
export const onJobWrite = functions.firestore
  .document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const jobPublicRef = db.collection("jobPublic").doc(jobId);

    const jobAfter = change.after.data() as Job | undefined;

    // If job is deleted or is not open, delete the public doc
    if (!jobAfter || jobAfter.status !== "open") {
      const publicDoc = await jobPublicRef.get();
      if (publicDoc.exists) {
        functions.logger.log(`Deleting public job: ${jobId}`);
        await jobPublicRef.delete();
      }
      return;
    }

    // If job is open, create/update the public doc
    const publicJob: JobPublic = {
      title: jobAfter.title,
      department: jobAfter.department,
      locationType: jobAfter.locationType,
      locationText: jobAfter.locationText,
      employmentType: jobAfter.employmentType,
      descriptionMarkdown: jobAfter.descriptionMarkdown,
      requirements: jobAfter.requirements,
      niceToHave: jobAfter.niceToHave,
      compensationRange: jobAfter.compensationRange,
      status: 'open', // Explicitly set to open
      updatedAt: jobAfter.updatedAt,
    };

    functions.logger.log(`Updating public job: ${jobId}`, { publicJob });
    await jobPublicRef.set(publicJob, { merge: true });
  });
