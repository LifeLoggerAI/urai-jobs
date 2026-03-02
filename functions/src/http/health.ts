import * as functions from "firebase-functions";

/**
 * A simple HTTP health check endpoint.
 */
export const httpHealth = functions.https.onRequest((req, res) => {
    // TODO: Add build info to the response.
    res.status(200).send({ status: "ok" });
});
