/**
 * R1047: pure, no-network preflight for disposable Firebase emulators.
 * This helper never logs environment VALUES or grants cloud permissions.
 * The caller must run it before importing Firebase Admin or touching provider APIs.
 */
export const R1047_DENIED = 'R1047_DISPOSABLE_EMULATOR_ENV_DENIED';
export const DISPOSABLE_PROJECT = 'urai-staging-test';
export const SECRET_KEYS = Object.freeze([
  'RUNPOD_API_KEY', 'GITHUB_TOKEN', 'GH_TOKEN', 'GITLAB_TOKEN',
  'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_OAUTH_ACCESS_TOKEN',
  'GOOGLE_CLOUD_ACCESS_TOKEN', 'GOOGLE_API_KEY', 'GCP_ACCESS_TOKEN',
  'FIREBASE_TOKEN', 'FIREBASE_CLI_TOKEN', 'NPM_TOKEN', 'VERCEL_TOKEN',
  'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
  'AZURE_CLIENT_SECRET', 'AZURE_STORAGE_CONNECTION_STRING',
  'OPENAI_API_KEY', 'STRIPE_SECRET_KEY',
]);
const HAS = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const SENSITIVE_NAME = /(?:^|_)(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|ACCESS_KEY|CREDENTIALS?)(?:_|$)/i;
function fail(reason, key) {
  // A field name is safe diagnostic context; never include its value.
  throw new Error(`${R1047_DENIED}:${reason}:${key}`);
}
export function assertDisposableEmulatorEnvironment(env) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) fail('ENV_INVALID', 'env');
  if (env.URAI_EMULATOR_PROJECT !== DISPOSABLE_PROJECT) fail('PROJECT_MISMATCH', 'URAI_EMULATOR_PROJECT');
  if (env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') fail('HOST_MISMATCH', 'FIRESTORE_EMULATOR_HOST');
  if (env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') fail('HOST_MISMATCH', 'FIREBASE_STORAGE_EMULATOR_HOST');
  for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
    if (HAS(env, key) && env[key] && env[key] !== DISPOSABLE_PROJECT) fail('CLOUD_PROJECT_CONFLICT', key);
  }
  for (const key of Object.keys(env)) {
    if ((SECRET_KEYS.includes(key) || SENSITIVE_NAME.test(key)) && env[key] !== undefined && env[key] !== '') {
      fail('CREDENTIAL_PRESENT', key);
    }
  }
  const options = String(env.NODE_OPTIONS || '');
  if (/--(?:require|import|inspect|eval|experimental-loader)(?:\s|=|$)/.test(options)) fail('NODE_PRELOAD_UNTRUSTED', 'NODE_OPTIONS');
  return Object.freeze({ disposableOnly: true, productionAuthorized: false, releaseApproved: false });
}
