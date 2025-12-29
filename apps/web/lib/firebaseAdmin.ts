import * as admin from 'firebase-admin';

// Ensure the service account is available
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccount) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set.');
}

// Initialize the admin app if it hasn't been already
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export default admin;
