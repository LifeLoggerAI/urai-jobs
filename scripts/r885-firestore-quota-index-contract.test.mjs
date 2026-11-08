/**
 * R885: exact-source index and current quota admission contract.
 *
 * Source only. Does not prove that Firebase has deployed the index, that
 * production index builds are READY, or that native transactions succeed.
 * #356's original index test targeted a different createJob implementation;
 * this revision matches R883's legacy migration pre-read + owner transaction.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const indexes = JSON.parse(readFileSync(new URL('firestore.indexes.json', root), 'utf8'));
const firebase = JSON.parse(readFileSync(new URL('firebase.json', root), 'utf8'));
const create = readFileSync(new URL('functions/src/jobs/createJob.ts', root), 'utf8');
const fields = order => [
  { fieldPath: 'ownerUid', order: 'ASCENDING' },
  { fieldPath: 'createdAt', order },
];
const matching = order => indexes.indexes.filter(index =>
  index.collectionGroup === 'jobs' && index.queryScope === 'COLLECTION' &&
  JSON.stringify(index.fields) === JSON.stringify(fields(order)));

test('R885 firebase.json actually selects the declared composite index file', () => {
  assert.equal(firebase.firestore?.indexes, 'firestore.indexes.json');
});
test('R885 migration query has exactly one owner/time ASC composite', () => {
  assert.equal(matching('ASCENDING').length, 1);
});
test('R885 existing owner/time DESC index remains intact', () => {
  assert.equal(matching('DESCENDING').length, 1);
});
test('R885 index matches current R883 pre-transaction legacy migration read', () => {
  assert.match(create, /async function legacyCreateAdmissionTimes\(uid: string\)/);
  assert.match(create, /\.collection\('jobs'\)\s*\.where\('ownerUid', '==', uid\)\s*\.where\('createdAt', '>=', windowStart\)/);
  assert.match(create, /const migrationAdmissions = await legacyCreateAdmissionTimes\(uid\)/);
  assert.match(create, /return await db\.runTransaction\(async \(transaction\) => \{/);
  assert.match(create, /reserveCreateJobRateLimit\(\s*currentOwner\?\.jobsCreateRateLimit,[\s\S]*migrationAdmissions,/);
  assert.match(create, /transaction\.update\(ownerRef, \{ jobsCreateRateLimit: nextRateLimit \}\)/);
  assert.doesNotMatch(create, /const currentWindow = await transaction\.get\(db\.collection\('jobs'\)/,
    'Do not import an outdated peer source-contract test as if it describes R883');
});
test('R885 composite entries are structurally unique and valid', () => {
  const seen = new Set();
  assert.ok(indexes.indexes.length >= 9, 'Expected original eight plus ascending owner/time index');
  for (const entry of indexes.indexes) {
    assert.equal(entry.queryScope, 'COLLECTION');
    assert.ok(entry.collectionGroup && Array.isArray(entry.fields) && entry.fields.length > 0);
    const key = JSON.stringify(entry);
    assert.ok(!seen.has(key), 'Duplicate index definition ' + key);
    seen.add(key);
    for (const field of entry.fields) {
      assert.ok(field.fieldPath);
      assert.ok(field.order === 'ASCENDING' || field.order === 'DESCENDING');
    }
  }
});
