#!/usr/bin/env node
// R426: nonproduction, pinned-source verification. Does not deploy or use live data.
// The receipt and step logs MUST be collected before an ephemeral Pod is stopped.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { isAbsolute, resolve, join } from 'node:path';
import { evidenceAdmission, publishEvidence } from './r427-evidence-escrow.mjs';

const expectedSha = String(process.env.URAI_EXACT_SOURCE_SHA || '').trim();
const evidenceDir = String(process.env.URAI_EVIDENCE_DIR || '').trim();
const syntheticHarness = process.env.URAI_R426_HARNESS_TEST === '1';
if (!/^[a-f0-9]{40}$/.test(expectedSha) || !isAbsolute(evidenceDir)) {
  console.error('R426_BLOCKED: exact 40-character source SHA and absolute evidence directory required');
  process.exit(2);
}
mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
const reportPath = join(evidenceDir, 'r426-report.json');
const report = {
  schema: 'urai-r426-original-source-evidence-v1',
  scope: syntheticHarness ? 'SYNTHETIC_HARNESS_NO_SOURCE_CERTIFICATION' : 'NONPRODUCTION_ORIGINAL_SOURCE',
  expectedSha,
  observedSha: null,
  sourceTree: null,
  status: 'BLOCKED',
  startedUtc: new Date().toISOString(),
  finishedUtc: null,
  steps: [],
  limitations: 'No Firebase emulator, connected user lifecycle, release approval, or deployment proof is implied.',
};
const store = () => {
  const tmp = reportPath + '.tmp';
  writeFileSync(tmp, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  renameSync(tmp, reportPath);
};
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const safeEnv = {
  PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
  HOME: process.env.HOME || '/tmp',
  TMPDIR: process.env.TMPDIR || '/tmp',
  CI: '1', GIT_TERMINAL_PROMPT: '0', NEXT_TELEMETRY_DISABLED: '1',
  COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false',
};
function git(args) {
  const result = spawnSync('git', args, { cwd: process.cwd(), env: safeEnv, encoding: 'utf8', timeout: 10000 });
  if (result.error || result.status !== 0) throw new Error('git preflight failed: ' + args.join(' '));
  return result.stdout.trim();
}
function capture(command, args, log, timeoutMs) {
  return new Promise(resolveStep => {
    const startedAt = Date.now();
    const child = spawn(command, args, { cwd: process.cwd(), env: safeEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let size = 0;
    let forced = false;
    const maxBytes = 2 * 1024 * 1024;
    const add = chunk => { if (size < maxBytes) { const bounded = chunk.subarray(0, maxBytes - size); chunks.push(bounded); size += bounded.length; } };
    child.stdout?.on('data', add);
    child.stderr?.on('data', add);
    const timer = setTimeout(() => { forced = true; child.kill('SIGKILL'); }, timeoutMs);
    let handled = false;
    const finish = (code, signal, error) => {
      if (handled) return;
      handled = true;
      clearTimeout(timer);
      writeFileSync(log, Buffer.concat(chunks), { mode: 0o600 });
      resolveStep({ exitCode: typeof code === 'number' ? code : null, signal: signal || null,
        timeout: forced, spawnError: error?.code || null, durationMs: Date.now() - startedAt,
        logSha256: sha256(log), logBytes: size, logTruncated: size >= maxBytes });
    };
    child.on('error', error => finish(null, null, error));
    child.on('close', (code, signal) => finish(code, signal, null));
  });
}
let exitCode = 2;
let escrowEndpoints = null;
let executionPassed = false;
try {
  store();
  // No costly real-source run without an explicit external evidence destination.
  escrowEndpoints = evidenceAdmission(process.env, syntheticHarness);
  report.observedSha = git(['rev-parse', 'HEAD']);
  report.sourceTree = git(['rev-parse', 'HEAD^{tree}']);
  if (report.observedSha !== expectedSha) throw new Error('SOURCE_SHA_MISMATCH');
  if (git(['status', '--porcelain', '--untracked-files=all'])) throw new Error('CHECKOUT_NOT_CLEAN');
  if (!existsSync('pnpm-lock.yaml') || !existsSync('pnpm-workspace.yaml')) throw new Error('CANONICAL_PNPM_LOCK_MISSING');
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  if (packageJson.packageManager !== 'pnpm@8.15.9') throw new Error('PACKAGE_MANAGER_PIN_MISMATCH');
  const stages = [
    ['install-frozen', 'corepack', ['pnpm', 'install', '--frozen-lockfile', '--ignore-scripts'], 240000],
    ['root-typecheck', 'npm', ['run', 'typecheck'], 180000],
    ['root-build', 'npm', ['run', 'build'], 240000],
    ['worker-consent', 'npm', ['run', 'life-movies:worker:verify'], 90000],
    ['consent-gate', 'npm', ['run', 'life-movies:consent-gate:verify'], 140000],
    ['private-delivery', 'npm', ['run', 'life-movies:private-delivery:verify'], 120000],
    ['data-rights', 'npm', ['run', 'privacy:data-rights:execution:verify'], 120000],
  ];
  for (const [name, command, args, timeoutMs] of stages) {
    const log = join(evidenceDir, name + '.log');
    report.status = 'RUNNING'; store();
    const outcome = await capture(command, args, log, timeoutMs);
    const ok = outcome.exitCode === 0 && !outcome.timeout && !outcome.spawnError && !outcome.logTruncated;
    report.steps.push({ name, argv: [command, ...args], status: ok ? 'PASS' : 'FAIL', ...outcome });
    store();
    console.log('R426_STEP ' + JSON.stringify({name,status:ok?'PASS':'FAIL',exitCode:outcome.exitCode,timeout:outcome.timeout,logSha256:outcome.logSha256}));
    if (!ok) throw new Error('STAGE_FAILED_' + name);
  }
  if (git(['rev-parse', 'HEAD']) !== expectedSha || git(['status', '--porcelain', '--untracked-files=no'])) {
    throw new Error('BUILD_MUTATED_TRACKED_SOURCE');
  }
  executionPassed = true;
  report.status = syntheticHarness ? 'TEST_ONLY' : 'PASS_PENDING_EVIDENCE_READBACK';
  exitCode = 0;
} catch (error) {
  report.status = 'FAIL_CLOSED';
  report.failureCode = String(error?.message || error).replace(/[^A-Z0-9_-]/gi, '_').slice(0,110);
  console.error('R426_FAILURE ' + report.failureCode);
  exitCode = 1;
} finally {
  report.finishedUtc = new Date().toISOString();
  store();
  if (escrowEndpoints) {
    try {
      report.evidenceDelivery = await publishEvidence({ evidenceDir, endpoints: escrowEndpoints, synthetic: syntheticHarness });
      if (executionPassed) report.status = syntheticHarness ? 'TEST_ONLY' : 'PASS_NONPRODUCTION_BUILD_AND_SCOPED_CONTRACTS';
    } catch {
      // Never print signed GCS URLs, sensitive query parameters, or backend errors.
      report.evidenceDelivery = { status: 'FAILED' };
      report.status = 'FAIL_CLOSED';
      report.failureCode = 'R427_EVIDENCE_ESCROW_FAILED';
      exitCode = 1;
    }
  } else if (syntheticHarness) {
    report.evidenceDelivery = { status: 'TEST_ONLY_NOT_UPLOADED' };
  } else {
    report.evidenceDelivery = { status: 'BLOCKED_NO_EXTERNAL_DESTINATION' };
    report.status = 'FAIL_CLOSED';
    report.failureCode = 'R427_EVIDENCE_DESTINATION_REQUIRED';
    exitCode = 1;
  }
  store();
  console.log('R426_RECEIPT ' + JSON.stringify({status:report.status,expectedSha,observedSha:report.observedSha,steps:report.steps.length,delivery:report.evidenceDelivery.status,reportPath,sha256:sha256(reportPath)}));
  process.exitCode = exitCode;
}
