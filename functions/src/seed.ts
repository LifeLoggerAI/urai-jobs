import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import admin from 'firebase-admin';
import { User } from '@urai-jobs/shared-types';

if (getApps().length === 0) initializeApp();

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();
const auth = admin.auth();

const users: Omit<User, 'uid'>[] = [
  {
    email: 'admin@example.com',
    role: 'admin',
    displayName: 'Admin User',
  },
  {
    email: 'user@example.com',
    role: 'user',
    displayName: 'Regular User',
  },
];

async function run() {
  for (const userData of users) {
    try {
      // 1. Create the user in Firebase Auth
      const userRecord = await auth.createUser({
        email: userData.email,
        password: 'password', // Set a default password for local development
        displayName: userData.displayName,
      });

      // 2. Set the custom role claim on the user
      await auth.setCustomUserClaims(userRecord.uid, { role: userData.role });

      // 3. Create the user document in Firestore
      const userDoc: User = {
        uid: userRecord.uid,
        ...userData,
      };
      await db.collection('users').doc(userRecord.uid).set(userDoc);

      console.log(`[PASS] Seeded user: ${userData.email} (role: ${userData.role})`);

    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        console.log(`[INFO] User already exists: ${userData.email}`);
      } else {
        console.error(`[FAIL] Error seeding user: ${userData.email}`, error);
      }
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
