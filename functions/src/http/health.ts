import * as functions from "firebase-functions";

/**
 * A public-facing HTTP endpoint for basic health checks.
 *
 * Responds with a 200 OK status and a simple JSON payload to confirm that the
 * Cloud Functions service is operational. This is useful for uptime monitoring,
 * smoke testing, and confirming successful deployments.
 */
export const httpHealth = functions.https.onRequest((request, response) => {
  // For more advanced use cases, you could check database connectivity
  // or other dependencies here.
  const data = {
    status: "ok",
    message: "URAI-Jobs Cloud Functions are running.",
    timestamp: new Date().toISOString(),
  };

  functions.logger.info("[httpHealth] Health check endpoint was called.", data);

  response.status(200).json(data);
});
