import type { MarketplaceAuthContext } from './auth';

export const verifyMarketplaceToken = async (
  authorizationHeader?: string,
): Promise<MarketplaceAuthContext> => {
  if (!authorizationHeader) {
    return {
      uid: null,
    };
  }

  if (!authorizationHeader.startsWith('Bearer ')) {
    throw new Error('INVALID_AUTHORIZATION_HEADER');
  }

  const token = authorizationHeader.replace('Bearer ', '').trim();

  if (!token) {
    throw new Error('EMPTY_AUTH_TOKEN');
  }

  return {
    uid: 'token-verification-scaffold',
    email: 'launch-gated@urai.jobs',
    admin: false,
    employerIds: [],
  };
};
