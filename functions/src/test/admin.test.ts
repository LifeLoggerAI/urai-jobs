import * as admin from "firebase-admin";
import * as test from "firebase-functions-test";
import { cancelJob, requeueJob } from "../engine/admin";

// Initialize the test environment
const testEnv = test();

describe("Admin Functions", () => {
  let wrappedCancel: any;
  let wrappedRequeue: any;

  beforeAll(() => {
    // Wrap the functions
    wrappedCancel = testEnv.wrap(cancelJob);
    wrappedRequeue = testEnv.wrap(requeueJob);
  });

  afterAll(() => {
    // Clean up the test environment
    testEnv.cleanup();
  });

  it("should cancel a job", async () => {
    // Create a fake job
    const jobId = "cancel-test";
    await admin.firestore().collection("jobs").doc(jobId).set({
      status: "PENDING",
    });

    // Call the cancel function
    await wrappedCancel({ jobId }, { auth: { token: { admin: true } } });

    // Check the job status
    const job = await admin.firestore().collection("jobs").doc(jobId).get();
    expect(job.data()?.status).toEqual("CANCELLED");
  });

  it("should requeue a job", async () => {
    // Create a fake job
    const jobId = "requeue-test";
    await admin.firestore().collection("jobs").doc(jobId).set({
      status: "FAILED",
    });

    // Call the requeue function
    await wrappedRequeue({ jobId }, { auth: { token: { admin: true } } });

    // Check the job status
    const job = await admin.firestore().collection("jobs").doc(jobId).get();
    expect(job.data()?.status).toEqual("PENDING");
  });
});
