import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";

export const dailyDigest = functions.pubsub.schedule("every 24 hours").onRun(async (context) => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const newApplications = await firestore()
    .collection("applications")
    .where("submittedAt", ">=", yesterday)
    .get();

  const jobs = await firestore().collection("jobs").get();
  const jobsById = new Map(jobs.docs.map(doc => [doc.id, doc.data()]));

  const summary = newApplications.docs.map(doc => {
    const app = doc.data();
    const job = jobsById.get(app.jobId);
    return {
      applicationId: doc.id,
      applicantEmail: app.applicantEmail,
      jobTitle: job?.title,
      submittedAt: app.submittedAt.toDate().toISOString(),
    };
  });

  if (summary.length > 0) {
    const webhookUrl = functions.config().digest.webhook_url;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
    }
  }
});
