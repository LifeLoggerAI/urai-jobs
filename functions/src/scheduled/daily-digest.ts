import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Application } from "../../../packages/model/src/lib/model";

const db = admin.firestore();

/**
 * A scheduled function that runs daily to generate a digest of activity for each org.
 *
 * This function is triggered by a Cloud Scheduler job (via a Pub/Sub topic) and
 * is responsible for aggregating key metrics from the previous day.
 *
 * For each organization, it calculates:
 * - The number of new applications in the last 24 hours.
 * - The total number of applications pending review ("NEW" or "SCREEN").
 * - A list of the top 5 jobs by application volume in the last 24 hours.
 *
 * It then writes this summary to a new document in the `digests` sub-collection,
 * named with the date (YYYY-MM-DD).
 */
export const scheduledDailyDigest = functions.pubsub
  .topic("daily-tick") // This topic should be created and targeted by Cloud Scheduler
  .onPublish(async (message) => {
    functions.logger.log("[scheduledDailyDigest] Starting daily digest generation.");

    const orgsSnapshot = await db.collection("orgs").get();
    if (orgsSnapshot.empty) {
      functions.logger.log("[scheduledDailyDigest] No organizations found. Exiting.");
      return;
    }

    const allPromises = orgsSnapshot.docs.map((orgDoc) => {
      return generateDigestForOrg(orgDoc.id);
    });

    await Promise.all(allPromises);
    functions.logger.log("[scheduledDailyDigest] Finished generating digests for all orgs.");
  });

async function generateDigestForOrg(orgId: string) {
  try {
    functions.logger.log(`[scheduledDailyDigest] Generating digest for org: ${orgId}`);
    const now = new Date();
    const twentyFourHoursAgo = admin.firestore.Timestamp.fromMillis(
      now.getTime() - 24 * 60 * 60 * 1000
    );

    const applicationsRef = db.collection(`orgs/${orgId}/applications`);

    // 1. Get new applications in the last 24 hours
    const newAppsSnapshot = await applicationsRef
      .where("submittedAt", ">=", twentyFourHoursAgo)
      .get();
    const newApplicationsCount = newAppsSnapshot.size;

    // 2. Get counts for pending statuses
    const newStatusSnapshot = await applicationsRef.where("status", "==", "NEW").count().get();
    const screenStatusSnapshot = await applicationsRef.where("status", "==", "SCREEN").count().get();
    const pendingReviewCount = newStatusSnapshot.data().count + screenStatusSnapshot.data().count;

    // 3. Aggregate top jobs from new applications
    const jobCounts: { [jobId: string]: { count: number; title: string } } = {};
    for (const doc of newAppsSnapshot.docs) {
        const app = doc.data() as Application;
        if (jobCounts[app.jobId]) {
            jobCounts[app.jobId].count++;
        } else {
            // Fetch job title for the first occurrence
            const jobDoc = await db.doc(`orgs/${orgId}/jobs/${app.jobId}`).get();
            const jobTitle = jobDoc.exists ? jobDoc.data()?.title : "Unknown Job";
            jobCounts[app.jobId] = { count: 1, title: jobTitle };
        }
    }
    const topJobs = Object.entries(jobCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([jobId, data]) => ({ jobId, ...data }));


    // 4. Create the digest document
    const dateString = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const digestRef = db.doc(`orgs/${orgId}/digests/${dateString}`);

    await digestRef.set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      newApplicationsCount,
      pendingReviewCount,
      topJobs,
    });

    functions.logger.log(`[scheduledDailyDigest] Successfully created digest for org: ${orgId}`);
  } catch (error) {
    functions.logger.error(
      `[scheduledDailyDigest] Failed to generate digest for org: ${orgId}`,
      error
    );
  }
}
