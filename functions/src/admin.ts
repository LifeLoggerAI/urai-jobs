import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * A callable function to bootstrap the first admin user.
 * This function can only be run once and is protected by a secret token.
 */
export const adminBootstrap = functions.https.onCall(async (data, context) => {
  // Check if the bootstrap process has already been sealed.
  const configRef = db.collection("config").doc("jobs");
  const configSnap = await configRef.get();
  if (configSnap.exists && configSnap.data()?.sealedAdminBootstrap) {
    throw new functions.https.HttpsError("failed-precondition", "Admin bootstrap is already sealed.");
  }

  // Verify the bootstrap token to ensure the caller is authorized.
  const bootstrapToken = data.token;
  if (!bootstrapToken || bootstrapToken !== process.env.ADMIN_BOOTSTRAP_TOKEN) {
    throw new functions.https.HttpsError("unauthenticated", "Invalid bootstrap token.");
  }

  // Check if a UID was provided in the data payload.
  const uid = data.uid;
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "No UID provided.");
  }

  try {
    // Set the custom claim 'admin' to true for the specified user.
    await admin.auth().setCustomUserClaims(uid, { admin: true });

    // Seal the bootstrap process to prevent it from being run again.
    await configRef.set({ sealedAdminBootstrap: true }, { merge: true });

    // Record the action in the audit log for security purposes.
    await db.collection("auditLogs").add({
      at: new Date(),
      action: "admin-bootstrap",
      target: `users/${uid}`,
      meta: { sealed: true },
    });

    return { success: true, message: `Successfully set admin claim for user ${uid}.` };
  } catch (error) {
    console.error("Error in adminBootstrap:", error);
    throw new functions.https.HttpsError("internal", "An internal error occurred.");
  }
});
