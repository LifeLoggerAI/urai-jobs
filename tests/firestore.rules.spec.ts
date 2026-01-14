import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import * as fs from "fs";

let testEnv: RulesTestEnvironment;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-urai-jobs", // Matches seed script
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

describe("Public Access", () => {
  it("should allow anyone to read an open public job", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "jobPublic/job1"), { status: "open" });
    });
    await assertSucceeds(getDoc(doc(unauthedDb, "jobPublic/job1")));
  });

  it("should DENY reading a closed public job", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "jobPublic/job2"), { status: "closed" });
    });
    await assertFails(getDoc(doc(unauthedDb, "jobPublic/job2")));
  });

  it("should DENY public read of applicants", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthedDb, "applicants/app1")));
  });

  it("should allow public to create an application", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(unauthedDb, "applications/new-app-1"), {
        jobId: "some-job",
        applicantEmail: "test@example.com",
    }));
  });
});

describe("Admin Access", () => {
    const adminAuth = { uid: "admin_user", token: { admin: true } };
    let adminDb: any; // Use `any` for simplicity in test setup
    before(() => {
        adminDb = testEnv.authenticatedContext(adminAuth.uid, adminAuth.token).firestore();
    });

    it("should allow an admin to write a job", async () => {
        await assertSucceeds(setDoc(doc(adminDb, "jobs/job-admin"), {
            title: "Admin Job",
            createdAt: serverTimestamp()
        }));
    });

    it("should allow an admin to read applicants", async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          await setDoc(doc(context.firestore(), "applicants/app1"), { name: "test" });
        });
        await assertSucceeds(getDoc(doc(adminDb, "applicants/app1")));
    });
});
