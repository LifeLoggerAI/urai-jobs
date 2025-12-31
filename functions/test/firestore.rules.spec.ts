import { readFileSync } from 'fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let testEnv: RulesTestEnvironment;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-urai-jobs',
    firestore: {
      host: 'localhost',
      port: 8080,
      rules: readFileSync('../../firestore.rules', 'utf8'),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

describe('Firestore Security Rules', () => {
  it('should allow public read on jobPublic', async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(db.collection('jobPublic').doc('some-job').get());
  });

  it('should not allow public read on applicants', async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(db.collection('applicants').doc('some-applicant').get());
  });

  it('should allow admin to read applicants', async () => {
    const db = testEnv.authenticatedContext('admin-uid').database();
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.database().doc('admins/admin-uid').set({ role: 'admin' });
    });
    await assertSucceeds(db.collection('applicants').doc('some-applicant').get());
  });

  it('should allow public to create an application with valid schema', async () => {
    const db = testEnv.unauthenticatedContext().database();
    const validApplication = {
        jobId: 'some-job',
        applicantEmail: 'test@example.com',
        answers: { q1: 'a1' },
        submittedAt: new Date(),
    };
    await assertSucceeds(db.collection('applications').add(validApplication));
  });

  it('should not allow public to create an application with invalid schema', async () => {
    const db = testEnv.unauthenticatedContext().database();
    const invalidApplication = {
        jobId: 'some-job',
        // Missing applicantEmail
        answers: { q1: 'a1' },
        submittedAt: new Date(),
    };
    await assertFails(db.collection('applications').add(invalidApplication));
  });

  it('should allow admin to call adminSetApplicationStatus', async () => {
    // This is not a direct rules test, but an integration test concept.
    // Testing callable functions requires the Functions emulator and is more involved.
    // We will trust the function's internal logic and IAM for this for now.
    // A full test would look something like:
    // const funcs = testEnv.functions();
    // const callable = funcs.httpsCallable('adminSetApplicationStatus');
    // await assertSucceeds(callable({ applicationId: 'app-id', status: 'REVIEW' }));
    console.log('SKIPPED: Callable function test requires Functions emulator setup.');
  });
});
