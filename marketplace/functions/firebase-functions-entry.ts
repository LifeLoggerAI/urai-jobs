// Keep the existing isolated API identity; mount the persisted onRequest entry.
// The entry enforces the closed launch state before invoking the runtime router.
export { marketplaceHttpsApi as marketplaceApi } from './https-entry.js';

export const marketplaceEntrypointState = () => ({
  ok: true, entrypoint: 'persisted-https-runtime', launchState: 'launch-gated',
});
