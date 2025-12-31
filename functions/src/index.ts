import * as admin from "firebase-admin";

admin.initializeApp();

// Triggers
export * from "./triggers/onJobWrite";
export * from "./triggers/onApplicationCreate";

// Callables
export * from "./callables/createResumeUpload";
export * from "./callables/adminSetApplicationStatus";

// Scheduled
export * from "./scheduled/dailyDigest";

// HTTP
export * from "./http/health";
