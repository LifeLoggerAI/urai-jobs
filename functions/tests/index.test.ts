import { beforeAll, describe, it, expect } from 'vitest';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions-test';
import { HttpsError } from 'firebase-functions/v1/https';

// Initialize the Firebase Test SDK
const testEnv = functions();

// Import the functions to be tested
import { createJob, enqueueRun } from '../src/index';

describe('Cloud Functions', () => {
  let wrappedCreateJob: any;
  let wrappedEnqueueRun: any;

  beforeAll(() => {
    // Wrap the functions
    wrappedCreateJob = testEnv.wrap(createJob);
    wrappedEnqueueRun = testEnv.wrap(enqueueRun);
  });

  describe('createJob', () => {
    it('should create a new job', async () => {
      const data = {
        name: 'Test Job',
        description: 'This is a test job',
        handler: 'noop',
      };

      const context = {
        auth: {
          uid: 'admin-uid',
        },
      };

      // Set the user's role to admin
      await admin.firestore().collection('users').doc('admin-uid').set({ role: 'admin' });

      const result = await wrappedCreateJob(data, context);

      expect(result.id).toBeDefined();

      const job = await admin.firestore().collection('jobs').doc(result.id).get();
      expect(job.exists).toBe(true);
      expect(job.data()?.name).toBe('Test Job');
    });

    it('should not allow a non-admin to create a job', async () => {
      const data = {
        name: 'Test Job',
        description: 'This is a test job',
        handler: 'noop',
      };

      const context = {
        auth: {
          uid: 'user-uid',
        },
      };

      // Set the user's role to viewer
      await admin.firestore().collection('users').doc('user-uid').set({ role: 'viewer' });

      await expect(wrappedCreateJob(data, context)).rejects.toThrow(HttpsError);
    });
  });

  describe('enqueueRun', () => {
    it('should enqueue a new run', async () => {
      const jobData = {
        name: 'Test Job',
        description: 'This is a test job',
        handler: 'noop',
        createdBy: 'admin-uid',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const job = await admin.firestore().collection('jobs').add(jobData);

      const data = {
        jobId: job.id,
      };

      const context = {
        auth: {
          uid: 'operator-uid',
        },
      };

      // Set the user's role to operator
      await admin.firestore().collection('users').doc('operator-uid').set({ role: 'operator' });

      const result = await wrappedEnqueueRun(data, context);

      expect(result.runId).toBeDefined();

      const run = await admin.firestore().collection('jobRuns').doc(result.runId).get();
      expect(run.exists).toBe(true);
      expect(run.data()?.jobId).toBe(job.id);
    });
  });
});
