import * as functions from "firebase-functions";

export const health = functions.https.onRequest((request, response) => {
  response.send({ status: "ok" });
});
