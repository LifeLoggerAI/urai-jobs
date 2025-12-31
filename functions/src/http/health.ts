import * as functions from "firebase-functions";

export const health = functions.https.onRequest((request, response) => {
  response.status(200).json({
    ok: true,
    service: "urai-jobs",
    env: process.env.FUNCTIONS_EMULATOR ? "dev" : "prod",
    version: process.env.npm_package_version, // Assumes you have version in package.json
    time: new Date().toISOString(),
  });
});
