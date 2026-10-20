import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { PassThrough, Readable } from 'node:stream'

// Real original Jobs transport code, synthetic metadata and media only.
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const ts = require('typescript')
const sourceRoot = fileURLToPath(new URL('../', import.meta.url))
const source = fs.readFileSync(path.join(sourceRoot, 'functions/src/jobs/privateMediaDelivery.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const encoded = Buffer.from('URAI_SYNTHETIC_PRIVATE_TEST_MEDIA')

function fixture({ metadataWait = false, ownerWait = false, lifetime = 30_000, preAborted = false } = {}) {
  const request = new EventEmitter()
  if (preAborted) request.aborted = true
  const response = new PassThrough()
  const delivered = []
  response.set = () => response
  response.on('data', chunk => delivered.push(Buffer.from(chunk)))
  response.on('error', () => {})
  const stats = { bucketCalls: 0, metadataReads: 0, authorityChecks: 0, streamStarts: 0 }
  const store = { bucket(name) {
    assert.equal(name, 'fixture-private-bucket')
    stats.bucketCalls++
    return { file(name, options) {
      assert.equal(name, 'tenant/owner/movie.mp4')
      assert.equal(options.generation, '7')
      return {
        async getMetadata() {
          stats.metadataReads++
          if (metadataWait) return new Promise(() => {})
          return [{ generation: '7', size: encoded.length }]
        },
        createReadStream() { stats.streamStarts++; return Readable.from([encoded]) },
      }
    } }
  } }
  const exports = {}
  new Function('exports', 'require', compiled)(exports, name => {
    if (name === 'firebase-admin/storage') return { getStorage: () => store }
    if (name.startsWith('node:')) return require(name)
    throw new Error('Unexpected original Jobs transport import: ' + name)
  })
  const args = {
    descriptor: { authorityHash: digest('synthetic-current-owner'), generation: '7', expiresAt: Date.now() + lifetime },
    location: { bucket: 'fixture-private-bucket', objectPath: 'tenant/owner/movie.mp4' },
    mimeType: 'video/mp4', disposition: 'inline', checksum: digest(encoded), request, response,
    revalidate: async () => {
      stats.authorityChecks++
      if (ownerWait) return new Promise(() => {})
    },
  }
  return { request, stats, args, call: () => exports.streamPrivateMedia(args), get delivered() { return Buffer.concat(delivered) } }
}

async function settlesDenied(promise, ms = 350) {
  const status = await Promise.race([
    promise.then(() => 'released', () => 'denied'),
    new Promise(resolve => setTimeout(() => resolve('stalled'), ms)),
  ])
  assert.equal(status, 'denied', 'cancelled/expired media preflight must reject promptly')
}

test('normal original Jobs current-owner private MP4 still delivers and verifies', async () => {
  const h = fixture()
  await h.call()
  assert.deepEqual(h.delivered, encoded)
  assert.equal(h.stats.streamStarts, 1)
  assert.ok(h.stats.authorityChecks >= 3)
})

test('already aborted Jobs request never reads private provider metadata', async () => {
  const h = fixture({ preAborted: true })
  await assert.rejects(h.call(), /private_media_delivery_expired/)
  assert.equal(h.stats.bucketCalls, 0)
  assert.equal(h.delivered.length, 0)
})

test('abort during pending storage metadata rejects before private output starts', async () => {
  const h = fixture({ metadataWait: true })
  const work = h.call()
  await new Promise(resolve => setImmediate(resolve))
  h.request.emit('aborted')
  await settlesDenied(work)
  assert.equal(h.stats.streamStarts, 0)
  assert.equal(h.delivered.length, 0)
})

test('abort during unresolved initial owner authorization rejects promptly', async () => {
  const h = fixture({ ownerWait: true })
  const work = h.call()
  await new Promise(resolve => setImmediate(resolve))
  h.request.emit('aborted')
  await settlesDenied(work)
  assert.equal(h.stats.streamStarts, 0)
  assert.equal(h.delivered.length, 0)
})

test('expiry deadline bounds storage preflight even without a request abort', async () => {
  const h = fixture({ metadataWait: true, lifetime: 70 })
  const work = h.call()
  await settlesDenied(work, 400)
  assert.equal(h.stats.streamStarts, 0)
  assert.equal(h.delivered.length, 0)
})

test('expiry deadline bounds stalled preflight owner authorization', async () => {
  const h = fixture({ ownerWait: true, lifetime: 70 })
  const work = h.call()
  await settlesDenied(work, 400)
  assert.equal(h.stats.streamStarts, 0)
  assert.equal(h.delivered.length, 0)
})
