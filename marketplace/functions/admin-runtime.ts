import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime.js';
import { marketplaceCollections } from './collections.js';
import type { MarketplaceAuthContext } from './auth.js';
import { requireAdmin } from './auth.js';
import { assertCurrentMarketplaceActor, assertCurrentMarketplaceAuth, assertTenant, currentMarketplaceAuthBinding,
  readCurrentMarketplaceAccount, requireIdentifier } from './auth-runtime.js';
import { requireApprovedEmployer, requireEmployerName } from './ownership-runtime.js';

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
  const moderateEmployer = (actor: MarketplaceAuthContext,
    input: { employerId: string; action: 'approve' | 'reject'; reason?: string }) => {
    requireAdmin(actor);
    const employerId = requireIdentifier(input.employerId, 'employerId');
    let admittedReview: string | undefined;
    return db.runTransaction(async transaction => {
      const current = await assertCurrentMarketplaceActor(db, transaction, actor);
      const ref = db.collection(marketplaceCollections.employers).doc(employerId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error('EMPLOYER_NOT_FOUND');
      const data = snapshot.data() || {};
      assertTenant(data, current.tenantId);
      if (data.status !== 'pending_review' || data.moderationStatus !== 'pending') throw new Error('EMPLOYER_NOT_EDITABLE');
      if (data.id !== employerId) throw new Error('EMPLOYER_REVIEW_CHANGED');
      const ownerUid = requireIdentifier(data.createdBy, 'employer createdBy');
      if (data.ownerUid !== undefined && data.ownerUid !== ownerUid) throw new Error('EMPLOYER_OWNER_REQUIRED');
      requireEmployerName(data);
      const review = createHash('sha256').update(JSON.stringify(Object.fromEntries(
        Object.entries(data).sort(([a], [b]) => a.localeCompare(b))))).digest('hex');
      // A transaction retry may observe a changed organization. It cannot turn
      // the admitted review into approval of a replacement owner or source.
      if (admittedReview !== undefined && review !== admittedReview) throw new Error('EMPLOYER_REVIEW_CHANGED');
      admittedReview = review;
      let ownerAuth: string | undefined;
      if (input.action === 'approve') {
        const owner = await transaction.get(db.collection('users').doc(ownerUid));
        const account = readCurrentMarketplaceAccount(ownerUid, owner.exists ? owner.data() : undefined);
        if (account.tenantId !== current.tenantId) throw new Error('TENANT_MISMATCH');
        ownerAuth = await currentMarketplaceAuthBinding(ownerUid);
      }
      if (ownerAuth !== undefined && ownerAuth !== await currentMarketplaceAuthBinding(ownerUid)) {
        throw new Error('ACCOUNT_AUTHORITY_CHANGED');
      }
      await assertCurrentMarketplaceAuth(actor);
      const now = FieldValue.serverTimestamp();
      const approved = input.action === 'approve';
      const patch = approved ? { status: 'approved', moderationStatus: 'approved',
        approvedBy: current.uid, approvedAt: now, updatedAt: now }
        : { status: 'rejected', moderationStatus: 'rejected', rejectedBy: current.uid,
          rejectedReason: input.reason ?? null, rejectedAt: now, updatedAt: now };
      transaction.update(ref, patch);
      transaction.create(db.collection(marketplaceCollections.auditLogs).doc(), {
        actorUid: current.uid, tenantId: current.tenantId, action: approved ? 'employer.approved' : 'employer.rejected',
        targetType: 'employer', targetId: employerId, reviewDigest: review,
        previousStatus: data.status, status: patch.status, reason: approved ? null : input.reason ?? null, createdAt: now,
      });
      return { ok: true, employerId, status: patch.status, moderationStatus: patch.moderationStatus };
    });
  };
  return {
    async listModerationQueue(actor: MarketplaceAuthContext) {
      requireAdmin(actor);
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        const snapshot = await transaction.get(db.collection(marketplaceCollections.publicJobs)
          .where('tenantId', '==', current.tenantId).where('moderationStatus', '==', 'pending').limit(100));
        const employers = await transaction.get(db.collection(marketplaceCollections.employers)
          .where('tenantId', '==', current.tenantId).where('moderationStatus', '==', 'pending').limit(100));
        await assertCurrentMarketplaceAuth(actor);
        return { jobs: snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })),
          employers: employers.docs.filter(doc => doc.data().status === 'pending_review')
            .map(doc => ({ ...doc.data(), id: doc.id })) };
      });
    },
    approveJob(actor: MarketplaceAuthContext, input: { jobId: string }) { return moderate(actor, input, true); },
    rejectJob(actor: MarketplaceAuthContext, input: { jobId: string; reason?: string }) { return moderate(actor, input, false); },
    moderateEmployer,
  };
};
