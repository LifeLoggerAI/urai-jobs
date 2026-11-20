'use strict'
// Combined-source regression on a disposable native Firestore emulator.
// Auth is an explicit handler-boundary fixture; this does not certify hosted login.
const { test, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '..')
const req = createRequire(path.join(root, 'functions/package.json'))
const ts = req('typescript')
const admin = req('firebase-admin/app')
const { getFirestore, FieldValue } = req('firebase-admin/firestore')
assert.equal(process.env.GCLOUD_PROJECT, 'demo-urai-convergence-r1600')
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8689')
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT })
const db = getFirestore(app)
after(async () => admin.deleteApp(app))
const cache = new Map()
function loadSource(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const exports = {}
  cache.set(file, exports)
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const localRequire = name => {
    if (file.endsWith('/jobs/createJob.ts') && name === '../core/auth.js') {
      return { withAuthenticatedRole: (_roles, handler) => handler }
    }
    if (name.startsWith('.')) return loadSource(path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts')))
    return req(name)
  }
  // Keep native Promises in this realm for the Firestore SDK's Promise check.
  new Function('exports', 'require', compiled + '\n//# sourceURL=' + file)(exports, localRequire)
  return exports
}
const createJob = loadSource(path.join(root, 'functions/src/jobs/createJob.ts')).createJob
const { consentBlockRef } = loadSource(path.join(root, 'functions/src/privacy/consentBlocks.ts'))
const { ownerDeletionFenceRefs, ownerDeletionFenced } = loadSource(path.join(root, 'functions/src/privacy/ownerDeletionFence.ts'))
const { canFinalizeExecution } = loadSource(path.join(root, 'functions/src/jobs/executionGuards.ts'))
const { isConsentContext } = loadSource(path.join(root, 'functions/src/privacy/consentBlocks.ts'))
const { jobDoc, jobQueueEntryDoc } = loadSource(path.join(root, 'functions/src/core/firestore-paths.ts'))
const executionSource = fs.readFileSync(path.join(root, 'functions/src/jobs/executeJob.ts'), 'utf8')
const contextsBegin = executionSource.indexOf('function jobConsentContexts(')
const contextsEnd = executionSource.indexOf('\n}', contextsBegin) + 2
assert.ok(contextsBegin >= 0 && contextsEnd > contextsBegin)
const contextsJs = ts.transpileModule(executionSource.slice(contextsBegin, contextsEnd) + '\nreturn jobConsentContexts;', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const jobConsentContexts = new Function('isConsentContext', contextsJs)(isConsentContext)
const begin = executionSource.indexOf('const finalized = await db.runTransaction(async (transaction) => {')
const end = executionSource.indexOf('\n    });\n\n    if (!finalized)', begin)
assert.ok(begin > 0 && end > begin, 'extract the actual combined-source result transaction')
const expression = executionSource.slice(begin + 'const finalized = await db.runTransaction('.length, end + 6)
const callbackJs = ts.transpileModule('const callback = ' + expression + '; return callback;', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
function finalizer(f) {
  return new Function('jobRef', 'queueRef', 'leaseToken', 'jobId', 'result', 'FieldValue',
    'ownerDeletionFenceRefs', 'ownerDeletionFenced', 'consentBlockRef', 'jobConsentContexts', 'canFinalizeExecution', callbackJs)(
      f.jobRef, f.queueRef, f.lease, f.id, { marker: 'synthetic-result' }, FieldValue,
      ownerDeletionFenceRefs, ownerDeletionFenced, consentBlockRef, jobConsentContexts, canFinalizeExecution)
}
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
for (const filename of ['functions/src/jobs/createJob.ts', 'functions/src/jobs/executeJob.ts',
  'functions/src/jobs/storytimeNarratorBridge.ts', 'functions/src/privacy/ownerDeletionFence.ts']) {
  console.log('R1600_SOURCE ' + filename + ' ' + digest(fs.readFileSync(path.join(root, filename))))
}
const user = { role: 'user', permissions: ['jobs:create'] }
const consent = (purpose = 'memory.storage') => ({ purpose, policyVersion: 'synthetic-v1', decisionReceiptId: 'synthetic-receipt' })
let serial = 0
const owner = () => 'r1600-owner-' + (++serial)
const request = (extra = {}) => ({ jobType: 'asset.render', payload: { marker: 'synthetic-no-media' }, idempotencyKey: 'same-key', ...extra })
const create = (uid, data) => createJob(data, { auth: { uid } }, user)
async function blocked(uid, purpose = 'memory.storage') {
  await consentBlockRef(uid, purpose).set({ active: true, schemaVersion: 'consent.revoked.v2' })
}
async function deny(uid, data, message) {
  const before = await db.collection('jobs').where('ownerUid', '==', uid).get()
  await assert.rejects(create(uid, data), error => error.code === 'failed-precondition' && error.message.includes(message))
  const after = await db.collection('jobs').where('ownerUid', '==', uid).get()
  assert.equal(after.size, before.size, 'denial creates no replacement job')
}
test('native combined admission: unfenced owner creates one job and correct queue row', async () => {
  const uid = owner(), result = await create(uid, request({ consent: consent() }))
  assert.equal(result.deduplicated, false)
  assert.equal((await jobDoc(result.jobId).get()).data().ownerUid, uid)
  assert.equal((await jobQueueEntryDoc(result.jobId).get()).exists, true)
})
for (const marker of ['accountDeletionFences', 'privacyDeletionTombstones']) {
  test('native combined admission: any existing ' + marker + ' denies new jobs', async () => {
    const uid = owner()
    await db.collection(marker).doc(uid).set({ active: false })
    await deny(uid, request({ consent: consent() }), 'deletion fence')
    assert.equal((await db.collection('jobs').where('ownerUid', '==', uid).get()).size, 0)
  })
}
test('native combined replay: valid consent-free legacy job is denied after deletion', async () => {
  const uid = owner(), data = request(), first = await create(uid, data)
  const second = await create(uid, data)
  assert.equal(second.jobId, first.jobId); assert.equal(second.deduplicated, true)
  await db.collection('accountDeletionFences').doc(uid).set({ state: 'deleted' })
  await deny(uid, data, 'deletion fence')
})
test('native combined replay: omitted incoming consent retains stored revoked purpose', async () => {
  const uid = owner()
  await create(uid, request({ consent: consent() })); await blocked(uid)
  await deny(uid, request(), 'revoked')
})
test('native combined replay: different incoming consent cannot replace stored revoked purpose', async () => {
  const uid = owner()
  await create(uid, request({ consent: consent() })); await blocked(uid)
  await deny(uid, request({ consent: consent('data.export') }), 'revoked')
})
test('native combined replay: plural stored authority remains required', async () => {
  const uid = owner()
  await create(uid, request({ consents: [consent(), consent('data.export')] }))
  await blocked(uid, 'data.export'); await deny(uid, request(), 'revoked')
})
test('native combined replay: incoming purpose joins stored authority', async () => {
  const uid = owner()
  await create(uid, request({ consent: consent() })); await blocked(uid, 'data.export')
  await deny(uid, request({ consent: consent('data.export') }), 'revoked')
})
test('native combined replay: malformed present stored consent fails closed', async () => {
  const uid = owner(), first = await create(uid, request({ consent: consent() }))
  await jobDoc(first.jobId).update({ consent: null })
  await deny(uid, request(), 'consent authority')
})
test('native combined replay: inconsistent stored owner fails closed', async () => {
  const uid = owner(), first = await create(uid, request({ consent: consent() }))
  await jobDoc(first.jobId).update({ ownerUid: 'different-synthetic-owner' })
  await deny(uid, request(), 'identity')
})
test('native combined admission: foreign owner fences preserve valid owner access', async () => {
  const uid = owner()
  await db.collection('accountDeletionFences').doc(uid + '-foreign').set({ active: true })
  await blocked(uid + '-foreign')
  const result = await create(uid, request({ consent: consent() }))
  assert.equal((await jobDoc(result.jobId).get()).exists, true)
})
async function running() {
  const uid = owner(), id = 'r1600-running-' + serial, lease = 'synthetic-lease-' + serial
  const jobRef = jobDoc(id), queueRef = jobQueueEntryDoc(id)
  await jobRef.set({ jobId: id, ownerUid: uid, status: 'RUNNING', type: 'asset.render',
    execution: { leaseToken: lease }, consent: consent() })
  await queueRef.set({ jobId: id, status: 'RUNNING' })
  return { uid, id, lease, jobRef, queueRef }
}
for (const marker of ['accountDeletionFences', 'privacyDeletionTombstones']) {
  test('native combined finalization: ' + marker + ' cancels result and queue', async () => {
    const f = await running(); await db.collection(marker).doc(f.uid).set({ active: false })
    assert.equal(await db.runTransaction(finalizer(f)), false)
    const job = (await f.jobRef.get()).data()
    assert.equal(job.status, 'CANCELLED'); assert.equal(job.result, undefined); assert.equal(job.output, undefined)
    assert.equal((await f.queueRef.get()).data().status, 'CANCELLED')
  })
}
test('native combined finalization: mid-worker revocation denies result', async () => {
  const f = await running(); await blocked(f.uid)
  assert.equal(await db.runTransaction(finalizer(f)), false)
  assert.equal((await f.jobRef.get()).data().status, 'CANCELLED')
})
test('native combined finalization: current unfenced lease succeeds', async () => {
  const f = await running(); assert.equal(await db.runTransaction(finalizer(f)), true)
  assert.equal((await f.jobRef.get()).data().result.marker, 'synthetic-result')
})
test('native combined finalization: stale lease cannot publish result', async () => {
  const f = await running(); f.lease = 'stale-synthetic-lease'
  assert.equal(await db.runTransaction(finalizer(f)), false)
  assert.equal((await f.jobRef.get()).data().status, 'RUNNING')
  assert.equal((await f.jobRef.get()).data().result, undefined)
})

async function afterFirstRealTransaction(install, action) {
  const original = db.runTransaction
  let calls = 0
  db.runTransaction = async function (...args) {
    const call = ++calls
    const value = await original.apply(this, args)
    if (call === 1) await install()
    return value
  }
  try { await action(); assert.equal(calls, 2) }
  finally { db.runTransaction = original }
}
test('native combined admission: deletion fence installed between transactions denies queue creation', async () => {
  const uid = owner()
  await afterFirstRealTransaction(
    () => db.collection('accountDeletionFences').doc(uid).set({ active: false }),
    () => deny(uid, request({ consent: consent() }), 'deletion fence'))
  assert.equal((await db.collection('jobs').where('ownerUid', '==', uid).get()).size, 0)
})
test('native combined replay: late binding still applies stored purpose in final admission transaction', async () => {
  const uid = owner(), data = request({ consent: consent() })
  const first = await create(uid, data)
  const { buildIdempotencyBindingId } = loadSource(path.join(root, 'functions/src/core/jobsReliability.ts'))
  const bindingRef = db.collection('jobIdempotencyBindings').doc(buildIdempotencyBindingId(uid, 'asset.render', 'same-key'))
  const binding = (await bindingRef.get()).data()
  assert.equal(binding.jobId, first.jobId)
  await bindingRef.delete()
  await afterFirstRealTransaction(
    async () => { await bindingRef.set(binding); await blocked(uid) },
    () => deny(uid, request(), 'revoked'))
  assert.equal((await db.collection('jobs').where('ownerUid', '==', uid).get()).size, 1)
})
