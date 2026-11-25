import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime.js';
import { marketplaceCollections } from './collections.js';
import type { MarketplaceAuthContext } from './auth.js';
import { assertCurrentMarketplaceActor, assertCurrentMarketplaceAuth, assertTenant, requireIdentifier } from './auth-runtime.js';

export const requireApprovedEmployer = (data: Record<string, unknown>) => {
  if (data.status !== 'approved') throw new Error('EMPLOYER_NOT_ACTIVE');
};

export const assertEmployerOwner = (data: Record<string, unknown>, uid: string) => {
  if (data.createdBy !== uid || (data.ownerUid !== undefined && data.ownerUid !== uid)) {
    throw new Error('EMPLOYER_OWNER_REQUIRED');
  }
};

export const requireEmployerName = (data: Record<string, unknown>): string => {
  const value = data.orgName === undefined ? data.companyName : data.orgName;
  if (typeof value !== 'string' || !value.trim() || value.length > 256) throw new Error('EMPLOYER_NOT_ACTIVE');
  return value.trim();
};

export const readOwnedEmployer = async (db: Firestore, transaction: Transaction,
  employerId: string, actor: { uid: string; tenantId: string }) => {
  requireIdentifier(employerId, 'employerId');
  const snapshot = await transaction.get(db.collection(marketplaceCollections.employers).doc(employerId));
  if (!snapshot.exists) throw new Error('EMPLOYER_NOT_FOUND');
  const data = snapshot.data() || {};
  assertTenant(data, actor.tenantId);
  assertEmployerOwner(data, actor.uid);
  return data;
};

export const createOwnershipRuntime = () => {
  const db = initializeMarketplaceAdminRuntime().firestore;
  return {
    async requireEmployerOwner(input: { employerId: string; actor: MarketplaceAuthContext }) {
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, input.actor);
        await readOwnedEmployer(db, transaction, input.employerId, current);
        await assertCurrentMarketplaceAuth(input.actor);
        return { ok: true, employerId: input.employerId };
      });
    },
    async requireJobOwner(input: { jobId: string; actor: MarketplaceAuthContext }) {
      requireIdentifier(input.jobId, 'jobId');
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, input.actor);
        const snapshot = await transaction.get(db.collection(marketplaceCollections.publicJobs).doc(input.jobId));
        if (!snapshot.exists) throw new Error('JOB_NOT_FOUND');
        const data = snapshot.data() || {};
        assertTenant(data, current.tenantId);
        if (data.createdBy !== current.uid) throw new Error('JOB_OWNER_REQUIRED');
        await readOwnedEmployer(db, transaction, requireIdentifier(data.employerId, 'employerId'), current);
        await assertCurrentMarketplaceAuth(input.actor);
        return { ok: true, jobId: input.jobId };
      });
    },
  };
};
