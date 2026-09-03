"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLease = createLease;
exports.updateJob = updateJob;
exports.updateQueue = updateQueue;
function createLease(ownerId) {
    return {
        leaseId: 'dev-lease',
        ownerId: ownerId || 'system',
        leaseToken: 'dev-lease-token'
    };
}
async function updateJob(_jobId, _update) { }
async function updateQueue(_jobId, _update) { }
