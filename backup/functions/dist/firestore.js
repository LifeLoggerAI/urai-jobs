"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollJobs = exports.releaseJob = exports.heartbeatJob = exports.lockJob = exports.updateJob = exports.createJob = exports.getJob = void 0;
const firebase_admin_1 = require("firebase-admin");


// AUTO-PATCH: ensure default app exists during deploy analysis
if (!firebase_admin_1.apps?.length) { firebase_admin_1.initializeApp(); }
// AUTO-PATCH: ensure default app exists during deploy analysis
if (!firebase_admin_1.apps?.length) { firebase_admin_1.initializeApp(); }
const jobs_1 = require("./types/jobs");
const db = (0, firebase_admin_1.firestore)();
const jobsCollection = db.collection('jobs');
const getJob = async (jobId) => {
    const doc = await jobsCollection.doc(jobId).get();
    if (!doc.exists) {
        return null;
    }
    const data = doc.data();
    return jobs_1.JobSchema.parse(data);
};
exports.getJob = getJob;
const createJob = async (job) => {
    await jobsCollection.doc(job.jobId).set(job);
};
exports.createJob = createJob;
const updateJob = async (jobId, updates) => {
    await jobsCollection.doc(jobId).update(updates);
};
exports.updateJob = updateJob;
const lockJob = async (jobId, workerId, leaseMs) => {
    return db.runTransaction(async (transaction) => {
        const jobRef = jobsCollection.doc(jobId);
        const doc = await transaction.get(jobRef);
        if (!doc.exists) {
            return null;
        }
        const job = jobs_1.JobSchema.parse(doc.data());
        if (job.status === 'QUEUED' || (job.status === 'RUNNING' && job.lease?.lockedUntil && job.lease.lockedUntil.toMillis() < Date.now())) {
            const lease = {
                lockedBy: workerId,
                lockedAt: firebase_admin_1.firestore.Timestamp.now(),
                lockedUntil: firebase_admin_1.firestore.Timestamp.fromMillis(Date.now() + leaseMs),
            };
            transaction.update(jobRef, { status: 'RUNNING', lease });
            return { ...job, status: 'RUNNING', lease };
        }
        else {
            return null;
        }
    });
};
exports.lockJob = lockJob;
const heartbeatJob = async (jobId, workerId, leaseMs) => {
    return db.runTransaction(async (transaction) => {
        const jobRef = jobsCollection.doc(jobId);
        const doc = await transaction.get(jobRef);
        if (!doc.exists) {
            return null;
        }
        const job = jobs_1.JobSchema.parse(doc.data());
        if (job.lease?.lockedBy === workerId) {
            const newLockedUntil = firebase_admin_1.firestore.Timestamp.fromMillis(Date.now() + leaseMs);
            transaction.update(jobRef, { 'lease.lockedUntil': newLockedUntil });
            return newLockedUntil;
        }
        else {
            return null;
        }
    });
};
exports.heartbeatJob = heartbeatJob;
const releaseJob = async (jobId, workerId) => {
    await db.runTransaction(async (transaction) => {
        const jobRef = jobsCollection.doc(jobId);
        const doc = await transaction.get(jobRef);
        if (doc.exists) {
            const job = jobs_1.JobSchema.parse(doc.data());
            if (job.lease?.lockedBy === workerId) {
                transaction.update(jobRef, { lease: firebase_admin_1.firestore.FieldValue.delete() });
            }
        }
    });
};
exports.releaseJob = releaseJob;
const pollJobs = async (limit, kinds) => {
    let query = jobsCollection;
    query = query.where('status', '==', 'QUEUED');
    if (kinds.length > 0) {
        query = query.where('kind', 'in', kinds);
    }
    const snapshot = await query.limit(limit).get();
    return snapshot.docs.map((doc) => jobs_1.JobSchema.parse(doc.data()));
};
exports.pollJobs = pollJobs;
//# sourceMappingURL=firestore.js.map