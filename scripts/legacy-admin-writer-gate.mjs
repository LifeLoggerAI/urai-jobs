/**
 * Legacy Admin SDK scripts predate the authenticated Jobs authorization path.
 * They are usable only against a disposable local Firestore emulator.
 * This is not authorization to create, replay, render, or inspect user media.
 */
const PREFIX = 'URAI_LEGACY_WRITER_HOLD';

function reject(reason) {
  throw new Error(`${PREFIX}: ${reason}`);
}

export function assertDisposableLegacyWriter(env = process.env) {
  if (env.URAI_LEGACY_WRITER_SCOPE !== 'DISPOSABLE_FIRESTORE_EMULATOR_ONLY') {
    reject('explicit disposable-emulator scope is required; use the authorized Jobs callable for real work');
  }
  const host = env.FIRESTORE_EMULATOR_HOST;
  if (typeof host !== 'string' || !/^(?:localhost|127\.0\.0\.1|\[::1\]):\d{1,5}$/.test(host)) {
    reject('FIRESTORE_EMULATOR_HOST must be loopback with a numeric port');
  }
  const port = Number(host.slice(host.lastIndexOf(':') + 1));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    reject('invalid Firestore emulator port');
  }
  const declared = [
    env.FIREBASE_PROJECT_ID,
    env.GCLOUD_PROJECT,
    env.GOOGLE_CLOUD_PROJECT,
    env.CLOUDSDK_CORE_PROJECT,
  ].filter(value => value !== undefined && value !== '');
  if (declared.length === 0 || declared.some(value => typeof value !== 'string' || !/^demo-[a-z0-9][a-z0-9-]{0,62}$/.test(value))) {
    reject('a demo-* Firebase project ID is required; live and unknown projects are forbidden');
  }
  if (new Set(declared).size !== 1) {
    reject('all declared Firebase/GCP project IDs must agree');
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_CONFIG ||
      env.GOOGLE_CLOUD_BUCKET || env.FIREBASE_STORAGE_BUCKET || env.GOOGLE_CLOUD_QUOTA_PROJECT) {
    reject('cloud credentials or Storage bucket environment variables are forbidden');
  }
  return Object.freeze({ projectId: declared[0], firestoreHost: host });
}

export function refuseLegacyManualQueueDrain() {
  reject('raw Admin SDK/gcloud queue-drain bypass is retired; use the authenticated processQueueNow callable after native acceptance');
}
