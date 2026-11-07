/**
 * R882: original Firestore index declarations must cover Jobs quota query.
 * Static schema regression only; native index deployment remains unverified.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const indexes = JSON.parse(readFileSync(new URL('firestore.indexes.json', root), 'utf8'));
const create = readFileSync(new URL('functions/src/jobs/createJob.ts', root), 'utf8');

const expected = {
  collectionGroup: 'jobs', queryScope: 'COLLECTION',
  fields: [
    { fieldPath: 'ownerUid', order: 'ASCENDING' },
    { fieldPath: 'createdAt', order: 'ASCENDING' },
  ],
};
test('R882 has exactly one ascending Jobs owner/time range index', () => {
  assert.equal(indexes.indexes.filter(index =>
    index.collectionGroup === expected.collectionGroup &&
    index.queryScope === expected.queryScope &&
    JSON.stringify(index.fields) === JSON.stringify(expected.fields)
  ).length, 1);
});
test('R882 retains historic descending Jobs owner/time index', () => {
  assert.ok(indexes.indexes.some(index =>
    index.collectionGroup === 'jobs' &&
    index.queryScope === 'COLLECTION' &&
    JSON.stringify(index.fields) === JSON.stringify([
      { fieldPath: 'ownerUid', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ])));
});
test('R882 original createJob uses owner equality and createdAt minimum', () => {
  assert.match(create, /\.where\('ownerUid', '==', uid\)/);
  assert.match(create, /\.where\('createdAt', '>=', windowStart\)/);
  assert.match(create, /const currentWindow = await transaction\.get\(db\.collection\('jobs'\)/);
});
test('R882 all index metadata is structurally complete and unique', () => {
  const names = new Set();
  for (const entry of indexes.indexes) {
    assert.equal(entry.queryScope, 'COLLECTION');
    assert.ok(entry.collectionGroup);
    assert.ok(entry.fields.length);
    const key = JSON.stringify(entry);
    assert.ok(!names.has(key), 'Duplicate composite index: ' + key);
    names.add(key);
    for (const field of entry.fields) {
      assert.ok(field.fieldPath);
      assert.ok(['ASCENDING', 'DESCENDING'].includes(field.order));
    }
  }
});
