import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

// Compile the ACTUAL original TypeScript with in-process fake Admin APIs.
// This is a source contract, not a Firebase emulator or production issuer.
const require = createRequire(import.meta.url);
const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../functions/src/privacy/lifeMovieFirebaseOwnerState.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

let state;
const app = { options: { projectId: 'urai-staging' } };
function snapshot(data) {
  return { exists: data != null, data: () => data };
}
const auth = { getUser: async uid => {
  state.events.push('auth:' + uid);
  if (state.authError) throw Error('firebase-auth-unavailable');
  return state.account;
} };
const db = { collection(name) {
  state.events.push('collection:' + name);
  return { doc(uid) {
    state.events.push('doc:' + name + ':' + uid);
    return { async get() {
      state.events.push('read:' + name + ':' + uid);
      if (name === 'users') {
        if (state.profileError) throw Error('firestore-profile-unavailable');
        return snapshot(state.profile);
      }
      if (name === 'privacyDeletionTombstones') {
        if (state.tombstoneError) throw Error('firestore-deletion-unavailable');
        return snapshot(state.tombstone);
      }
      throw Error('unapproved collection');
    } };
  } };
} };
const m = { exports: {} };
vm.runInNewContext(output, {
  module: m, exports: m.exports, Object, Array, RegExp, Error, Promise,
  require(name) {
    if (name === 'firebase-admin/app') return { getApp: () => state?.app ?? app };
    if (name === 'firebase-admin/auth') return { getAuth: target => {
      assert.equal(target, app); return auth;
    } };
    if (name === 'firebase-admin/firestore') return { getFirestore: target => {
      assert.equal(target, app); return db;
    } };
    throw Error('Unexpected import ' + name);
  },
}, { filename: 'lifeMovieFirebaseOwnerState.ts' });
const { createReviewOnlyFirebaseLifeMovieOwnerVerifier } = m.exports;
const DENIED = /life_movie_owner_state_unverified/;
let checks = 0;

function fixture(overrides = {}) {
  state = {
    app,
    account: { uid: 'owner-1', disabled: false, customClaims: { tenantId: 'tenant-1' } },
    profile: { uid: 'owner-1', tenantId: 'tenant-1', accountStatus: 'active',
      deleted: false, markedForDeletion: false, dataRightsDeletionPendingCentralPrivacy: false },
    tombstone: null,
    events: [],
    ...overrides,
  };
  return createReviewOnlyFirebaseLifeMovieOwnerVerifier({ firebaseProjectId: 'urai-staging' });
}
const admit = async (f, uid = 'owner-1', tenant = 'tenant-1') => {
  await f(uid, tenant);
  checks++;
};
const deny = async (f, uid = 'owner-1', tenant = 'tenant-1') => {
  await assert.rejects(() => f(uid, tenant), DENIED);
  checks++;
};
for (const config of [{}, { firebaseProjectId: 'not--allowed/' }, { firebaseProjectId: 'another-project' }]) {
  state = { app };
  assert.throws(() => createReviewOnlyFirebaseLifeMovieOwnerVerifier(config), DENIED);
  checks++;
}
await admit(fixture());
assert.deepEqual(state.events.filter(v => v.startsWith('read:')), [
  'read:users:owner-1', 'read:privacyDeletionTombstones:owner-1',
]);
checks++;
await admit(fixture({ tombstone: { active: false } }));
await admit(fixture({ account: { uid: 'owner-1', disabled: false } })); // legacy no claim
for (const overrides of [
  { account: { uid: 'foreign', disabled: false } },
  { account: { uid: 'owner-1', disabled: true } },
  { account: { uid: 'owner-1', disabled: false, customClaims: { tenantId: 'foreign' } } },
  { account: { uid: 'owner-1', disabled: false, customClaims: 'bad' } },
  { account: null },
  { profile: null },
  { profile: { uid: 'owner-1', tenantId: 'tenant-1', accountStatus: 'disabled', deleted: false, markedForDeletion: false } },
  { profile: { uid: 'owner-1', tenantId: 'foreign', accountStatus: 'active', deleted: false, markedForDeletion: false } },
  { profile: { uid: 'owner-1', tenantId: 'tenant-1', accountStatus: 'active', deleted: true, markedForDeletion: false } },
  { profile: { uid: 'owner-1', tenantId: 'tenant-1', accountStatus: 'active', deleted: false, markedForDeletion: true } },
  { profile: { uid: 'owner-1', tenantId: 'tenant-1', accountStatus: 'active', deleted: false, markedForDeletion: false, dataRightsDeletionPendingCentralPrivacy: true } },
  { profile: { uid: 'owner-1', tenantId: 'tenant-1', accountStatus: 'active', deleted: false, markedForDeletion: false, dataRightsDeletionPendingCentralPrivacy: null } },
  { tombstone: { active: true } },
  { tombstone: { active: false, deletionPlanningLeaseToken: 'pending' } },
  { tombstone: { active: false, deletionPlanningLeaseRequestId: 'request-1' } },
  { tombstone: {} },
  { authError: true }, { profileError: true }, { tombstoneError: true },
]) await deny(fixture(overrides));

for (const [uid, tenant] of [['foreign', 'tenant-1'], ['owner-1', 'foreign'], ['', 'tenant-1'], ['bad/uid', 'tenant-1']]) {
  await deny(fixture(), uid, tenant);
}
{
  const profile = { uid: 'owner-1', tenantId: 'tenant-1', accountStatus: 'active',
    deleted: false, markedForDeletion: false };
  let getterCalls = 0;
  Object.defineProperty(profile, 'tenantId', { get() { getterCalls++; return 'tenant-1'; } });
  await deny(fixture({ profile }));
  assert.equal(getterCalls, 0);
  checks++;
}
{
  const record = { active: false };
  Object.defineProperty(record, 'active', { get() { throw Error('untrusted accessor'); } });
  await deny(fixture({ tombstone: record }));
}
{
  const claim = { tenantId: 'tenant-1' };
  let getterCalls = 0;
  Object.defineProperty(claim, 'tenantId', { get() { getterCalls++; return 'tenant-1'; } });
  await deny(fixture({ account: { uid: 'owner-1', disabled: false, customClaims: claim } }));
  assert.equal(getterCalls, 0);
  checks++;
}
console.log('[PASS] ' + checks + ' original-source Firebase owner/deletion review contract checks; no deployed issuer, IAM or render authority.');
