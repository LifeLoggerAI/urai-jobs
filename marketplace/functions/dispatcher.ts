import { marketplaceRoutes } from './http-routes';
import { verifyMarketplaceToken } from './token-verification';
import { fromError, ok } from './responses';

export const dispatchMarketplaceRequest = async (request: {
  method: string;
  path: string;
  authorization?: string;
}) => {
  try {
    const auth = await verifyMarketplaceToken(request.authorization);

    const route = marketplaceRoutes.find(
      (candidate) =>
        candidate.method === request.method && candidate.path === request.path,
    );

    if (!route) {
      return fromError(new Error('ROUTE_NOT_FOUND'));
    }

    return ok({
      route,
      auth,
      state: 'dispatcher-scaffolded',
      launchState: 'launch-gated',
    });
  } catch (error) {
    return fromError(error);
  }
};
