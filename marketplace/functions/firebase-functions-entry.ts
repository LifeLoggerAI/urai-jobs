import { createFirebaseHttpAdapter } from './firebase-http-adapter';

export const marketplaceApi = async (request: {
  method: string;
  path: string;
  headers?: Record<string, string | undefined>;
}) => {
  const adapter = createFirebaseHttpAdapter();

  return adapter.handle({
    method: request.method,
    path: request.path,
    authorization: request.headers?.authorization,
  });
};

export const marketplaceEntrypointState = () => ({
  ok: true,
  entrypoint: 'firebase-functions-entry-scaffolded',
  launchState: 'launch-gated',
});
