'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const projects = {
  privacy: 'urai-privacy-r1512-disposable',
  jobs: 'urai-jobs-r1624-disposable',
};

function requireEmulatorContext(service, env = process.env) {
  const project = projects[service];
  assert.ok(project, 'Unknown emulator service');
  assert.equal(env.GCLOUD_PROJECT, project, 'Unexpected emulator project');
  if (env.GOOGLE_CLOUD_PROJECT) assert.equal(env.GOOGLE_CLOUD_PROJECT, project);
  if (env.FIREBASE_CONFIG) assert.equal(JSON.parse(env.FIREBASE_CONFIG).projectId, project);
  assert.equal(env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080', 'Expected loopback Firestore emulator');
  assert.equal(env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099', 'Expected loopback Auth emulator');
  for (const name of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'GITHUB_TOKEN', 'RUNPOD_API_KEY']) {
    assert.ok(env[name] === undefined, 'Unexpected credential variable ' + name);
  }
  return path.resolve(__dirname, '../functions');
}

module.exports = { requireEmulatorContext };
