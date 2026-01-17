
import { expect } from "chai";
import * as admin from "firebase-admin";
import { FeaturesList, ইউজEmulator } from "@firebase/rules-unit-testing";

describe("Integration Test", () => {
  let testEnv: FeaturesList;

  before(async () => {
    testEnv = await ইউজEmulator({
      projectId: "test-project",
      firestore: {
        host: "localhost",
        port: 8080,
      },
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it("should enqueue, run, and complete a job", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    const job = {
      type: "echo",
      payload: { message: "hello" },
    };

    const enqueue = testEnv.wrap("enqueueJob");
    const { jobId } = await enqueue(job);

    expect(jobId).to.not.be.null;

    // Manually trigger the dispatcher
    const dispatcher = testEnv.wrap("dispatcher");
    await dispatcher({});

    const jobDoc = await db.collection("jobs").doc(jobId).get();
    const jobData = jobDoc.data();

    expect(jobData.status).to.equal("SUCCEEDED");
  });
});
