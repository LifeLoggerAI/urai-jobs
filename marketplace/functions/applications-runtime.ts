import { FieldValue } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';
import { marketplaceCollections } from './collections';
import { createAuditRuntime } from './audit-runtime';

export type ApplicationStatus =
  | 'submitted'
  | 'reviewing'
  | 'shortlisted'
  | 'rejected'
  | 'accepted';

export const createApplicationRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const db = runtime.firestore;
  const audit = createAuditRuntime();

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
          .collection(marketplaceCollections.jobApplications)
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
          updatedAt: FieldValue.serverTimestamp(),
          status: 'submitted',
        });

        return {
          ok: true,
          applicationId: uniqueKey,
        };
      });
    },

    async updateApplicationStatus(input: {
      employerId: string;
      actorUid: string;
      applicationId: string;
      status: ApplicationStatus;
      note?: string;
    }) {
      const applicationRef = db
        .collection(marketplaceCollections.jobApplications)
        .doc(input.applicationId);

      await applicationRef.update({
        status: input.status,
        employerNote: input.note ?? null,
        updatedAt: FieldValue.serverTimestamp(),
        reviewedBy: input.actorUid,
      });

      await audit.record({
        actorUid: input.actorUid,
        action: 'application.status_updated',
        targetType: 'application',
        targetId: input.applicationId,
        metadata: {
          employerId: input.employerId,
          status: input.status,
        },
      });

      return {
        ok: true,
        applicationId: input.applicationId,
        status: input.status,
      };
    },

    async listByCandidate(candidateUid: string) {
      const snapshot = await db
        .collection(marketplaceCollections.jobApplications)
        .where('candidateUid', '==', candidateUid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async listByEmployer(employerId: string) {
      const snapshot = await db
        .collection(marketplaceCollections.jobApplications)
        .where('employerId', '==', employerId)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },
  };
};
