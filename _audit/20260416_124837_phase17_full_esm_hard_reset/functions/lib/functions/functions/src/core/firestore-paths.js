// URAI-JOBS Firestore Path Definitions
// Version: 1.0.0
// DO NOT EDIT MANUALLY. This file is managed by the URAI-JOBS execution pack.
import { getFirestore } from 'firebase-admin/firestore';
// --- Collection Names ---
export const JOBS_COLLECTION = 'jobs';
export const JOB_QUEUE_COLLECTION = 'jobQueue';
export const USER_ROLES_COLLECTION = 'user_roles';
export const LOGS_SUBCOLLECTION = 'logs';
// --- Firestore DB Instance ---
const db = getFirestore();
// --- Typed Collection References ---
export const jobsCollection = () => {
    return db.collection(JOBS_COLLECTION);
};
export const jobQueueCollection = () => {
    return db.collection(JOB_QUEUE_COLLECTION);
};
export const userRolesCollection = () => {
    return db.collection(USER_ROLES_COLLECTION);
};
// --- Typed Document References ---
export const jobDoc = (jobId) => {
    return jobsCollection().doc(jobId);
};
export const jobQueueEntryDoc = (jobId) => {
    return jobQueueCollection().doc(jobId);
};
export const userRoleDoc = (uid) => {
    return userRolesCollection().doc(uid);
};
// --- Typed Subcollection References ---
export const jobLogsCollection = (jobId) => {
    return jobDoc(jobId).collection(LOGS_SUBCOLLECTION);
};
