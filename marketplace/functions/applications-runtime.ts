import { FieldValue } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';
import { marketplaceCollections } from './collections';

export const createApplicationRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const db = runtime.firestore;

  return {
    async createApplication(input: {
      candidateUid: string;
      jobId: string;
      employerId: string;
      resumeUrl?: string;
    }) {
      const uniqueKey = `${input.candidateUid}:${input.jobId}`;

      return db.runTransaction(async (transaction) => {
        const duplicateRef = db
          .collection(marketplaceCollections.applications)
          .doc(uniqueKey);

        const existing = await transaction.get(duplicateRef);

        if (existing.exists) {
          throw new Error('DUPLICATE_APPLICATION');
        }

        transaction.set(duplicateRef, {
          candidateUid: input.candidateUid,
          jobId: input.jobId,
          employerId: input.employerId,
          resumeUrl: input.resumeUrl ?? null,
          createdAt: FieldValue.serverTimestamp(),
          status: 'submitted',
        });

        return {
          ok: true,
          applicationId: uniqueKey,
        };
      });
    },
  };
};
