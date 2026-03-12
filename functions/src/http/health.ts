import * as functions from "firebase-functions";
import { version } from "../../package.json";

/**
 * A simple HTTP health check endpoint.
 */
export const httpHealth = functions.https.onRequest((req, res) => {
    res.status(200).send({ status: "ok", version });
});
