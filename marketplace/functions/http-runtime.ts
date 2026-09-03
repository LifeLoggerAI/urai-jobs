import { marketplaceRoutes } from './http-routes';
import { initializeMarketplaceFirebaseAdmin } from './firebase-admin';

export const createMarketplaceRuntime = () => {
  const firebase = initializeMarketplaceFirebaseAdmin();

  return {
    ok: true,
    firebase,
    routes: marketplaceRoutes,
    launchState: 'launch-gated',
  };
};

export const runtimeHealthcheck = () => {
  return {
    ok: true,
    service: 'urai-jobs-marketplace-runtime',
    timestamp: new Date().toISOString(),
    state: 'runtime-scaffolded',
  };
};
