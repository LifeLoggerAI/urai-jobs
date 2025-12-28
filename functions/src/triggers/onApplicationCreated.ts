import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { enqueue } from "../jobs/enqueue";

export const onApplicationCreated = functions.firestore
  .document("applications/{applicationId}")
  .onCreate(async (snap) => {
    const application = snap.data();
    const { jobId, name, email } = application;

    const job = await admin.firestore().collection("jobs").doc(jobId).get();
    const { recruiterId } = job.data() as any;

    const recruiter = await admin.auth().getUser(recruiterId);
    const recruiterEmail = recruiter.email;

    if (!recruiterEmail) {
      console.error(`Recruiter ${recruiterId} for job ${jobId} has no email`);
      return;
    }

    await enqueue("email.send", {
      to: recruiterEmail,
      subject: `New application for ${job.data()?.title}`,
      text: `You have a new application from ${name} (${email}).`,
    });
  });
