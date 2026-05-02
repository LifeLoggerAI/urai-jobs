export function createLease(ownerId?: string) {
  return {
    leaseId: 'dev-lease',
    ownerId: ownerId || 'system',
    leaseToken: 'dev-lease-token'
  };
}

export async function updateJob(_jobId: string, _update: any) {}

export async function updateQueue(_jobId: string, _update: any) {}
