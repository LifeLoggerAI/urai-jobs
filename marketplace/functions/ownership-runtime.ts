import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';
import { marketplaceCollections } from './collections';

export const createOwnershipRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const db = runtime.firestore;

  return {
    async requireEmployerOwner(input: {
      employerId: string;
      uid: string;
    }) {
      const snapshot = await db
        .collection(marketplaceCollections.employers)
        .doc(input.employerId)
        .get();

      if (!snapshot.exists) {
        throw new Error('EMPLOYER_NOT_FOUND');
      }

      const data = snapshot.data();

      if (data?.ownerUid !== input.uid) {
        throw new Error('EMPLOYER_OWNER_REQUIRED');
      }

      return {
        ok: true,
        employerId: input.employerId,
      };
    },

    async requireJobOwner(input: {
      jobId: string;
      uid: string;
    }) {
      const snapshot = await db
        .collection(marketplaceCollections.jobs)
        .doc(input.jobId)
        .get();

      if (!snapshot.exists) {
        throw new Error('JOB_NOT_FOUND');
      }

      const data = snapshot.data();

      if (data?.createdBy !== input.uid) {
        throw new Error('JOB_OWNER_REQUIRED');
      }

      return {
        ok: true,
        jobId: input.jobId,
      };
    },
  };
};
