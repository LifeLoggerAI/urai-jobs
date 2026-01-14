import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK. Must be done once.
admin.initializeApp();

// Export all functions from their individual files.

// Firestore Triggers
export { onJobWrite } from "./onJobWrite";
export { onApplicationCreate } from "./onApplicationCreate";

// Callable Functions
export { createResumeUploadUrl } from "./createResumeUpload";
export { adminSetApplicationStatus } from "./adminSetApplicationStatus";

// HTTP and Scheduled Functions
export { httpHealth, scheduledDailyDigest } from "./http";
