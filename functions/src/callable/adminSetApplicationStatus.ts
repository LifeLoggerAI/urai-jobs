
import * as functions from "firebase-functions";
import { firestore } from "../lib/firebase";

export const adminSetApplicationStatus = functions.https.onCall(
  async (data, context) => {
    if (!context.auth || !context.auth.token.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You must be an admin to perform this action."
      );
    }

    const { applicationId, status, tags, rating } = data;

    const applicationRef = firestore
      .collection("applications")
      .doc(applicationId);

    await applicationRef.update({
      status,
      tags,
      "internal.rating": rating,
      "internal.reviewerId": context.auth.uid,
      "internal.reviewedAt": new Date(),
    });

    await firestore.collection("events").add({
      type: "status_changed",
      entityType: "application",
      entityId: applicationId,
      metadata: { newStatus: status, reviewerId: context.auth.uid },
      createdAt: new Date(),
    });
  }
);
