
import * as admin from "firebase-admin";

admin.initializeApp();

// Job processing functions
export { planner } from "./jobs/planner";
export { executor } from "./jobs/executor";
export { verifyJobs } from "./jobs/verifier";

// Health check
import * as functions from "firebase-functions";
export const health = functions.https.onRequest((request, response) => {
  response.status(200).send("OK");
});
