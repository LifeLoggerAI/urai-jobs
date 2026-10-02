import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = fs.readFileSync(
  new URL('../functions/src/jobs/sceneTruthReceipt.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, require, Buffer, console });
const { verifySceneTruthReceiptValue } = module.exports;

const secret = 'scene-truth-test-secret-0123456789abcdef';
const projectId = 'project-1';
const ownerUid = 'user-1';
const digest = 'b'.repeat(64);
const receiptId = 'abcdefghijklmnopqrstuvwx';
const nowMs = 1_800_000_000_000;
const expiresAt = nowMs + 10 * 60 * 1000;
const expiryToken = expiresAt.toString(36);

function sign(project, sceneDigest, owner = ownerUid, expiry = expiryToken) {
  const message = `${receiptId}\n${project}\n${sceneDigest}\n${owner}\n${expiry}`;
  const signature = createHmac('sha256', secret).update(message).digest('base64url');
  return `str_${receiptId}_${expiry}_${signature}`;
}

const valid = sign(projectId, digest);
assert.deepEqual(
  JSON.parse(JSON.stringify(verifySceneTruthReceiptValue(projectId, digest, ownerUid, valid, secret, nowMs))),
  { ok: true, expiresAt, receiptId },
);

assert.deepEqual(
  JSON.parse(JSON.stringify(verifySceneTruthReceiptValue('project-2', digest, ownerUid, valid, secret, nowMs))),
  { ok: false, code: 'invalid_scene_truth_receipt_signature' },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(verifySceneTruthReceiptValue(projectId, 'c'.repeat(64), ownerUid, valid, secret, nowMs))),
  { ok: false, code: 'invalid_scene_truth_receipt_signature' },
);

const expiredToken = (nowMs - 1).toString(36);
const expired = sign(projectId, digest, ownerUid, expiredToken);
assert.deepEqual(
  JSON.parse(JSON.stringify(verifySceneTruthReceiptValue(projectId, digest, ownerUid, expired, secret, nowMs))),
  { ok: false, code: 'scene_truth_receipt_expired' },
);

const tampered = valid.slice(0, -1) + (valid.endsWith('A') ? 'B' : 'A');
assert.deepEqual(
  JSON.parse(JSON.stringify(verifySceneTruthReceiptValue(projectId, digest, ownerUid, tampered, secret, nowMs))),
  { ok: false, code: 'invalid_scene_truth_receipt_signature' },
);

assert.deepEqual(
  JSON.parse(JSON.stringify(verifySceneTruthReceiptValue(projectId, digest, ownerUid, valid, 'short', nowMs))),
  { ok: false, code: 'scene_truth_receipt_authority_unavailable' },
);

console.log('[PASS] SceneTruth receipt HMAC binds project, digest, expiry and signature');

assert.deepEqual(
  JSON.parse(JSON.stringify(verifySceneTruthReceiptValue(projectId, digest, 'user-2', valid, secret, nowMs))),
  { ok: false, code: 'invalid_scene_truth_receipt_signature' },
);
console.log('[PASS] SceneTruth receipt cannot be replayed by another owner');
