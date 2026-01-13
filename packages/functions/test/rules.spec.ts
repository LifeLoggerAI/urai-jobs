import * as firebase from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = 'urai-jobs';
const firestoreRules = fs.readFileSync(path.resolve(__dirname, '../../../../firestore.rules'), 'utf8');

describe('Firestore security rules', () => {
  let testEnv: firebase.RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await firebase.initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: firestoreRules } });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('should allow public read on jobPublic', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await firebase.assertSucceeds(db.collection('jobPublic').doc('test').get());
  });

  it('should not allow unauthenticated writes to applications', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await firebase.assertFails(db.collection('applications').add({}));
  });
});
    beforeEach(async () => {
        await testEnv.clearFirestore();
    });

    it('should allow user to read their own job', async () => {
        const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' });
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().collection('jobs').doc('alice-job').set({ ownerUid: 'alice' });
        });
        await firebase.assertSucceeds(alice.firestore().collection('jobs').doc('alice-job').get());
    });

    it('should NOT allow user to read other users jobs', async () => {
        const alice = testEnv.authenticatedContext('alice');
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().collection('jobs').doc('bob-job').set({ ownerUid: 'bob' });
        });
        await firebase.assertFails(alice.firestore().collection('jobs').doc('bob-job').get());
    });

    it('should allow admin to read any job', async () => {
        const admin = testEnv.authenticatedContext('admin-user');
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().collection('admins').doc('admin-user').set({ role: 'admin' });
            await context.firestore().collection('jobs').doc('any-job').set({ ownerUid: 'test-user' });
        });
        await firebase.assertSucceeds(admin.firestore().collection('jobs').doc('any-job').get());
    });

    it('should NOT allow unauthenticated users to create jobs', async () => {
        const unauthedDb = testEnv.unauthenticatedContext().firestore();
        await firebase.assertFails(unauthedDb.collection('jobs').add({ ownerUid: 'alice' }));
    });
});
