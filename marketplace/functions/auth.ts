export type MarketplaceConsent = {
  purpose: 'career.profile' | 'career.application';
  policyVersion: string;
  decisionReceiptId: string;
};

export type MarketplaceAuthContext = {
  uid: string | null;
  email?: string;
  tenantId?: string;
  admin?: boolean;
  accountBinding?: string;
  authBinding?: string;
  employerIds?: string[];
};

export const requireSignedIn = (auth: MarketplaceAuthContext): string => {
  if (!auth.uid) throw new Error('AUTH_REQUIRED');
  return auth.uid;
};

export const requireAdmin = (auth: MarketplaceAuthContext): string => {
  const uid = requireSignedIn(auth);
  if (auth.admin !== true) throw new Error('ADMIN_REQUIRED');
  return uid;
};

export const requireEmployerMember = (auth: MarketplaceAuthContext, employerId: string): string => {
  const uid = requireSignedIn(auth);
  if (!auth.employerIds?.includes(employerId)) throw new Error('EMPLOYER_MEMBERSHIP_REQUIRED');
  return uid;
};
