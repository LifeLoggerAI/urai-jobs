#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const receiptPath = process.argv[2] || process.env.DEPLOY_RECEIPT_PATH || 'docs/release-evidence/worker-deploy-receipt.json';
const outputFile = process.env.GITHUB_ENV || process.env.URAI_JOBS_WORKER_ENV_FILE || '';
const expectedSha = String(process.env.DEPLOY_SOURCE_SHA || '').trim();
const expectedProject = String(process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || '').trim();
const expectedEnvironment = String(process.env.URAI_ENV || '').trim();
const requiredWorkers = new Map([
  ['narrator-worker', 'NARRATOR_WORKER_URL'],
  ['asset-worker', 'ASSET_WORKER_URL'],
]);

if (!fs.existsSync(receiptPath)) throw new Error(`Worker deploy receipt is missing: ${receiptPath}`);
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
const failures = [];
if (receipt.schemaVersion !== 'urai-jobs-worker-deploy-receipt-3') failures.push('schemaVersion');
if (!/^[0-9a-f]{40}$/.test(expectedSha) || receipt.commitSha !== expectedSha) failures.push('source SHA');
if (!expectedProject || receipt.project !== expectedProject) failures.push('project');
if (!expectedEnvironment || receipt.environment !== expectedEnvironment) failures.push('environment');

const services = Array.isArray(receipt.services) ? receipt.services : [];
const byWorker = new Map(services.map((service) => [service?.worker, service]));
if (JSON.stringify([...byWorker.keys()].sort()) !== JSON.stringify([...requiredWorkers.keys()].sort())) {
  failures.push('canonical worker set');
}

const lines = [];
for (const [worker, envName] of requiredWorkers) {
  const service = byWorker.get(worker);
  const url = String(service?.serviceUrl || '');
  if (!url.startsWith('https://')) failures.push(`${worker} HTTPS service URL`);
  if (!String(service?.revision || '').startsWith(`${worker}-`)) failures.push(`${worker} revision identity`);
  if (!/^sha256:[0-9a-f]{64}$/.test(String(service?.imageDigest || ''))) failures.push(`${worker} image digest`);
  lines.push(`${envName}=${url}`);
}

if (failures.length) throw new Error(`Worker URL receipt verification failed: ${failures.join(', ')}`);
if (outputFile) fs.appendFileSync(outputFile, `${lines.join('\n')}\n`);
console.log(JSON.stringify({
  status: 'PASS',
  receiptPath: path.resolve(receiptPath),
  sourceSha: expectedSha,
  project: expectedProject,
  environment: expectedEnvironment,
  workers: Object.fromEntries(lines.map((line) => line.split('=', 2))),
}, null, 2));
