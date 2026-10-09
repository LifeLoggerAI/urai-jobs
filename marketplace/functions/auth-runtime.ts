import { createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { MarketplaceAuthContext, MarketplaceConsent } from './auth.js';
import { requireSignedIn } from './auth.js';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime.js';

const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

export const requireIdentifier = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) throw new Error('VALIDATION_IDENTIFIER:' + name);
  return value;
};

export const requireApplicationIdentifier = (value: unknown): string => {
  if (typeof value !== 'string' || !(/^(?:application-[a-f0-9]{64}|[A-Za-z0-9_-]{1,128}:[A-Za-z0-9_-]{1,128})$/.test(value))) {
    throw new Error('VALIDATION_IDENTIFIER:applicationId');
  }
  return value;
};

export const requireApplicationPathIdentifier = (value: string): string => {
  try { return requireApplicationIdentifier(decodeURIComponent(value)); }
  catch { throw new Error('VALIDATION_IDENTIFIER:applicationId'); }
};

export function readCurrentMarketplaceAccount(uid: string, data: Record<string, unknown> | undefined) {
  if (!data || (data.uid !== undefined && data.uid !== uid)
    || (data.disabled !== undefined && data.disabled !== false)
    || (data.deleted !== undefined && data.deleted !== false)
    || ['deleted', 'disabled', 'suspended'].includes(String(data.status || ''))) {
    throw new Error('ACCOUNT_NOT_ACTIVE');
  }
  const tenantId = requireIdentifier(data.tenantId, 'server-owned tenantId');
  const role = typeof data.role === 'string' ? data.role : 'user';
  const revision = data.accountRevision ?? 0;
  if (!Number.isSafeInteger(revision) || Number(revision) < 0) throw new Error('ACCOUNT_NOT_ACTIVE');
  const binding = createHash('sha256').update(JSON.stringify({ uid, tenantId, role, revision,
    disabled: data.disabled ?? false, deleted: data.deleted ?? false, status: data.status ?? null })).digest('hex');
  return { tenantId, role, binding };
}

function liveAuthBinding(user: { uid: string; email?: string; disabled: boolean; tokensValidAfterTime?: string; customClaims?: Record<string, unknown> }) {
  return createHash('sha256').update(JSON.stringify({ uid: user.uid, email: user.email ?? null,
    disabled: user.disabled, tokensValidAfterTime: user.tokensValidAfterTime ?? null,
    claims: Object.fromEntries(Object.entries(user.customClaims || {}).sort(([a], [b]) => a.localeCompare(b))),
  })).digest('hex');
}

const adminClaim = (claims: Record<string, unknown>) => claims.admin === true || claims.role === 'admin'
  || (Array.isArray(claims.roles) && claims.roles.includes('admin'));

export const currentMarketplaceAuthBinding = async (uid: string): Promise<string> => {
  const liveUser = await initializeMarketplaceAdminRuntime().auth.getUser(uid);
  if (liveUser.disabled) throw new Error('ACCOUNT_NOT_ACTIVE');
  return liveAuthBinding(liveUser);
};

// Auth is a separate service: re-read it at the final decision boundary as well
// as admission. Firestore reads below fence account/consent changes atomically;
// this does not claim an atomic transaction across Auth and Firestore.
export const assertCurrentMarketplaceAuth = async (actor: MarketplaceAuthContext) => {
  const uid = requireIdentifier(requireSignedIn(actor), 'authenticated uid');
  if (!actor.authBinding || actor.authBinding !== await currentMarketplaceAuthBinding(uid)) {
    throw new Error('ACCOUNT_AUTHORITY_CHANGED');
  }
};

export const verifyFirebaseIdToken = async (authorizationHeader?: string): Promise<MarketplaceAuthContext> => {
  if (!authorizationHeader) return { uid: null };
  const match = /^Bearer ([^\s]+)$/.exec(authorizationHeader);
  if (!match) throw new Error('INVALID_AUTHORIZATION_HEADER');
  const runtime = initializeMarketplaceAdminRuntime();
  const decoded = await runtime.auth.verifyIdToken(match[1], true)
    .catch(() => { throw new Error('INVALID_AUTHORIZATION_HEADER'); });
  const uid = requireIdentifier(decoded.uid, 'authenticated uid');
  const liveUser = await runtime.auth.getUser(uid);
  if (liveUser.disabled) throw new Error('ACCOUNT_NOT_ACTIVE');
  const snapshot = await runtime.firestore.collection('users').doc(uid).get();
  const account = readCurrentMarketplaceAccount(uid, snapshot.exists ? snapshot.data() : undefined);
  if (decoded.firebase?.tenant && decoded.firebase.tenant !== account.tenantId) throw new Error('TENANT_MISMATCH');
  const claimedAdmin = adminClaim(decoded) && adminClaim(liveUser.customClaims || {});
  return { uid, email: liveUser.email, tenantId: account.tenantId,
    admin: claimedAdmin && account.role === 'admin', accountBinding: account.binding,
    authBinding: liveAuthBinding(liveUser) };
};

// Every private read/write admits the current protected account inside its transaction.
// Token verification alone cannot authorize a changed or deleted account.
export const assertCurrentMarketplaceActor = async (
  db: Firestore, transaction: Transaction, actor: MarketplaceAuthContext,
): Promise<{ uid: string; tenantId: string }> => {
  const uid = requireIdentifier(requireSignedIn(actor), 'authenticated uid');
  await assertCurrentMarketplaceAuth(actor);
  const snapshot = await transaction.get(db.collection('users').doc(uid));
  const current = readCurrentMarketplaceAccount(uid, snapshot.exists ? snapshot.data() : undefined);
  if (!actor.accountBinding || current.binding !== actor.accountBinding
    || current.tenantId !== actor.tenantId) throw new Error('ACCOUNT_AUTHORITY_CHANGED');
  return { uid, tenantId: current.tenantId };
};

export const assertTenant = (data: Record<string, unknown> | undefined, tenantId: string) => {
  if (!data || data.tenantId !== tenantId) throw new Error('TENANT_MISMATCH');
};

export const parseConsent = (value: unknown, purpose: MarketplaceConsent['purpose']): MarketplaceConsent => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('CONSENT_REQUIRED');
  const record = value as Record<string, unknown>;
  if (record.purpose !== purpose
    || typeof record.policyVersion !== 'string' || !/^[A-Za-z0-9._:-]{1,80}$/.test(record.policyVersion)
    || typeof record.decisionReceiptId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(record.decisionReceiptId)
    || Object.keys(record).some(key => !['purpose', 'policyVersion', 'decisionReceiptId'].includes(key))) {
    throw new Error('CONSENT_REQUIRED');
  }
  return { purpose, policyVersion: record.policyVersion, decisionReceiptId: record.decisionReceiptId };
};

// Consume the existing Jobs revocation authority; never create an approval,
// canonical consent receipt, regrant or parallel consent registry here.
export const assertCurrentMarketplaceConsent = async (
  db: Firestore, transaction: Transaction, ownerUid: string, consent: MarketplaceConsent,
) => {
  const blockId = createHash('sha256').update(ownerUid + '\n' + consent.purpose).digest('hex');
  const block = await transaction.get(db.collection('jobConsentBlocks').doc(blockId));
  if (!block.exists) return;
  const data = block.data() || {};
  if (data.active !== true || data.consumerId !== 'urai-jobs' || data.ownerUid !== ownerUid
    || data.purpose !== consent.purpose || data.status !== 'blocked' || typeof data.eventId !== 'string') {
    throw new Error('CONSENT_AUTHORITY_INVALID');
  }
  const receipt = await transaction.get(db.collection('jobConsentEventReceipts')
    .doc(createHash('sha256').update(data.eventId).digest('hex')));
  const expected = createHash('sha256').update([
    data.eventId, data.ownerUid, data.purpose, data.policyVersion, data.decisionReceiptId, data.status,
  ].join('\n')).digest('hex');
  const record = receipt.data() || {};
  if (!receipt.exists || data.integrityHash !== expected || record.integrityHash !== expected
    || ['consumerId', 'eventId', 'ownerUid', 'purpose', 'policyVersion', 'decisionReceiptId', 'status']
      .some(key => record[key] !== data[key])) throw new Error('CONSENT_AUTHORITY_INVALID');
  throw new Error('CONSENT_REVOKED');
};
