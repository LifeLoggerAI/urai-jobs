import * as functions from "firebase-functions";

export const httpHealth = functions.https.onRequest((request, response) => {
  response.status(200).json({ status: "ok" });
});
