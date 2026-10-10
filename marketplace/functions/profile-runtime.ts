import { FieldValue } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime.js';
import { marketplaceCollections } from './collections.js';
import type { MarketplaceAuthContext, MarketplaceConsent } from './auth.js';
import { assertCurrentMarketplaceActor, assertCurrentMarketplaceAuth, assertCurrentMarketplaceConsent, assertTenant, parseConsent } from './auth-runtime.js';

export const createProfileRuntime = () => {
  const db = initializeMarketplaceAdminRuntime().firestore;
  return {
    async getProfile(actor: MarketplaceAuthContext) {
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        const snapshot = await transaction.get(db.collection(marketplaceCollections.candidateProfiles).doc(current.uid));
        if (!snapshot.exists) { await assertCurrentMarketplaceAuth(actor); return null; }
        const data = snapshot.data() || {};
        assertTenant(data, current.tenantId);
        await assertCurrentMarketplaceConsent(db, transaction, current.uid, parseConsent(data.consent, 'career.profile'));
        await assertCurrentMarketplaceAuth(actor);
        return { ...data, id: snapshot.id };
      });
    },
    async upsertProfile(actor: MarketplaceAuthContext, input: {
      displayName: string; location?: string; skills?: string[]; links?: string[];
      experience?: string; resumePath?: string; expectedRevision: number;
      consentGranted: boolean; consent: MarketplaceConsent;
    }) {
      if (input.consentGranted !== true) throw new Error('CONSENT_REQUIRED');
      const consent = parseConsent(input.consent, 'career.profile');
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        const ref = db.collection(marketplaceCollections.candidateProfiles).doc(current.uid);
        const snapshot = await transaction.get(ref);
        const previous = snapshot.data() || {};
        if (snapshot.exists) assertTenant(previous, current.tenantId);
        const revision = snapshot.exists ? previous.revision : 0;
        if (revision !== input.expectedRevision) throw new Error('PROFILE_REVISION_CHANGED');
        await assertCurrentMarketplaceConsent(db, transaction, current.uid, consent);
        const now = FieldValue.serverTimestamp();
        const patch = {
          uid: current.uid, tenantId: current.tenantId, displayName: input.displayName,
          email: actor.email ?? null, location: input.location ?? previous.location ?? '',
          skills: input.skills ?? previous.skills ?? [], links: input.links ?? previous.links ?? [],
          experience: input.experience ?? previous.experience ?? '',
          resumePath: input.resumePath ?? previous.resumePath ?? null,
          consent, revision: input.expectedRevision + 1,
          createdAt: previous.createdAt ?? now, updatedAt: now,
        };
        await assertCurrentMarketplaceAuth(actor);
        transaction.set(ref, patch);
        return { ok: true, uid: current.uid, revision: patch.revision };
      });
    },
  };
};
