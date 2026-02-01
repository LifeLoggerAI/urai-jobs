import { runWorker } from './worker';

// This file is for local development and testing
// It will not be deployed to Firebase Functions

if (require.main === module) {
  runWorker().catch(err => {
    console.error('Error running local worker', err);
    process.exit(1);
  });
}
