import * as admin from "firebase-admin";

admin.initializeApp();

// Callable Functions
export { createResumeUpload } from "./callable/createResumeUpload";
export { adminSetApplicationStatus } from "./callable/adminSetApplicationStatus";

// HTTP Functions
export { health } from "./http/health";

// Scheduled Functions
export { scheduledDailyDigest } from "./scheduled/dailyDigest";

// Firestore Triggers
export { onJobWrite } from "./triggers/onJobWrite";
export { onApplicationCreate } from "./triggers/onApplicationCreate";
