import {initializeApp} from "firebase-admin/app";

initializeApp();

// Triggers
export {onJobWrite} from "./triggers/onJobWrite";
export {onApplicationCreate} from "./triggers/onApplicationCreate";

// Callable
export {createResumeUpload} from "./callable/createResumeUpload";
export {adminSetApplicationStatus} from "./callable/adminSetApplicationStatus";

// Scheduled
export {dailyDigest} from "./scheduled/dailyDigest";

// HTTP
export {health} from "./http/health";
