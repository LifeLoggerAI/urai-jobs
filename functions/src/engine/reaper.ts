
import * as admin from "firebase-admin";
import { pubsub } from "firebase-functions";
import { Job } from "../types";
import { failJob } from "./lifecycle";

const db = admin.firestore();

export const reapStuckJobs = pubsub
  .schedule("every 5 minutes")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const stuckJobs = await db
      .collection("jobs")
      .where("status", "==", "RUNNING")
      .where("leaseExpiresAt", "<", now)
      .get();

    if (stuckJobs.empty) {
      console.log("No stuck jobs found.");
      return;
    }

    console.log(`Found ${stuckJobs.size} stuck jobs. Reaping...`);

    for (const jobDoc of stuckJobs.docs) {
      const job = jobDoc.data() as Job;
      const runs = await jobDoc.ref.collection("runs").orderBy("startedAt", "desc").limit(1).get();
      const lastRun = runs.docs[0];

      await failJob(jobDoc.id, job, lastRun.id, new Error("Job timed out."));
    }
  });
