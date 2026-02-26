import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Job, JobPublic } from "../../../packages/model/src/lib/model";

const db = admin.firestore();

/**
 * Triggered on write to any job document in any organization.
 *
 * This function maintains the denormalized `jobPublic` collection, which is a
 * read-only, public-facing view of jobs that are currently "open".
 *
 * - If a job's status is "open", it creates/updates a public version of the job.
 * - If a job's status is not "open" (e.g., "draft", "closed") or the job is
 *   deleted, it removes the public version.
 */
export const onJobWrite = functions.firestore
  .document("orgs/{orgId}/jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { orgId, jobId } = context.params;
    const publicJobRef = db.doc(`orgs/${orgId}/jobPublic/${jobId}`);

    // If the job is deleted, delete the public job doc.
    if (!change.after.exists) {
      try {
        await publicJobRef.delete();
        functions.logger.log(
          `[onJobWrite] Deleted public job ${jobId} for org ${orgId} because source job was deleted.`
        );
      } catch (error) {
        // If the public doc doesn't exist, we don't need to do anything.
        if ((error as { code: string }).code !== "not-found") {
          functions.logger.error(
            `[onJobWrite] Failed to delete public job ${jobId} for org ${orgId}.`,
            error
          );
        }
      }
      return;
    }

    const job = change.after.data() as Job;

    // If the job status is "open", create or update the public job doc.
    if (job.status === "open") {
      const publicJobData: JobPublic = {
        title: job.title,
        department: job.department,
        locationType: job.locationType,
        locationText: job.locationText,
        employmentType: job.employmentType,
        descriptionMarkdown: job.descriptionMarkdown,
        requirements: job.requirements || [],
        niceToHave: job.niceToHave || [],
        // Conditionally add compensationRange only if it exists
        ...(job.compensationRange && {
          compensationRange: job.compensationRange,
        }),
        orgId: orgId,
        updatedAt: job.updatedAt,
      };

      try {
        await publicJobRef.set(publicJobData, { merge: true });
        functions.logger.log(
          `[onJobWrite] Published job ${jobId} for org ${orgId} to public collection.`
        );
      } catch (error) {
        functions.logger.error(
          `[onJobWrite] Failed to set public job ${jobId} for org ${orgId}.`,
          error
        );
      }
    } else {
      // If the job is not "open" (e.g., "draft", "closed"), delete the public job doc.
      try {
        await publicJobRef.delete();
        functions.logger.log(
          `[onJobWrite] Unpublished job ${jobId} for org ${orgId} because status is now '${job.status}'.`
        );
      } catch (error) {
        // If the public doc doesn't exist, we don't need to do anything.
        if ((error as { code: string }).code !== "not-found") {
          functions.logger.error(
            `[onJobWrite] Failed to unpublish job ${jobId} for org ${orgId}.`,
            error
          );
        }
      }
    }
  });