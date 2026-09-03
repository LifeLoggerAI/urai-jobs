import { FieldValue } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';
import { marketplaceCollections } from './collections';

export const createJobRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const db = runtime.firestore;

  return {
    async createJob(input: {
      jobId: string;
      employerId: string;
      createdBy: string;
      title: string;
      description: string;
      location?: string;
      remote?: boolean;
      employmentType?: string;
    }) {
      await db.collection(marketplaceCollections.jobs).doc(input.jobId).set({
        ...input,
        status: 'draft',
        moderationStatus: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        ok: true,
        jobId: input.jobId,
      };
    },

    async updateJob(input: {
      jobId: string;
      title?: string;
      description?: string;
      location?: string;
      remote?: boolean;
      employmentType?: string;
    }) {
      const { jobId, ...updates } = input;

      await db.collection(marketplaceCollections.jobs).doc(jobId).set(
        {
          ...updates,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return {
        ok: true,
        jobId,
      };
    },

    async closeJob(input: { jobId: string; closedBy: string }) {
      await db.collection(marketplaceCollections.jobs).doc(input.jobId).set(
        {
          status: 'closed',
          closedBy: input.closedBy,
          closedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return {
        ok: true,
        jobId: input.jobId,
        status: 'closed',
      };
    },
  };
};
