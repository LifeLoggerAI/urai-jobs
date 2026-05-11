import { dispatchMarketplaceRequest } from './dispatcher';
import { readMarketplaceEnv } from './env';

export const createFirebaseHttpAdapter = () => {
  const env = readMarketplaceEnv();

  return {
    ok: true,
    runtime: 'firebase-http-adapter-scaffolded',
    allowedOrigin: env.allowedOrigin,
    async handle(input: {
      method: string;
      path: string;
      authorization?: string;
    }) {
      return dispatchMarketplaceRequest(input);
    },
  };
};
