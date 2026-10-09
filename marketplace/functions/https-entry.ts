import { onRequest } from 'firebase-functions/v2/https';
import { readMarketplaceEnv } from './env.js';
import { assertMarketplaceLaunchState } from './launch-lock.js';
import { routeMarketplaceRuntimeRequest } from './runtime-router.js';
import { fromError, fail } from './responses.js';

const readBody = (body: unknown): Record<string, unknown> => {
  if (body === undefined || body === null || body === '') return {};
  if (typeof body !== 'object' || Array.isArray(body)) throw new Error('VALIDATION_BODY');
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 65536) throw new Error('VALIDATION_BODY_SIZE');
  return body as Record<string, unknown>;
};

export const marketplaceHttpsApi = onRequest({ region: 'us-central1', cors: false }, async (request, response) => {
  try {
    const env = readMarketplaceEnv();
    const origin = request.headers.origin;
    if (origin && origin !== env.allowedOrigin) {
      response.status(403).json(fail('ORIGIN_NOT_ALLOWED', 'Origin not allowed.', 403));
      return;
    }
    if (origin) { response.set('Access-Control-Allow-Origin', origin); response.set('Vary', 'Origin'); }
    response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
    if (request.method === 'GET' && request.path === '/api/marketplace/health') {
      response.status(200).json({ ok: true, service: 'urai-jobs-marketplace',
        launchState: 'launch-gated', ready: false, launchApproved: env.launchApproved });
      return;
    }
    // This existing release hold is enforced before any Auth, Firestore or Storage work.
    assertMarketplaceLaunchState(env, request.method + ':' + request.path);
    const result = await routeMarketplaceRuntimeRequest({ method: request.method,
      path: request.path, authorization: request.headers.authorization, body: readBody(request.body) });
    response.status('status' in result && typeof result.status === 'number' ? result.status : result.ok ? 200 : 400).json(result);
  } catch (error) {
    const result = fromError(error);
    response.status(result.status).json(result);
  }
});
