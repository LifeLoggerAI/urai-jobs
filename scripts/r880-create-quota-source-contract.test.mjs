/**
 * R880 source wiring guard. Checks the ORIGINAL source files instead of a
 * mock reimplementation. Static-only: not a Firestore emulator proof.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const creation = read('functions/src/jobs/createJob.ts');
const rights = read('functions/src/privacy/dataRightsExecution.ts');
const rules = read('firestore.rules');

test('R880 new queue and job use the existing transaction', () => {
  assert.match(creation, /return await db\.runTransaction\(async \(transaction\) =>/);
  assert.match(creation, /transaction\.create\(jobRef,/);
  assert.match(creation, /transaction\.create\(queueRef,/);
  assert.match(creation, /transaction\.create\(logRef,/);
});
test('R880 transaction reads owner, lock and recent job query before any write', () => {
  const start = creation.indexOf('return await db.runTransaction(async (transaction) =>');
  const end = creation.indexOf('  } catch (error: unknown)', start);
  assert.ok(start >= 0 && end > start);
  const body = creation.slice(start, end);
  const owner = body.indexOf('transaction.get(ownerRef)');
  const lock = body.indexOf('transaction.get(quotaLockRef)');
  const count = body.indexOf('transaction.get(db.collection(\'jobs\')');
  const check = body.indexOf('jobCreateRateLimitAllowsCount(currentWindow.size, MAX_CREATE_PER_MINUTE)');
  const firstWrite = body.indexOf('transaction.set(quotaLockRef,');
  const jobWrite = body.indexOf('transaction.create(jobRef,');
  assert.ok(owner >= 0 && owner < lock);
  assert.ok(lock < count && count < check);
  assert.ok(check < firstWrite && firstWrite < jobWrite);
  assert.doesNotMatch(body.slice(0, firstWrite), /transaction\.(?:set|create|update|delete)\(/);
});
test('R880 quota document uses same owner lock for every new job type', () => {
  assert.match(creation, /const quotaLockRef = db\.collection\('jobCreateRateLimitLocks'\)\.doc\(jobCreateRateLimitLockId\(uid\)\)/);
  assert.match(creation, /transaction\.set\(quotaLockRef,[\s\S]*?FieldValue\.increment\(1\)/);
  assert.match(creation, /where\('ownerUid', '==', uid\)/);
  assert.match(creation, /where\('createdAt', '>=', windowStart\)/);
});
test('R880 duplicate idempotency hit is resolved before new quota allocation', () => {
  const hit = creation.indexOf('if (bindingRef) {\n    const existing = await bindingRef.get()');
  const admission = creation.indexOf('await assertCreateRateLimit(uid)');
  assert.ok(hit >= 0 && admission > hit);
  assert.match(creation.slice(hit, admission), /return db\.runTransaction/);
});
test('R880 quota lock remains server-only under Firestore Rules', () => {
  assert.match(rules, /match \/jobCreateRateLimitLocks\/\{lockId\} \{\s*allow read, write: if false;\s*\}/);
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
});
test('R880 protected Jobs deletion removes owner quota lock', () => {
  assert.match(rights, /import \{ jobCreateRateLimitLockId \} from '\.\.\/core\/jobsReliability\.js'/);
  const fence = rights.indexOf('async function executeDelete(');
  const lock = rights.indexOf("db.collection('jobCreateRateLimitLocks')", fence);
  const privacyFlag = rights.indexOf('dataRightsDeletionPendingCentralPrivacy: true', fence);
  assert.ok(fence >= 0 && lock > fence && privacyFlag > lock);
  assert.match(rights.slice(lock, privacyFlag), /\.doc\(jobCreateRateLimitLockId\(ownerUid\)\)\.delete\(\)/);
});
