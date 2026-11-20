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
  consent: {purpose:'storytime.voiceover',policyVersion:'r1601',decisionReceiptId:'synthetic-receipt'},
}

// Exercise the actual HTTP handler with real schema/auth hashing and explicit
// Firestore/Storage boundary doubles. These fixtures are not worker generation
// receipts, live IAM evidence, or positive deletion acceptance.
function fixture(job = baseJob, { exists = true, tombstone = false, deletionFence = false, revoked = false } = {}) {
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
    if (name.endsWith('/consentBlocks.js')) return { consentBlockRef: () => ({get:async()=>({exists:revoked,data:()=>({active:revoked})})}) }
    if (name.endsWith('/ownerDeletionFence.js')) return {
      ownerDeletionFenceRefs:()=>[{get:async()=>({exists:deletionFence})},{get:async()=>({exists:tombstone})}],
      ownerDeletionFenced:xs=>xs.some(x=>x.exists),
    }
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

const playbackRequest={...identity,action:'playback'}
const statusRequest={...identity,action:'status'}
for(const [name,opts,error] of [
 ['owner deletion', {deletionFence:true}, 'storytime_owner_deleted'],
 ['Privacy tombstone', {tombstone:true}, 'storytime_owner_deleted'],
 ['voiceover revocation', {revoked:true}, 'storytime_voiceover_consent_revoked'],
]) {
 test('playback rejects '+name+' without signing any URL',async()=>{
   const f=fixture(baseJob,opts)
   const r=await f.call(playbackRequest)
   assert.equal(r.statusCode,409);assert.equal(r.body.error,error)
   assert.deepEqual(f.calls.storage,[])
 })
 test('status rejects '+name+' without showing prior output',async()=>{
   const f=fixture(baseJob,opts)
   const r=await f.call(statusRequest)
   assert.equal(r.statusCode,409);assert.equal(r.body.error,error)
   assert.equal(r.body.job,undefined)
 })
}
test('legitimate unrevoked owner may request narrator status',async()=>{
 const f=fixture();const r=await f.call(statusRequest)
 assert.equal(r.statusCode,200);assert.equal(r.body.job.status,'SUCCESS')
})
test('legitimate unrevoked owner may get signed playback URL',async()=>{
 const f=fixture();const r=await f.call(playbackRequest)
 assert.equal(r.statusCode,200);assert.equal(r.body.playback.url,'https://invalid.example/synthetic')
 assert.ok(f.calls.storage.includes('getSignedUrl'))
})
test('missing stored narrator consent denies playback before signing',async()=>{
 const job={...baseJob};delete job.consent
 const f=fixture(job),r=await f.call(playbackRequest)
 assert.equal(r.statusCode,409);assert.equal(r.body.error,'storytime_voiceover_consent_unverified');assert.deepEqual(f.calls.storage,[])
})
test('missing stored narrator consent denies metadata status',async()=>{
 const job={...baseJob};delete job.consent
 const f=fixture(job),r=await f.call(statusRequest)
 assert.equal(r.statusCode,409);assert.equal(r.body.error,'storytime_voiceover_consent_unverified')
})
test('foreign source owner cannot get signed playback URL',async()=>{
 const f=fixture({...baseJob,ownerUid:'another-owner'}),r=await f.call(playbackRequest)
 assert.equal(r.statusCode,403);assert.deepEqual(f.calls.storage,[])
})
