import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const adminBootstrap = functions.https.onCall(async (data, context) => {
  const { uid, token } = data;

  if (!uid || !token) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      'The function must be called with "uid" and "token" arguments.'
    );
  }

  const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!bootstrapToken) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "The ADMIN_BOOTSTRAP_TOKEN environment variable is not set."
    );
  }

  if (token !== bootstrapToken) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Invalid bootstrap token."
    );
  }

  const configRef = admin.firestore().collection("config").doc("jobs");
  const configDoc = await configRef.get();

  if (configDoc.exists && configDoc.data()?.sealedAdminBootstrap) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Admin bootstrap has already been completed and is sealed."
    );
  }

  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });

    await configRef.set({ sealedAdminBootstrap: true }, { merge: true });

    await admin
      .firestore()
      .collection("admins")
      .doc(uid)
      .set({ role: "owner", createdAt: admin.firestore.FieldValue.serverTimestamp() });

    await admin.firestore().collection("auditLogs").add({
      at: admin.firestore.FieldValue.serverTimestamp(),
      action: "admin-bootstrap",
      target: `users/${uid}`,
      meta: { sealed: true },
    });

    return { success: true, message: `Successfully set user ${uid} as admin.` };
  } catch (error) {
    console.error("Error setting custom claims:", error);
    throw new functions.https.HttpsError(
      "internal",
      "An internal error occurred."
    );
  }
});
