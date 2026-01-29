import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

/**
 * A simple health check endpoint.
 */
export const health = onRequest({ cors: true }, (req, res) => {
  logger.info("Health check endpoint invoked.");
  res.status(200).json({
    ok: true,
    service: "urai-jobs",
    ts: new Date().toISOString(),
  });
});
