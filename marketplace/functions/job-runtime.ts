import { FieldValue } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime.js';
import { marketplaceCollections } from './collections.js';
import type { MarketplaceAuthContext } from './auth.js';
import { assertCurrentMarketplaceActor, assertCurrentMarketplaceAuth, assertTenant, requireIdentifier } from './auth-runtime.js';
import { readOwnedEmployer, requireEmployerName } from './ownership-runtime.js';

export const createJobRuntime = () => {
  const db = initializeMarketplaceAdminRuntime().firestore;
  const admitOwnedJob = async (transaction: import('firebase-admin/firestore').Transaction,
    actor: MarketplaceAuthContext, jobId: string) => {
    const current = await assertCurrentMarketplaceActor(db, transaction, actor);
    const ref = db.collection(marketplaceCollections.publicJobs).doc(requireIdentifier(jobId, 'jobId'));
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error('JOB_NOT_FOUND');
    const data = snapshot.data() || {};
    assertTenant(data, current.tenantId);
    if (data.createdBy !== current.uid) throw new Error('JOB_OWNER_REQUIRED');
    await readOwnedEmployer(db, transaction, requireIdentifier(data.employerId, 'employerId'), current);
    return { current, ref, data };
  };
  return {
    async createJob(actor: MarketplaceAuthContext, input: {
      jobId: string; employerId: string; title: string; description: string;
      location?: string; remote?: boolean; employmentType?: string;
    }) {
      const jobId = requireIdentifier(input.jobId, 'jobId');
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        const employer = await readOwnedEmployer(db, transaction, input.employerId, current);
        if (!['pending_review', 'approved'].includes(String(employer.status))) throw new Error('EMPLOYER_NOT_ACTIVE');
        const companyName = requireEmployerName(employer);
        const ref = db.collection(marketplaceCollections.publicJobs).doc(jobId);
        if ((await transaction.get(ref)).exists) throw new Error('JOB_ALREADY_EXISTS');
        await assertCurrentMarketplaceAuth(actor);
        const now = FieldValue.serverTimestamp();
        transaction.create(ref, { id: jobId, slug: jobId, employerId: input.employerId,
          tenantId: current.tenantId, createdBy: current.uid,
          companyName, title: input.title, description: input.description,
          location: input.location ?? '', remote: input.remote ?? false,
          employmentType: input.employmentType ?? 'contract', requirements: [], featured: false,
          status: 'pending_review', moderationStatus: 'pending', createdAt: now, updatedAt: now });
        return { ok: true, jobId };
      });
    },
    async updateJob(actor: MarketplaceAuthContext, input: {
      jobId: string; title?: string; description?: string; location?: string;
      remote?: boolean; employmentType?: string;
    }) {
      return db.runTransaction(async transaction => {
        const admitted = await admitOwnedJob(transaction, actor, input.jobId);
        if (['closed', 'rejected'].includes(String(admitted.data.status))) throw new Error('JOB_NOT_EDITABLE');
        const employer = await readOwnedEmployer(db, transaction, String(admitted.data.employerId), admitted.current);
        if (!['pending_review', 'approved'].includes(String(employer.status))) throw new Error('EMPLOYER_NOT_ACTIVE');
        const { jobId, ...values } = input;
        const updates = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
        await assertCurrentMarketplaceAuth(actor);
        transaction.update(admitted.ref, { ...updates, status: 'pending_review',
          moderationStatus: 'pending', updatedAt: FieldValue.serverTimestamp() });
        return { ok: true, jobId };
      });
    },
    async closeJob(actor: MarketplaceAuthContext, input: { jobId: string }) {
      return db.runTransaction(async transaction => {
        const admitted = await admitOwnedJob(transaction, actor, input.jobId);
        await assertCurrentMarketplaceAuth(actor);
        transaction.update(admitted.ref, { status: 'closed', closedBy: admitted.current.uid,
          closedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        return { ok: true, jobId: input.jobId, status: 'closed' };
      });
    },
  };
};
