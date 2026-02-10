


import * as logger from "firebase-functions/logger";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { Job, JobPublic } from "../../../packages/types/src";

const db = getFirestore();

export const onjobwrite = onDocumentWritten("jobs/{jobId}", async (event) => {
  const jobId = event.params.jobId;
  logger.info(`Processing job write for jobId: ${jobId}`, { structuredData: true });

  const jobAfter = event.data?.after.data() as Job | undefined;
  const jobBefore = event.data?.before.data() as Job | undefined;

  const jobPublicRef = db.collection("jobPublic").doc(jobId);

  // If the job is deleted, delete the public job posting
  if (!jobAfter) {
    logger.info(`Job ${jobId} deleted. Deleting public job.`);
    await jobPublicRef.delete();
    return;
  }

  // If the job is not open, delete the public job posting
  if (jobAfter.status !== "open") {
    // If a public doc exists, delete it.
    if (jobBefore?.status === "open") {
      logger.info(
        `Job ${jobId} status changed from 'open' to '${jobAfter.status}'. Deleting public job.`
      );
      await jobPublicRef.delete();
    }
    return;
  }

  // If the job is open, create or update the public job posting
  logger.info(`Job ${jobId} is open. Syncing to jobPublic collection.`);
  const {
    title,
    department,
    locationType,
    locationText,
    employmentType,
    descriptionMarkdown,
    requirements,
    niceToHave,
    compensationRange,
    updatedAt,
  } = jobAfter;

  const jobPublicData: JobPublic = {
    title,
    department,
    locationType,
    locationText,
    employmentType,
    descriptionMarkdown,
    requirements,
    niceToHave,
    compensationRange,
    status: "open",
    updatedAt,
  };

  await jobPublicRef.set(jobPublicData, { merge: true });
  logger.info(`Successfully synced job ${jobId} to public collection.`);
});
