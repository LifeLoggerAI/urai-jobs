import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDisposableEmulatorEnvironment, R1047_DENIED, SECRET_KEYS } from './r1047-disposable-emulator-env.mjs';

const synthetic = 'SYNTHETIC_R1301_DO_NOT_PUBLISH';
const good = () => ({
  URAI_EMULATOR_PROJECT: 'urai-staging-test',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
});
function denied(env, reason, field) {
  let error;
  try { assertDisposableEmulatorEnvironment(env); } catch (caught) { error = caught; }
  assert.ok(error, 'must fail closed');
  assert.equal(error.message, `${R1047_DENIED}:${reason}:${field}`);
  assert.ok(!error.message.includes(synthetic));
  assert.ok(!String(error.stack).includes(synthetic));
}
test('disposable emulator is admitted but not production-authorized', () => {
  assert.deepEqual(assertDisposableEmulatorEnvironment(good()), {
    disposableOnly: true, productionAuthorized: false, releaseApproved: false
  });
});
test('Runpod credential denied without echo', () => denied({...good(), RUNPOD_API_KEY: synthetic}, 'CREDENTIAL_PRESENT','RUNPOD_API_KEY'));
test('GitHub credential denied without echo', () => denied({...good(), GITHUB_TOKEN: synthetic}, 'CREDENTIAL_PRESENT','GITHUB_TOKEN'));
test('Firebase credential denied without echo', () => denied({...good(), FIREBASE_TOKEN: synthetic}, 'CREDENTIAL_PRESENT','FIREBASE_TOKEN'));
test('other token-shaped variable denied', () => denied({...good(), CUSTOM_WORKER_TOKEN: synthetic}, 'CREDENTIAL_PRESENT','CUSTOM_WORKER_TOKEN'));
test('other secret-shaped variable denied', () => denied({...good(), MY_ACCOUNT_SECRET: synthetic}, 'CREDENTIAL_PRESENT','MY_ACCOUNT_SECRET'));
test('all enumerated credential names rejected without echo', () => {
  for (const key of SECRET_KEYS) denied({...good(), [key]: synthetic}, 'CREDENTIAL_PRESENT', key);
});
test('empty credential does not grant production access', () => {
  assert.equal(assertDisposableEmulatorEnvironment({...good(), RUNPOD_API_KEY: ''}).productionAuthorized, false);
});
test('invalid project rejected', () => denied({...good(), URAI_EMULATOR_PROJECT: 'production'}, 'PROJECT_MISMATCH','URAI_EMULATOR_PROJECT'));
test('wrong Firestore emulator host rejected', () => denied({...good(), FIRESTORE_EMULATOR_HOST: '10.0.0.1:8080'}, 'HOST_MISMATCH','FIRESTORE_EMULATOR_HOST'));
test('wrong Storage emulator host rejected', () => denied({...good(), FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9198'}, 'HOST_MISMATCH','FIREBASE_STORAGE_EMULATOR_HOST'));
test('wrong cloud project rejected', () => denied({...good(), GOOGLE_CLOUD_PROJECT: 'production'}, 'CLOUD_PROJECT_CONFLICT','GOOGLE_CLOUD_PROJECT'));
test('untrusted Node flags rejected', () => denied({...good(), NODE_OPTIONS: '--require anything'}, 'NODE_OPTIONS_UNTRUSTED','NODE_OPTIONS'));
test('invalid environment shape rejected', () => denied(null, 'ENV_INVALID','env'));
