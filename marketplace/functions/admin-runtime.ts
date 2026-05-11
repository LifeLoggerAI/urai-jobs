import { FieldValue } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';
import { marketplaceCollections } from './collections';
import type { MarketplaceAuthContext } from './auth';

export const requireAdmin = (auth: MarketplaceAuthContext) => {
  if (!auth.admin) {
    throw new Error('ADMIN_REQUIRED');
  }

  return auth.uid;
};

export const createMarketplaceAdminRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const db = runtime.firestore;

  return {
    async listModerationQueue() {
      return db
        .collection(marketplaceCollections.jobs)
        .where('moderationStatus', '==', 'pending')
        .limit(100)
        .get();
    },

    async approveJob(input: {
      adminUid: string;
      jobId: string;
    }) {
      await db.collection(marketplaceCollections.jobs).doc(input.jobId).set(
        {
          moderationStatus: 'approved',
          approvedBy: input.adminUid,
          approvedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return {
        ok: true,
        jobId: input.jobId,
        moderationStatus: 'approved',
      };
    },
  };
};
