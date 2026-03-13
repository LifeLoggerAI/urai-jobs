import { 
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes } from 'firebase/storage';

let testEnv: RulesTestEnvironment;

const MY_PROJECT_ID = 'urai-jobs-test';
const myId = "user_abc";
const theirId = "user_xyz";

describe('Storage Rules', () => {
    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: MY_PROJECT_ID,
            storage: { host: 'localhost', port: 9199 },
        });
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    it('should not allow unauthenticated users to upload files', async () => {
        const unauthedStorage = testEnv.unauthenticatedContext().storage();
        const newRef = ref(unauthedStorage, 'test.jpg');
        await assertFails(uploadBytes(newRef, new Blob()));
    });

    it('should allow authenticated users to upload files to their own folder', async () => {
        const authedStorage = testEnv.authenticatedContext(myId).storage();
        const newRef = ref(authedStorage, `resumes/${myId}/test.jpg`);
        await assertSucceeds(uploadBytes(newRef, new Blob()));
    });

    it('should not allow authenticated users to upload files to another user\'s folder', async () => {
        const authedStorage = testEnv.authenticatedContext(myId).storage();
        const newRef = ref(authedStorage, `resumes/${theirId}/test.jpg`);
        await assertFails(uploadBytes(newRef, new Blob()));
    });
});
