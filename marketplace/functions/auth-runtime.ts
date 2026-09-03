import type { MarketplaceAuthContext } from './auth';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';

export const verifyFirebaseIdToken = async (
  authorizationHeader?: string,
): Promise<MarketplaceAuthContext> => {
  if (!authorizationHeader) {
    return { uid: null };
  }

  if (!authorizationHeader.startsWith('Bearer ')) {
    throw new Error('INVALID_AUTHORIZATION_HEADER');
  }

  const idToken = authorizationHeader.replace('Bearer ', '').trim();

  if (!idToken) {
    throw new Error('EMPTY_AUTH_TOKEN');
  }

  const runtime = initializeMarketplaceAdminRuntime();
  const decoded = await runtime.auth.verifyIdToken(idToken, true);
  const employerIds = Array.isArray(decoded.employerIds)
    ? decoded.employerIds.filter((value): value is string => typeof value === 'string')
    : [];

  return {
    uid: decoded.uid,
    email: decoded.email,
    admin: decoded.admin === true,
    employerIds,
  };
};
