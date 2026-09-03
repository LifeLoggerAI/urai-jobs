export type MarketplaceAuthContext = {
  uid: string | null;
  email?: string;
  admin?: boolean;
  employerIds?: string[];
};

export const requireSignedIn = (auth: MarketplaceAuthContext) => {
  if (!auth.uid) {
    throw new Error('AUTH_REQUIRED');
  }

  return auth.uid;
};

export const requireAdmin = (auth: MarketplaceAuthContext) => {
  requireSignedIn(auth);

  if (auth.admin !== true) {
    throw new Error('ADMIN_REQUIRED');
  }

  return auth.uid;
};

export const requireEmployerMember = (
  auth: MarketplaceAuthContext,
  employerId: string,
) => {
  requireSignedIn(auth);

  if (!auth.employerIds?.includes(employerId)) {
    throw new Error('EMPLOYER_MEMBERSHIP_REQUIRED');
  }

  return auth.uid;
};
