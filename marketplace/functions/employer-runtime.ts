import { FieldValue } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';
import { marketplaceCollections } from './collections';

export const createEmployerRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const db = runtime.firestore;

  return {
    async createEmployer(input: {
      employerId: string;
      ownerUid: string;
      companyName: string;
      website?: string;
      description?: string;
    }) {
      await db
        .collection(marketplaceCollections.employers)
        .doc(input.employerId)
        .set({
          ...input,
          moderationStatus: 'pending',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

      return {
        ok: true,
        employerId: input.employerId,
      };
    },

    async getEmployer(employerId: string) {
      const snapshot = await db
        .collection(marketplaceCollections.employers)
        .doc(employerId)
        .get();

      if (!snapshot.exists) {
        return null;
      }

      return {
        id: snapshot.id,
        ...snapshot.data(),
      };
    },
  };
};
