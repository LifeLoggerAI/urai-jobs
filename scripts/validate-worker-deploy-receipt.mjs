import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const IMAGE_DIGEST_PATTERN = /(?:^|@)sha256:[0-9a-f]{64}$/;
const ALLOWED_ENVIRONMENTS = new Set(['staging', 'prod', 'production']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateWorkerDeployReceipt(receipt) {
  const failures = [];

  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new Error('worker deployment receipt must be a JSON object');
  }

  if (receipt.schemaVersion !== 'urai-jobs-worker-deploy-receipt-1') {
    failures.push('schemaVersion must equal urai-jobs-worker-deploy-receipt-1');
  }
  if (!nonEmptyString(receipt.generatedAt) || !Number.isFinite(Date.parse(receipt.generatedAt))) {
    failures.push('generatedAt must be a valid timestamp');
  }
  if (!nonEmptyString(receipt.repository)) failures.push('repository is required');
  if (!SHA_PATTERN.test(String(receipt.commitSha ?? ''))) failures.push('commitSha must be a full lowercase 40-character SHA');
  if (!nonEmptyString(receipt.project)) failures.push('project is required');
  if (!nonEmptyString(receipt.region)) failures.push('region is required');
  if (!ALLOWED_ENVIRONMENTS.has(String(receipt.environment ?? ''))) failures.push('environment must be staging, prod, or production');
  if (!nonEmptyString(receipt.artifactRegistryRepository)) failures.push('artifactRegistryRepository is required');
  if (!nonEmptyString(receipt.runtimeServiceAccount)) failures.push('runtimeServiceAccount is required');

  if (!Array.isArray(receipt.services) || receipt.services.length === 0) {
    failures.push('services must contain at least one deployed worker');
  } else {
    const seenWorkers = new Set();
    for (const [index, service] of receipt.services.entries()) {
      const prefix = `services[${index}]`;
      if (!service || typeof service !== 'object' || Array.isArray(service)) {
        failures.push(`${prefix} must be an object`);
        continue;
      }
      if (!nonEmptyString(service.worker)) failures.push(`${prefix}.worker is required`);
      if (seenWorkers.has(service.worker)) failures.push(`${prefix}.worker duplicates ${service.worker}`);
      seenWorkers.add(service.worker);
      if (!nonEmptyString(service.buildId)) failures.push(`${prefix}.buildId is required`);
      if (!nonEmptyString(service.serviceUrl) || !String(service.serviceUrl).startsWith('https://')) {
        failures.push(`${prefix}.serviceUrl must be an https URL`);
      }
      if (!nonEmptyString(service.revision)) failures.push(`${prefix}.revision is required`);
      if (!IMAGE_DIGEST_PATTERN.test(String(service.imageDigest ?? ''))) {
        failures.push(`${prefix}.imageDigest must be an immutable sha256 digest`);
      }
      if (!HEX64_PATTERN.test(String(service.configFingerprint ?? ''))) {
        failures.push(`${prefix}.configFingerprint must be a lowercase 64-character SHA-256 value`);
      }
      if (service.unauthorizedProbe !== 'PASS') failures.push(`${prefix}.unauthorizedProbe must equal PASS`);
      if (service.authorizedProbe !== 'PASS') failures.push(`${prefix}.authorizedProbe must equal PASS`);
      if ((receipt.environment === 'prod' || receipt.environment === 'production') && !nonEmptyString(service.rollbackRevision)) {
        failures.push(`${prefix}.rollbackRevision is required for production`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`worker deployment receipt validation failed:\n- ${failures.join('\n- ')}`);
  }

  return true;
}

function validFixture() {
  return {
    schemaVersion: 'urai-jobs-worker-deploy-receipt-1',
    generatedAt: '2026-07-11T15:00:00.000Z',
    repository: 'LifeLoggerAI/urai-jobs',
    branch: 'secure-worker-deploy-20260706',
    commitSha: 'a'.repeat(40),
    project: 'urai-jobs-staging',
    region: 'us-central1',
    environment: 'staging',
    artifactRegistryRepository: 'urai-jobs',
    runtimeServiceAccount: 'urai-jobs-worker@example.iam.gserviceaccount.com',
    services: [
      {
        worker: 'narrator-worker',
        buildId: 'build-123',
        serviceUrl: 'https://narrator-worker.example.run.app',
        revision: 'narrator-worker-00001-abc',
        rollbackRevision: null,
        imageDigest: `sha256:${'b'.repeat(64)}`,
        configFingerprint: 'c'.repeat(64),
        unauthorizedProbe: 'PASS',
        authorizedProbe: 'PASS',
      },
    ],
    caveats: [],
  };
}

export function runWorkerDeployReceiptValidatorSelfTest() {
  validateWorkerDeployReceipt(validFixture());

  const missingDigest = validFixture();
  missingDigest.services[0].imageDigest = null;
  try {
    validateWorkerDeployReceipt(missingDigest);
    throw new Error('missing image digest fixture unexpectedly passed');
  } catch (error) {
    if (String(error).includes('unexpectedly passed')) throw error;
  }

  const productionWithoutRollback = validFixture();
  productionWithoutRollback.environment = 'production';
  try {
    validateWorkerDeployReceipt(productionWithoutRollback);
    throw new Error('production receipt without rollback fixture unexpectedly passed');
  } catch (error) {
    if (String(error).includes('unexpectedly passed')) throw error;
  }

  const invalidSourceSha = validFixture();
  invalidSourceSha.commitSha = 'manual';
  try {
    validateWorkerDeployReceipt(invalidSourceSha);
    throw new Error('invalid source SHA fixture unexpectedly passed');
  } catch (error) {
    if (String(error).includes('unexpectedly passed')) throw error;
  }

  return true;
}

function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  if (process.argv[2] === '--self-test') {
    runWorkerDeployReceiptValidatorSelfTest();
    console.log('[PASS] worker deployment receipt validator self-test');
  } else {
    const receiptPath = process.argv[2];
    if (!receiptPath) {
      console.error('Usage: node scripts/validate-worker-deploy-receipt.mjs <receipt.json> | --self-test');
      process.exit(2);
    }
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    validateWorkerDeployReceipt(receipt);
    console.log(`[PASS] worker deployment receipt validated: ${receiptPath}`);
  }
}
