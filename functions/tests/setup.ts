import { test } from 'vitest';
import * as admin from 'firebase-admin';

// Initialize the Firebase Admin SDK
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
admin.initializeApp({ projectId: 'urai-jobs' });

test('setup', () => {
  // This is a setup file, so we don't need to do anything here.
  // The purpose of this file is to initialize the Firebase Admin SDK.
});
