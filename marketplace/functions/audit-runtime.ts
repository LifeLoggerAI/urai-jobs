import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';
import { marketplaceCollections } from './collections';

export type MarketplaceAuditAction =
  | 'application.status_updated'
  | 'job.created'
  | 'job.updated'
  | 'job.closed'
  | 'job.approved'
  | 'job.rejected'
  | 'employer.created'
  | 'profile.updated';

export const createAuditRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const db = runtime.firestore;

  return {
    async record(input: {
      actorUid: string;
      action: MarketplaceAuditAction;
      targetType: string;
      targetId: string;
      metadata?: Record<string, unknown>;
    }) {
      const auditId = randomUUID();

      await db.collection(marketplaceCollections.auditLogs).doc(auditId).set({
        auditId,
        actorUid: input.actorUid,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ?? {},
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        ok: true,
        auditId,
      };
    },
  };
};
