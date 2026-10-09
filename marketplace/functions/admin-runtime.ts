import { FieldValue } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime.js';
import { marketplaceCollections } from './collections.js';
import type { MarketplaceAuthContext } from './auth.js';
import { requireAdmin } from './auth.js';
import { assertCurrentMarketplaceActor, assertCurrentMarketplaceAuth, assertTenant, requireIdentifier } from './auth-runtime.js';
import { requireApprovedEmployer } from './ownership-runtime.js';

export const createMarketplaceAdminRuntime = () => {
  const db = initializeMarketplaceAdminRuntime().firestore;
  const moderate = (actor: MarketplaceAuthContext, input: { jobId: string; reason?: string }, approved: boolean) => {
    requireAdmin(actor);
    return db.runTransaction(async transaction => {
      const current = await assertCurrentMarketplaceActor(db, transaction, actor);
      const ref = db.collection(marketplaceCollections.publicJobs).doc(requireIdentifier(input.jobId, 'jobId'));
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error('JOB_NOT_FOUND');
      const data = snapshot.data() || {};
      assertTenant(data, current.tenantId);
      if (data.status !== 'pending_review' || data.moderationStatus !== 'pending') throw new Error('JOB_NOT_EDITABLE');
      const employer = await transaction.get(db.collection(marketplaceCollections.employers).doc(String(data.employerId)));
      assertTenant(employer.data(), current.tenantId);
      if (approved) requireApprovedEmployer(employer.data() || {});
      await assertCurrentMarketplaceAuth(actor);
      const now = FieldValue.serverTimestamp();
      const patch = approved ? { status: 'published', moderationStatus: 'approved',
        approvedBy: current.uid, approvedAt: now, publishedAt: now, updatedAt: now }
        : { status: 'rejected', moderationStatus: 'rejected', rejectedBy: current.uid,
          rejectedReason: input.reason ?? null, rejectedAt: now, updatedAt: now };
      transaction.update(ref, patch);
      return { ok: true, jobId: input.jobId, status: patch.status, moderationStatus: patch.moderationStatus };
    });
  };
  return {
    async listModerationQueue(actor: MarketplaceAuthContext) {
      requireAdmin(actor);
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        const snapshot = await transaction.get(db.collection(marketplaceCollections.publicJobs)
          .where('tenantId', '==', current.tenantId).where('moderationStatus', '==', 'pending').limit(100));
        await assertCurrentMarketplaceAuth(actor);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      });
    },
    approveJob(actor: MarketplaceAuthContext, input: { jobId: string }) { return moderate(actor, input, true); },
    rejectJob(actor: MarketplaceAuthContext, input: { jobId: string; reason?: string }) { return moderate(actor, input, false); },
  };
};
