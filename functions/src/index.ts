/**
 * Import and re-export all Cloud Functions so that they can be deployed.
 * This file is the single source of truth for all deployed functions.
 */

// Firestore Triggers
export { onJobWrite } from "./triggers/jobs/on-write";
export { onApplicationCreate } from "./triggers/applications/on-create";

// Callable functions
export { createResumeUpload } from "./callable/create-resume-upload";
export { adminSetApplicationStatus } from "./callable/admin-set-application-status";

// Scheduled Functions
export { scheduledDailyDigest } from "./scheduled/daily-digest";

// HTTP Functions
export { httpHealth } from "./http/health";
