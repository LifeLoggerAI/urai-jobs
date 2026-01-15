import { onRequest } from "firebase-functions/v2/https";

export const health = onRequest((request, response) => {
  response.status(200).send({
    status: "ok",
    build: process.env.K_REVISION,
  });
});
