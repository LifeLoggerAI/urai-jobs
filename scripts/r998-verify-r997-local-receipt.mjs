#!/usr/bin/env node
// R998 review-only independent audit of R997 local runner receipts.
// A local command's zero exit status is NOT certified integration or protected CI.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const CLASSES = {
  PASSED: 'LOCAL_COMMAND_EXIT_ZERO_UNVERIFIED',
  FAILED: 'LOCAL_COMMAND_FAILED',
  TIMEOUT_OR_KILLED: 'LOCAL_COMMAND_TIMED_OUT_OR_KILLED',
  NATIVE_TOOL_MISSING: 'LOCAL_TOOL_MISSING',
};

export class ReceiptRejected extends Error {
  constructor(message) { super(message); this.name = 'ReceiptRejected'; }
}
function deny(message) { throw new ReceiptRejected(message); }
function regularFile(dir, name) {
  const filename = path.join(dir, name);
  let s;
  try { s = fs.lstatSync(filename); }
  catch { deny(`missing ${name}`); }
  if (!s.isFile() || s.isSymbolicLink()) deny(`non-regular or symlink ${name}`);
  return fs.readFileSync(filename);
}
function exactly(value, expected, label) {
  if (value !== expected) deny(`${label} mismatch`);
}
function parseDate(v, label) {
  if (typeof v !== 'string' || !UTC.test(v) || !Number.isFinite(Date.parse(v))) deny(`invalid ${label}`);
  return Date.parse(v);
}

export function audit(receiptDir, expectedSha, expectedTree) {
  if (typeof receiptDir !== 'string' || !path.isAbsolute(receiptDir)) deny('receiptDir must be absolute');
  if (typeof expectedSha !== 'string' || !SHA.test(expectedSha) || typeof expectedTree !== 'string' || !SHA.test(expectedTree)) deny('source pins must be exact SHA-1 identifiers');
  let root;
  try { root = fs.lstatSync(receiptDir); }
  catch { deny('receipt directory missing'); }
  if (!root.isDirectory() || root.isSymbolicLink()) deny('receipt directory must not be symlink');
  let json;
  try { json = JSON.parse(regularFile(receiptDir, 'receipt.json').toString('utf8')); }
  catch (e) { if (e instanceof ReceiptRejected) throw e; deny('invalid JSON receipt'); }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) deny('invalid JSON object');
  exactly(json.schema, 'R997_NATIVE_VERIFY_V1', 'schema');
  exactly(json.evidence_class, 'LOCAL_SCRIPT_EXECUTION_NOT_PROTECTED_CI', 'evidence class');
  exactly(json.source_sha, expectedSha, 'source SHA');
  exactly(json.tree_sha, expectedTree, 'tree SHA');
  if (!SHA256.test(json.log_sha256 ?? '')) deny('invalid SHA256 digest');
  if (!Number.isSafeInteger(json.exit_code) || json.exit_code < 0 || json.exit_code > 255) deny('invalid exit code');
  if (!Number.isSafeInteger(json.duration_seconds) || json.duration_seconds < 0 || json.duration_seconds > 3600) deny('invalid recorded duration');
  if (!Object.hasOwn(CLASSES, json.status)) deny('unknown local status');
  const start = parseDate(json.start_utc, 'start timestamp');
  const end = parseDate(json.end_utc, 'end timestamp');
  if (end < start) deny('time reversal');
  if (Math.abs(Math.round((end - start) / 1000) - json.duration_seconds) > 2) deny('duration inconsistent with timestamps');
  if (json.status === 'PASSED' && json.exit_code !== 0) deny('false PASSED exit code');
  if (json.exit_code === 0 && json.status !== 'PASSED') deny('exit zero falsely marked as non-PASSED');
  if (json.status === 'NATIVE_TOOL_MISSING' && json.exit_code !== 127) deny('tool missing requires exit 127');
  if (json.status === 'TIMEOUT_OR_KILLED' && ![124, 137].includes(json.exit_code)) deny('time-out code mismatch');
  if (json.status === 'FAILED' && [0, 124, 137].includes(json.exit_code)) deny('failure code mismatch');
  const log = regularFile(receiptDir, 'native.log');
  exactly(createHash('sha256').update(log).digest('hex'), json.log_sha256, 'log digest');
  const metadata = regularFile(receiptDir, 'metadata.log').toString('utf8');
  const expectedMeta = `R997_ATTEMPT_CREATED sha=${expectedSha} tree=${expectedTree} started=${json.start_utc}\n`;
  exactly(metadata, expectedMeta, 'metadata');
  return Object.freeze({
    schema: 'R998_LOCAL_RECEIPT_AUDIT_V1',
    internal_receipt_consistency_verified: true,
    external_source_identity_verified: false,
    independent_external_provenance_verified: false,
    verified_provider_identity: false,
    protected_ci_certified: false,
    authenticated_lifecycle_certified: false,
    release_authorized: false,
    source_sha: expectedSha,
    tree_sha: expectedTree,
    original_local_status: json.status,
    classification: CLASSES[json.status],
    raw_log_sha256: json.log_sha256,
    evidence_only: true,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const [, , receiptDir, sha, tree] = process.argv;
    if (process.argv.length !== 5) deny('usage: node verify-r997-local-receipt.mjs ABS_RECEIPT_DIR EXACT_SOURCE_SHA EXACT_TREE_SHA');
    process.stdout.write(`${JSON.stringify(audit(receiptDir, sha, tree))}\n`);
  } catch (e) {
    process.stderr.write(`R998_RECEIPT_DENIED: ${e.message}\n`);
    process.exitCode = 2;
  }
}
