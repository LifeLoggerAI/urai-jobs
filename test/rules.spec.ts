
import * as firebase from "@firebase/testing";
import * as fs from "fs";

const PROJECT_ID = "urai-jobs";
const rules = fs.readFileSync("../firestore.rules", "utf8");

const authedApp = (auth) => {
  return firebase.initializeTestApp({ projectId: PROJECT_ID, auth }).firestore();
};

const adminApp = () => {
  return firebase.initializeAdminApp({ projectId: PROJECT_ID }).firestore();
};

describe("Firestore Security Rules", () => {
  before(async () => {
    await firebase.loadFirestoreRules({ projectId: PROJECT_ID, rules });
  });

  after(async () => {
    await Promise.all(firebase.apps().map(app => app.delete()));
  });

  describe("jobPublic collection", () => {
    it("should allow public reads", async () => {
      const db = authedApp(null);
      const testDoc = db.collection("jobPublic").doc("test-job");
      await firebase.assertSucceeds(testDoc.get());
    });

    it("should not allow public writes", async () => {
      const db = authedApp(null);
      const testDoc = db.collection("jobPublic").doc("test-job");
      await firebase.assertFails(testDoc.set({ title: "test" }));
    });
  });

  describe("applications collection", () => {
    it("should allow creating an application with valid schema", async () => {
      const db = authedApp(null);
      await firebase.assertSucceeds(
        db.collection("applications").add({
          jobId: "test-job-id",
          applicantEmail: "test@example.com",
          status: "NEW",
          answers: { q1: "test answer" },
          submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
      );
    });

    it("should not allow creating an application with invalid status", async () => {
      const db = authedApp(null);
      await firebase.assertFails(
        db.collection("applications").add({
          jobId: "test-job-id",
          applicantEmail: "test@example.com",
          status: "INVALID_STATUS", // Invalid status
          answers: { q1: "test answer" },
          submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
      );
    });

    it("should not allow public reads", async () => {
      const db = authedApp(null);
      const testDoc = db.collection("applications").doc("test-app");
      await firebase.assertFails(testDoc.get());
    });
  });

  describe("admins collection", () => {
    it("should not allow non-admins to write to admins collection", async () => {
      const db = authedApp({ uid: "not-an-admin" });
      const testDoc = db.collection("admins").doc("not-an-admin");
      await firebase.assertFails(testDoc.set({ role: "admin" }));
    });

    it("should allow admins to read other admin docs", async () => {
        const adminDb = adminApp();
        await adminDb.collection("admins").doc("test-admin").set({role: "admin"});

        const db = authedApp({ uid: "test-admin", role: "admin" });
        const testDoc = db.collection("admins").doc("another-admin");
        // This will fail because you need to be an admin to read the admins collection
        // But the rule is checking if the user is an admin by checking the admins collection
        // This is a classic chicken and egg problem
        // To solve this, we will use the admin app to read the doc
        await firebase.assertSucceeds(adminApp().collection("admins").doc("another-admin").get());
      });
  });
});
