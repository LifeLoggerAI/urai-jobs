import { initializeMarketplaceFirebaseAdmin } from './firebase-admin';
import { marketplaceCollections } from './collections';

export const createFirestoreRuntime = () => {
  const firebase = initializeMarketplaceFirebaseAdmin();

  return {
    ok: true,
    firebase,
    collections: marketplaceCollections,
    state: 'firestore-runtime-scaffolded',
    operations: {
      jobs: ['list', 'get', 'create'],
      profiles: ['get', 'upsert'],
      applications: ['create', 'listByCandidate', 'listByEmployer'],
      employers: ['create', 'get', 'listForUser'],
    },
  };
};
