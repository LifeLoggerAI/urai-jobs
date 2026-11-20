'use strict'

// Actual createJob source with explicit Auth/Firestore service-boundary doubles.
// Inter-transaction fixtures exercise both branches; they are not native race proof.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const sourcePath = path.join(root, 'functions/src/jobs/createJob.ts')
const requireRoot = createRequire(path.join(root, 'functions/package.json'))
const ts = requireRoot('typescript')

function loadSource(file, requireModule) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const sandbox = { exports: {}, require: requireModule, process, console, Buffer }
  vm.runInNewContext(code, sandbox, { filename: file })
  return sandbox.exports
}
const reliability = loadSource(path.join(root, 'functions/src/core/jobsReliability.ts'), requireRoot)
let records, created, reads, transactions, afterFirstTransaction
function reset() {
  records = new Map()
  created = []
  reads = []
  transactions = 0
  afterFirstTransaction = null
}
function snapshot(key) {
  return { exists: records.has(key), data: () => structuredClone(records.get(key)) }
}
function ref(key) {
  return { key, get: async () => snapshot(key), collection: x => ({ doc: y => ref(key + '/' + x + '/' + y) }) }
}
const db = {
  collection: name => ({
    doc: id => ref(name + '/' + id),
    where: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }),
  }),
  runTransaction: async callback => {
    transactions++
    const staged = []
    const transaction = {
      get: async r => {
        assert.equal(staged.length, 0, 'all transaction reads precede writes')
        reads.push(r.key)
        return snapshot(r.key)
      },
      create: (r, data) => { staged.push([r.key, data]) },
      set: () => { throw new Error('unexpected transaction set') },
      update: () => { throw new Error('unexpected transaction update') },
    }
    const value = await callback(transaction)
    for (const [key, data] of staged) {
      assert.equal(records.has(key), false)
      created.push(key)
      records.set(key, data)
    }
    if (transactions === 1 && afterFirstTransaction) afterFirstTransaction()
    return value
  },
}
const modules = {
  'firebase-admin/firestore': {
    getFirestore: () => db,
    FieldValue: { serverTimestamp: () => ({ server: true }) },
    Timestamp: { fromMillis: x => x },
  },
  'firebase-functions/v1/https': {
    HttpsError: class HttpsError extends Error {
      constructor(code, message) { super(message); this.code = code }
    },
  },
  '@urai-jobs/shared-types': {},
  '../core/auth.js': { withAuthenticatedRole: (roles, handler) => handler },
  '../core/errors.js': {
    httpsError: (code, message) => new modules['firebase-functions/v1/https'].HttpsError(code, message),
  },
  '../core/firestore-paths.js': {
    jobDoc: id => ref('jobs/' + id),
    jobQueueEntryDoc: id => ref('jobQueue/' + id),
  },
  '../core/jobsReliability.js': reliability,
  './studioLifeMovieContract.js': { StudioLifeMovieRenderPayloadSchema: { safeParse: () => ({ success: true }) } },
  '../core/runtimeJobTypes.js': {
    isActiveRuntimeJobType: () => true,
    RUNTIME_JOB_REGISTRY: new Proxy({}, { get: () => ({ maxAttempts: 1 }) }),
  },
  '../privacy/consentBlocks.js': { consentBlockRef: (uid, purpose) => ref('jobConsentBlocks/' + uid + '::' + purpose) },
}
const handler = loadSource(sourcePath, name => modules[name] || requireRoot(name)).createJob
const user = { role: 'user', permissions: ['jobs:create'] }
const auth = { auth: { uid: 'owner-a' } }
const consent = (receipt = 'receipt-old', purpose = 'memory.storage') => ({
  purpose, policyVersion: 'policy-v1', decisionReceiptId: receipt,
})
const request = (overrides = {}) => ({ jobType: 'asset.render', payload: {}, consent: consent(), ...overrides })
const bindingKey = (uid = 'owner-a') => 'jobIdempotencyBindings/' + reliability.buildIdempotencyBindingId(uid, 'asset.render', 'key')
function bind(job = { consent: consent() }, binding = {}) {
  records.set(bindingKey(), {
    ownerUid: 'owner-a', jobType: 'asset.render',
    requestFingerprint: reliability.buildRequestFingerprint('asset.render', {}), jobId: 'job-old', ...binding,
  })
  if (job !== null) records.set('jobs/job-old', {
    jobId: 'job-old', ownerUid: 'owner-a', jobType: 'asset.render', type: 'asset.render', payload: {}, ...job,
  })
}
const block = (uid = 'owner-a', purpose = 'memory.storage') =>
  records.set('jobConsentBlocks/' + uid + '::' + purpose, { active: true, schemaVersion: 'consent.revoked.v2' })
async function denied(p, message = 'revoked') {
  const before = structuredClone([...records])
  await assert.rejects(handler(p, auth, user), e => e.code === 'failed-precondition' && e.message.includes(message))
  assert.equal(created.length, 0)
  assert.deepEqual([...records], before, 'denial preserves stored state')
}
async function sameJob(p) {
  const result = await handler(p, auth, user)
  assert.equal(result.jobId, 'job-old')
  assert.equal(result.deduplicated, true)
  assert.equal(created.length, 0)
  assert.ok(reads.includes('jobs/job-old'))
  assert.equal(transactions, 1)
}

test('revoked single-purpose job denied at admission', async () => {
  reset(); block(); await denied(request())
})
test('new receipt after revocation cannot reactivate admission', async () => {
  reset(); block(); await denied(request({ consent: consent('receipt-new') }))
})
test('blocked idempotent retry denied, not an accepted dedupe', async () => {
  reset(); bind(); block(); await denied(request({ idempotencyKey: 'key' }))
})
test('unblocked idempotent retry keeps same stored job reference', async () => {
  reset(); bind(); await sameJob(request({ idempotencyKey: 'key' }))
})
test('unblocked consent job enters queue after transaction reads', async () => {
  reset(); const result = await handler(request(), auth, user)
  assert.ok(result.jobId)
  assert.ok(created.some(p => p.startsWith('jobs/')))
  assert.ok(created.some(p => p.startsWith('jobQueue/')))
})
test('other owner block does not veto a different owner', async () => {
  reset(); block('owner-b'); assert.ok((await handler(request(), auth, user)).jobId)
})
test('one blocked purpose denies plural-consent job', async () => {
  reset(); block('owner-a', 'data.export')
  await denied(request({ consent: undefined, consents: [consent(), consent('other', 'data.export')] }))
})
test('block installed between lookup and admission prevents queue commit', async () => {
  reset(); afterFirstTransaction = () => block()
  await assert.rejects(handler(request({ idempotencyKey: 'key' }), auth, user), e => e.code === 'failed-precondition')
  assert.equal(transactions, 2); assert.equal(created.length, 0)
})
test('genuinely consent-free legacy replay validates stored identity transactionally', async () => {
  reset(); bind({}); await sameJob(request({ consent: undefined, idempotencyKey: 'key' }))
})

test('stored single consent remains required when incoming consent is absent', async () => {
  reset(); bind(); block()
  await denied(request({ consent: undefined, idempotencyKey: 'key' }))
})
test('stored single consent remains required when incoming purpose differs', async () => {
  reset(); bind(); block()
  await denied(request({ consent: consent('new', 'data.export'), idempotencyKey: 'key' }))
})
test('stored plural consent remains required when incoming consent is absent', async () => {
  reset(); bind({ consents: [consent(), consent('export', 'data.export')] }); block('owner-a', 'data.export')
  await denied(request({ consent: undefined, idempotencyKey: 'key' }))
})
test('all stored authority fields contribute to the required purpose union', async () => {
  reset(); bind({ consent: consent(), consents: [consent('export', 'data.export')] }); block('owner-a', 'data.export')
  await denied(request({ idempotencyKey: 'key' }))
})
test('incoming purposes are checked as well as the stored purpose', async () => {
  reset(); bind(); block('owner-a', 'data.export')
  await denied(request({ consent: consent('export', 'data.export'), idempotencyKey: 'key' }))
})
test('fresh incoming receipt cannot clear the original stored-purpose block', async () => {
  reset(); bind(); block()
  await denied(request({ consent: consent('receipt-new'), idempotencyKey: 'key' }))
})
test('missing bound job fails closed', async () => {
  reset(); bind(null); await denied(request({ consent: undefined, idempotencyKey: 'key' }), 'identity')
})
for (const [name, value] of [
  ['foreign owner', { ownerUid: 'owner-b' }],
  ['different stored job ID', { jobId: 'job-other' }],
  ['conflicting type alias', { type: 'narrator.tts' }],
  ['different jobType alias', { jobType: 'narrator.tts' }],
  ['missing type aliases', { type: undefined, jobType: undefined }],
  ['null type alias', { type: null }],
]) {
  test(name + ' fails closed during replay', async () => {
    reset(); bind(value); await denied(request({ consent: undefined, idempotencyKey: 'key' }), 'identity')
  })
}
for (const [name, value] of [
  ['null single consent', { consent: null }],
  ['undefined present single consent', { consent: undefined }],
  ['incomplete single consent', { consent: { purpose: 'memory.storage' } }],
  ['unknown single consent field', { consent: { ...consent(), injected: true } }],
  ['null plural consent', { consents: null }],
  ['empty plural consent', { consents: [] }],
  ['malformed plural entry', { consents: [consent(), { purpose: 'data.export' }] }],
]) {
  test(name + ' cannot be treated as absent authority', async () => {
    reset(); bind(value); await denied(request({ consent: undefined, idempotencyKey: 'key' }), 'consent authority')
  })
}
test('legacy type-only identity retains safe deduplication', async () => {
  reset(); bind({ jobType: undefined }); await sameJob(request({ consent: undefined, idempotencyKey: 'key' }))
})
test('legacy jobType-only identity retains safe deduplication', async () => {
  reset(); bind({ type: undefined }); await sameJob(request({ consent: undefined, idempotencyKey: 'key' }))
})
test('different request binding retains conflict behavior', async () => {
  reset(); bind({}, { requestFingerprint: 'different' })
  await assert.rejects(handler(request({ idempotencyKey: 'key' }), auth, user), e => e.code === 'already-exists')
  assert.equal(created.length, 0)
})
test('binding appearing in creation transaction still checks stored consent', async () => {
  reset(); afterFirstTransaction = () => { bind(); block() }
  await assert.rejects(handler(request({ consent: undefined, idempotencyKey: 'key' }), auth, user),
    e => e.code === 'failed-precondition' && e.message.includes('revoked'))
  assert.equal(transactions, 2); assert.equal(created.length, 0)
  assert.ok(reads.includes('jobs/job-old'))
})
test('valid legacy binding appearing in creation transaction returns the stored job', async () => {
  reset(); afterFirstTransaction = () => bind({})
  const result = await handler(request({ consent: undefined, idempotencyKey: 'key' }), auth, user)
  assert.equal(result.jobId, 'job-old'); assert.equal(result.deduplicated, true)
  assert.equal(transactions, 2); assert.equal(created.length, 0)
})

// Owner-deletion cases retained from #518/#519, using the stored-job-aware fixture.
const accountFence = (uid = 'owner-a') =>
  records.set('accountDeletionFences/' + uid, { state: 'revoked' })
const privacyTombstone = (uid = 'owner-a', data = { active: true }) =>
  records.set('privacyDeletionTombstones/' + uid, data)

test('account deletion fence denies new consent-bearing job', async () => {
  reset(); accountFence(); await denied(request(), 'deletion fence')
})
test('Privacy deletion tombstone denies new job', async () => {
  reset(); privacyTombstone(); await denied(request(), 'deletion fence')
})
test('malformed deletion tombstone fails closed rather than regranting', async () => {
  reset(); privacyTombstone('owner-a', { active: false }); await denied(request(), 'deletion fence')
})
test('deletion fence prevents legacy idempotent replay without consent', async () => {
  reset(); bind({}); accountFence()
  await denied(request({ consent: undefined, idempotencyKey: 'key' }), 'deletion fence')
})
test('deletion fence prevents consent-bearing idempotent replay', async () => {
  reset(); bind(); privacyTombstone()
  await denied(request({ idempotencyKey: 'key' }), 'deletion fence')
})
test('another owner deletion fence does not deny this owner', async () => {
  reset(); accountFence('owner-b')
  const result = await handler(request(), auth, user)
  assert.ok(result.jobId); assert.ok(created.some(p => p.startsWith('jobs/')))
})
test('deletion fence between idempotent lookup and admission prevents queue commit', async () => {
  reset(); afterFirstTransaction = () => accountFence()
  await assert.rejects(handler(request({ idempotencyKey: 'key' }), auth, user),
    e => e.code === 'failed-precondition' && e.message.includes('deletion fence'))
  assert.equal(transactions, 2); assert.equal(created.length, 0)
})
test('owner deletion denies new jobs even without declared consent', async () => {
  reset(); accountFence(); await denied(request({ consent: undefined }), 'deletion fence')
})
test('deletion denies a consent-free binding first seen in the creation transaction', async () => {
  reset(); afterFirstTransaction = () => { bind({}); privacyTombstone() }
  await assert.rejects(handler(request({ consent: undefined, idempotencyKey: 'key' }), auth, user),
    e => e.code === 'failed-precondition' && e.message.includes('deletion fence'))
  assert.equal(transactions, 2); assert.equal(created.length, 0)
})
