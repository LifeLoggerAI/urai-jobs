"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobLogsCollection = exports.userRoleDoc = exports.jobQueueEntryDoc = exports.jobDoc = exports.userRolesCollection = exports.jobQueueCollection = exports.jobsCollection = exports.LOGS_SUBCOLLECTION = exports.USER_ROLES_COLLECTION = exports.JOB_QUEUE_COLLECTION = exports.JOBS_COLLECTION = void 0;
// URAI-JOBS Firestore Path Definitions
// Version: 1.0.0
// DO NOT EDIT MANUALLY. This file is managed by the URAI-JOBS execution pack.
const firestore_1 = require("firebase-admin/firestore");
// --- Collection Names ---
exports.JOBS_COLLECTION = 'jobs';
exports.JOB_QUEUE_COLLECTION = 'jobQueue';
exports.USER_ROLES_COLLECTION = 'user_roles';
exports.LOGS_SUBCOLLECTION = 'logs';
// --- Firestore DB Instance ---
const db = (0, firestore_1.getFirestore)();
// --- Typed Collection References ---
const jobsCollection = () => {
    return db.collection(exports.JOBS_COLLECTION);
};
exports.jobsCollection = jobsCollection;
const jobQueueCollection = () => {
    return db.collection(exports.JOB_QUEUE_COLLECTION);
};
exports.jobQueueCollection = jobQueueCollection;
const userRolesCollection = () => {
    return db.collection(exports.USER_ROLES_COLLECTION);
};
exports.userRolesCollection = userRolesCollection;
// --- Typed Document References ---
const jobDoc = (jobId) => {
    return (0, exports.jobsCollection)().doc(jobId);
};
exports.jobDoc = jobDoc;
const jobQueueEntryDoc = (jobId) => {
    return (0, exports.jobQueueCollection)().doc(jobId);
};
exports.jobQueueEntryDoc = jobQueueEntryDoc;
const userRoleDoc = (uid) => {
    return (0, exports.userRolesCollection)().doc(uid);
};
exports.userRoleDoc = userRoleDoc;
// --- Typed Subcollection References ---
const jobLogsCollection = (jobId) => {
    return (0, exports.jobDoc)(jobId).collection(exports.LOGS_SUBCOLLECTION);
};
exports.jobLogsCollection = jobLogsCollection;
