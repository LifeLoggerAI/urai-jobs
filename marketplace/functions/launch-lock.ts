import type { MarketplaceEnv } from './env.js';

export const assertMarketplaceLaunchState = (
  env: MarketplaceEnv,
  operation: string,
) => {
  if (!env.launchApproved) {
    throw new Error(`MARKETPLACE_LAUNCH_BLOCKED:${operation}`);
  }

  return {
    ok: true,
    operation,
    launchApproved: true,
  };
};
