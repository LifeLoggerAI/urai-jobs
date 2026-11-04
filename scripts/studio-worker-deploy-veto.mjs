import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// R522: temporary, unconditional protection while Jobs #252 remains P0.
// This parser runs before either approved or direct worker deployment mutates
// Cloud Run, Storage, IAM, Secret Manager, or Artifact Registry.
// It does not change live IAM or prove that older revisions cannot write.
const ALLOWED_WORKERS = new Set([
  'narrator-worker',
  'asset-worker',
  'studio-worker',
  'private-source-worker',
  'captured-reality-worker',
]);
const DENIED = 'STUDIO_WORKER_DEPLOY_HARD_OFF';

export function assertSafeWorkerDeployment(selection) {
  if (typeof selection !== 'string' || selection.trim().length === 0) {
    throw new Error('WORKER_SELECTION_UNVERIFIED');
  }
  const workers = selection.split(',').map((item) => item.trim());
  if (workers.some((worker) => !ALLOWED_WORKERS.has(worker)) ||
      new Set(workers).size !== workers.length) {
    throw new Error('WORKER_SELECTION_UNVERIFIED');
  }
  if (workers.includes('studio-worker')) {
    // No environment variable, bearer token or caller-supplied approval
    // can override this until broker-exclusive IAM is independently proven.
    throw new Error(DENIED);
  }
  return workers;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assertSafeWorkerDeployment(process.env.WORKERS_CSV);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'WORKER_SELECTION_UNVERIFIED';
    console.error('[FAIL] ' + code + '; review Jobs #252 before Studio worker deployment.');
    process.exitCode = 1;
  }
}
