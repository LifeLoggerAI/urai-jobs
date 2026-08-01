import { onRequest } from 'firebase-functions/v1/https';

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export const buildInfo = onRequest((request, response) => {
  if (request.method !== 'GET') {
    response.set('Allow', 'GET');
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const sourceSha = String(process.env.URAI_BUILD_SHA || '').trim();
  const environment = String(process.env.URAI_ENV || '').trim();
  const projectId = String(
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    ''
  ).trim();

  response.set('Cache-Control', 'no-store, max-age=0');
  response.set('X-Content-Type-Options', 'nosniff');

  if (!SHA_PATTERN.test(sourceSha) || !environment || !projectId) {
    response.status(503).json({
      schemaVersion: 'urai-jobs-build-info-1',
      status: 'misconfigured',
      sourceSha: SHA_PATTERN.test(sourceSha) ? sourceSha : null,
      environment: environment || null,
      projectId: projectId || null,
    });
    return;
  }

  response.status(200).json({
    schemaVersion: 'urai-jobs-build-info-1',
    status: 'ok',
    sourceSha,
    environment,
    projectId,
  });
});
