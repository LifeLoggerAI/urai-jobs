'use strict'

// Fixed getJobStatus source, actual Zod schema, explicit service-boundary doubles.
// These cases do not claim native Firestore, callable token, or concurrent-race proof.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '..')
const load = createRequire(path.join(root, 'functions/package.json'))
const ts = load('typescript')
let storedJob, activeBlocks, deletionFence, blockReads
const consent = (purpose = 'memory.storage') => ({
  purpose, policyVersion: 'policy-v1', decisionReceiptId: 'receipt-v1',
})
function reset(authority = {}) {
  storedJob = {
    jobId: 'status-fixed-source', ownerUid: 'owner-a', status: 'SUCCESS',
    result: { artifact: 'SYNTHETIC_RESULT' }, ...authority,
  }
  activeBlocks = new Set()
  deletionFence = false
  blockReads = []
}
const modules = {
  zod: load('zod'),
  '../core/auth.js': { withAuthenticatedRole: (roles, handler) => handler },
  '../core/errors.js': { httpsError: (code, message) => Object.assign(new Error(message), { code }) },
  '../core/firestore-paths.js': {
    jobDoc: () => ({ get: async () => ({ exists: true, data: () => structuredClone(storedJob) }) }),
  },
  '../privacy/consentBlocks.js': {
    consentBlockRef: (uid, purpose) => ({ get: async () => {
      blockReads.push([uid, purpose])
      return { exists: activeBlocks.has(purpose), data: () => ({ active: true }) }
    } }),
  },
  '../privacy/ownerDeletionFence.js': {
    ownerDeletionFenceRefs: () => [{ get: async () => ({ exists: deletionFence }) }],
    ownerDeletionFenced: snapshots => snapshots.some(snapshot => snapshot.exists),
  },
}
const file = path.join(root, 'functions/src/jobs/getJobStatus.ts')
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exportsObject = {}
vm.runInNewContext(compiled, {
  exports: exportsObject,
  require: name => {
    if (!(name in modules)) throw new Error('Unexpected dependency ' + name)
    return modules[name]
  },
}, { filename: file })
const read = (uid = 'owner-a', role = 'user') =>
  exportsObject.getJobStatus({ jobId: storedJob.jobId }, { auth: { uid } }, { role })
async function deniedAuthority(authority) {
  reset(authority)
  const before = structuredClone(storedJob)
  await assert.rejects(read(), error =>
    error.code === 'failed-precondition' && error.message.includes('consent authority'))
  assert.deepEqual(storedJob, before)
}
test('genuinely consent-free legacy output remains available to its owner', async () => {
  reset()
  assert.equal((await read()).job.result.artifact, 'SYNTHETIC_RESULT')
  assert.equal(blockReads.length, 0)
})
test('valid single stored authority retains allowed status access', async () => {
  reset({ consent: consent() })
  assert.equal((await read()).job.status, 'SUCCESS')
  assert.deepEqual(blockReads, [['owner-a', 'memory.storage']])
})
test('valid plural-only authority retains allowed status access', async () => {
  reset({ consents: [consent(), consent('data.export')] })
  assert.equal((await read()).job.status, 'SUCCESS')
  assert.deepEqual(blockReads, [['owner-a', 'memory.storage'], ['owner-a', 'data.export']])
})
test('both valid authority fields contribute their deduplicated purpose union', async () => {
  reset({ consent: consent(), consents: [consent(), consent('data.export')] })
  await read()
  assert.deepEqual(blockReads, [['owner-a', 'memory.storage'], ['owner-a', 'data.export']])
})
test('normalized stored purpose still observes its revocation block', async () => {
  reset({ consent: { ...consent(), purpose: ' memory.storage ' } })
  activeBlocks.add('memory.storage')
  await assert.rejects(read(), error => error.code === 'failed-precondition' && error.message.includes('Revoked'))
})
test('one revoked plural purpose denies the entire stored result', async () => {
  reset({ consents: [consent(), consent('data.export')] })
  activeBlocks.add('data.export')
  await assert.rejects(read(), error => error.code === 'failed-precondition' && error.message.includes('Revoked'))
})
test('legacy consent-free output remains denied by owner deletion', async () => {
  reset(); deletionFence = true
  await assert.rejects(read(), error => error.code === 'failed-precondition' && error.message.includes('deletion'))
})
for (const [name, value] of [
  ['null', null],
  ['present undefined', undefined],
  ['empty object', {}],
  ['missing receipt', { purpose: 'memory.storage', policyVersion: 'policy-v1' }],
  ['empty purpose', { ...consent(), purpose: '' }],
  ['whitespace purpose', { ...consent(), purpose: ' ' }],
  ['empty policy', { ...consent(), policyVersion: '' }],
  ['empty receipt', { ...consent(), decisionReceiptId: '' }],
  ['oversized purpose', { ...consent(), purpose: 'x'.repeat(161) }],
  ['oversized policy', { ...consent(), policyVersion: 'x'.repeat(81) }],
  ['oversized receipt', { ...consent(), decisionReceiptId: 'x'.repeat(161) }],
  ['unknown field', { ...consent(), extra: true }],
]) {
  test('present single authority rejects ' + name, () => deniedAuthority({ consent: value }))
}
for (const [name, value] of [
  ['null', null],
  ['present undefined', undefined],
  ['non-array', {}],
  ['empty list', []],
  ['more than eight entries', Array.from({ length: 9 }, () => consent())],
  ['malformed member', [consent(), { purpose: 'data.export' }]],
  ['unknown member field', [consent(), { ...consent('data.export'), extra: true }]],
]) {
  test('present plural authority rejects ' + name, () => deniedAuthority({ consents: value }))
}
test('valid single authority cannot mask malformed plural authority', () =>
  deniedAuthority({ consent: consent(), consents: [null] }))
test('valid plural authority cannot mask malformed single authority', () =>
  deniedAuthority({ consent: null, consents: [consent()] }))
test('operator status access still rejects malformed authority', async () => {
  reset({ consent: null })
  await assert.rejects(read('operator-a', 'operator'), error =>
    error.code === 'failed-precondition' && error.message.includes('consent authority'))
})
