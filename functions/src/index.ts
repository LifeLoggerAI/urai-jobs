import { initializeApp } from "firebase-admin/app";

initializeApp();

export { onJobWrite } from "./jobs";
export { onApplicationCreate } from "./applications";
export { createResumeUpload } from "./resume";
export { adminSetApplicationStatus } from "./admin";
export { scheduledDailyDigest } from "./digest";
export { httpHealth } from "./health";
