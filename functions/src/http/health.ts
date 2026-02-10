
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

interface BuildInfo {
  buildDate: string;
  gitCommit: string;
}

// These values can be replaced by a build script.
const buildInfo: BuildInfo = {
  buildDate: process.env.BUILD_DATE || new Date().toISOString(),
  gitCommit: process.env.GIT_COMMIT_SHA || "unknown",
};

export const health = onRequest((request, response) => {
  logger.info("Health check endpoint hit.", { buildInfo });
  response.status(200).json({
    status: "ok",
    ...buildInfo,
  });
});
