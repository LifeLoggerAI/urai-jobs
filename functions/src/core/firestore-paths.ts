import { getFirestore, FirestoreDataConverter, QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { Job, JobQueueEntry, User, JobLog } from '@urai-jobs/shared-types';

const converter = <T>(): FirestoreDataConverter<T> => ({
  toFirestore: (data: T) => data as DocumentData,
  fromFirestore: (snap: QueryDocumentSnapshot) => snap.data() as T,
});

// --- Collection Names ---
const USERS_COLLECTION = 'users';
const JOBS_COLLECTION = 'jobs';
const JOB_QUEUE_COLLECTION = 'jobQueue';
const LOGS_SUBCOLLECTION = 'logs';

// --- Firestore DB Instance ---
const db = getFirestore();

// --- Typed Collection References ---

export const usersCollection = () => {
  return db.collection(USERS_COLLECTION).withConverter(converter<User>());
};

export const jobsCollection = () => {
  return db.collection(JOBS_COLLECTION).withConverter(converter<Job>());
};

export const jobQueueCollection = () => {
  return db.collection(JOB_QUEUE_COLLECTION).withConverter(converter<JobQueueEntry>());
};

// --- Typed Document References ---

export const userDoc = (uid: string) => {
  return usersCollection().doc(uid);
};

export const jobDoc = (jobId: string) => {
  return jobsCollection().doc(jobId);
};

export const jobQueueEntryDoc = (jobId: string) => {
  return jobQueueCollection().doc(jobId);
};

// --- Typed Subcollection References ---

export const jobLogsCollection = (jobId: string) => {
  return jobDoc(jobId).collection(LOGS_SUBCOLLECTION).withConverter(converter<JobLog>());
};
