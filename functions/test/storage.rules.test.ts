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

    beforeEach(async () => {
        await testEnv.clearStorage();
    });

    it('should allow an authenticated user to upload their own resume to the correct path', async () => {
        const authedStorage = testEnv.authenticatedContext(myId).storage();
        const resumeRef = ref(authedStorage, `resumes/${myId}/app123/resume.pdf`);
        const blob = new Blob(['This is a test resume.'], { type: 'application/pdf' });
        await assertSucceeds(uploadBytes(resumeRef, blob));
    });

    it('should NOT allow a user to upload a resume to another user\'s path', async () => {
        const authedStorage = testEnv.authenticatedContext(myId).storage();
        const resumeRef = ref(authedStorage, `resumes/${theirId}/app456/resume.pdf`);
        const blob = new Blob(['This is a malicious resume.'], { type: 'application/pdf' });
        await assertFails(uploadBytes(resumeRef, blob));
    });

    it('should NOT allow an unauthenticated user to upload a resume', async () => {
        const unauthedStorage = testEnv.unauthenticatedContext().storage();
        const resumeRef = ref(unauthedStorage, `resumes/${myId}/app789/resume.pdf`);
        const blob = new Blob(['This is an anonymous resume.'], { type: 'application/pdf' });
        await assertFails(uploadBytes(resumeRef, blob));
    });

    it('should NOT allow a user to upload a file that is too large', async () => {
        const authedStorage = testEnv.authenticatedContext(myId).storage();
        const resumeRef = ref(authedStorage, `resumes/${myId}/app123/large_resume.pdf`);
        // Create a blob larger than 10MB
        const largeBlob = new Blob(new Array(11 * 1024 * 1024).fill('a'), { type: 'application/pdf' });
        await assertFails(uploadBytes(resumeRef, largeBlob));
    });

    it('should NOT allow a user to upload a file with an incorrect content type', async () => {
        const authedStorage = testEnv.authenticatedContext(myId).storage();
        const resumeRef = ref(authedStorage, `resumes/${myId}/app123/image.png`);
        const blob = new Blob(['This is not a document.'], { type: 'image/png' });
        await assertFails(uploadBytes(resumeRef, blob));
    });
});
