export function createLease(ownerId) {
    return {
        leaseId: 'dev-lease',
        ownerId: ownerId || 'system',
        leaseToken: 'dev-lease-token'
    };
}
export async function updateJob(_jobId, _update) { }
export async function updateQueue(_jobId, _update) { }
