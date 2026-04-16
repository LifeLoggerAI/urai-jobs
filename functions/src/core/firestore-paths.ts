import { Job, JobQueueEntry, UserRole, JobLog, NarratorTtsPayloadSchema } from '../shared-types';


// URAI-JOBS Firestore Path Definitions
// Version: 1.0.0
// DO NOT EDIT MANUALLY. This file is managed by the URAI-JOBS execution pack.

import { getFirestore, CollectionReference, DocumentReference } from 'firebase-admin/firestore';


// --- Collection Names ---
export const JOBS_COLLECTION = 'jobs';
export const JOB_QUEUE_COLLECTION = 'jobQueue';
export const USER_ROLES_COLLECTION = 'user_roles';
export const LOGS_SUBCOLLECTION = 'logs';

// --- Firestore DB Instance ---
const db = getFirestore();

// --- Typed Collection References ---

export const jobsCollection = (): CollectionReference<Job> => {
  return db.collection(JOBS_COLLECTION) as CollectionReference<Job>;
};

export const jobQueueCollection = (): CollectionReference<JobQueueEntry> => {
  return db.collection(JOB_QUEUE_COLLECTION) as CollectionReference<JobQueueEntry>;
};

export const userRolesCollection = (): CollectionReference<UserRole> => {
  return db.collection(USER_ROLES_COLLECTION) as CollectionReference<UserRole>;
};

// --- Typed Document References ---

export const jobDoc = (jobId: string): DocumentReference<Job> => {
  return jobsCollection().doc(jobId);
};

export const jobQueueEntryDoc = (jobId: string): DocumentReference<JobQueueEntry> => {
  return jobQueueCollection().doc(jobId);
};

export const userRoleDoc = (uid: string): DocumentReference<UserRole> => {
  return userRolesCollection().doc(uid);
};

// --- Typed Subcollection References ---

export const jobLogsCollection = (jobId: string): CollectionReference<JobLog> => {
  return jobDoc(jobId).collection(LOGS_SUBCOLLECTION) as CollectionReference<JobLog>;
};

