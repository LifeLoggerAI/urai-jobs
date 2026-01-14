import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Job, JobPublic } from "./models";

const db = admin.firestore();

export const onJobWrite = functions.firestore
  .document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const jobPublicRef = db.collection("jobPublic").doc(jobId);

    const jobAfter = change.after.data() as Job | undefined;

    // If job is deleted or status is not 'open', delete the public doc.
    if (!jobAfter || jobAfter.status !== "open") {
      try {
        await jobPublicRef.delete();
        functions.logger.info(`Deleted public job: ${jobId}`);
      } catch (error) {
        // Ignore if the doc doesn't exist
        if ((error as any).code !== 'not-found') {
          functions.logger.error(`Error deleting public job ${jobId}:`, error);
        }
      }
      return;
    }

    // If job is 'open', create/update the public-facing document.
    const { createdBy, ...restOfJob } = jobAfter;
    const publicJob: JobPublic = {
      ...restOfJob,
      status: "open", // Ensure status is explicitly open
      updatedAt: jobAfter.updatedAt, // Carry over the update time
    };

    functions.logger.info(`Updating public job: ${jobId}`);
    await jobPublicRef.set(publicJob, { merge: true });
  });
