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
assert.ok(!process.env.URAI_JOBS_CREATE_RATE_LIMIT_PER_MINUTE || process.env.URAI_JOBS_CREATE_RATE_LIMIT_PER_MINUTE === '10',
  'R879 quota assertion requires the original 10/min admission limit');
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
const ids = { owner: 'r879-owner-' + prefix, operator: 'r879-operator-' + prefix, foreign: 'r879-foreign-' + prefix, quota: 'r879-quota-' + prefix };
const credentials = new Map(), touchedJobs = new Set();
let ownerToken, operatorToken, foreignToken, quotaToken, originalId;
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
  assert.match(name, /^(getJob|getJobStatus|cancelJob|createJob|listJobs|listJobLogs|retryJob|listJobsV2|listJobLogsV2|retryJobV2)$/);
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
  await db.collection('users').doc(ids.foreign).set(profile(ids.foreign, 'user', { permissions: [] }));
  await db.collection('users').doc(ids.quota).set(profile(ids.quota, 'user', { tenantId: 'tenant-r879-quota', orgId: 'org-r879-quota' }));
  ownerToken = await tokenFor(ids.owner);
  operatorToken = await tokenFor(ids.operator); // intentionally retained after demotion
  foreignToken = await tokenFor(ids.foreign);
  quotaToken = await tokenFor(ids.quota);
});
after(async () => {
  // Synthetic users are uniquely namespaced. Delete their jobs recursively
  // (including audit logs) and idempotency bindings, even after test failure.
  // Never scan or delete records belonging to unrelated emulator accounts.
  const failures = [];
  for (const uid of Object.values(ids)) {
    try {
      const owned = await db.collection('jobs').where('ownerUid', '==', uid).get();
      for (const job of owned.docs) {
        touchedJobs.add(job.id);
        await db.recursiveDelete(job.ref);
        await db.collection('jobQueue').doc(job.id).delete();
      }
      const bindings = await db.collection('jobIdempotencyBindings')
        .where('ownerUid', '==', uid).get();
      for (const binding of bindings.docs) await binding.ref.delete();
      await db.collection('users').doc(uid).delete();
      await auth.deleteUser(uid);
    } catch (error) {
      failures.push(uid + ': ' + String(error));
    }
  }
  try { await deleteApp(app); } catch (error) { failures.push('app: ' + String(error)); }
  assert.deepEqual(failures, [], 'R879 emulator teardown must not silently leave synthetic records');
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
  await t.test('ordinary foreign owner cannot read or cancel another owner job', async () => {
    await denied('getJob', foreignToken, { jobId: originalId });
    await denied('getJobStatus', foreignToken, { jobId: originalId });
    await denied('cancelJob', foreignToken, { jobId: originalId });
    await denied('createJob', foreignToken, requestFor('foreign-no-permission', 'r879-' + prefix + '-foreign'));
  });
  await t.test('demoted operator holding earlier token cannot read, cancel, list logs or retry foreign jobs', async () => {
    assert.equal((await succeeds('getJob', operatorToken, { jobId: originalId })).job.ownerUid, ids.owner);
    await db.collection('users').doc(ids.operator).update({ role: 'user', disabled: true, permissions: [] });
    for (const [method, data] of [
      ['getJob', { jobId: originalId }], ['cancelJob', { jobId: originalId }],
      ['listJobsV2', {}], ['listJobLogsV2', { jobId: originalId }],
      ['retryJobV2', { jobId: originalId }],
      ['listJobs', {}], ['listJobLogs', { jobId: originalId }],
      ['retryJob', { jobId: originalId }],
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
  await t.test('concurrent independent admission never exceeds the configured 10/minute quota', async () => {
    // A separate synthetic owner ensures the window is empty. Fire all requests
    // simultaneously: a pre-transaction read can otherwise count the same state.
    const attempts = 14;
    const results = await Promise.all(Array.from({ length: attempts }, (_, i) =>
      invoke('createJob', quotaToken,
        requestFor('quota-' + i, 'r879-' + prefix + '-quota-' + i))));
    const accepted = results.filter(r => r.code === 200 && r.result?.jobId && !r.body.error);
    for (const item of accepted) touchedJobs.add(item.result.jobId);
    const blocked = results.filter(r => !(r.code === 200 && r.result?.jobId && !r.body.error));
    const actualJobs = await db.collection('jobs').where('ownerUid', '==', ids.quota).get();
    for (const doc of actualJobs.docs) touchedJobs.add(doc.id);
    assert.equal(actualJobs.size, accepted.length,
      'Every accepted quota job must have exactly one durable Firestore job record');
    assert.ok(accepted.length > 0, 'At least one legitimate demo quota request must work');
    assert.ok(accepted.length <= 10,
      'P2 quota failure: ' + accepted.length + ' concurrent creates exceeded 10/min; ' +
      'new job IDs: ' + accepted.map(x => x.result.jobId).join(','));
    assert.equal(blocked.length, attempts - accepted.length);
    for (const item of blocked) {
      const reason = JSON.stringify(item.body.error ?? {}).toLowerCase().replaceAll('_', '-');
      assert.match(reason, /resource-exhausted/,
        'Rejected concurrent quota requests must carry a quota-specific denial, got: ' +
        JSON.stringify(item.body));
    }
  });
});
