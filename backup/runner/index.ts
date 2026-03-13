
import * as admin from 'firebase-admin';
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

const claimNextJob = httpsCallable(functions, 'claimNextJob');
const completeJob = httpsCallable(functions, 'completeJob');

async function main() {
  while (true) {
    try {
      const result = await claimNextJob();
      const job = result.data as any;

      if (job) {
        console.log(`Claimed job: ${job.id}`);

        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const output = { message: 'Job completed successfully' };
        await completeJob({ jobId: job.id, status: 'SUCCEEDED', output });

        console.log(`Completed job: ${job.id}`);
      } else {
        console.log('No jobs to claim');
      }
    } catch (error) {
      console.error('Error processing job:', error);
    }

    await new Promise((resolve) => setTimeout(resolve, 10000)); // Poll every 10 seconds
  }
}

main();
