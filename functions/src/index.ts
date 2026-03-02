/**
 * Import and re-export all Cloud Functions so that they can be deployed.
 */

// Firestore Triggers
export { onJobWrite } from "./triggers/on-job-write";
export { onApplicationCreate } from "./triggers/on-application-create";

// Callable Functions
export { createResumeUpload } from "./callable/create-resume-upload";
export { adminSetApplicationStatus } from "./callable/admin-set-application-status";

// Scheduled Functions
export { scheduledDailyDigest } from "./scheduled/daily-digest";

// HTTP Functions
export { httpHealth } from "./http/health";
