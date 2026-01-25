import * as functions from "firebase-functions";

export const httpHealth = functions.https.onRequest((req, res) => {
  res.status(200).send({
    status: "ok",
    timestamp: Date.now(),
  });
});
