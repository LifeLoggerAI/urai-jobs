import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Throws an error if the user is not authenticated or is not an admin.
 * Uses the presence of a custom claim `admin: true`.
 */
export function requireAdmin(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }
  if (context.auth.token.admin !== true) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "The function must be called by an admin user."
    );
  }
  return context.auth.uid;
}
