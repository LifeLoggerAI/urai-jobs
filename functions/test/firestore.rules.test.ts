import { 
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const MY_PROJECT_ID = 'urai-jobs-test';
const myId = "user_abc";
const theirId = "user_xyz";

describe('Firestore Rules', () => {
    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: MY_PROJECT_ID,
            firestore: { host: 'localhost', port: 8080 },
        });
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    it('should not allow unauthenticated users to read from a protected collection', async () => {
        const unauthedDb = testEnv.unauthenticatedContext().firestore();
        const protectedDoc = doc(unauthedDb, 'jobs/test_job');
        await assertFails(getDoc(protectedDoc));
    });

    it('should allow authenticated users to create their own application', async () => {
        const authedDb = testEnv.authenticatedContext(myId).firestore();
        const newApplication = doc(authedDb, 'applications/new_app');
        await assertSucceeds(setDoc(newApplication, { applicantId: myId, status: 'submitted' }));
    });

    it('should not allow authenticated users to create an application for another user', async () => {
        const authedDb = testEnv.authenticatedContext(myId).firestore();
        const newApplication = doc(authedDb, 'applications/new_app');
        await assertFails(setDoc(newApplication, { applicantId: theirId, status: 'submitted' }));
    });
});
