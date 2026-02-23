import { an } from 'vitest/dist/reporters-5f784f42.js';
import { 
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const MY_PROJECT_ID = 'urai-jobs-test';
const myId = "user_abc";
const theirId = "user_xyz";
const myAuth = { uid: myId };

// Set up the test environment before all tests
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({ 
        projectId: MY_PROJECT_ID,
        firestore: { host: 'localhost', port: 8080 },
    });
});

// Clean up the test environment after all tests
afterAll(async () => {
    await testEnv.cleanup();
});

// Clear the firestore data before each test
beforeEach(async () => {
    await testEnv.clearFirestore();
});

describe('Public Access Firestore Rules', () => {

    it('should allow anyone to read from the jobPublic collection', async () => {
        const unauthedDb = testEnv.unauthenticatedContext().firestore();
        // Set up a public job document as an admin first
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'jobPublic/testJob'), { title: 'Public Job' });
        });

        const testDoc = doc(unauthedDb, 'jobPublic/testJob');
        await assertSucceeds(getDoc(testDoc));
    });

    it('should NOT allow anyone to write to the jobPublic collection', async () => {
        const unauthedDb = testEnv.unauthenticatedContext().firestore();
        const testDoc = doc(unauthedDb, 'jobPublic/newJob');
        await assertFails(setDoc(testDoc, { title: 'Malicious Job' }));
    });

    it('should NOT allow public users to read private collections', async () => {
        const unauthedDb = testEnv.unauthenticatedContext().firestore();
        
        // Set up dummy data that should be inaccessible
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();
            await setDoc(doc(db, 'jobs/privateJob'), { title: 'Private Job' });
            await setDoc(doc(db, 'applicants/applicant1'), { name: 'Test Applicant' });
            await setDoc(doc(db, 'applications/app1'), { status: 'NEW' });
            await setDoc(doc(db, 'admins/admin1'), { role: 'admin' });
        });

        await assertFails(getDoc(doc(unauthedDb, 'jobs/privateJob')));
        await assertFails(getDoc(doc(unauthedDb, 'applicants/applicant1')));
        await assertFails(getDoc(doc(unauthedDb, 'applications/app1')));
        await assertFails(getDoc(doc(unauthedDb, 'admins/admin1')));
    });
});

describe('Applicant-Specific Firestore Rules', () => {
    beforeEach(async () => {
        // Create a public job for application tests
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'jobPublic/testJob'), { title: 'Public Job' });
        });
    });

    it('should allow a user to create their own applicant profile', async () => {
        const db = testEnv.authenticatedContext(myId).firestore();
        const applicantProfile = doc(db, `applicants/${myId}`);
        await assertSucceeds(setDoc(applicantProfile, { name: 'My Name', primaryEmail: 'me@test.com' }));
    });

    it('should NOT allow a user to create an applicant profile for someone else', async () => {
        const db = testEnv.authenticatedContext(myId).firestore();
        const applicantProfile = doc(db, `applicants/${theirId}`);
        await assertFails(setDoc(applicantProfile, { name: 'Their Name', primaryEmail: 'them@test.com' }));
    });

    it('should allow a user to create an application for themselves', async () => {
        const db = testEnv.authenticatedContext(myId).firestore();
        const newApplication = doc(db, 'applications/newApp');
        await assertSucceeds(setDoc(newApplication, { applicantId: myId, jobId: 'testJob'}));
    });

    it('should NOT allow a user to create an application for someone else', async () => {
        const db = testEnv.authenticatedContext(myId).firestore();
        const newApplication = doc(db, 'applications/newApp');
        await assertFails(setDoc(newApplication, { applicantId: theirId, jobId: 'testJob'}));
    });

    it('should NOT allow a user to update an application status', async () => {
        const db = testEnv.authenticatedContext(myId).firestore();
        // Admin creates the application first
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'applications/appToUpdate'), { applicantId: myId, status: 'NEW' });
        });

        const appToUpdate = doc(db, 'applications/appToUpdate');
        await assertFails(updateDoc(appToUpdate, { status: 'HIRED' }));
    });
});

describe('Admin-Specific Firestore Rules', () => {
    const adminId = 'admin_user';
    const adminAuth = { uid: adminId };

    beforeEach(async () => {
        // Set up an admin user in the firestore
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), `admins/${adminId}`), { role: 'admin' });
        });
    });

    it('should allow an admin to read any application', async () => {
        const adminDb = testEnv.authenticatedContext(adminId, { admin: true }).firestore();
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'applications/anyApp'), { applicantId: theirId });
        });
        
        const appDoc = doc(adminDb, 'applications/anyApp');
        await assertSucceeds(getDoc(appDoc));
    });

    it('should allow an admin to update an application status', async () => {
        const adminDb = testEnv.authenticatedContext(adminId, { admin: true }).firestore();
         await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'applications/appToUpdateByAdmin'), { applicantId: theirId, status: 'NEW' });
        });

        const appToUpdate = doc(adminDb, 'applications/appToUpdateByAdmin');
        await assertSucceeds(updateDoc(appToUpdate, { status: 'SCREEN' }));
    });

    it('should NOT allow a non-admin to update application status', async () => {
        const userDb = testEnv.authenticatedContext(myId).firestore();
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'applications/appToFailUpdate'), { applicantId: myId, status: 'NEW' });
        });

        const appToUpdate = doc(userDb, 'applications/appToFailUpdate');
        await assertFails(updateDoc(appToUpdate, { status: 'HIRED' }));
    });
});
