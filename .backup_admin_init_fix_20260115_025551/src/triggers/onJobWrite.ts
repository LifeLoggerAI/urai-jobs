import { firestore } from "firebase-functions/v2";
import {getFirestore} from "firebase-admin/firestore";
import { Job, JobPublic } from "../models";

const db = getFirestore();

export const onjobwrite = firestore.onDocumentWritten("jobs/{jobId}", async (event) => {
  const beforeData = event.data?.before.data() as Job | undefined;
  const afterData = event.data?.after.data() as Job | undefined;
  const jobId = event.params.jobId;

  const jobPublicRef = db.collection("jobPublic").doc(jobId);

  if (afterData?.status === "open") {
    const jobPublic: JobPublic = {
      title: afterData.title,
      department: afterData.department,
      locationType: afterData.locationType,
      locationText: afterData.locationText,
      employmentType: afterData.employmentType,
      descriptionMarkdown: afterData.descriptionMarkdown,
      requirements: afterData.requirements,
      niceToHave: afterData.niceToHave,
      compensationRange: afterData.compensationRange,
      status: "open",
      createdAt: afterData.createdAt as any,
      updatedAt: afterData.updatedAt as any,
    };
    await jobPublicRef.set(jobPublic, { merge: true });
  } else {
    if (beforeData?.status === "open") {
      await jobPublicRef.delete();
    }
  }
});
