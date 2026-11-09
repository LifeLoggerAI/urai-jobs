import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// This is a native Firebase Auth + Firestore Rules emulator test. All document
// writes under test use a Firebase Auth *client* ID token via Firestore REST;
// the Admin SDK is used ONLY for fixture seeding and final state readback.
// Firebase explicitly states that Firebase ID token REST calls obey Rules,
// while Admin SDK operations bypass Rules. Do not count Admin writes as Rules tests.
const PROJECT = 'demo-urai-jobs';
const EXPECTED = {
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};
for (const [key, value] of Object.entries(EXPECTED)) {
  assert.equal(process.env[key], value, `${key} must point at the local demo emulator`);
}
for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) {
  if (process.env[key]) assert.equal(process.env[key], PROJECT, `${key} must be demo-only`);
}
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_OAUTH_ACCESS_TOKEN', 'GOOGLE_CLOUD_ACCESS_TOKEN', 'FIREBASE_TOKEN', 'FIREBASE_CLI_TOKEN']) {
  assert.equal(process.env[key] ?? '', '', `${key} must be unset for emulator proof`);
}
const nonce = `${process.pid}-${Date.now()}`;
const owner = `r820-owner-${nonce}`;
const foreign = `r820-foreign-${nonce}`;
const legacy = `r820-legacy-${nonce}`;
const owned = [owner, foreign, legacy];
const app = initializeApp({ projectId: PROJECT }, 'r820-rules-proof');
const auth = getAuth(app);
const firestore = getFirestore(app);
const documents = (uid) => `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`;
const tokens = new Map();
const emails = new Map();

async function signIn(uid) {
  const email = `${uid}@test.local`;
  const password = `R820-${nonce}-Valid!`;
  emails.set(uid, email);
  await auth.createUser({ uid, email, password });
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=not-a-real-key', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
    redirect: 'error',
  });
  const json = await response.json();
  assert.equal(response.status, 200, JSON.stringify(json));
  assert.match(json.idToken, /\S+/, 'Auth emulator must provide a user ID token');
  tokens.set(uid, json.idToken);
}
function fieldsToFirestore(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (typeof value === 'string') return [key, { stringValue: value }];
    if (typeof value === 'boolean') return [key, { booleanValue: value }];
    if (Array.isArray(value)) return [key, { arrayValue: { values: value.map(item => ({ stringValue: item })) } }];
    throw Error('unsupported synthetic field type');
  }));
}
async function clientPatch(actor, uid, key, value, omit = false) {
  const url = `${documents(uid)}?updateMask.fieldPaths=${encodeURIComponent(key)}`;
  return fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${tokens.get(actor)}` },
    body: JSON.stringify({ fields: omit ? {} : fieldsToFirestore({ [key]: value }) }),
    redirect: 'error',
  });
}
async function denyMutation(actor, uid, key, value, omit = false) {
  const ref = firestore.collection('users').doc(uid);
  const beforeState = (await ref.get()).data();
  const response = await clientPatch(actor, uid, key, value, omit);
  assert.equal(response.status, 403, `Rules must deny ${actor} ${omit ? 'removing' : 'changing'} ${key}: ${response.status} ${await response.text()}`);
  const afterState = (await ref.get()).data();
  assert.deepEqual(afterState, beforeState, `Denied ${key} write must leave the profile unchanged`);
}

before(async () => {
  for (const uid of owned) await signIn(uid);
  const regular = { uid: owner, role: 'user', orgId: 'org-one', permissions: ['jobs:create'], disabled: false,
    tenantId: 'tenant-one', accountStatus: 'active', deleted: false, markedForDeletion: false,
    dataRightsDeletionPendingCentralPrivacy: true, dataRightsDeletionRequestId: 'request-original', displayName: 'Original' };
  await firestore.collection('users').doc(owner).set(regular);
  await firestore.collection('users').doc(foreign).set({ ...regular, uid: foreign, dataRightsDeletionPendingCentralPrivacy: false });
  // Missing legacy authority fields matter: add/remove must both be blocked.
  await firestore.collection('users').doc(legacy).set({ uid: legacy, role: 'user', orgId: 'org-one',
    permissions: ['jobs:create'], disabled: false, displayName: 'Legacy' });
});
after(async () => {
  await Promise.allSettled(owned.map(uid => firestore.collection('users').doc(uid).delete()));
  await Promise.allSettled(owned.map(uid => auth.deleteUser(uid)));
  await deleteApp(app);
});

test('real authenticated owner can update an ordinary display field', async () => {
  const response = await clientPatch(owner, owner, 'displayName', 'Updated');
  assert.equal(response.status, 200, `Ordinary owner profile update was denied: ${response.status} ${await response.text()}`);
  assert.equal((await firestore.collection('users').doc(owner).get()).get('displayName'), 'Updated');
});
for (const [key, value] of [
  ['role', 'admin'], ['orgId', 'foreign-org'], ['permissions', ['admin']], ['disabled', true],
  ['uid', 'another'], ['tenantId', 'tenant-two'], ['accountStatus', 'active-but-forged'],
  ['deleted', true], ['markedForDeletion', true], ['dataRightsDeletionPendingCentralPrivacy', false],
  ['dataRightsDeletionRequestId', 'request-forged'], 
]) {
  test(`real owner cannot mutate privileged ${key}`, async () => denyMutation(owner, owner, key, value));
  test(`real owner cannot remove privileged ${key}`, async () => denyMutation(owner, owner, key, value, true));
}
for (const [key, value] of [
  ['tenantId', 'tenant-two'], ['accountStatus', 'active'], ['deleted', false],
  ['markedForDeletion', false], ['dataRightsDeletionPendingCentralPrivacy', false],
  ['dataRightsDeletionRequestId', 'request-forged'], 
]) {
  test(`legacy owner cannot add privileged ${key}`, async () => denyMutation(legacy, legacy, key, value));
}
test('foreign authenticated user cannot update owner profile', async () => denyMutation(foreign, owner, 'displayName', 'Forged'));
test('owners cannot create arbitrary new profiles through Firestore Rules', async () => {
  const uid = `r820-absent-${nonce}`;
  const response = await clientPatch(owner, uid, 'displayName', 'New');
  assert.equal(response.status, 403, `Client-created profile must be denied: ${response.status} ${await response.text()}`);
  assert.equal((await firestore.collection('users').doc(uid).get()).exists, false);
});
test('owners cannot delete their Firestore profile', async () => {
  const response = await fetch(documents(owner), {
    method: 'DELETE', headers: { Authorization: `Bearer ${tokens.get(owner)}` }, redirect: 'error',
  });
  assert.equal(response.status, 403, `Client deletion must be denied: ${response.status} ${await response.text()}`);
  assert.equal((await firestore.collection('users').doc(owner).get()).exists, true);
});
