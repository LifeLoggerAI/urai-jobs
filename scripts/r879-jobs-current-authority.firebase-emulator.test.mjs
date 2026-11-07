/**
 * R879: Auth + Firestore + Functions emulator acceptance using real emulator
 * ID tokens and deployed callables. Synthetic disposable demo project only.
 * Not a GCS IAM, positive C6, private rendering or release certificate.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT = 'demo-urai-jobs';
const AUTH_HOST = '127.0.0.1:9099';
const FIRESTORE_HOST = '127.0.0.1:8080';
const FUNCTIONS_HOST = '127.0.0.1:5001';
const STORAGE_HOST = '127.0.0.1:9199';
assert.equal(process.env.R879_JOBS_EMULATOR_APPROVED, '1', 'R879 requires explicit demo-emulator opt-in');
for (const [key, value] of Object.entries({
  GCLOUD_PROJECT: PROJECT,
  GOOGLE_CLOUD_PROJECT: PROJECT,
  FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST,
  FIRESTORE_EMULATOR_HOST: FIRESTORE_HOST,
  FIREBASE_STORAGE_EMULATOR_HOST: STORAGE_HOST,
})) assert.equal(process.env[key], value, 'R879 forbids non-demo ' + key);
for (const key of [
  'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'FIREBASE_CLI_TOKEN',
  'GOOGLE_OAUTH_ACCESS_TOKEN', 'GOOGLE_CLOUD_ACCESS_TOKEN', 'RUNPOD_API_KEY',
  'GCS_BUCKET_NAME', 'FIREBASE_STORAGE_BUCKET',
]) assert.equal(process.env[key], undefined, 'R879 forbids inherited credential or storage config ' + key);
if (process.env.FIREBASE_CONFIG) {
  const config = JSON.parse(process.env.FIREBASE_CONFIG);
  assert.equal(config.projectId, PROJECT, 'R879 Firebase config cannot target a real project');
}
assert.ok(!process.env.FUNCTIONS_EMULATOR_ORIGIN ||
  process.env.FUNCTIONS_EMULATOR_ORIGIN === 'http://' + FUNCTIONS_HOST,
'R879 forbids remote Functions origin');

const app = initializeApp({ projectId: PROJECT }, 'r879-' + randomUUID());
const auth = getAuth(app), db = getFirestore(app);
const prefix = randomUUID().replaceAll('-', '').slice(0, 18);
const ids = { owner: 'r879-owner-' + prefix, operator: 'r879-operator-' + prefix };
const credentials = new Map(), touchedJobs = new Set();
let ownerToken, operatorToken, originalId;
const oldKey = 'r879-' + prefix + '-original';
function profile(uid, role, extra = {}) {
  return { uid, role, disabled: false, deleted: false, markedForDeletion: false,
    accountStatus: 'active', dataRightsDeletionPendingCentralPrivacy: false,
    permissions: role === 'user' ? ['jobs:create'] : [],
    tenantId: 'tenant-r879-a', orgId: 'org-r879-a', ...extra };
}
function requestFor(label, key) {
  return { jobType: 'narrator.tts', payload: { text: 'Synthetic R879 ' + label,
    format: 'MP3', options: { voice: 'default', speed: 1 } }, idempotencyKey: key };
}
async function tokenFor(uid) {
  const { email, password } = credentials.get(uid);
  const res = await fetch('http://' + AUTH_HOST + '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-r879-only', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }), signal: AbortSignal.timeout(10000),
  });
  const body = await res.json();
  assert.equal(res.status, 200, 'Auth emulator sign-in failed ' + JSON.stringify(body));
  assert.ok(body.idToken, 'Auth emulator must issue an ID token');
  return body.idToken;
}
async function invoke(name, token, data) {
  assert.match(name, /^(getJob|getJobStatus|cancelJob|createJob|listJobsV2|listJobLogsV2|retryJobV2)$/);
  const response = await fetch('http://' + FUNCTIONS_HOST + '/' + PROJECT + '/us-central1/' + name, {
    method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ data }), signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  return { code: response.status, body, result: body.result };
}
async function succeeds(name, token, data) {
  const got = await invoke(name, token, data);
  assert.equal(got.code, 200, name + ' failed: ' + JSON.stringify(got.body));
  assert.ok(!got.body.error, name + ' returned error ' + JSON.stringify(got.body.error));
  return got.result;
}
async function denied(name, token, data, expected = /permission[-_]denied|failed[-_]precondition/) {
  const got = await invoke(name, token, data);
  const error = JSON.stringify(got.body.error ?? {}).replaceAll('_', '-').toLowerCase();
  assert.ok(got.code >= 400 || got.body.error, name + ' unexpectedly succeeded');
  assert.match(error, expected, name + ' denial mismatch: ' + JSON.stringify(got.body));
}
before(async () => {
  for (const uid of Object.values(ids)) {
    const email = uid + '@test.local', password = 'Demo-Only-' + randomUUID() + '!';
    credentials.set(uid, { email, password });
    await auth.createUser({ uid, email, password });
  }
  await auth.setCustomUserClaims(ids.operator, { role: 'operator', roles: ['operator'], uraiJobsAdmin: true });
  await db.collection('users').doc(ids.owner).set(profile(ids.owner, 'user'));
  await db.collection('users').doc(ids.operator).set(profile(ids.operator, 'operator'));
  ownerToken = await tokenFor(ids.owner);
  operatorToken = await tokenFor(ids.operator); // intentionally retained after demotion
});
after(async () => {
  await Promise.allSettled(Object.values(ids).map(uid => db.collection('users').doc(uid).delete()));
  await Promise.allSettled([...touchedJobs].map(async id => {
    await db.collection('jobs').doc(id).delete();
    await db.collection('jobQueue').doc(id).delete();
  }));
  await Promise.allSettled(Object.values(ids).map(uid => auth.deleteUser(uid)));
  await deleteApp(app);
});
test('R879 original native Auth/Firestore/Functions caller and owner-scope acceptance', async t => {
  await t.test('active owner creates and reads a bound job', async () => {
    const created = await succeeds('createJob', ownerToken, requestFor('initial', oldKey));
    assert.equal(created.deduplicated, false);
    assert.match(created.jobId, /\S+/);
    originalId = created.jobId;
    touchedJobs.add(originalId);
    const original = (await db.collection('jobs').doc(originalId).get()).data();
    assert.equal(original.ownerUid, ids.owner);
    assert.equal(original.tenantId, 'tenant-r879-a');
    assert.equal((await succeeds('getJobStatus', ownerToken, { jobId: originalId })).job.ownerUid, ids.owner);
    assert.equal((await succeeds('getJob', ownerToken, { jobId: originalId })).job.ownerUid, ids.owner);
  });
  await t.test('same owner and same key deduplicate without creating a second job', async () => {
    const retry = await succeeds('createJob', ownerToken, requestFor('initial', oldKey));
    assert.equal(retry.jobId, originalId);
    assert.equal(retry.deduplicated, true);
    assert.equal((await db.collection('jobs').where('ownerUid', '==', ids.owner).get()).size, 1);
  });
  await t.test('demoted operator holding earlier token cannot read, cancel, list logs or retry foreign jobs', async () => {
    assert.equal((await succeeds('getJob', operatorToken, { jobId: originalId })).job.ownerUid, ids.owner);
    await db.collection('users').doc(ids.operator).update({ role: 'user', disabled: true, permissions: [] });
    for (const [method, data] of [
      ['getJob', { jobId: originalId }], ['cancelJob', { jobId: originalId }],
      ['listJobsV2', {}], ['listJobLogsV2', { jobId: originalId }],
      ['retryJobV2', { jobId: originalId }],
    ]) await denied(method, operatorToken, data);
    assert.equal((await db.collection('jobs').doc(originalId).get()).data().status, 'PENDING');
  });
  await t.test('disabled owner cannot read or replay and cannot create new work', async () => {
    await db.collection('users').doc(ids.owner).update({ disabled: true });
    await denied('getJobStatus', ownerToken, { jobId: originalId });
    await denied('getJob', ownerToken, { jobId: originalId });
    await denied('createJob', ownerToken, requestFor('initial', oldKey));
    await denied('createJob', ownerToken, requestFor('new-disabled', 'r879-' + prefix + '-disabled'));
    assert.equal((await db.collection('jobs').where('ownerUid', '==', ids.owner).get()).size, 1);
  });
  await t.test('central deletion-pending owner cannot read or enqueue', async () => {
    await db.collection('users').doc(ids.owner).update({ disabled: false, dataRightsDeletionPendingCentralPrivacy: true });
    await denied('getJobStatus', ownerToken, { jobId: originalId });
    await denied('createJob', ownerToken, requestFor('initial', oldKey));
  });
  await t.test('tenant transfer refuses old binding, accepts new job and current-scope retry', async () => {
    await db.collection('users').doc(ids.owner).update({
      dataRightsDeletionPendingCentralPrivacy: false, tenantId: 'tenant-r879-b', orgId: 'org-r879-b',
    });
    await denied('createJob', ownerToken, requestFor('initial', oldKey));
    const key = 'r879-' + prefix + '-moved';
    const moved = await succeeds('createJob', ownerToken, requestFor('after-transfer', key));
    assert.equal(moved.deduplicated, false);
    assert.notEqual(moved.jobId, originalId);
    touchedJobs.add(moved.jobId);
    const doc = (await db.collection('jobs').doc(moved.jobId).get()).data();
    assert.equal(doc.tenantId, 'tenant-r879-b');
    assert.equal(doc.orgId, 'org-r879-b');
    const replay = await succeeds('createJob', ownerToken, requestFor('after-transfer', key));
    assert.equal(replay.jobId, moved.jobId);
    assert.equal(replay.deduplicated, true);
  });
  await t.test('permission removal rejects new admission and original idempotent retry', async () => {
    await db.collection('users').doc(ids.owner).update({ permissions: [] });
    await denied('createJob', ownerToken, requestFor('after-transfer', 'r879-' + prefix + '-moved'));
    await denied('createJob', ownerToken, requestFor('no-permission', 'r879-' + prefix + '-no-permission'));
  });
});
