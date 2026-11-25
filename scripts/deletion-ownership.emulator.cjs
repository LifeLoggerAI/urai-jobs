'use strict';
// Compile Functions, then run only with the exact local project/host below.
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const dependencyRoot = path.join(__dirname, '../functions');
const { initializeApp, deleteApp } = require(require.resolve('firebase-admin/app', { paths: [dependencyRoot] }));
const { getFirestore } = require(require.resolve('firebase-admin/firestore', { paths: [dependencyRoot] }));
const { executeJobsScopedDelete } = require('../functions/lib/functions/privacy/dataRightsExecution.js');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-urai-jobs-deletion');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:18180');
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'GITHUB_TOKEN', 'RUNPOD_API_KEY']) assert.equal(process.env[key], undefined);
const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT }, 'deletion-ownership-native');
const db = getFirestore(app), nonce = randomBytes(6).toString('hex');
const owner = `synthetic-owner-${nonce}`, foreign = `synthetic-other-${nonce}`;
const cleanup = new Set(), checks = [];
async function put(location, data) {
  cleanup.add(location);
  await db.doc(location).set(data);
}
// Simulate ordinary concurrent record updates after the bounded inventory read,
// using native Firestore for both writes and the production deletion transaction.
function changeAfterInventory(collectionName, change) {
  let changed = false;
  const wrap = query => new Proxy(query, { get(target, key) {
    if (key === 'get') return async () => {
      const snapshot = await target.get();
      if (!changed) { changed = true; await change(); }
      return snapshot;
    };
    if (['where', 'orderBy', 'limit'].includes(key)) return (...args) => wrap(target[key](...args));
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } });
  return new Proxy(db, { get(target, key) {
    if (key === 'collection') return name => name === collectionName ? wrap(target.collection(name)) : target.collection(name);
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } });
}
async function main() {
  const job = `changed-job-${nonce}`;
  await put(`jobs/${job}`, { ownerUid: owner, payload: { synthetic: true } });
  await put(`jobResults/${job}`, { ownerUid: owner, result: { synthetic: true } });
  await assert.rejects(executeJobsScopedDelete(changeAfterInventory('jobs', () => db.doc(`jobs/${job}`).update({ ownerUid: foreign })), 'synthetic-request', owner), /ownership changed/);
  assert.equal((await db.doc(`jobs/${job}`).get()).get('ownerUid'), foreign);
  assert.ok((await db.doc(`jobs/${job}`).get()).get('payload'));
  assert.ok((await db.doc(`jobResults/${job}`).get()).exists);
  checks.push('changed-job-owner-preserves-linked-records');

  // The previous linked result is no longer a valid owner-targeted orphan.
  await db.doc(`jobResults/${job}`).update({ ownerUid: foreign });
  const orphan = `changed-orphan-${nonce}`;
  await put(`jobResults/${orphan}`, { ownerUid: owner, result: { synthetic: true } });
  await assert.rejects(executeJobsScopedDelete(changeAfterInventory('jobResults', () => db.doc(`jobResults/${orphan}`).update({ ownerUid: foreign })), 'synthetic-request', owner), /ownership changed/);
  assert.equal((await db.doc(`jobResults/${orphan}`).get()).get('ownerUid'), foreign);
  checks.push('changed-orphan-owner-preserved');

  const conflict = `conflict-job-${nonce}`;
  await put(`jobs/${conflict}`, { ownerUid: owner, payload: { synthetic: true } });
  await put(`jobs/${conflict}/logs/one`, { synthetic: true });
  await put(`jobResults/${conflict}`, { ownerUid: foreign, result: { synthetic: true } });
  await assert.rejects(executeJobsScopedDelete(db, 'synthetic-request', owner), /ownership requires reconciliation/);
  assert.ok((await db.doc(`jobs/${conflict}/logs/one`).get()).exists);
  assert.ok((await db.doc(`jobs/${conflict}`).get()).get('payload'));
  checks.push('conflicting-linked-owner-denies-entire-job-transaction');

  // Reconcile the synthetic conflict, then prove the legitimate path still works.
  await db.doc(`jobResults/${conflict}`).update({ ownerUid: owner });
  await put(`jobQueue/${conflict}`, { ownerUid: owner, synthetic: true });
  const tagged = `owned-orphan-${nonce}`, untagged = `unknown-orphan-${nonce}`;
  await put(`jobResults/${tagged}`, { ownerUid: owner, result: { synthetic: true } });
  await put(`jobResults/${untagged}`, { result: { unknownOwnership: true } });
  cleanup.add(`users/${owner}`);
  const result = await executeJobsScopedDelete(db, 'synthetic-request', owner);
  assert.deepEqual([result.jobsAnonymized, result.queueDeletes, result.jobResultDeletes, result.logDeletes], [1, 1, 2, 1]);
  for (const location of [`jobQueue/${conflict}`, `jobResults/${conflict}`, `jobs/${conflict}/logs/one`, `jobResults/${tagged}`]) assert.equal((await db.doc(location).get()).exists, false);
  assert.ok((await db.doc(`jobResults/${untagged}`).get()).exists);
  assert.equal((await db.doc(`jobResults/${orphan}`).get()).get('ownerUid'), foreign);
  assert.equal((await db.doc(`users/${owner}`).get()).get('dataRightsDeletionPendingCentralPrivacy'), true);
  checks.push('committed-owner-counts-correct-unknown-and-foreign-preserved');
  console.log('JOBS_DELETION_OWNERSHIP_NATIVE_PASS ' + JSON.stringify({ checks, synthetic: true, globalDeletionCertified: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const location of cleanup) await db.doc(location).delete();
  await deleteApp(app);
});
