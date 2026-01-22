import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const onJobWrite = functions.firestore
  .document("jobs/{jobId}")
  .onWrite(async (change, context) => {
    const { jobId } = context.params;
    const publicJobRef = db.collection("jobPublic").doc(jobId);

    const jobDataAfter = change.after.data();

    // If job is deleted or status is not 'open', delete the public job doc
    if (!jobDataAfter || jobDataAfter.status !== 'open') {
      try {
        await publicJobRef.delete();
        console.log(`Deleted public job: ${jobId}`);
      } catch (error) {
        console.error(`Error deleting public job ${jobId}:`, error);
      }
      return;
    }

    // If job is 'open', create or update the public job doc
    const publicJobData = {
      title: jobDataAfter.title,
      department: jobDataAfter.department,
      locationType: jobDataAfter.locationType,
      locationText: jobDataAfter.locationText,
      employmentType: jobDataAfter.employmentType,
      descriptionMarkdown: jobDataAfter.descriptionMarkdown,
      requirements: jobDataAfter.requirements,
      niceToHave: jobDataAfter.niceToHave,
      // Ensure no sensitive data is included
    };

    try {
      await publicJobRef.set(publicJobData, { merge: true });
      console.log(`Set public job: ${jobId}`);
    } catch (error) {
      console.error(`Error setting public job ${jobId}:`, error);
    }
  });
