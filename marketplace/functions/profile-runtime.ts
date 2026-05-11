import { FieldValue } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';
import { marketplaceCollections } from './collections';

export const createProfileRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const db = runtime.firestore;

  return {
    async getProfile(uid: string) {
      const snapshot = await db
        .collection(marketplaceCollections.profiles)
        .doc(uid)
        .get();

      if (!snapshot.exists) {
        return null;
      }

      return {
        id: snapshot.id,
        ...snapshot.data(),
      };
    },

    async upsertProfile(input: {
      uid: string;
      displayName?: string;
      email?: string;
      location?: string;
      skills?: string[];
      links?: string[];
      resumePath?: string;
    }) {
      const ref = db.collection(marketplaceCollections.profiles).doc(input.uid);
      const now = FieldValue.serverTimestamp();

      await ref.set(
        {
          ...input,
          updatedAt: now,
          createdAt: now,
        },
        { merge: true },
      );

      return {
        ok: true,
        uid: input.uid,
      };
    },
  };
};
