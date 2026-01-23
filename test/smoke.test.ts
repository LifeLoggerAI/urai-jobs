import { describe, it, expect } from 'vitest';
import * as firebaseFunctionsTest from 'firebase-functions-test';
import * as admin from 'firebase-admin';

const test = firebaseFunctionsTest();

describe('Smoke Test', () => {
  it('should enqueue and process a health.ping job', async () => {
    const { enqueue, runWorker } = await import('../src/index');

    const wrappedEnqueue = test.wrap(enqueue);
    await wrappedEnqueue({ jobId: 'health.ping', payload: { message: 'test' } }, { auth: { uid: 'test-uid', token: { admin: true } } });

    const wrappedRunWorker = test.wrap(runWorker);
    await wrappedRunWorker({});

    const snapshot = await admin.firestore().collection('jobQueue').where('payload.message', '==', 'test').get();
    const job = snapshot.docs[0].data();

    expect(job.status).toBe('succeeded');
  });
});
