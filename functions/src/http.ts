import * as functions from "firebase-functions";

/**
 * A simple health check endpoint.
 */
export const health = functions.https.onRequest((request, response) => {
    response.status(200).send({ status: "ok", build: process.env.BUILD_VERSION || "local" });
});
