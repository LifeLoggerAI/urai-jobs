import * as functions from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { JobPosting, JobPublic, Application, Applicant } from "./jobs/types";

const db = getFirestore();

export const onJobWrite = functions.firestore
  .document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { jobId } = context.params;

    // If the job is deleted, delete the public job posting
    if (!change.after.exists) {
      const publicJobRef = db.collection("jobPublic").doc(jobId);
      try {
        await publicJobRef.delete();
        console.log(`Deleted public job ${jobId} because source job was deleted.`);
      } catch (error) {
        console.error(`Error deleting public job ${jobId}`, error);
      }
      return;
    }

    const job = change.after.data() as JobPosting;
    const publicJobRef = db.collection("jobPublic").doc(jobId);

    if (job.status === "open") {
      // If the job is open, create or update the public job posting
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

      try {
        await publicJobRef.set(publicJob, { merge: true });
        console.log(`Upserted public job ${jobId}.`);
      } catch (error) {
        console.error(`Error upserting public job ${jobId}`, error);
      }
    } else {
      // If the job is not open, delete the public job posting
      try {
        await publicJobRef.delete();
        console.log(`Deleted public job ${jobId} because status is now '${job.status}'.`);
      } catch (error) {
        // It's okay if the delete fails because the doc doesn't exist.
        if (error.code !== "not-found") {
          console.error(`Error deleting public job ${jobId}`, error);
        }
      }
    }
  });

export const onApplicationCreate = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const application = snap.data() as Application;
    const { applicationId } = context.params;
    const { jobId, applicantEmail, applicantId } = application;

    const batch = db.batch();

    // 1. Create or merge applicant
    const applicantRef = db.collection("applicants").doc(applicantId);
    batch.set(applicantRef, { lastActivityAt: snap.createTime }, { merge: true });

    // 2. Log event
    const eventRef = db.collection("events").doc();
    batch.set(eventRef, {
      type: "apply_submit",
      entityType: "application",
      entityId: applicationId,
      createdAt: snap.createTime,
    });

    // 3. Update job stats
    const jobRef = db.collection("jobs").doc(jobId);
    batch.update(jobRef, {
        "stats.applicantsCount": FieldValue.increment(1),
        [`stats.statusCounts.${application.status}`]: FieldValue.increment(1),
    });

    // 4. Handle referrals
    // This is a placeholder for the referral logic. 
    // A more robust implementation would be needed in a real-world scenario.

    console.log(`Application ${applicationId} processed.`);

    await batch.commit();
  });

