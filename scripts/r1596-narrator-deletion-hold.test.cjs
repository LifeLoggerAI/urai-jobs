'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '..')
const functionsRequire = createRequire(path.join(root, 'functions/package.json'))
const ts = functionsRequire('typescript')
const source = fs.readFileSync(path.join(root, 'functions/src/jobs/storytimeNarratorBridge.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

const token = 'r1596-synthetic-handler-boundary-token'
const identity = {
  userId: 'synthetic-grandma-r1596',
  sessionId: 'synthetic-private-session-r1596',
  narratorScriptId: 'synthetic-narrator-script-r1596',
  jobId: '01R1596SYNTHETICNARRATORJOB01',
}
const request = { action: 'delete-output', ...identity }
const artifactPath = 'gs://urai-r1596-synthetic-assets/storytime/' +
  identity.userId + '/' + identity.sessionId + '/' + identity.narratorScriptId + '/test.mp3'
const baseJob = {
  jobId: identity.jobId,
  type: 'narrator.tts',
  jobType: 'narrator.tts',
  status: 'SUCCESS',
  ownerUid: identity.userId,
  sourceSystem: 'urai-storytime',
  sourceSessionId: identity.sessionId,
  sourceNarratorScriptId: identity.narratorScriptId,
  retryCount: 0,
  output: {
    artifactPath,
    mimeType: 'audio/mpeg',
    size: 8,
    provider: 'google',
    modelId: 'google-cloud-text-to-speech',
    voiceId: 'synthetic-default',
    provenanceRef: 'provider-native',
    consentRef: null,
    rightsRef: null,
  },
  result: { artifactPath },
}

// Exercise the actual HTTP handler with real schema/auth hashing and explicit
// Firestore/Storage boundary doubles. These fixtures are not worker generation
// receipts, live IAM evidence, or positive deletion acceptance.
function fixture(job = baseJob, { exists = true } = {}) {
  const stored = structuredClone(job)
  const original = structuredClone(stored)
  const calls = { reads: [], storage: [], mutations: [], fieldDeletes: 0, serverTimestamps: 0 }
  const ref = id => ({
    async get() {
      calls.reads.push(id)
      return { exists, data: () => stored }
    },
    async update(value) { calls.mutations.push({ operation: 'update', id, value }) },
    async set(value) { calls.mutations.push({ operation: 'set', id, value }) },
    async delete() { calls.mutations.push({ operation: 'delete', id }) },
    collection() { throw Error('unexpected collection access') },
  })
  const module = { exports: {} }
  const requireBoundary = name => {
    if (name === 'node:crypto') return require(name)
    if (name === 'zod') return functionsRequire('zod')
    if (name === 'ulid') return { ulid: () => 'synthetic-unused-id' }
    if (name === 'firebase-admin/firestore') return {
      FieldValue: {
        delete() { calls.fieldDeletes++; return { syntheticDeleteSentinel: true } },
        serverTimestamp() { calls.serverTimestamps++; return { syntheticTimestamp: true } },
      },
      getFirestore() { throw Error('unexpected Firestore transaction') },
    }
    if (name === 'firebase-admin/storage') return {
      getStorage() {
        calls.storage.push('getStorage')
        return { bucket(bucket) {
          calls.storage.push({ bucket })
          return { file(object, options) {
            calls.storage.push({ object, options })
            return {
              async delete(options) { calls.storage.push({ delete: options }) },
              async getMetadata() { calls.storage.push('getMetadata'); return [{ generation: '987654321' }] },
              async getSignedUrl() { calls.storage.push('getSignedUrl'); return ['https://invalid.example/synthetic'] },
            }
          } }
        } }
      },
    }
    if (name === 'firebase-functions/params') return { defineSecret: () => ({ value: () => token }) }
    if (name === 'firebase-functions/v2/https') return { onRequest: (_options, handler) => handler }
    if (name.endsWith('/firestore-paths.js')) return { jobDoc: ref, jobQueueEntryDoc: ref }
    if (name.endsWith('/jobsReliability.js')) return {
      bindingMatches() { throw Error('unexpected binding mutation') },
      buildIdempotencyBindingId() { throw Error('unexpected idempotency mutation') },
      buildRequestFingerprint() { throw Error('unexpected request mutation') },
    }
    if (name.endsWith('/consentBlocks.js')) return { consentBlockRef() { throw Error('unexpected consent mutation') } }
    if (name.endsWith('/ownerDeletionFence.js')) return { ownerDeletionFenceRefs() { throw Error('unexpected owner fence read during delete hold') }, ownerDeletionFenced() { throw Error('unexpected owner fence decision during delete hold') } }
    throw Error('unmapped dependency: ' + name)
  }
  vm.runInNewContext(compiled, {
    module, exports: module.exports, require: requireBoundary, Buffer,
    process: { env: { NODE_ENV: 'production', URAI_ENV: 'staging', FUNCTIONS_EMULATOR: 'false', GCS_BUCKET_NAME: 'urai-r1596-synthetic-assets' } },
    console,
  }, { filename: 'actual-storytimeNarratorBridge.cjs' })
  async function call(body = request, authorization = 'Bearer ' + token) {
    const res = {
      statusCode: 200, body: undefined, headers: {},
      set(key, value) { this.headers[key] = value; return this },
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this },
    }
    await module.exports.storytimeNarratorBridge({
      method: 'POST', body, get: name => name.toLowerCase() === 'authorization' ? authorization : '',
    }, res)
    return res
  }
  function assertPreserved(res, status, error) {
    assert.equal(res.statusCode, status)
    assert.equal(res.body.ok, false)
    assert.equal(res.body.error, error)
    assert.equal(res.body.deletion, undefined)
    assert.equal(res.body.deleted, undefined)
    assert.deepEqual(calls.storage, [], 'no Storage API, metadata read, signing, or deletion')
    assert.deepEqual(calls.mutations, [], 'no output erase or completion-state mutation')
    assert.equal(calls.fieldDeletes, 0)
    assert.equal(calls.serverTimestamps, 0)
    assert.deepEqual(stored, original)
    assert.equal(res.headers['Cache-Control'], 'no-store, max-age=0')
  }
  return { call, assertPreserved, calls }
}

for (const [name, patch] of [
  ['current worker output without a generation receipt', {}],
  ['missing generation field explicitly null', { artifactGeneration: null }],
  ['untrusted stored generation scalar', { artifactGeneration: '987654321' }],
  ['forged stored generation receipt claims', { generation: '987654321', generationReceipt: { trusted: true, generation: '987654321', issuedBy: 'worker' } }],
]) {
  test(name + ' cannot delete, erase metadata, or acknowledge completion', async () => {
    const f = fixture({ ...baseJob, output: { ...baseJob.output, ...patch } })
    f.assertPreserved(await f.call(), 409, 'narrator_output_generation_unverified')
    assert.deepEqual(f.calls.reads, [identity.jobId])
  })
}

for (const extra of [
  { generation: '987654321' },
  { generationReceipt: { generation: '987654321', trusted: true } },
]) {
  test('caller cannot add generation authority: ' + Object.keys(extra)[0], async () => {
    const f = fixture()
    f.assertPreserved(await f.call({ ...request, ...extra }), 400, 'invalid_storytime_narrator_request')
    assert.deepEqual(f.calls.reads, [])
  })
}

for (const [name, patch] of [
  ['foreign owner', { ownerUid: 'synthetic-other-owner' }],
  ['foreign session', { sourceSessionId: 'synthetic-other-session' }],
  ['foreign narrator script', { sourceNarratorScriptId: 'synthetic-other-script' }],
  ['foreign source system', { sourceSystem: 'synthetic-other-system' }],
  ['foreign job type', { type: 'asset.render', jobType: 'asset.render' }],
]) {
  test(name + ' remains denied before generation handling', async () => {
    const f = fixture({ ...baseJob, ...patch })
    f.assertPreserved(await f.call(), 403, 'storytime_narrator_boundary_mismatch')
  })
}

test('nonterminal job preserves existing state and denial', async () => {
  const f = fixture({ ...baseJob, status: 'RUNNING' })
  f.assertPreserved(await f.call(), 409, 'job_not_ready_for_playback')
})

test('missing artifact preserves the existing missing-artifact denial', async () => {
  const f = fixture({ ...baseJob, output: {} })
  f.assertPreserved(await f.call(), 409, 'narrator_artifact_missing')
})

for (const [name, value] of [
  ['foreign bucket', artifactPath.replace('urai-r1596-synthetic-assets', 'synthetic-foreign-bucket')],
  ['foreign object scope', artifactPath.replace(identity.userId, 'synthetic-other-owner')],
]) {
  test(name + ' remains denied without contacting Storage', async () => {
    const f = fixture({ ...baseJob, output: { ...baseJob.output, artifactPath: value } })
    f.assertPreserved(await f.call(), 403, 'narrator_artifact_boundary_mismatch')
  })
}

test('missing job remains not found without any mutation', async () => {
  const f = fixture(baseJob, { exists: false })
  f.assertPreserved(await f.call(), 404, 'job_not_found')
})

for (const authorization of ['', 'Bearer synthetic-wrong-token']) {
  test((authorization ? 'invalid' : 'missing') + ' bridge credential remains unauthorized', async () => {
    const f = fixture()
    f.assertPreserved(await f.call(request, authorization), 401, 'unauthorized')
    assert.deepEqual(f.calls.reads, [])
  })
}

test('repeated delivery remains unverified and never creates a false completion receipt', async () => {
  const f = fixture()
  f.assertPreserved(await f.call(), 409, 'narrator_output_generation_unverified')
  f.assertPreserved(await f.call(), 409, 'narrator_output_generation_unverified')
  assert.deepEqual(f.calls.reads, [identity.jobId, identity.jobId])
})
