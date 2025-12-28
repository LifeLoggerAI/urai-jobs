import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const setAdmin = functions.https.onCall(async (data, context) => {
  if (context.auth?.token.role !== "admin") {
    return { error: "Request not authorized. User must be an admin to fulfill request." };
  }
  const { email, role } = data;
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { role });
  return { message: `Success! ${email} has been granted the role of ${role}.` };
});