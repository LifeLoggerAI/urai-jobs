import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const NUMERIC_SECRET_VERSION_PATTERN = /^[1-9][0-9]*$/;
const IMAGE_DIGEST_PATTERN = /(?:^|@)sha256:[0-9a-f]{64}$/;
const ALLOWED_ENVIRONMENTS = new Set(['staging', 'prod', 'production']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function requiredSecretNames(worker) {
  return worker === 'asset-worker'
    ? ['URAI_JOBS_WORKER_TOKEN', 'URAI_WHEEL_GITHUB_TOKEN', 'URAI_JOBS_CALLBACK_SECRET']
    : ['URAI_JOBS_WORKER_TOKEN'];
}

export function validateWorkerDeployReceipt(receipt) {
  const failures = [];

  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new Error('worker deployment receipt must be a JSON object');
  }

  if (receipt.schemaVersion !== 'urai-jobs-worker-deploy-receipt-2') {
    failures.push('schemaVersion must equal urai-jobs-worker-deploy-receipt-2');
  }
  if (!nonEmptyString(receipt.generatedAt) || !Number.isFinite(Date.parse(receipt.generatedAt))) {
    failures.push('generatedAt must be a valid timestamp');
  }
  if (!nonEmptyString(receipt.repository)) failures.push('repository is required');
  if (!SHA_PATTERN.test(String(receipt.commitSha ?? ''))) failures.push('commitSha must be a full lowercase 40-character SHA');
  if (!SHA_PATTERN.test(String(receipt.rollbackSha ?? ''))) failures.push('rollbackSha must be a full lowercase 40-character SHA');
  if (receipt.commitSha === receipt.rollbackSha) failures.push('rollbackSha must differ from commitSha');
  if (!nonEmptyString(receipt.project)) failures.push('project is required');
  if (!nonEmptyString(receipt.region)) failures.push('region is required');
  if (!ALLOWED_ENVIRONMENTS.has(String(receipt.environment ?? ''))) failures.push('environment must be staging, prod, or production');
  if (!nonEmptyString(receipt.artifactRegistryRepository)) failures.push('artifactRegistryRepository is required');
  if (!nonEmptyString(receipt.artifactBucket)) failures.push('artifactBucket is required');
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
      if (!['narrator-worker', 'asset-worker'].includes(String(service.worker ?? ''))) failures.push(`${prefix}.worker is not approved`);
      if (seenWorkers.has(service.worker)) failures.push(`${prefix}.worker duplicates ${service.worker}`);
      seenWorkers.add(service.worker);
      if (!nonEmptyString(service.buildId)) failures.push(`${prefix}.buildId is required`);
      if (!nonEmptyString(service.serviceUrl) || !String(service.serviceUrl).startsWith('https://')) failures.push(`${prefix}.serviceUrl must be an https URL`);

      const expectedImage = `${receipt.region}-docker.pkg.dev/${receipt.project}/${receipt.artifactRegistryRepository}/${service.worker}:${receipt.commitSha}`;
      if (service.image !== expectedImage) failures.push(`${prefix}.image must equal exact source-bound image ${expectedImage}`);
      if (service.sourceSha !== receipt.commitSha) failures.push(`${prefix}.sourceSha must equal commitSha`);
      if (service.rollbackSourceSha !== receipt.rollbackSha) failures.push(`${prefix}.rollbackSourceSha must equal rollbackSha`);

      if (!nonEmptyString(service.revision) || !String(service.revision).startsWith(`${service.worker}-`)) failures.push(`${prefix}.revision must belong to ${service.worker}`);
      if (!nonEmptyString(service.rollbackRevision) || !String(service.rollbackRevision).startsWith(`${service.worker}-`)) failures.push(`${prefix}.rollbackRevision must belong to ${service.worker}`);
      if (service.rollbackRevision === service.revision) failures.push(`${prefix}.rollbackRevision must differ from revision`);
      if (!IMAGE_DIGEST_PATTERN.test(String(service.imageDigest ?? ''))) failures.push(`${prefix}.imageDigest must be immutable`);
      if (!IMAGE_DIGEST_PATTERN.test(String(service.rollbackImageDigest ?? ''))) failures.push(`${prefix}.rollbackImageDigest must bind the rollback revision`);

      if (!service.secretVersions || typeof service.secretVersions !== 'object' || Array.isArray(service.secretVersions)) {
        failures.push(`${prefix}.secretVersions must be an object of pinned numeric versions`);
      } else {
        const required = requiredSecretNames(service.worker);
        const allowed = new Set(required);
        for (const name of required) {
          if (!NUMERIC_SECRET_VERSION_PATTERN.test(String(service.secretVersions[name] ?? ''))) failures.push(`${prefix}.secretVersions.${name} must be numeric`);
        }
        for (const [name, version] of Object.entries(service.secretVersions)) {
          if (!allowed.has(name)) failures.push(`${prefix}.secretVersions contains unexpected binding ${name}`);
          if (String(version).toLowerCase() === 'latest') failures.push(`${prefix}.secretVersions.${name} must not use latest`);
          if (!NUMERIC_SECRET_VERSION_PATTERN.test(String(version))) failures.push(`${prefix}.secretVersions.${name} must be numeric`);
        }
      }

      const expectedConfiguration = {
        worker: service.worker,
        environment: receipt.environment,
        region: receipt.region,
        bucket: receipt.artifactBucket,
        runtimeServiceAccount: receipt.runtimeServiceAccount,
        secretVersions: service.secretVersions,
      };
      if (!service.configuration || typeof service.configuration !== 'object' || Array.isArray(service.configuration)) {
        failures.push(`${prefix}.configuration is required`);
      } else if (JSON.stringify(stable(service.configuration)) !== JSON.stringify(stable(expectedConfiguration))) {
        failures.push(`${prefix}.configuration does not match receipt runtime identity and pinned secrets`);
      }
      const expectedFingerprint = fingerprint(expectedConfiguration);
      if (!HEX64_PATTERN.test(String(service.configFingerprint ?? ''))) failures.push(`${prefix}.configFingerprint must be a SHA-256 value`);
      else if (service.configFingerprint !== expectedFingerprint) failures.push(`${prefix}.configFingerprint does not match the canonical configuration`);

      if (service.unauthorizedProbe !== 'PASS') failures.push(`${prefix}.unauthorizedProbe must equal PASS`);
      if (service.authorizedProbe !== 'PASS') failures.push(`${prefix}.authorizedProbe must equal PASS`);
    }
  }

  if (failures.length > 0) throw new Error(`worker deployment receipt validation failed:\n- ${failures.join('\n- ')}`);
  return true;
}

function validFixture() {
  const receipt = {
    schemaVersion: 'urai-jobs-worker-deploy-receipt-2',
    generatedAt: '2026-07-11T15:00:00.000Z',
    repository: 'LifeLoggerAI/urai-jobs',
    branch: 'secure-worker-deploy-20260706',
    commitSha: 'a'.repeat(40),
    rollbackSha: 'e'.repeat(40),
    project: 'urai-jobs-staging',
    region: 'us-central1',
    environment: 'staging',
    artifactRegistryRepository: 'urai-jobs',
    artifactBucket: 'urai-jobs-staging-artifacts',
    runtimeServiceAccount: 'urai-jobs-worker@example.iam.gserviceaccount.com',
    services: [],
    caveats: [],
  };
  const secretVersions = { URAI_JOBS_WORKER_TOKEN: '7' };
  const configuration = {
    worker: 'narrator-worker',
    environment: receipt.environment,
    region: receipt.region,
    bucket: receipt.artifactBucket,
    runtimeServiceAccount: receipt.runtimeServiceAccount,
    secretVersions,
  };
  receipt.services.push({
    worker: 'narrator-worker',
    buildId: 'build-123',
    image: `${receipt.region}-docker.pkg.dev/${receipt.project}/${receipt.artifactRegistryRepository}/narrator-worker:${receipt.commitSha}`,
    serviceUrl: 'https://narrator-worker.example.run.app',
    revision: 'narrator-worker-00002-def',
    sourceSha: receipt.commitSha,
    rollbackRevision: 'narrator-worker-00001-abc',
    rollbackSourceSha: receipt.rollbackSha,
    imageDigest: `sha256:${'b'.repeat(64)}`,
    rollbackImageDigest: `sha256:${'d'.repeat(64)}`,
    secretVersions,
    configuration,
    configFingerprint: fingerprint(configuration),
    unauthorizedProbe: 'PASS',
    authorizedProbe: 'PASS',
  });
  return receipt;
}

function expectRejected(name, mutate) {
  const fixture = validFixture();
  mutate(fixture);
  try {
    validateWorkerDeployReceipt(fixture);
    throw new Error(`${name} fixture unexpectedly passed`);
  } catch (error) {
    if (String(error).includes('unexpectedly passed')) throw error;
  }
}

export function runWorkerDeployReceiptValidatorSelfTest() {
  validateWorkerDeployReceipt(validFixture());
  expectRejected('missing image digest', (fixture) => { fixture.services[0].imageDigest = null; });
  expectRejected('invalid source SHA', (fixture) => { fixture.commitSha = 'manual'; });
  expectRejected('mutable latest secret', (fixture) => {
    fixture.services[0].secretVersions.URAI_JOBS_WORKER_TOKEN = 'latest';
    fixture.services[0].configuration.secretVersions.URAI_JOBS_WORKER_TOKEN = 'latest';
    fixture.services[0].configFingerprint = fingerprint(fixture.services[0].configuration);
  });
  expectRejected('same revision and rollback', (fixture) => { fixture.services[0].rollbackRevision = fixture.services[0].revision; });
  expectRejected('missing rollback digest', (fixture) => { fixture.services[0].rollbackImageDigest = null; });
  expectRejected('rollback source mismatch', (fixture) => { fixture.services[0].rollbackSourceSha = 'f'.repeat(40); });
  expectRejected('tampered configuration fingerprint', (fixture) => { fixture.services[0].configFingerprint = 'c'.repeat(64); });
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
