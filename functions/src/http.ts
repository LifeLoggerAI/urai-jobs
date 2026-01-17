import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

// A simple health check endpoint to verify that the functions are deployed and running.
export const httpHealth = onRequest((req, res) => {
  logger.info("Health check endpoint hit.");
  res.status(200).json({ 
    status: "ok", 
    // In a real build pipeline, you would inject the build hash or version here.
    build: "dev", 
  });
});
