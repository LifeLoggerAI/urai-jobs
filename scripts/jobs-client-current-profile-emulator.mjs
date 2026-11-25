import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

// Native client rule proof. Uses the declared Functions SDK, real local
// Auth/Firestore emulators and synthetic records; no provider or private source.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-urai-jobs';
assert.match(projectId, /^demo-/);
for (const name of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
  assert.match(process.env[name] || '', /^(127\.0\.0\.1|localhost):[0-9]+$/, `${name} must be local`);
}
const app = initializeApp({ projectId }), auth = getAuth(app), db = getFirestore(app);
const suffix = randomUUID(), ownerUid = `client-owner-${suffix}`, adminUid = `client-admin-${suffix}`;
const jobId = `client-job-${suffix}`, password = `Client-${suffix}!`, createdUsers = [];
const profile = { role: 'user', orgId: null, permissions: [], disabled: false, deleted: false, suspended: false, status: 'active' };
const ownerProfile = { ...profile, uid: ownerUid }, adminProfile = { ...profile, uid: adminUid, role: 'admin' };
const adminClaims = { role: 'admin', roles: ['admin'], uraiJobsAdmin: true };
const jobPath = `jobs/${jobId}`, logPath = `${jobPath}/logs/synthetic-log`;
let passed = 0, failed = 0;

async function signIn(uid) {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${uid}@test.local`, password, returnSecureToken: true }),
  });
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body)); assert.equal(typeof body.idToken, 'string');
  return body.idToken;
}
async function read(label, token, path, expected) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/${path}`, { headers });
  await response.arrayBuffer();
  if (response.status === expected) { passed++; console.log(`[PASS] ${label}: ${response.status}`); }
  else { failed++; console.log(`[FAIL] ${label}: expected ${expected}, actual ${response.status}`); }
}
async function readJobAndLog(label, token, expected) {
  await read(`${label} job`, token, jobPath, expected);
  await read(`${label} log`, token, logPath, expected);
}
async function readProfileRoutes(label, token, uid, expected) {
  await readJobAndLog(label, token, expected);
  await read(`${label} profile`, token, `users/${uid}`, expected);
}

try {
  for (const uid of [ownerUid, adminUid]) {
    await auth.createUser({ uid, email: `${uid}@test.local`, password }); createdUsers.push(uid);
  }
  await auth.setCustomUserClaims(adminUid, adminClaims);
  await db.doc(`users/${ownerUid}`).set(ownerProfile); await db.doc(`users/${adminUid}`).set(adminProfile);
  await db.doc(jobPath).set({ jobId, ownerUid, status: 'PENDING', payload: { text: 'Synthetic client-rule fixture' } });
  await db.doc(logPath).set({ message: 'Synthetic job log' });
  const ownerToken = await signIn(ownerUid), adminToken = await signIn(adminUid);
  await readProfileRoutes('active protected owner', ownerToken, ownerUid, 200);
  await readProfileRoutes('active protected admin reading foreign job', adminToken, adminUid, 200);
  await readJobAndLog('missing bearer', null, 403);
  await db.doc(`users/${adminUid}`).update({ role: 'user' });
  await readJobAndLog('foreign account with cached admin token but user profile', adminToken, 403);
  await db.doc(`users/${adminUid}`).set(adminProfile);

  for (const [field, value] of [['disabled', true], ['deleted', true], ['suspended', true], ['status', 'inactive'], ['uid', 'synthetic-foreign-uid']]) {
    await db.doc(`users/${ownerUid}`).update({ [field]: value });
    await readProfileRoutes(`owner protected ${field}`, ownerToken, ownerUid, 403);
    await db.doc(`users/${ownerUid}`).set(ownerProfile);
    await db.doc(`users/${adminUid}`).update({ [field]: value });
    await readProfileRoutes(`foreign reader protected admin ${field}`, adminToken, adminUid, 403);
    await db.doc(`users/${adminUid}`).set(adminProfile);
  }
  await db.doc(`users/${ownerUid}`).delete();
  await readJobAndLog('owner missing protected profile', ownerToken, 403);
  await db.doc(`users/${ownerUid}`).set({ ...ownerProfile, role: 'unknown-role' });
  await readJobAndLog('owner unknown protected role', ownerToken, 403);
  await db.doc(`users/${ownerUid}`).set(ownerProfile);

  await auth.setCustomUserClaims(adminUid, {});
  const unprivilegedToken = await signIn(adminUid);
  await readJobAndLog('protected admin profile without privileged token', unprivilegedToken, 403);
  await auth.setCustomUserClaims(adminUid, adminClaims);

  // Existing valid profiles may omit the optional identity/status flags.
  await db.doc(`users/${ownerUid}`).set({ role: 'user' });
  await readProfileRoutes('active legacy owner profile', ownerToken, ownerUid, 200);
  await db.doc(`users/${adminUid}`).set({ role: 'admin' });
  await readProfileRoutes('active legacy admin profile', adminToken, adminUid, 200);
  assert.equal(passed + failed, 52);
  console.log(`[RESULT] JOBS_CLIENT_CURRENT_PROFILE_EMULATOR: ${passed} PASS / ${failed} FAIL; 52 real client-rule cases`);
  if (process.argv.includes('--baseline')) assert.equal(failed, 36);
  else assert.equal(failed, 0);
} finally {
  await Promise.allSettled([...createdUsers.map(uid => auth.deleteUser(uid)), db.doc(`users/${ownerUid}`).delete(), db.doc(`users/${adminUid}`).delete(), db.doc(logPath).delete(), db.doc(jobPath).delete()]);
  await db.terminate(); await deleteApp(app);
}
