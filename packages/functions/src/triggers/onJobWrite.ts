import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { Job } from "../../../types";

const db = getFirestore();

export const onjobwrite = onDocumentWritten("jobs/{jobId}", async (event) => {
  const job = event.data?.after.data() as Job | undefined;
  const jobId = event.params.jobId;

  if (job && job.status === "open") {
    const { 
      // Fields to exclude from the public projection
      status,
      internal, 
      notesCount,
      compensationRange,
      createdBy,
      ...publicJob 
    } = job;

    await db.collection("jobPublic").doc(jobId).set(publicJob, { merge: true });

  } else {
    // If the job is not open, delete the public doc.
    await db.collection("jobPublic").doc(jobId).delete();
  }
});
