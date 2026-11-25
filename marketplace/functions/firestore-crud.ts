import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime.js';
import { marketplaceCollections } from './collections.js';
import { createProfileRuntime } from './profile-runtime.js';
import { createApplicationRuntime } from './applications-runtime.js';
import { requireIdentifier } from './auth-runtime.js';
import type { MarketplaceAuthContext } from './auth.js';

export const createMarketplaceCrudRuntime = () => {
  const db = initializeMarketplaceAdminRuntime().firestore;
  return {
    jobs: {
      async list() {
        return db.collection(marketplaceCollections.publicJobs)
          .where('status', '==', 'published').where('moderationStatus', '==', 'approved').limit(50).get();
      },
      async get(jobId: string) {
        return db.collection(marketplaceCollections.publicJobs).doc(requireIdentifier(jobId, 'jobId')).get();
      },
    },
    profiles: { get(actor: MarketplaceAuthContext) { return createProfileRuntime().getProfile(actor); } },
    applications: { listByCandidate(actor: MarketplaceAuthContext) { return createApplicationRuntime().listByCandidate(actor); } },
  };
};
