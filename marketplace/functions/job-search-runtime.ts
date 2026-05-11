import type { Query } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';
import { marketplaceCollections } from './collections';

export type JobSearchInput = {
  search?: string;
  location?: string;
  remote?: boolean;
  employmentType?: string;
  limit?: number;
};

const normalizeLimit = (limit?: number) => {
  if (!limit || Number.isNaN(limit)) {
    return 20;
  }

  return Math.min(Math.max(limit, 1), 50);
};

export const createJobSearchRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const db = runtime.firestore;

  return {
    async listPublishedJobs(input: JobSearchInput = {}) {
      let query: Query = db
        .collection(marketplaceCollections.jobs)
        .where('status', '==', 'published')
        .where('moderationStatus', '==', 'approved');

      if (input.location) {
        query = query.where('location', '==', input.location);
      }

      if (typeof input.remote === 'boolean') {
        query = query.where('remote', '==', input.remote);
      }

      if (input.employmentType) {
        query = query.where('employmentType', '==', input.employmentType);
      }

      const snapshot = await query
        .orderBy('publishedAt', 'desc')
        .limit(normalizeLimit(input.limit))
        .get();

      const normalizedSearch = input.search?.trim().toLowerCase();
      const jobs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((job) => {
          if (!normalizedSearch) {
            return true;
          }

          const haystack = [
            typeof job.title === 'string' ? job.title : '',
            typeof job.description === 'string' ? job.description : '',
            typeof job.companyName === 'string' ? job.companyName : '',
          ]
            .join(' ')
            .toLowerCase();

          return haystack.includes(normalizedSearch);
        });

      return {
        ok: true,
        jobs,
        count: jobs.length,
        filters: {
          search: input.search ?? null,
          location: input.location ?? null,
          remote: input.remote ?? null,
          employmentType: input.employmentType ?? null,
          limit: normalizeLimit(input.limit),
        },
      };
    },
  };
};
