import * as admin from "firebase-admin";

/**
 * Ensure the default app exists before any Firebase Admin service is used.
 * This file must be imported by any module that calls getFirestore() / getAuth() etc.
 */
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { admin };
