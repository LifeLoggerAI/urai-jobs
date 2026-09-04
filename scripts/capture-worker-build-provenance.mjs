import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const NUMERIC_PATTERN = /^[1-9][0-9]*$/;
const APPROVED_WORKERS = ['asset-worker', 'narrator-worker'];

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function validTimestamp(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function normalizeResolvedStorageSource(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    bucket: String(source.bucket || ''),
    object: String(source.object || ''),
    generation: String(source.generation || ''),
  };
}

function validateLedger(ledger, expectedSourceSha) {
  const failures = [];
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
    throw new Error('worker build source ledger must be a JSON object');
  }
  if (ledger.schemaVersion !== 'urai-jobs-worker-build-source-ledger-1') {
    failures.push('source ledger schemaVersion must equal urai-jobs-worker-build-source-ledger-1');
  }
  if (ledger.sourceSha !== expectedSourceSha) failures.push('source ledger sourceSha must equal deployment source SHA');
  if (!Array.isArray(ledger.entries)) failures.push('source ledger entries must be an array');

  const entries = new Map();
  for (const [index, entry] of (ledger.entries || []).entries()) {
    const prefix = `source ledger entries[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      failures.push(`${prefix} must be an object`);
      continue;
    }
    if (!APPROVED_WORKERS.includes(entry.worker)) failures.push(`${prefix}.worker is not approved`);
    if (entries.has(entry.worker)) failures.push(`${prefix}.worker duplicates ${entry.worker}`);
    entries.set(entry.worker, entry);
    if (entry.sourceDirectory !== `workers/${entry.worker}`) failures.push(`${prefix}.sourceDirectory is not canonical`);
    if (!HEX64_PATTERN.test(String(entry.sourceManifestSha256 || ''))) failures.push(`${prefix}.sourceManifestSha256 must be SHA-256`);
    if (!HEX64_PATTERN.test(String(entry.sourceArchiveSha256 || ''))) failures.push(`${prefix}.sourceArchiveSha256 must be SHA-256`);
    if (!Number.isInteger(entry.sourceArchiveBytes) || entry.sourceArchiveBytes <= 0) failures.push(`${prefix}.sourceArchiveBytes must be positive`);
    if (!Number.isInteger(entry.sourceFileCount) || entry.sourceFileCount <= 0) failures.push(`${prefix}.sourceFileCount must be positive`);
    if (!Number.isInteger(entry.sourceTotalBytes) || entry.sourceTotalBytes <= 0) failures.push(`${prefix}.sourceTotalBytes must be positive`);
  }

  if (stableJson([...entries.keys()].sort()) !== stableJson(APPROVED_WORKERS)) {
    failures.push('source ledger must contain exactly the canonical workers');
  }
  if (failures.length) throw new Error(`worker build source ledger validation failed:\n- ${failures.join('\n- ')}`);
  return entries;
}

export function createWorkerBuildProvenanceEvidence({
  receipt,
  ledger,
  buildsById,
  workflowRunId,
  generatedAt = new Date().toISOString(),
  receiptSha256,
}) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new Error('worker deployment receipt must be a JSON object');
  }
  if (receipt.schemaVersion !== 'urai-jobs-worker-deploy-receipt-3') {
    throw new Error('worker deployment receipt schema must equal urai-jobs-worker-deploy-receipt-3');
  }
  if (!SHA_PATTERN.test(String(receipt.commitSha || ''))) throw new Error('worker deployment receipt commitSha is invalid');
  if (!nonEmptyString(receipt.project)) throw new Error('worker deployment receipt project is required');
  if (!Array.isArray(receipt.services)) throw new Error('worker deployment receipt services must be an array');

  const ledgerEntries = validateLedger(ledger, receipt.commitSha);
  const services = [];
  const seenWorkers = new Set();

  for (const service of receipt.services) {
    if (!service || typeof service !== 'object' || Array.isArray(service)) throw new Error('worker deployment service must be an object');
    if (!APPROVED_WORKERS.includes(service.worker)) throw new Error(`unapproved worker in deployment receipt: ${service.worker}`);
    if (seenWorkers.has(service.worker)) throw new Error(`duplicate worker in deployment receipt: ${service.worker}`);
    seenWorkers.add(service.worker);
    const source = ledgerEntries.get(service.worker);
    if (!source) throw new Error(`missing source ledger entry for ${service.worker}`);
    const build = buildsById instanceof Map ? buildsById.get(service.buildId) : buildsById?.[service.buildId];
    if (!build || typeof build !== 'object' || Array.isArray(build)) throw new Error(`missing Cloud Build resource for ${service.worker}`);
    if (build.id !== service.buildId) throw new Error(`${service.worker} Cloud Build id mismatch`);
    if (build.status !== 'SUCCESS') throw new Error(`${service.worker} Cloud Build status must equal SUCCESS`);
    if (!validTimestamp(build.createTime) || !validTimestamp(build.finishTime)) {
      throw new Error(`${service.worker} Cloud Build timestamps are invalid`);
    }
    const resolvedStorageSource = normalizeResolvedStorageSource(build.sourceProvenance?.resolvedStorageSource);
    if (!nonEmptyString(resolvedStorageSource.bucket) || !nonEmptyString(resolvedStorageSource.object) || !NUMERIC_PATTERN.test(resolvedStorageSource.generation)) {
      throw new Error(`${service.worker} Cloud Build resolvedStorageSource must contain bucket, object and numeric generation`);
    }
    const images = Array.isArray(build.results?.images) ? build.results.images : [];
    const image = images.find((candidate) => candidate?.name === service.imageTag && candidate?.digest === service.buildImageDigest);
    if (!image) throw new Error(`${service.worker} Cloud Build image result does not match the receipt tag and digest`);
    if (!DIGEST_PATTERN.test(String(service.buildImageDigest || '')) || service.buildImageDigest !== service.imageDigest) {
      throw new Error(`${service.worker} build and deployed revision digests must be identical immutable digests`);
    }

    services.push({
      worker: service.worker,
      sourceDirectory: source.sourceDirectory,
      sourceManifestSha256: source.sourceManifestSha256,
      sourceArchiveSha256: source.sourceArchiveSha256,
      sourceArchiveBytes: source.sourceArchiveBytes,
      sourceFileCount: source.sourceFileCount,
      sourceTotalBytes: source.sourceTotalBytes,
      buildId: service.buildId,
      buildStatus: build.status,
      buildCreateTime: build.createTime,
      buildFinishTime: build.finishTime,
      resolvedStorageSource,
      imageTag: service.imageTag,
      buildImageDigest: service.buildImageDigest,
      deployedRevision: service.revision,
      deployedImageDigest: service.imageDigest,
    });
  }

  if (stableJson([...seenWorkers].sort()) !== stableJson(APPROVED_WORKERS)) {
    throw new Error('worker deployment receipt must contain exactly the canonical workers');
  }

  const evidence = {
    schemaVersion: 'urai-jobs-worker-build-provenance-1',
    generatedAt,
    repository: receipt.repository,
    workflowRunId: String(workflowRunId || ''),
    sourceSha: receipt.commitSha,
    project: receipt.project,
    receiptSha256,
    services: services.sort((left, right) => left.worker.localeCompare(right.worker)),
  };
  validateWorkerBuildProvenanceEvidence(evidence);
  return evidence;
}

export function validateWorkerBuildProvenanceEvidence(evidence) {
  const failures = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error('worker build provenance evidence must be a JSON object');
  }
  if (evidence.schemaVersion !== 'urai-jobs-worker-build-provenance-1') failures.push('schemaVersion must equal urai-jobs-worker-build-provenance-1');
  if (!validTimestamp(evidence.generatedAt)) failures.push('generatedAt must be a valid timestamp');
  if (!nonEmptyString(evidence.repository)) failures.push('repository is required');
  if (!NUMERIC_PATTERN.test(String(evidence.workflowRunId || ''))) failures.push('workflowRunId must be numeric');
  if (!SHA_PATTERN.test(String(evidence.sourceSha || ''))) failures.push('sourceSha must be a full lowercase SHA');
  if (!nonEmptyString(evidence.project)) failures.push('project is required');
  if (!HEX64_PATTERN.test(String(evidence.receiptSha256 || ''))) failures.push('receiptSha256 must be SHA-256');
  if (!Array.isArray(evidence.services)) failures.push('services must be an array');

  const workers = new Set();
  for (const [index, service] of (evidence.services || []).entries()) {
    const prefix = `services[${index}]`;
    if (!service || typeof service !== 'object' || Array.isArray(service)) {
      failures.push(`${prefix} must be an object`);
      continue;
    }
    if (!APPROVED_WORKERS.includes(service.worker)) failures.push(`${prefix}.worker is not approved`);
    if (workers.has(service.worker)) failures.push(`${prefix}.worker duplicates ${service.worker}`);
    workers.add(service.worker);
    if (service.sourceDirectory !== `workers/${service.worker}`) failures.push(`${prefix}.sourceDirectory is not canonical`);
    if (!HEX64_PATTERN.test(String(service.sourceManifestSha256 || ''))) failures.push(`${prefix}.sourceManifestSha256 must be SHA-256`);
    if (!HEX64_PATTERN.test(String(service.sourceArchiveSha256 || ''))) failures.push(`${prefix}.sourceArchiveSha256 must be SHA-256`);
    if (!Number.isInteger(service.sourceArchiveBytes) || service.sourceArchiveBytes <= 0) failures.push(`${prefix}.sourceArchiveBytes must be positive`);
    if (!Number.isInteger(service.sourceFileCount) || service.sourceFileCount <= 0) failures.push(`${prefix}.sourceFileCount must be positive`);
    if (!Number.isInteger(service.sourceTotalBytes) || service.sourceTotalBytes <= 0) failures.push(`${prefix}.sourceTotalBytes must be positive`);
    if (!nonEmptyString(service.buildId)) failures.push(`${prefix}.buildId is required`);
    if (service.buildStatus !== 'SUCCESS') failures.push(`${prefix}.buildStatus must equal SUCCESS`);
    if (!validTimestamp(service.buildCreateTime) || !validTimestamp(service.buildFinishTime)) failures.push(`${prefix} build timestamps are invalid`);
    const resolved = normalizeResolvedStorageSource(service.resolvedStorageSource);
    if (!nonEmptyString(resolved.bucket) || !nonEmptyString(resolved.object) || !NUMERIC_PATTERN.test(resolved.generation)) failures.push(`${prefix}.resolvedStorageSource is incomplete`);
    if (!DIGEST_PATTERN.test(String(service.buildImageDigest || ''))) failures.push(`${prefix}.buildImageDigest must be immutable`);
    if (service.buildImageDigest !== service.deployedImageDigest) failures.push(`${prefix} build and deployed digests must match`);
    if (!nonEmptyString(service.deployedRevision) || !String(service.deployedRevision).startsWith(`${service.worker}-`)) failures.push(`${prefix}.deployedRevision must belong to the worker`);
  }
  if (stableJson([...workers].sort()) !== stableJson(APPROVED_WORKERS)) failures.push('services must contain exactly the canonical workers');
  if (failures.length) throw new Error(`worker build provenance validation failed:\n- ${failures.join('\n- ')}`);
  return true;
}

function fixture() {
  const sourceSha = 'a'.repeat(40);
  const project = 'urai-jobs-staging';
  const receipt = {
    schemaVersion: 'urai-jobs-worker-deploy-receipt-3',
    repository: 'LifeLoggerAI/urai-jobs',
    commitSha: sourceSha,
    project,
    services: [],
  };
  const ledger = {
    schemaVersion: 'urai-jobs-worker-build-source-ledger-1',
    sourceSha,
    entries: [],
  };
  const buildsById = new Map();
  for (const [index, worker] of APPROVED_WORKERS.entries()) {
    const digest = `sha256:${String(index + 1).repeat(64)}`;
    const imageTag = `us-central1-docker.pkg.dev/${project}/urai-jobs/${worker}:${sourceSha}`;
    const buildId = `build-${worker}`;
    receipt.services.push({
      worker,
      buildId,
      imageTag,
      buildImageDigest: digest,
      imageDigest: digest,
      revision: `${worker}-00002-abc`,
    });
    ledger.entries.push({
      worker,
      sourceDirectory: `workers/${worker}`,
      sourceManifestSha256: String(index + 3).repeat(64),
      sourceArchiveSha256: String(index + 5).repeat(64),
      sourceArchiveBytes: 4096 + index,
      sourceFileCount: 5 + index,
      sourceTotalBytes: 2048 + index,
    });
    buildsById.set(buildId, {
      id: buildId,
      status: 'SUCCESS',
      createTime: '2026-07-11T19:00:00.000Z',
      finishTime: '2026-07-11T19:01:00.000Z',
      sourceProvenance: {
        resolvedStorageSource: {
          bucket: `${project}_cloudbuild`,
          object: `source/${buildId}.tgz`,
          generation: String(100 + index),
        },
      },
      results: { images: [{ name: imageTag, digest }] },
    });
  }
  return { receipt, ledger, buildsById };
}

function expectRejected(name, mutate) {
  const input = fixture();
  mutate(input);
  try {
    createWorkerBuildProvenanceEvidence({
      ...input,
      workflowRunId: '29164998022',
      generatedAt: '2026-07-11T19:02:00.000Z',
      receiptSha256: 'f'.repeat(64),
    });
    throw new Error(`${name} unexpectedly passed`);
  } catch (error) {
    if (String(error).includes('unexpectedly passed')) throw error;
  }
}

export function runWorkerBuildProvenanceSelfTest() {
  const input = fixture();
  const evidence = createWorkerBuildProvenanceEvidence({
    ...input,
    workflowRunId: '29164998022',
    generatedAt: '2026-07-11T19:02:00.000Z',
    receiptSha256: 'f'.repeat(64),
  });
  validateWorkerBuildProvenanceEvidence(evidence);
  expectRejected('missing resolved source', ({ buildsById }) => { buildsById.values().next().value.sourceProvenance = {}; });
  expectRejected('failed build', ({ buildsById }) => { buildsById.values().next().value.status = 'FAILURE'; });
  expectRejected('digest mismatch', ({ receipt }) => { receipt.services[0].buildImageDigest = `sha256:${'9'.repeat(64)}`; });
  expectRejected('archive hash drift', ({ ledger }) => { ledger.entries[0].sourceArchiveSha256 = 'manual'; });
  expectRejected('stale source SHA', ({ ledger }) => { ledger.sourceSha = 'b'.repeat(40); });
  expectRejected('duplicate worker', ({ receipt }) => { receipt.services[1].worker = receipt.services[0].worker; });
  expectRejected('missing canonical worker', ({ ledger }) => { ledger.entries.pop(); });
  return true;
}

function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  if (process.argv[2] === '--self-test') {
    runWorkerBuildProvenanceSelfTest();
    console.log('[PASS] worker build provenance self-test');
  } else {
    const ledgerPath = process.env.WORKER_BUILD_SOURCE_LEDGER;
    const receiptPath = process.env.DEPLOY_RECEIPT_PATH || 'docs/release-evidence/worker-deploy-receipt.json';
    const outputPath = process.env.WORKER_BUILD_PROVENANCE_PATH || 'docs/release-evidence/worker-build-provenance.json';
    const gcloud = process.env.REAL_GCLOUD || 'gcloud';
    if (!ledgerPath) throw new Error('WORKER_BUILD_SOURCE_LEDGER is required');
    const receiptBytes = fs.readFileSync(receiptPath);
    const receipt = JSON.parse(receiptBytes.toString('utf8'));
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    const buildsById = new Map();
    for (const service of receipt.services || []) {
      const raw = execFileSync(gcloud, ['builds', 'describe', service.buildId, '--project', receipt.project, '--format=json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      buildsById.set(service.buildId, JSON.parse(raw));
    }
    const evidence = createWorkerBuildProvenanceEvidence({
      receipt,
      ledger,
      buildsById,
      workflowRunId: process.env.GITHUB_RUN_ID,
      receiptSha256: sha256Bytes(receiptBytes),
    });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`[PASS] worker build provenance captured: ${outputPath}`);
  }
}
