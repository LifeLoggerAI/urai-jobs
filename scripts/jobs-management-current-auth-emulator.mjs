import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { currentJobActor, requireJobOperator } from '../functions/lib/functions/core/currentJobActor.js';

// The root and Functions workspaces intentionally lock different Admin SDK versions.
// Initialize the same SDK instance that the compiled Functions leaf imports.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// This proof uses the actual compiled authority leaf and Auth/Firestore emulators.
// It does not replace the loaded callable E2E or assert deployed/provider authority.
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-urai-jobs';
assert.match(projectId, /^demo-/);
for (const name of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
  assert.match(process.env[name] || '', /^(127\.0\.0\.1|localhost):[0-9]+$/, `${name} must be local`);
}
const app = initializeApp({ projectId });
const auth = getAuth(app), db = getFirestore(app);
const suffix = Date.now();
const ownerUid = `management-owner-${suffix}`, operatorUid = `management-operator-${suffix}`;
const ownerEmail = `management-owner-${suffix}@test.local`, operatorEmail = `management-operator-${suffix}@test.local`;
const password = `Management-${suffix}!`;
const ownerProfile = { uid: ownerUid, role: 'user', orgId: null, permissions: [], disabled: false, deleted: false, suspended: false, status: 'active' };
const operatorProfile = { ...ownerProfile, uid: operatorUid, role: 'admin' };
const operatorClaims = { role: 'admin', roles: ['admin'], uraiJobsAdmin: true };
let cases = 0;
async function check(label, callback) {
  await callback();
  cases++;
  console.log(`[PASS] ${label}`);
}
async function signIn(email) {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body));
  assert.equal(typeof body.idToken, 'string');
  return body.idToken;
}
function request(uid, token) { return { auth: { uid }, rawRequest: { headers: { authorization: `Bearer ${token}` } } }; }
function denied(callback, code) { return assert.rejects(callback, error => error.code === code); }
async function patchProfile(token, field, value) {
  const typed = typeof value === 'boolean' ? { booleanValue: value } : { stringValue: value };
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/users/${ownerUid}?updateMask.fieldPaths=${field}`, {
    method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { [field]: typed } }),
  });
  return { status: response.status, body: await response.json() };
}

try {
  await auth.createUser({ uid: ownerUid, email: ownerEmail, password });
  await auth.createUser({ uid: operatorUid, email: operatorEmail, password });
  await auth.setCustomUserClaims(operatorUid, operatorClaims);
  await db.doc(`users/${ownerUid}`).set(ownerProfile);
  await db.doc(`users/${operatorUid}`).set(operatorProfile);
  let ownerToken = await signIn(ownerEmail);
  const operatorToken = await signIn(operatorEmail);
  const ownerRequest = () => request(ownerUid, ownerToken);
  const operatorRequest = () => request(operatorUid, operatorToken);

  await check('actual Auth bearer and protected owner profile resolve canonical UID', async () => {
    const actor = await currentJobActor(ownerRequest());
    assert.equal(actor.uid, ownerUid); assert.equal(actor.profile.uid, ownerUid); assert.equal(actor.operator, false);
  });
  await check('actual current operator claims and protected profile authorize the operator', async () => {
    const actor = await currentJobActor(operatorRequest()); requireJobOperator(actor); assert.equal(actor.operator, true);
  });
  await check('Firestore transaction reads the actual protected actor profile', async () => {
    const actor = await db.runTransaction(transaction => currentJobActor(operatorRequest(), transaction));
    requireJobOperator(actor);
  });
  await check('foreign actual Auth bearer cannot bind the requested owner UID', () => denied(() => currentJobActor(request(ownerUid, operatorToken)), 'unauthenticated'));

  await auth.updateUser(ownerUid, { disabled: true });
  await check('live Auth disable rejects the previously accepted bearer', () => denied(() => currentJobActor(ownerRequest()), 'unauthenticated'));
  await auth.updateUser(ownerUid, { disabled: false });
  ownerToken = await signIn(ownerEmail);
  await check('re-enabled owner with fresh authentication remains accepted', async () => assert.equal((await currentJobActor(ownerRequest())).uid, ownerUid));

  await auth.setCustomUserClaims(operatorUid, {});
  await check('current Auth claims removal denies cached privileged token', async () => {
    const actor = await currentJobActor(operatorRequest());
    assert.equal(actor.operator, false); assert.throws(() => requireJobOperator(actor), error => error.code === 'permission-denied');
  });
  await auth.setCustomUserClaims(operatorUid, operatorClaims);
  await db.doc(`users/${operatorUid}`).update({ role: 'user' });
  await check('current protected role downgrade denies cached privileged token', async () => {
    const actor = await currentJobActor(operatorRequest());
    assert.equal(actor.operator, false);
    assert.throws(() => requireJobOperator(actor), error => error.code === 'permission-denied');
  });
  await db.doc(`users/${operatorUid}`).set(operatorProfile);
  await check('restored current operator retains the original positive control', async () => requireJobOperator(await currentJobActor(operatorRequest())));

  for (const [field, value] of [['uid', operatorUid], ['disabled', true], ['deleted', true], ['suspended', true], ['status', 'inactive']]) {
    await db.doc(`users/${ownerUid}`).update({ [field]: value });
    await check(`protected ${field} change denies the owner`, () => denied(() => currentJobActor(ownerRequest()), 'permission-denied'));
    await db.doc(`users/${ownerUid}`).set(ownerProfile);
  }
  await db.doc(`users/${ownerUid}`).delete();
  await check('missing protected owner profile denies the actual Auth bearer', () => denied(() => currentJobActor(ownerRequest()), 'permission-denied'));
  await db.doc(`users/${ownerUid}`).set(ownerProfile);

  await check('rules allow an owner to edit an ordinary profile field', async () => {
    const result = await patchProfile(ownerToken, 'displayName', 'Synthetic management owner');
    assert.equal(result.status, 200, JSON.stringify(result.body));
  });
  for (const [field, value] of [['deleted', true], ['suspended', true], ['status', 'inactive'], ['role', 'admin'], ['uid', operatorUid], ['disabled', true]]) {
    await check(`rules deny owner writes to protected ${field}`, async () => {
      const result = await patchProfile(ownerToken, field, value);
      assert.equal(result.status, 403, JSON.stringify(result.body));
      assert.equal((await db.doc(`users/${ownerUid}`).get()).data()?.[field], ownerProfile[field]);
    });
  }

  // Auth's auth_time and tokensValidAfterTime have second precision.
  await new Promise(resolve => setTimeout(resolve, 1_100));
  await auth.revokeRefreshTokens(ownerUid);
  await check('actual refresh-token revocation rejects the old owner bearer', () => denied(() => currentJobActor(ownerRequest()), 'unauthenticated'));
  ownerToken = await signIn(ownerEmail);
  await check('a fresh owner bearer after revocation is accepted', async () => assert.equal((await currentJobActor(ownerRequest())).uid, ownerUid));
  await auth.deleteUser(ownerUid);
  await check('live Auth account deletion rejects the last owner bearer', () => denied(() => currentJobActor(ownerRequest()), 'unauthenticated'));
  console.log(`[PASS] JOBS_MANAGEMENT_CURRENT_AUTH_EMULATOR: ${cases} cases; real Auth/Firestore SDK and client rules, zero providers`);
} finally {
  await Promise.allSettled([auth.deleteUser(ownerUid), auth.deleteUser(operatorUid), db.doc(`users/${ownerUid}`).delete(), db.doc(`users/${operatorUid}`).delete()]);
  await db.terminate();
  await deleteApp(app);
}
