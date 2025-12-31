import * as functions from "firebase-functions";

export const health = functions.https.onRequest((request, response) => {
  response.send({
    ok: true,
    service: "urai-jobs",
    env: process.env.GCLOUD_PROJECT === "urai-jobs" ? "prod" : "dev",
    version: process.env.K_REVISION,
    region: process.env.FUNCTION_REGION,
    time: new Date().toISOString(),
  });
});
