'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const { requireEmulatorContext } = require('./r1629-emulator-context.cjs');

const jobsEnv = {
  GCLOUD_PROJECT: 'urai-jobs-r1624-disposable',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};

test('both disposable projects resolve Functions from this checkout', () => {
  for (const [service, project] of [['jobs', jobsEnv.GCLOUD_PROJECT], ['privacy', 'urai-privacy-r1512-disposable']]) {
    assert.equal(requireEmulatorContext(service, { ...jobsEnv, GCLOUD_PROJECT: project }), path.resolve(__dirname, '../functions'));
  }
});

for (const [name, override] of Object.entries({
  'missing Firestore host': { FIRESTORE_EMULATOR_HOST: undefined },
  'remote Firestore host': { FIRESTORE_EMULATOR_HOST: 'example.invalid:8080' },
  'missing Auth host': { FIREBASE_AUTH_EMULATOR_HOST: undefined },
  'wrong project': { GCLOUD_PROJECT: 'other' },
  'conflicting project alias': { GOOGLE_CLOUD_PROJECT: 'other' },
  'conflicting Firebase config': { FIREBASE_CONFIG: '{"projectId":"other"}' },
  'inherited credential': { GOOGLE_APPLICATION_CREDENTIALS: 'dummy' },
})) {
  test('preflight rejects ' + name, () => {
    assert.throws(() => requireEmulatorContext('jobs', { ...jobsEnv, ...override }));
  });
}

for (const script of ['jobs-delivery-worker', 'jobs-handler-worker', 'owner-jobs-submission', 'owner-request-to-privacy.emulator']) {
  test(script + ' rejects missing Firestore before SDK imports', () => {
    const env = { ...jobsEnv };
    if (script.includes('privacy')) env.GCLOUD_PROJECT = 'urai-privacy-r1512-disposable';
    delete env.FIRESTORE_EMULATOR_HOST;
    const result = spawnSync(process.execPath, [require.resolve('./r1629-' + script + '.cjs')], {
      env, encoding: 'utf8', cwd: path.parse(__dirname).root,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected loopback Firestore emulator/);
  });
}
