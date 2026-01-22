"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimJob = claimJob;
exports.releaseJob = releaseJob;
const LEASE_DURATION_MS = 60 * 1000; // 60 seconds
async function claimJob(firestore, jobRef) {
    return firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(jobRef);
        if (!doc.exists) {
            return null;
        }
        const job = doc.data();
        if (job.status !== 'queued' || (job.scheduledFor && job.scheduledFor.getTime() > Date.now())) {
            return null;
        }
        const leaseUntil = new Date(Date.now() + LEASE_DURATION_MS);
        const lockedBy = `worker-${process.pid}`;
        transaction.update(jobRef, { status: 'leased', leaseUntil, lockedBy, updatedAt: new Date() });
        return { ...job, status: 'leased', leaseUntil, lockedBy };
    });
}
async function releaseJob(firestore, jobRef, status, updates = {}) {
    await jobRef.update({ ...updates, status, lockedBy: null, leaseUntil: null, updatedAt: new Date() });
}
