import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

// Runs the existing Storytime narrator HTTP handler and its actual consent
// and idempotency modules against synthetic versioned Firestore. No network,
// paid narrator provider, customer data, credentials or deployed writes.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const zod = require('zod');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const owner = 'synthetic-owner-a', sessionId = 'synthetic-session-a';
const narratorScriptId = 'synthetic-script-a', purpose = 'storytime.voiceover';
const consentPath = 'jobConsentBlocks/' + sha256(owner + '\n' + purpose);
const creation = {
  action: 'create', userId: owner, sessionId, narratorScriptId,
  idempotencyKey: 'synthetic-replay-key-01',
  consent: { purpose, policyVersion: 'synthetic-policy-v1', decisionReceiptId: 'synthetic-receipt-001' },
  payload: { text: 'Synthetic narrator text only.', provider: 'google', locale: 'en-US', format: 'MP3' }
};

function harness() {
  const documents = new Map(), versions = new Map(), modules = new Map();
  let serial = 0;
  const state = { attempts: 0, conflicts: 0, commits: 0, privateMediaCalls: 0,
    storageDeletes: [], failStorage: false, beforeStorageDelete: null, afterStorageDelete: null,
    beforeTransaction: null, beforeCommit: null };
  const clone = value => value === undefined ? undefined : structuredClone(value);
  function set(path, value) {
    documents.set(path, clone(value));
    versions.set(path, (versions.get(path) || 0) + 1);
  }
  function merge(current, patch) {
    const result = clone(current || {});
    for (const [path, value] of Object.entries(patch)) {
      if (value === 'synthetic-delete-field') delete result[path];
      else result[path] = clone(value);
    }
    return result;
  }
  function reference(path) {
    return {
      path, get: async () => snapshot(path),
      collection: name => ({ doc: id => reference(path + '/' + name + '/' + id) }),
      update: async value => set(path, merge(documents.get(path), value)),
    };
  }
  function snapshot(path) {
    return { exists: documents.has(path), data: () => clone(documents.get(path)),
      ref: reference(path) };
  }
  const firestore = {
    collection: name => ({ doc: id => reference(name + '/' + id) }),
    async runTransaction(callback) {
      const preflight = state.beforeTransaction;
      state.beforeTransaction = null;
      await preflight?.();
      for (let attempt = 0; attempt < 6; attempt++) {
        state.attempts++;
        const reads = new Map(), writes = [];
        const tx = {
          async get(ref) {
            assert.equal(writes.length, 0, 'Firestore transaction reads must precede writes');
            reads.set(ref.path, versions.get(ref.path) || 0);
            return snapshot(ref.path);
          },
          create(ref, data) { writes.push({ path: ref.path, value: data, create: true }); },
          update(ref, data) { writes.push({ path: ref.path, value: data, merge: true }); },
          set(ref, data, options) { writes.push({ path: ref.path, value: data, merge: options?.merge === true }); },
        };
        const result = await callback(tx);
        const concurrent = state.beforeCommit;
        state.beforeCommit = null;
        await concurrent?.();
        if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) {
          state.conflicts++;
          continue;
        }
        for (const write of writes) {
          if (write.create) assert.equal(documents.has(write.path), false, 'Duplicate document create');
        }
        for (const write of writes) {
          const value = write.merge ? merge(documents.get(write.path), write.value) : write.value;
          set(write.path, value);
        }
        state.commits++;
        return result;
      }
      throw new Error('synthetic_transaction_conflict');
    },
  };
  function load(relativePath) {
    if (modules.has(relativePath)) return modules.get(relativePath);
    const exports = {};
    modules.set(relativePath, exports);
    const source = fs.readFileSync(
      new URL('../functions/src/' + relativePath + '.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
    }}).outputText;
    vm.runInNewContext(compiled, {
      exports, Buffer, process: { env: { URAI_ENV: 'test', GCS_BUCKET_NAME: 'synthetic-private-bucket' } }, console,
      require(name) {
        if (name === 'node:crypto') return require('node:crypto');
        if (name === 'zod') return zod;
        if (name === 'firebase-admin/firestore') return {
          getFirestore: () => firestore, FieldValue: {
            serverTimestamp: () => 'synthetic-server-time',
            delete: () => 'synthetic-delete-field',
          }
        };
        if (name === 'firebase-admin/storage') return { getStorage: () => ({
          bucket: bucket => ({ file: objectPath => ({ async delete(options) {
            assert.equal(options.ignoreNotFound, true);
            const before = state.beforeStorageDelete;
            state.beforeStorageDelete = null;
            await before?.();
            state.storageDeletes.push({ bucket, objectPath });
            if (state.failStorage) throw new Error('synthetic_storage_failure');
            const next = state.afterStorageDelete;
            state.afterStorageDelete = null;
            await next?.();
          }}) })
        }) };
        if (name === 'firebase-functions/params') return {
          defineSecret: () => ({ value: () => 'synthetic-bridge-token' })
        };
        if (name === 'firebase-functions/v2/https') return {
          onRequest: (_options, handler) => handler
        };
        if (name === 'ulid') return { ulid: () =>
          'SYNTHETICNARRATORJOB' + String(++serial).padStart(12, '0') };
        if (name === '../core/firestore-paths.js') return {
          jobDoc: id => reference('jobs/' + id),
          jobQueueEntryDoc: id => reference('jobQueue/' + id),
        };
        if (name === '../core/jobsReliability.js') return load('core/jobsReliability');
        if (name === '../privacy/consentBlocks.js') return load('privacy/consentBlocks');
        if (name === './privateMediaDelivery.js') return Object.fromEntries(
          ['assertPrivateMediaOwnerActive', 'inspectPrivateMedia', 'privateMediaDescriptor',
            'streamPrivateMedia'].map(key => [key, () => {
              state.privateMediaCalls++; throw new Error('unexpected_private_media_access');
            }]));
        throw new Error('Unexpected narrator handler dependency: ' + name);
      },
    }, { filename: relativePath + '.js' });
    return exports;
  }
  const handler = load('jobs/storytimeNarratorBridge').storytimeNarratorBridge;
  async function invoke(body = creation, options = {}) {
    const response = {
      statusCode: 0, body: null, headersSent: false, destroyed: false,
      status(value) { this.statusCode = value; return this; },
      set() { return this; },
      json(value) { this.body = value; return this; },
    };
    const request = {
      method: options.method || 'POST',
      body: clone(body),
      get(name) {
        return name.toLowerCase() === 'authorization'
          ? (options.authorization ?? 'Bearer synthetic-bridge-token') : '';
      },
    };
    await handler(request, response);
    return response;
  }
  return {
    state, invoke, setBlock: active => set(consentPath, { ownerUid: owner, purpose, active }),
    count: prefix => [...documents.keys()].filter(k => k.startsWith(prefix)).length,
    record: path => clone(documents.get(path)),
    patchJob: (id, patch) => set('jobs/' + id, merge(documents.get('jobs/' + id), patch)),
  };
}

test('first authorized creation persists owner-bound narrator job and only one queue entry', async () => {
  const h = harness(), r = await h.invoke();
  assert.equal(r.statusCode, 202); assert.equal(r.body.ok, true);
  assert.equal(r.body.deduplicated, false);
  assert.equal(h.count('jobQueue/'), 1); assert.equal(h.count('jobs/'), 2);
  const job = h.record('jobs/' + r.body.jobId);
  assert.equal(job.ownerUid, owner);
  assert.equal(job.consent.purpose, purpose);
  assert.equal(job.status, 'PENDING');
  assert.equal(h.state.privateMediaCalls, 0);
  const status = await h.invoke({ action: 'status', userId: owner, sessionId,
    narratorScriptId, jobId: r.body.jobId });
  assert.equal(status.statusCode, 200);
  assert.equal(status.body.job.status, 'PENDING');
});

test('authorized idempotency reuse returns HTTP 200, original ID and no extra queue writes', async () => {
  const h = harness(), first = await h.invoke(), replay = await h.invoke();
  assert.equal(first.statusCode, 202); assert.equal(replay.statusCode, 200);
  assert.equal(replay.body.deduplicated, true);
  assert.equal(replay.body.jobId, first.body.jobId);
  assert.equal(h.count('jobQueue/'), 1);
});

test('a reused idempotency key with different narrator text is rejected', async () => {
  const h = harness();
  assert.equal((await h.invoke()).statusCode, 202);
  const altered = await h.invoke({ ...creation,
    payload: { ...creation.payload, text: 'Changed synthetic narration.' } });
  assert.equal(altered.statusCode, 409);
  assert.equal(altered.body.error, 'idempotency_conflict');
  assert.equal(h.count('jobQueue/'), 1);
});

test('revoked consent before request denies all narrator queue admission', async () => {
  const h = harness(); h.setBlock(true);
  const response = await h.invoke();
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.error, 'storytime_voiceover_consent_revoked');
  assert.equal(h.count('jobQueue/'), 0); assert.equal(h.count('jobs/'), 0);
});

test('revocation between preflight and transaction denies a new narrator job', async () => {
  const h = harness();
  h.state.beforeTransaction = () => h.setBlock(true);
  const response = await h.invoke();
  assert.equal(response.statusCode, 409);
  assert.equal(h.count('jobQueue/'), 0); assert.equal(h.count('jobs/'), 0);
});

test('concurrent revocation conflicts with transaction read and forces a denied retry', async () => {
  const h = harness();
  h.state.beforeCommit = () => h.setBlock(true);
  const response = await h.invoke();
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.error, 'storytime_voiceover_consent_revoked');
  assert.equal(h.state.conflicts, 1);
  assert.ok(h.state.attempts >= 2);
  assert.equal(h.count('jobQueue/'), 0); assert.equal(h.count('jobs/'), 0);
});

test('previously queued narration cannot be revived by replay after revocation', async () => {
  const h = harness(), first = await h.invoke();
  assert.equal(first.statusCode, 202);
  h.setBlock(true);
  const response = await h.invoke();
  assert.equal(response.statusCode, 409);
  assert.equal(h.count('jobQueue/'), 1);
});

test('revocation after replay preflight rejects even an existing valid binding', async () => {
  const h = harness(), first = await h.invoke();
  assert.equal(first.statusCode, 202);
  h.state.beforeTransaction = () => h.setBlock(true);
  const response = await h.invoke();
  assert.equal(response.statusCode, 409);
  assert.equal(h.count('jobQueue/'), 1);
});

test('replayed bound job conflicts with a concurrent revocation before commit', async () => {
  const h = harness(); assert.equal((await h.invoke()).statusCode, 202);
  h.state.beforeCommit = () => h.setBlock(true);
  const response = await h.invoke();
  assert.equal(response.statusCode, 409);
  assert.equal(h.state.conflicts, 1);
  assert.equal(h.count('jobQueue/'), 1);
});

test('foreign identities cannot retrieve another narrator session or job', async () => {
  const h = harness(), first = await h.invoke();
  assert.equal(first.statusCode, 202);
  for (const change of [{ userId: 'other-owner' }, { sessionId: 'other-session' },
    { narratorScriptId: 'other-script' }]) {
    const response = await h.invoke({ action: 'status', userId: owner,
      sessionId, narratorScriptId, jobId: first.body.jobId, ...change });
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.error, 'storytime_narrator_boundary_mismatch');
  }
  assert.equal(h.count('jobQueue/'), 1);
});

test('method, schema and shared-service auth fail before queue mutations', async () => {
  const h = harness();
  assert.equal((await h.invoke(creation, { method: 'GET' })).statusCode, 405);
  assert.equal((await h.invoke(creation, { authorization: 'Bearer incorrect' })).statusCode, 401);
  assert.equal((await h.invoke({ ...creation, arbitrary: true })).statusCode, 400);
  assert.equal(h.count('jobQueue/'), 0);
});

test('owner-bound cancellation prevents a pending narrator queue entry from running', async () => {
  const h = harness(), first = await h.invoke();
  assert.equal(first.statusCode, 202);
  const response = await h.invoke({ action: 'cancel', userId: owner, sessionId,
    narratorScriptId, jobId: first.body.jobId });
  assert.equal(response.statusCode, 200);
  assert.equal(h.record('jobs/' + first.body.jobId).status, 'CANCELLED');
  assert.equal(h.record('jobQueue/' + first.body.jobId).status, 'CANCELLED');
  assert.equal(h.state.privateMediaCalls, 0);
});


const jobAction = (action, id, overrides = {}) => ({
  action, userId: owner, sessionId, narratorScriptId, jobId: id, ...overrides
});
const privateArtifact = () =>
  'gs://synthetic-private-bucket/storytime/' + owner + '/' + sessionId + '/' + narratorScriptId + '/narration.mp3';

test('revoke already-SUCCESS narration deletes the exact scoped object and fences playback', async () => {
  const h = harness(), first = await h.invoke();
  const id = first.body.jobId;
  h.patchJob(id, { status: 'SUCCESS', output: { artifactPath: privateArtifact(), mimeType: 'audio/mpeg' } });
  const deleted = await h.invoke(jobAction('delete-output', id));
  assert.equal(deleted.statusCode, 200);
  assert.equal(deleted.body.deletion.deleted, true);
  assert.equal(h.state.storageDeletes.length, 1);
  assert.equal(h.state.storageDeletes[0].bucket, 'synthetic-private-bucket');
  const job = h.record('jobs/' + id);
  assert.equal(job.output, undefined);
  assert.equal(job.outputDeletionState, 'COMPLETE');
  assert.equal(job.derivativeAccessState, 'REVOKED');
  assert.equal((await h.invoke(jobAction('playback', id))).statusCode, 409);
  const replay = await h.invoke(jobAction('delete-output', id));
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.body.deletion.alreadyDeleted, true);
  assert.equal(h.state.storageDeletes.length, 1);
});

test('CANCELLED and FAILED narrator jobs clean any surviving private artifacts', async () => {
  for (const status of ['CANCELLED', 'FAILED', 'DEAD']) {
    const h = harness(), first = await h.invoke(), id = first.body.jobId;
    h.patchJob(id, { status, output: { artifactPath: privateArtifact() } });
    const r = await h.invoke(jobAction('delete-output', id));
    assert.equal(r.statusCode, 200, status);
    assert.equal(r.body.deletion.deleted, true);
    assert.equal(h.state.storageDeletes.length, 1);
    assert.equal(h.record('jobs/' + id).outputDeletionState, 'COMPLETE');
  }
});

test('CANCELLED without a persisted artifact is an idempotent confirmed absence', async () => {
  const h = harness(), first = await h.invoke(), id = first.body.jobId;
  await h.invoke(jobAction('cancel', id));
  const r = await h.invoke(jobAction('delete-output', id));
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.deletion.deleted, true);
  assert.equal(h.state.storageDeletes.length, 0);
  assert.equal(h.record('jobs/' + id).outputDeletionState, 'COMPLETE');
});

test('active or mismatched tenants cannot authorize narrator deletion', async () => {
  const h = harness(), first = await h.invoke(), id = first.body.jobId;
  const active = await h.invoke(jobAction('delete-output', id));
  assert.equal(active.statusCode, 409);
  h.patchJob(id, { status: 'SUCCESS', output: { artifactPath: privateArtifact() } });
  for (const mutation of [{ userId: 'foreign-user' }, { sessionId: 'other-session' },
    { narratorScriptId: 'other-script' }]) {
    const response = await h.invoke(jobAction('delete-output', id, mutation));
    assert.equal(response.statusCode, 403);
  }
  assert.equal(h.state.storageDeletes.length, 0);
});

test('bucket and full user/session/script prefixes are checked before deletion', async () => {
  for (const artifact of [
    'gs://wrong-bucket/storytime/' + owner + '/' + sessionId + '/' + narratorScriptId + '/audio.mp3',
    'gs://synthetic-private-bucket/storytime/' + owner + '/' + sessionId + '/foreign-script/audio.mp3',
    'gs://synthetic-private-bucket/storytime/foreign-owner/' + sessionId + '/' + narratorScriptId + '/audio.mp3',
    'gs://synthetic-private-bucket/storytime/' + owner + '/' + sessionId + '/' + narratorScriptId + '/../audio.mp3',
  ]) {
    const h = harness(), first = await h.invoke(), id = first.body.jobId;
    h.patchJob(id, { status: 'SUCCESS', output: { artifactPath: artifact } });
    const r = await h.invoke(jobAction('delete-output', id));
    assert.notEqual(r.statusCode, 200);
    assert.equal(h.state.storageDeletes.length, 0);
    assert.notEqual(h.record('jobs/' + id).outputDeletionState, 'COMPLETE');
  }
});

test('GCS failure retains revoked PENDING fence until deletion retry succeeds', async () => {
  const h = harness(), first = await h.invoke(), id = first.body.jobId;
  h.patchJob(id, { status: 'SUCCESS', output: { artifactPath: privateArtifact() } });
  h.state.failStorage = true;
  const r = await h.invoke(jobAction('delete-output', id));
  assert.notEqual(r.statusCode, 200);
  assert.equal(h.record('jobs/' + id).outputDeletionState, 'PENDING');
  assert.equal(h.record('jobs/' + id).derivativeAccessState, 'REVOKED');
  assert.equal((await h.invoke(jobAction('playback', id))).statusCode, 409);
  h.state.failStorage = false;
  assert.equal((await h.invoke(jobAction('delete-output', id))).statusCode, 200);
  assert.equal(h.record('jobs/' + id).outputDeletionState, 'COMPLETE');
});

test('artifact identity change mid-deletion cannot falsely complete cleanup', async () => {
  const h = harness(), first = await h.invoke(), id = first.body.jobId;
  h.patchJob(id, { status: 'SUCCESS', output: { artifactPath: privateArtifact() } });
  const second = 'gs://synthetic-private-bucket/storytime/' + owner + '/' + sessionId
    + '/' + narratorScriptId + '/new-audio.mp3';
  h.state.afterStorageDelete = () => h.patchJob(id, { output: { artifactPath: second } });
  const initial = await h.invoke(jobAction('delete-output', id));
  assert.equal(initial.statusCode, 409);
  assert.equal(h.record('jobs/' + id).output.artifactPath, second);
  assert.equal(h.record('jobs/' + id).outputDeletionState, 'PENDING');
  const secondAttempt = await h.invoke(jobAction('delete-output', id));
  assert.equal(secondAttempt.statusCode, 200);
  assert.equal(h.record('jobs/' + id).outputDeletionState, 'COMPLETE');
  assert.equal(h.state.storageDeletes.length, 2);
});

test('in-flight delete fences both playback descriptors and audio delivery before GCS operation', async () => {
  const h = harness(), first = await h.invoke(), id = first.body.jobId;
  h.patchJob(id, { status: 'SUCCESS', output: { artifactPath: privateArtifact(), mimeType: 'audio/mpeg' } });
  let checked = false;
  h.state.beforeStorageDelete = async () => {
    checked = true;
    const fenced = h.record('jobs/' + id);
    assert.equal(fenced.outputDeletionState, 'PENDING');
    assert.equal(fenced.derivativeAccessState, 'REVOKED');
    assert.equal(fenced.output.artifactPath, privateArtifact());
    const playback = await h.invoke(jobAction('playback', id));
    assert.equal(playback.statusCode, 409);
    assert.equal(playback.body.error, 'job_not_ready_for_playback');
    const delivery = await h.invoke({
      ...jobAction('deliver', id), kind: 'audio',
      authorityHash: 'a'.repeat(64), expiresAt: Date.now() + 60_000, generation: '1',
    });
    assert.equal(delivery.statusCode, 409);
    assert.equal(delivery.body.error, 'job_not_ready_for_playback');
    assert.equal(h.state.privateMediaCalls, 0);
    assert.equal(h.state.storageDeletes.length, 0);
  };
  h.state.failStorage = true;
  const interrupted = await h.invoke(jobAction('delete-output', id));
  assert.equal(checked, true);
  assert.notEqual(interrupted.statusCode, 200);
  assert.equal(h.record('jobs/' + id).outputDeletionState, 'PENDING');
  assert.equal(h.record('jobs/' + id).derivativeAccessState, 'REVOKED');
  assert.equal(h.state.storageDeletes.length, 1);
  h.state.failStorage = false;
  const retried = await h.invoke(jobAction('delete-output', id));
  assert.equal(retried.statusCode, 200);
  assert.equal(h.record('jobs/' + id).outputDeletionState, 'COMPLETE');
  assert.equal(h.record('jobs/' + id).output, undefined);
  assert.equal(h.state.storageDeletes.length, 2);
});
