import * as assert from "assert";
import { readFileSync, createReadStream } from "fs";
import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";

let testEnv: RulesTestEnvironment;

// Helper to get a Firestore client for a specific user
const getFirestore = (auth?: { uid: string; [key: string]: any }) => {
  return testEnv.authenticatedContext(auth?.uid, auth).firestore();
};


// Setup the test environment before all tests
before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "ur-ai-jobs",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

// Teardown the test environment after all tests
after(async () => {
  await testEnv.cleanup();
});

// Clear the database between tests
beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("Firestore Security Rules for 'applications' collection", () => {
  it("should DENY read access to unauthenticated users", async () => {
    const db = getFirestore(); // No user
    const appRef = db.collection("applications").doc("someAppId");
    await assertFails(appRef.get());
  });

  it("should DENY read access to authenticated non-admin users", async () => {
    // Create a non-admin user in our mock database
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection("users").doc("user123").set({ roles: ['viewer'] });
    });
    
    const db = getFirestore({ uid: "user123" });
    const appRef = db.collection("applications").doc("someAppId");
    await assertFails(appRef.get());
  });

  it("should ALLOW read access to authenticated admin users", async () => {
    // Create an admin user in our mock database
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection("users").doc("admin123").set({ roles: ['admin'] });
        await db.collection("applications").doc("app123").set({ applicant: 'test' });
    });

    const db = getFirestore({ uid: "admin123", roles: ['admin'] });
    const appRef = db.collection("applications").doc("app123");
    await assertSucceeds(appRef.get());
  });

  it("should ALLOW public read access to the 'jobs' collection", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection("jobs").doc("job123").set({ title: 'Software Engineer' });
    });
    
    const db = getFirestore(); // Unauthenticated user
    const jobRef = db.collection("jobs").doc("job123");
    await assertSucceeds(jobRef.get());
  });
});
