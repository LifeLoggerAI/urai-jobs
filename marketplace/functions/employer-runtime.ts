import { FieldValue } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime.js';
import { marketplaceCollections } from './collections.js';
import type { MarketplaceAuthContext } from './auth.js';
import { assertCurrentMarketplaceActor, assertCurrentMarketplaceAuth, assertTenant, requireIdentifier } from './auth-runtime.js';
import { assertEmployerOwner } from './ownership-runtime.js';

export const createEmployerRuntime = () => {
  const db = initializeMarketplaceAdminRuntime().firestore;
  return {
    async createEmployer(actor: MarketplaceAuthContext, input: {
      employerId: string; companyName: string; website?: string; description?: string;
    }) {
      const employerId = requireIdentifier(input.employerId, 'employerId');
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        const ref = db.collection(marketplaceCollections.employers).doc(employerId);
        if ((await transaction.get(ref)).exists) throw new Error('EMPLOYER_ALREADY_EXISTS');
        await assertCurrentMarketplaceAuth(actor);
        const now = FieldValue.serverTimestamp();
        transaction.create(ref, { id: employerId, ownerUid: current.uid, createdBy: current.uid,
          tenantId: current.tenantId, companyName: input.companyName, orgName: input.companyName,
          website: input.website ?? null, description: input.description ?? '',
          status: 'pending_review', moderationStatus: 'pending', createdAt: now, updatedAt: now });
        return { ok: true, employerId };
      });
    },
    async getEmployer(actor: MarketplaceAuthContext, employerId: string) {
      requireIdentifier(employerId, 'employerId');
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        const snapshot = await transaction.get(db.collection(marketplaceCollections.employers).doc(employerId));
        if (!snapshot.exists) { await assertCurrentMarketplaceAuth(actor); return null; }
        const data = snapshot.data() || {};
        assertTenant(data, current.tenantId);
        assertEmployerOwner(data, current.uid);
        await assertCurrentMarketplaceAuth(actor);
        return { ...data, id: snapshot.id };
      });
    },
  };
};
