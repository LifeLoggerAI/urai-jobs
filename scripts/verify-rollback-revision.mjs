import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const IMAGE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const NUMERIC_SECRET_VERSION_PATTERN = /^[1-9][0-9]*$/;
const ALLOWED_ENVIRONMENTS = new Set(['staging', 'prod', 'production']);
const APPROVED_WORKERS = new Set(['narrator-worker', 'asset-worker']);

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

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requiredSecretNames(worker) {
  return worker === 'asset-worker'
    ? ['URAI_JOBS_WORKER_TOKEN', 'URAI_WHEEL_GITHUB_TOKEN', 'URAI_JOBS_CALLBACK_SECRET']
    : ['URAI_JOBS_WORKER_TOKEN'];
}

function expectedPlainEnvironment(worker, { rollbackSha, environment, bucket }) {
  const expected = {
    GCS_BUCKET_NAME: bucket,
    URAI_ENV: environment,
    URAI_SOURCE_SHA: rollbackSha,
  };
  if (worker === 'asset-worker') expected.ASSET_FACTORY_REPO = 'LifeLoggerAI/asset-factory';
  return expected;
}

function normalizeDigest(value) {
  return String(value ?? '').replace(/^@/, '');
}

function parseRevisionEnvironment(revision) {
  const entries = revision?.spec?.containers?.[0]?.env ?? [];
  const plainEnv = {};
  const secretVersions = {};

  for (const entry of entries) {
    if (!nonEmptyString(entry?.name)) continue;
    const secretRef = entry?.valueSource?.secretKeyRef ?? entry?.valueFrom?.secretKeyRef;
    if (secretRef?.version != null) {
      secretVersions[entry.name] = String(secretRef.version);
    } else if (Object.prototype.hasOwnProperty.call(entry, 'value')) {
      plainEnv[entry.name] = String(entry.value);
    }
  }

  return { plainEnv, secretVersions };
}

export function inspectRollbackRevision({
  worker,
  rollbackRevision,
  revision,
  rollbackSha,
  environment,
  region,
  bucket,
  runtimeServiceAccount,
  approvedConfigFingerprint,
}) {
  const failures = [];
  if (!APPROVED_WORKERS.has(worker)) failures.push(`unsupported rollback worker ${worker}`);
  if (!nonEmptyString(rollbackRevision) || !rollbackRevision.startsWith(`${worker}-`)) {
    failures.push(`rollback revision ${rollbackRevision || '<missing>'} does not belong to ${worker}`);
  }
  if (!SHA_PATTERN.test(String(rollbackSha ?? ''))) failures.push('rollback source SHA must be a full lowercase 40-character SHA');
  if (!ALLOWED_ENVIRONMENTS.has(String(environment ?? ''))) failures.push('environment must be staging, prod, or production');
  if (!nonEmptyString(region)) failures.push('region is required');
  if (!nonEmptyString(bucket)) failures.push('artifact bucket is required');
  if (!nonEmptyString(runtimeServiceAccount)) failures.push('runtime service account is required');
  if (!HEX64_PATTERN.test(String(approvedConfigFingerprint ?? ''))) failures.push(`approved rollback configuration fingerprint for ${worker} must be a SHA-256 value`);

  const container = revision?.spec?.containers?.[0] ?? {};
  const labels = revision?.metadata?.labels ?? revision?.labels ?? {};
  const imageDigest = normalizeDigest(revision?.status?.imageDigest);
  const observedServiceAccount = String(revision?.spec?.serviceAccountName ?? '');
  const revisionLabels = {
    'urai-source-sha': String(labels['urai-source-sha'] ?? ''),
    'urai-environment': String(labels['urai-environment'] ?? ''),
  };
  const { plainEnv, secretVersions } = parseRevisionEnvironment(revision);
  const expectedPlainEnv = expectedPlainEnvironment(worker, { rollbackSha, environment, bucket });
  const expectedSecretNames = requiredSecretNames(worker);

  if (!container || typeof container !== 'object') failures.push('rollback revision container is missing');
  if (!IMAGE_DIGEST_PATTERN.test(imageDigest)) failures.push(`rollback revision image digest is not immutable: ${imageDigest || '<missing>'}`);
  if (observedServiceAccount !== runtimeServiceAccount) failures.push(`rollback revision service account ${observedServiceAccount || '<missing>'} does not match ${runtimeServiceAccount}`);
  if (revisionLabels['urai-source-sha'] !== rollbackSha) failures.push('rollback revision source SHA label mismatch');
  if (revisionLabels['urai-environment'] !== environment) failures.push('rollback revision environment label mismatch');

  const plainKeys = Object.keys(plainEnv).sort();
  const expectedPlainKeys = Object.keys(expectedPlainEnv).sort();
  if (JSON.stringify(plainKeys) !== JSON.stringify(expectedPlainKeys)) {
    failures.push(`rollback revision plain environment keys ${JSON.stringify(plainKeys)} do not match approved keys ${JSON.stringify(expectedPlainKeys)}`);
  }
  for (const [name, value] of Object.entries(expectedPlainEnv)) {
    if (plainEnv[name] !== value) failures.push(`rollback revision ${name} ${plainEnv[name] || '<missing>'} does not match approved value ${value}`);
  }

  const observedSecretNames = Object.keys(secretVersions).sort();
  const sortedExpectedSecretNames = [...expectedSecretNames].sort();
  if (JSON.stringify(observedSecretNames) !== JSON.stringify(sortedExpectedSecretNames)) {
    failures.push(`rollback revision secret bindings ${JSON.stringify(observedSecretNames)} do not match approved bindings ${JSON.stringify(sortedExpectedSecretNames)}`);
  }
  for (const name of expectedSecretNames) {
    const version = String(secretVersions[name] ?? '');
    if (!NUMERIC_SECRET_VERSION_PATTERN.test(version)) failures.push(`rollback revision ${name} must use an exact numeric Secret Manager version`);
  }

  const configuration = {
    worker,
    environment,
    region,
    bucket,
    runtimeServiceAccount,
    sourceSha: rollbackSha,
    imageDigest,
    revisionLabels,
    plainEnv,
    secretVersions,
  };
  const configFingerprint = fingerprint(configuration);
  if (configFingerprint !== approvedConfigFingerprint) {
    failures.push(`rollback revision configuration fingerprint ${configFingerprint} does not match explicitly approved fingerprint ${approvedConfigFingerprint}`);
  }

  if (failures.length > 0) {
    throw new Error(`[FAIL] ${worker} rollback configuration is not release-authorized:\n- ${failures.join('\n- ')}`);
  }

  return {
    worker,
    rollbackRevision,
    imageDigest,
    revisionLabels,
    plainEnv,
    secretVersions,
    configuration,
    configFingerprint,
    approvedConfigFingerprint,
    status: 'PASS',
  };
}

export function validateRollbackConfigurationReceipt(receipt) {
  const failures = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new Error('rollback configuration receipt must be a JSON object');
  }
  if (receipt.schemaVersion !== 'urai-jobs-rollback-config-receipt-1') failures.push('schemaVersion must equal urai-jobs-rollback-config-receipt-1');
  if (!nonEmptyString(receipt.generatedAt) || !Number.isFinite(Date.parse(receipt.generatedAt))) failures.push('generatedAt must be a valid timestamp');
  if (!nonEmptyString(receipt.repository)) failures.push('repository is required');
  if (!SHA_PATTERN.test(String(receipt.targetSha ?? ''))) failures.push('targetSha must be a full lowercase 40-character SHA');
  if (!SHA_PATTERN.test(String(receipt.rollbackSha ?? ''))) failures.push('rollbackSha must be a full lowercase 40-character SHA');
  if (receipt.targetSha === receipt.rollbackSha) failures.push('targetSha and rollbackSha must differ');
  if (!nonEmptyString(receipt.project)) failures.push('project is required');
  if (!nonEmptyString(receipt.region)) failures.push('region is required');
  if (!ALLOWED_ENVIRONMENTS.has(String(receipt.environment ?? ''))) failures.push('environment must be staging, prod, or production');
  if (!nonEmptyString(receipt.artifactBucket)) failures.push('artifactBucket is required');
  if (!nonEmptyString(receipt.runtimeServiceAccount)) failures.push('runtimeServiceAccount is required');

  if (!Array.isArray(receipt.services) || receipt.services.length === 0) {
    failures.push('services must contain at least one rollback revision');
  } else {
    const seen = new Set();
    for (const [index, service] of receipt.services.entries()) {
      const prefix = `services[${index}]`;
      if (!service || typeof service !== 'object' || Array.isArray(service)) {
        failures.push(`${prefix} must be an object`);
        continue;
      }
      if (!APPROVED_WORKERS.has(service.worker)) failures.push(`${prefix}.worker is not approved`);
      if (seen.has(service.worker)) failures.push(`${prefix}.worker duplicates ${service.worker}`);
      seen.add(service.worker);
      if (!nonEmptyString(service.rollbackRevision) || !String(service.rollbackRevision).startsWith(`${service.worker}-`)) failures.push(`${prefix}.rollbackRevision must belong to ${service.worker}`);
      if (!IMAGE_DIGEST_PATTERN.test(String(service.imageDigest ?? ''))) failures.push(`${prefix}.imageDigest must be immutable`);
      if (!HEX64_PATTERN.test(String(service.configFingerprint ?? ''))) failures.push(`${prefix}.configFingerprint must be a SHA-256 value`);
      if (!HEX64_PATTERN.test(String(service.approvedConfigFingerprint ?? ''))) failures.push(`${prefix}.approvedConfigFingerprint must be a SHA-256 value`);
      if (service.configFingerprint !== service.approvedConfigFingerprint) failures.push(`${prefix}.configFingerprint must equal the explicit approved fingerprint`);
      if (service.status !== 'PASS') failures.push(`${prefix}.status must equal PASS`);

      const expectedLabels = {
        'urai-source-sha': receipt.rollbackSha,
        'urai-environment': receipt.environment,
      };
      if (JSON.stringify(stable(service.revisionLabels)) !== JSON.stringify(stable(expectedLabels))) failures.push(`${prefix}.revisionLabels must bind rollback SHA and environment`);

      const expectedPlainEnv = expectedPlainEnvironment(service.worker, {
        rollbackSha: receipt.rollbackSha,
        environment: receipt.environment,
        bucket: receipt.artifactBucket,
      });
      if (JSON.stringify(stable(service.plainEnv)) !== JSON.stringify(stable(expectedPlainEnv))) failures.push(`${prefix}.plainEnv must match the approved rollback environment`);

      const requiredSecrets = requiredSecretNames(service.worker);
      if (!service.secretVersions || typeof service.secretVersions !== 'object' || Array.isArray(service.secretVersions)) {
        failures.push(`${prefix}.secretVersions must be an object`);
      } else {
        if (JSON.stringify(Object.keys(service.secretVersions).sort()) !== JSON.stringify([...requiredSecrets].sort())) failures.push(`${prefix}.secretVersions must contain the exact approved bindings`);
        for (const name of requiredSecrets) {
          if (!NUMERIC_SECRET_VERSION_PATTERN.test(String(service.secretVersions[name] ?? ''))) failures.push(`${prefix}.secretVersions.${name} must be numeric`);
        }
      }

      const expectedConfiguration = {
        worker: service.worker,
        environment: receipt.environment,
        region: receipt.region,
        bucket: receipt.artifactBucket,
        runtimeServiceAccount: receipt.runtimeServiceAccount,
        sourceSha: receipt.rollbackSha,
        imageDigest: service.imageDigest,
        revisionLabels: expectedLabels,
        plainEnv: expectedPlainEnv,
        secretVersions: service.secretVersions,
      };
      if (JSON.stringify(stable(service.configuration)) !== JSON.stringify(stable(expectedConfiguration))) failures.push(`${prefix}.configuration does not match the canonical rollback configuration`);
      if (fingerprint(expectedConfiguration) !== service.configFingerprint) failures.push(`${prefix}.configFingerprint does not match the canonical rollback configuration`);
    }
  }

  if (failures.length > 0) throw new Error(`rollback configuration receipt validation failed:\n- ${failures.join('\n- ')}`);
  return true;
}

function fixtureRevision({ worker, rollbackSha, environment, bucket, runtimeServiceAccount }) {
  const env = [
    { name: 'URAI_ENV', value: environment },
    { name: 'GCS_BUCKET_NAME', value: bucket },
    { name: 'URAI_SOURCE_SHA', value: rollbackSha },
    { name: 'URAI_JOBS_WORKER_TOKEN', valueSource: { secretKeyRef: { version: '7' } } },
  ];
  if (worker === 'asset-worker') {
    env.push(
      { name: 'ASSET_FACTORY_REPO', value: 'LifeLoggerAI/asset-factory' },
      { name: 'URAI_WHEEL_GITHUB_TOKEN', valueSource: { secretKeyRef: { version: '4' } } },
      { name: 'URAI_JOBS_CALLBACK_SECRET', valueSource: { secretKeyRef: { version: '9' } } },
    );
  }
  return {
    metadata: { labels: { 'urai-source-sha': rollbackSha, 'urai-environment': environment } },
    spec: { serviceAccountName: runtimeServiceAccount, containers: [{ env }] },
    status: { imageDigest: `sha256:${'b'.repeat(64)}` },
  };
}

function buildValidReceipt() {
  const rollbackSha = 'e'.repeat(40);
  const targetSha = 'a'.repeat(40);
  const environment = 'staging';
  const region = 'us-central1';
  const artifactBucket = 'urai-jobs-staging-artifacts';
  const runtimeServiceAccount = 'urai-jobs-worker@example.iam.gserviceaccount.com';
  const worker = 'narrator-worker';
  const revision = fixtureRevision({ worker, rollbackSha, environment, bucket: artifactBucket, runtimeServiceAccount });
  const provisional = inspectRollbackRevision({
    worker,
    rollbackRevision: 'narrator-worker-00001-abc',
    revision,
    rollbackSha,
    environment,
    region,
    bucket: artifactBucket,
    runtimeServiceAccount,
    approvedConfigFingerprint: fingerprint({
      worker,
      environment,
      region,
      bucket: artifactBucket,
      runtimeServiceAccount,
      sourceSha: rollbackSha,
      imageDigest: `sha256:${'b'.repeat(64)}`,
      revisionLabels: { 'urai-source-sha': rollbackSha, 'urai-environment': environment },
      plainEnv: { GCS_BUCKET_NAME: artifactBucket, URAI_ENV: environment, URAI_SOURCE_SHA: rollbackSha },
      secretVersions: { URAI_JOBS_WORKER_TOKEN: '7' },
    }),
  });
  return {
    schemaVersion: 'urai-jobs-rollback-config-receipt-1',
    generatedAt: '2026-07-11T16:00:00.000Z',
    repository: 'LifeLoggerAI/urai-jobs',
    targetSha,
    rollbackSha,
    project: 'urai-jobs-staging',
    region,
    environment,
    artifactBucket,
    runtimeServiceAccount,
    services: [provisional],
  };
}

function expectRejected(name, mutate) {
  const fixture = buildValidReceipt();
  mutate(fixture);
  try {
    validateRollbackConfigurationReceipt(fixture);
    throw new Error(`${name} fixture unexpectedly passed`);
  } catch (error) {
    if (String(error).includes('unexpectedly passed')) throw error;
  }
}

export function runRollbackRevisionVerifierSelfTest() {
  validateRollbackConfigurationReceipt(buildValidReceipt());
  expectRejected('rollback environment label mismatch', (fixture) => { fixture.services[0].revisionLabels['urai-environment'] = 'prod'; });
  expectRejected('rollback service account mismatch', (fixture) => { fixture.services[0].configuration.runtimeServiceAccount = 'wrong@example.iam.gserviceaccount.com'; });
  expectRejected('rollback artifact bucket mismatch', (fixture) => { fixture.services[0].plainEnv.GCS_BUCKET_NAME = 'wrong-bucket'; });
  expectRejected('rollback mutable secret alias', (fixture) => {
    fixture.services[0].secretVersions.URAI_JOBS_WORKER_TOKEN = 'latest';
    fixture.services[0].configuration.secretVersions.URAI_JOBS_WORKER_TOKEN = 'latest';
  });
  expectRejected('rollback source mismatch', (fixture) => { fixture.services[0].plainEnv.URAI_SOURCE_SHA = 'f'.repeat(40); });
  expectRejected('rollback fingerprint tampering', (fixture) => { fixture.services[0].configFingerprint = 'c'.repeat(64); });
  return true;
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!nonEmptyString(value)) throw new Error(`${name} is required`);
  return value;
}

function parseApprovedFingerprints(raw, workers) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`DEPLOY_ROLLBACK_CONFIG_FINGERPRINTS_JSON must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('DEPLOY_ROLLBACK_CONFIG_FINGERPRINTS_JSON must be a JSON object');
  const expectedKeys = [...workers].sort();
  const observedKeys = Object.keys(parsed).sort();
  if (JSON.stringify(expectedKeys) !== JSON.stringify(observedKeys)) throw new Error(`rollback fingerprint approvals must contain exactly ${JSON.stringify(expectedKeys)}, received ${JSON.stringify(observedKeys)}`);
  for (const worker of workers) {
    if (!HEX64_PATTERN.test(String(parsed[worker] ?? ''))) throw new Error(`rollback fingerprint approval for ${worker} must be a SHA-256 value`);
  }
  return parsed;
}

function gcloud(args) {
  try {
    return execFileSync('gcloud', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).trim() : '';
    throw new Error(`gcloud ${args.join(' ')} failed${stderr ? `: ${stderr}` : ''}`);
  }
}

function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  if (process.argv[2] === '--self-test') {
    runRollbackRevisionVerifierSelfTest();
    console.log('[PASS] rollback revision verifier self-test');
  } else {
    const project = requiredEnvironment('GCLOUD_PROJECT');
    const region = process.env.GCP_REGION || 'us-central1';
    const artifactBucket = requiredEnvironment('GCS_BUCKET_NAME');
    const runtimeServiceAccount = requiredEnvironment('WORKER_RUNTIME_SERVICE_ACCOUNT');
    const targetSha = requiredEnvironment('GITHUB_SHA');
    const rollbackSha = requiredEnvironment('DEPLOY_ROLLBACK_SHA');
    const environment = process.env.URAI_ENV || 'prod';
    const receiptPath = process.env.ROLLBACK_CONFIG_RECEIPT_PATH || 'docs/release-evidence/worker-rollback-config-receipt.json';
    const workers = (process.env.URAI_JOBS_DEPLOY_WORKERS || 'narrator-worker,asset-worker').split(',').map((value) => value.trim()).filter(Boolean);

    if (!SHA_PATTERN.test(targetSha)) throw new Error('GITHUB_SHA must be a full lowercase 40-character SHA');
    if (!SHA_PATTERN.test(rollbackSha)) throw new Error('DEPLOY_ROLLBACK_SHA must be a full lowercase 40-character SHA');
    if (targetSha === rollbackSha) throw new Error('GITHUB_SHA and DEPLOY_ROLLBACK_SHA must differ');
    if (!ALLOWED_ENVIRONMENTS.has(environment)) throw new Error('URAI_ENV must be staging, prod, or production');
    for (const worker of workers) if (!APPROVED_WORKERS.has(worker)) throw new Error(`unsupported rollback worker ${worker}`);

    const approvedFingerprints = parseApprovedFingerprints(requiredEnvironment('DEPLOY_ROLLBACK_CONFIG_FINGERPRINTS_JSON'), workers);
    const services = [];
    for (const worker of workers) {
      const rollbackRevision = gcloud([
        'run', 'services', 'describe', worker,
        '--project', project,
        '--region', region,
        '--platform', 'managed',
        '--format=value(status.latestReadyRevisionName)',
      ]);
      if (!rollbackRevision) throw new Error(`${worker} does not have an existing rollback revision`);
      const revision = JSON.parse(gcloud([
        'run', 'revisions', 'describe', rollbackRevision,
        '--project', project,
        '--region', region,
        '--format=json',
      ]));
      services.push(inspectRollbackRevision({
        worker,
        rollbackRevision,
        revision,
        rollbackSha,
        environment,
        region,
        bucket: artifactBucket,
        runtimeServiceAccount,
        approvedConfigFingerprint: approvedFingerprints[worker],
      }));
    }

    const receipt = {
      schemaVersion: 'urai-jobs-rollback-config-receipt-1',
      generatedAt: new Date().toISOString(),
      repository: process.env.GITHUB_REPOSITORY || 'LifeLoggerAI/urai-jobs',
      targetSha,
      rollbackSha,
      project,
      region,
      environment,
      artifactBucket,
      runtimeServiceAccount,
      services,
    };
    validateRollbackConfigurationReceipt(receipt);
    fs.mkdirSync(new URL('.', pathToFileURL(`${process.cwd()}/${receiptPath}`)), { recursive: true });
    fs.mkdirSync(receiptPath.includes('/') ? receiptPath.slice(0, receiptPath.lastIndexOf('/')) : '.', { recursive: true });
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(`[PASS] approved rollback configuration receipt: ${receiptPath}`);
  }
}
