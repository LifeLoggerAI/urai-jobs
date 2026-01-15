
import * as functions from "firebase-functions";
import { firestore } from "../lib/firebase";
import { Application } from "../types";

export const onApplicationCreate = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap, context) => {
    const application = snap.data() as Application;
    const { jobId, applicantId, applicantEmail } = application;

    // TODO: Create/merge applicant

    // Create event
    await firestore.collection("events").add({
      type: "application_submitted",
      entityType: "application",
      entityId: context.params.applicationId,
      metadata: { jobId, applicantId, applicantEmail },
      createdAt: new Date(),
    });

    // Increment job stats
    const jobRef = firestore.collection("jobs").doc(jobId);
    const jobDoc = await jobRef.get();
    if (jobDoc.exists) {
      const job = jobDoc.data();
      const newStatus = application.status;
      const newStatusCount = (job.stats?.statusCounts?.[newStatus] || 0) + 1;

      await jobRef.update({
        "stats.applicantsCount": (job.stats?.applicantsCount || 0) + 1,
        [`stats.statusCounts.${newStatus}`]: newStatusCount,
      });
    }

    // TODO: If referral refCode exists, increment referrals.submitsCount
  });
