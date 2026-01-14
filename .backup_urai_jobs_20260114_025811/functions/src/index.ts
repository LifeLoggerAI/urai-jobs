import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
// This is required for all functions
admin.initializeApp();

// Export all the functions from their individual files.
// This makes the project modular and easier to manage.

// Triggers
export { onJobWrite } from "./onJobWrite";
// export { onApplicationCreate } from "./onApplicationCreate";

// Callables
// export { adminSetApplicationStatus } from "./adminSetApplicationStatus";
// export { createResumeUploadUrl } from "./createResumeUploadUrl";

// HTTP
// export { health } from "./httpHealth";

// Scheduled
// export { scheduledDailyDigest } from "./scheduledDailyDigest";

// Job Queue System
// export * from "./jobQueueAdmin";
// export * from "./jobQueueWorker";
