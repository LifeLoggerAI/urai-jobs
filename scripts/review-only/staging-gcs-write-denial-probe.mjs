/**
 * R865: staging-only, review-only negative GCS object-create probe for Jobs #252.
 * A 403 is an observation for one credential/bucket/time, NEVER effective IAM,
 * legacy-identity inventory, deletion, positive consent or production authority.
 *
 * CLI refuses I/O without an explicit out-of-repo private manifest, out-of-repo
 * nonexisting append-only journal, a fixed opt-in flag and a separate environment opt-in.
 * It performs ZERO IAM mutation, uses ZERO customer media, and uploads only
 * an empty, unique, generation-preconditioned staging sentinel on an unexpected
 * permission grant. It never silently deletes unexpected evidence.
 */
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants, closeSync, existsSync, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, writeSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'urai-private-gcs-denial-staging-review-v1';
export const CONSENT = 'I_AUTHORIZE_ONLY_STAGING_ZERO_BYTE_GCS_DENIAL_ATTEMPTS';
const PREFIX = '__urai_security_staging__/post-revocation-denial/';
const EMAIL = /^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/;
const PROJECT = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const BUCKET = /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/;
const SHA = /^[0-9a-f]{40}$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const RESULT_CODES = new Set(['DENIED_OBSERVED', 'WRITE_WAS_ALLOWED', 'TOKEN_UNAVAILABLE', 'UNVERIFIED_RESPONSE', 'TRANSPORT_UNVERIFIED']);

function exact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_STAGING_MANIFEST');
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error('INVALID_STAGING_MANIFEST');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== fields.length || fields.some(x => !Object.hasOwn(descriptors, x) || !Object.hasOwn(descriptors[x], 'value'))) {
    throw Error('INVALID_STAGING_MANIFEST');
  }
  return Object.freeze(Object.fromEntries(fields.map(x => [x, descriptors[x].value])));
}

export function validateStagingManifest(untrusted, nowMs = Date.now()) {
  const x = exact(untrusted, ['schemaVersion', 'environment', 'projectId', 'bucket', 'probePrefix', 'authorizationRef', 'withdrawalEventId', 'withdrawalCommittedAt', 'expectedJobsSourceSha', 'serviceAccounts']);
  if (x.schemaVersion !== SCHEMA || x.environment !== 'STAGING' || !PROJECT.test(x.projectId) ||
      !/(staging|sandbox|test)/.test(x.projectId) || /(prod|production|live)/.test(x.projectId) ||
      typeof x.bucket !== 'string' || !BUCKET.test(x.bucket) || x.bucket.includes('..') ||
      !/(staging|sandbox|test)/.test(x.bucket) || /(prod|production|live)/.test(x.bucket) ||
      x.probePrefix !== PREFIX || !REF.test(x.authorizationRef) || !REF.test(x.withdrawalEventId) ||
      !SHA.test(x.expectedJobsSourceSha) || !Number.isSafeInteger(nowMs) || nowMs <= 0 ||
      typeof x.withdrawalCommittedAt !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(x.withdrawalCommittedAt)) throw Error('INVALID_STAGING_MANIFEST');
  const withdrawnAt = Date.parse(x.withdrawalCommittedAt);
  if (!Number.isFinite(withdrawnAt) || new Date(withdrawnAt).toISOString() !==
    new Date(x.withdrawalCommittedAt).toISOString() || withdrawnAt <= 0 || withdrawnAt >= nowMs) throw Error('REVOCATION_NOT_COMMITTED_BEFORE_PROBE');
  if (!Array.isArray(x.serviceAccounts) || x.serviceAccounts.length < 1 || x.serviceAccounts.length > 16) throw Error('INVALID_PRINCIPAL_INVENTORY');
  const identities = x.serviceAccounts.map(v => {
    const item = exact(v, ['email', 'kind', 'identityEvidenceRef']);
    if (typeof item.email !== 'string' || !EMAIL.test(item.email) ||
        !['retired-writer', 'alternate-writer'].includes(item.kind) || !REF.test(item.identityEvidenceRef)) {
      throw Error('INVALID_PRINCIPAL_INVENTORY');
    }
    return item;
  });
  if (!identities.some(i => i.kind === 'retired-writer') ||
      new Set(identities.map(i => i.email)).size !== identities.length) throw Error('INVALID_PRINCIPAL_INVENTORY');
  return Object.freeze({ ...x, serviceAccounts: Object.freeze(identities) });
}

export function assertExplicitStagingOptIn(args, env = process.env) {
  if (args.execute !== true || env.URAI_GCS_STAGING_NEGATIVE_PROBE_CONSENT !== CONSENT) throw Error('STAGING_NETWORK_PROBE_NOT_AUTHORIZED');
}

export function makeSentinel(scope, nowMs, random = randomBytes) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 1) throw Error('INVALID_PROBE_TIME');
  const nonce = random(16);
  if (!Buffer.isBuffer(nonce) || nonce.length !== 16) throw Error('INVALID_PROBE_NONCE');
  return scope.probePrefix + String(nowMs) + '-' + nonce.toString('hex') + '.empty';
}

export function buildGcsInsertUrl(bucket, objectName) {
  const url = new URL('https://storage.googleapis.com/upload/storage/v1/b/' + encodeURIComponent(bucket) + '/o');
  url.searchParams.set('uploadType', 'media');
  url.searchParams.set('name', objectName);
  url.searchParams.set('ifGenerationMatch', '0');
  url.searchParams.set('fields', 'name,generation');
  return url.toString();
}

const hashed = value => createHash('sha256').update(value).digest('hex');
function observedStatus(status) {
  if (status === 403) return 'DENIED_OBSERVED';
  if (status === 200 || status === 201) return 'WRITE_WAS_ALLOWED';
  return 'UNVERIFIED_RESPONSE';
}

/** Injected provider and fetch are used by offline tests; CLI uses gcloud + live GCS. */
export async function runStagingDenialReview(rawManifest, dependencies) {
  const nowMs = dependencies?.nowMs ?? Date.now();
  const manifest = validateStagingManifest(rawManifest, nowMs);
  assertExplicitStagingOptIn({ execute: dependencies?.execute }, dependencies?.env || {});
  if (typeof dependencies?.sourceSha !== 'string' || dependencies.sourceSha !== manifest.expectedJobsSourceSha ||
      typeof dependencies?.getCredential !== 'function' || typeof dependencies?.fetchImpl !== 'function') throw Error('SOURCE_OR_PROBE_DEPENDENCIES_UNVERIFIED');
  const results = [];
  for (const p of manifest.serviceAccounts) {
    const sentinel = makeSentinel(manifest, nowMs, dependencies.random || randomBytes);
    const base = { principalHash: hashed(p.email), kind: p.kind, identityEvidenceRef: p.identityEvidenceRef,
      objectName: sentinel, attemptedAt: new Date(nowMs).toISOString() };
    // Persist the exact sentinel BEFORE any token or byte operation. A crash
    // after an unexpectedly authorized request must not lose cleanup evidence.
    if (dependencies.onPrepared) await dependencies.onPrepared(Object.freeze(base));
    const record = async (outcome, httpStatus = null) => {
      const item = Object.freeze({ ...base, outcome, httpStatus, cleanupRequired:outcome === 'WRITE_WAS_ALLOWED' });
      results.push(item);
      if (dependencies.onResult) await dependencies.onResult(item);
      return item;
    };
    let token;
    try { token = await dependencies.getCredential(p.email, manifest.projectId); }
    catch { await record('TOKEN_UNAVAILABLE'); continue; }
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096 || /\s/.test(token)) {
      await record('TOKEN_UNAVAILABLE'); continue;
    }
    let response;
    try {
      response = await dependencies.fetchImpl(buildGcsInsertUrl(manifest.bucket, sentinel), {
        method:'POST', redirect:'error', cache:'no-store',
        headers:{ authorization:'Bearer ' + token, accept:'application/json', 'content-type':'application/octet-stream', 'content-length':'0' },
        body:Buffer.alloc(0), signal:AbortSignal.timeout(15000),
      });
    } catch { await record('TRANSPORT_UNVERIFIED'); continue; }
    const status = Number.isInteger(response?.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
    const outcome = observedStatus(status);
    if (!RESULT_CODES.has(outcome)) throw Error('UNEXPECTED_PROBE_OUTCOME');
    await record(outcome, status);
    // The first unexpected write proves the boundary failed. No reason to
    // risk creating further sentinel objects under alternate identities.
    if (outcome === 'WRITE_WAS_ALLOWED') break;
  }
  const all403 = results.length === manifest.serviceAccounts.length && results.every(r => r.outcome === 'DENIED_OBSERVED');
  return Object.freeze({ schemaVersion:SCHEMA, status:all403 ? 'STAGING_403_OBSERVED_HOLD' : 'BLOCKED_HOLD',
    projectId:manifest.projectId, bucket:manifest.bucket, sourceSha:manifest.expectedJobsSourceSha,
    withdrawalEventId:manifest.withdrawalEventId, withdrawalCommittedAt:manifest.withdrawalCommittedAt,
    authorizationRef:manifest.authorizationRef, collectedAt:new Date(nowMs).toISOString(),
    principalCoverage:'MANIFEST_ONLY_NOT_EXHAUSTIVE', identityAttestation:'GCLOUD_IMPERSONATION_INVOCATION_ONLY',
    storageWriteFenceVerified:false, effectiveIamVerified:false, privateOutputDeletionAcknowledged:false,
    productionAuthorized:false, productionGo:false, independentIamReviewRequired:true,
    results });
}

function pathOutsideRepo(filePath, checkExisting = false) {
  if (typeof filePath !== 'string' || !isAbsolute(filePath)) throw Error('PRIVATE_ABSOLUTE_PATH_REQUIRED');
  const directory = realpathSync(dirname(filePath));
  const repo = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  const rel = relative(repo, directory);
  if (rel === '' || (rel !== '..' && !rel.startsWith('..' + sep))) throw Error('OUTPUT_OR_MANIFEST_INSIDE_REPO');
  if (checkExisting) {
    const info = lstatSync(filePath);
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) {
      throw Error('PRIVATE_MANIFEST_MODE_REQUIRED');
    }
  }
  if (!checkExisting && existsSync(filePath)) throw Error('REFUSE_REPORT_OVERWRITE');
  return filePath;
}

function cliArgs(args) {
  if (args.length !== 5 || args[0] !== '--manifest' || args[2] !== '--report' || args[4] !== '--execute-staging-denial-probe') throw Error('EXPLICIT_CLI_SCOPE_REQUIRED');
  return { manifest:args[1], report:args[3], execute:true };
}
function activeGitSource() {
  const r = spawnSync('git', ['rev-parse','HEAD'], {cwd:resolve(dirname(fileURLToPath(import.meta.url)), '../..'), encoding:'utf8', timeout:5000, shell:false });
  if (r.error || r.status !== 0 || !SHA.test((r.stdout||'').trim())) throw Error('EXACT_GIT_SOURCE_UNAVAILABLE');
  return r.stdout.trim();
}
function impersonatedCredential(email, projectId) {
  const r = spawnSync('gcloud', ['auth','print-access-token', '--impersonate-service-account=' + email,
    '--project=' + projectId, '--quiet'], {encoding:'utf8', shell:false, timeout:20000,
    env:{...process.env,CLOUDSDK_CORE_DISABLE_PROMPTS:'1'}, maxBuffer:8192 });
  if (r.error || r.status !== 0) throw Error('SERVICE_ACCOUNT_IMPERSONATION_UNAVAILABLE');
  return (r.stdout||'').trim();
}
/**
 * R866: an append-only, fsynced audit journal. Never truncate a live audit
 * file: a crash halfway through rewriting the report can destroy the only
 * surviving path of an unexpectedly allowed GCS object.
 *
 * One complete JSONL entry per stage. A torn LAST line after a crash may be
 * ignored by a forensic reader; all preceding fsynced entries remain intact.
 */
export function appendReviewOnlyAuditEvent(fd, record) {
  const data = Buffer.from(JSON.stringify(record) + '\n');
  if (data.length > 16384) throw Error('PRIVATE_JOURNAL_ENTRY_TOO_LARGE');
  let written = 0;
  while (written < data.length) {
    const count = writeSync(fd, data, written, data.length - written, null);
    if (count <= 0) throw Error('PRIVATE_JOURNAL_APPEND_UNVERIFIED');
    written += count;
  }
  fsyncSync(fd);
}
async function main() {
  let journalFd;
  let seq = 0;
  const append = (type, data = {}) => {
    if (journalFd === undefined) throw Error('PRIVATE_JOURNAL_NOT_CREATED');
    appendReviewOnlyAuditEvent(journalFd, {
      schemaVersion:SCHEMA, sequence:++seq, type,
      ...data, productionGo:false, storageWriteFenceVerified:false,
      privateOutputDeletionAcknowledged:false,
    });
  };
  try {
    const args = cliArgs(process.argv.slice(2));
    assertExplicitStagingOptIn(args, process.env);
    const manifestPath = pathOutsideRepo(args.manifest, true);
    const reportPath = pathOutsideRepo(args.report, false);
    const raw=JSON.parse(readFileSync(manifestPath,'utf8'));
    const manifest=validateStagingManifest(raw);
    const head=activeGitSource();
    if (head !== manifest.expectedJobsSourceSha) throw Error('EXACT_GIT_SOURCE_MISMATCH');
    journalFd=openSync(reportPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_APPEND |
      (constants.O_NOFOLLOW || 0), 0o600);
    if ((fstatSync(journalFd).mode & 0o777) !== 0o600) {
      throw Error('PRIVATE_JOURNAL_MODE_UNVERIFIED');
    }
    append('STARTED_INCOMPLETE', {
      projectId:manifest.projectId, bucket:manifest.bucket, sourceSha:head,
      withdrawalEventId:manifest.withdrawalEventId,
      authorizationRef:manifest.authorizationRef,
      declaredPrincipals:manifest.serviceAccounts.length,
    });
    const receipt=await runStagingDenialReview(manifest,{
      execute:true,env:process.env,sourceSha:head,
      getCredential:impersonatedCredential,fetchImpl:fetch,
      onPrepared:async attempt=>{
        // This event must be durable BEFORE a token or GCS request starts.
        append('PREPARED_BEFORE_NETWORK', attempt);
      },
      onResult:async result=>{
        // A successful unexpected write is visible even if later steps crash.
        append('HTTP_RESULT', result);
      },
    });
    append('FINISHED_HOLD', {receipt});
    console.log('R866_STAGING_NEGATIVE_PROBE_RECORDED status=' + receipt.status +
      ' checked=' + receipt.results.length +
      ' productionGo=false storageWriteFenceVerified=false');
  } catch (e) {
    if (journalFd !== undefined) {
      try { append('INCOMPLETE_BLOCKED', { reason:'UNVERIFIED_STOP' }); } catch {}
    }
    console.error('R866_STAGING_PROBE_BLOCKED ' +
      (e instanceof Error ? e.message : 'UNVERIFIED'));
  } finally {
    if (journalFd !== undefined) closeSync(journalFd);
  }
  // Even a staging 403 cannot authorize production; always HOLD.
  process.exitCode=2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
