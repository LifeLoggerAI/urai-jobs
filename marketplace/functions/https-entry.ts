import { onRequest } from 'firebase-functions/v2/https';
import { readMarketplaceEnv } from './env';
import { routeMarketplaceRuntimeRequest } from './runtime-router';

const readBody = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }

  return body as Record<string, unknown>;
};

export const marketplaceHttpsApi = onRequest(
  {
    region: 'us-central1',
    cors: false,
  },
  async (request, response) => {
    const env = readMarketplaceEnv();
    const origin = request.headers.origin;

    if (origin && origin === env.allowedOrigin) {
      response.set('Access-Control-Allow-Origin', origin);
      response.set('Vary', 'Origin');
    }

    response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    const result = await routeMarketplaceRuntimeRequest({
      method: request.method,
      path: request.path,
      authorization: request.headers.authorization,
      body: readBody(request.body),
    });

    const status =
      typeof result.status === 'number' && Number.isInteger(result.status)
        ? result.status
        : result.ok
          ? 200
          : 400;

    response.status(status).json(result);
  },
);
