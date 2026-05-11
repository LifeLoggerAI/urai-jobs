import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';
import { marketplaceCollections } from './collections';

export const createMarketplaceCrudRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const db = runtime.firestore;

  return {
    jobs: {
      async list() {
        return db.collection(marketplaceCollections.jobs).limit(50).get();
      },

      async get(jobId: string) {
        return db.collection(marketplaceCollections.jobs).doc(jobId).get();
      },
    },

    profiles: {
      async get(uid: string) {
        return db.collection(marketplaceCollections.profiles).doc(uid).get();
      },
    },

    applications: {
      async listByCandidate(uid: string) {
        return db
          .collection(marketplaceCollections.applications)
          .where('candidateUid', '==', uid)
          .limit(50)
          .get();
      },
    },
  };
};
