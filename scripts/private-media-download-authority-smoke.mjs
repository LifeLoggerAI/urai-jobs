import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { harness } from './life-movies-delivery-authority-smoke.mjs';

class Response extends Writable {
  constructor(onChunk) { super(); this.statusCode = 200; this.headers = {}; this.chunks = []; this.headersSent = false;
    this.onChunk = onChunk; this.on('error', error => { this.streamError = error; }); }
  set(key, value) { if (typeof key === 'object') Object.assign(this.headers, key); else this.headers[key] = value; return this; }
  status(value) { this.statusCode = value; return this; }
  json(value) { this.body = value; return this; }
  _write(chunk, _encoding, callback) { this.headersSent = true; this.chunks.push(Buffer.from(chunk));
    try { this.onChunk?.(this.chunks.length); callback(); } catch (error) { callback(error); } }
}
function identity(h, form) {
  const i = h.identities;
  return form === 'narrator' ? { userId: i.userId, jobId: i.narratorId, sessionId: i.sessionId, narratorScriptId: i.narratorScriptId }
    : form === 'short' ? { tenantId: i.tenantId, userId: i.userId, jobId: i.childIds[0] }
      : { tenantId: i.tenantId, userId: i.userId, planId: i.planId };
}
async function http(h, form, body, { token = 'synthetic-token', onChunk } = {}) {
  const request = Object.assign(new EventEmitter(), { method: 'POST', body: { ...identity(h, form), ...body },
    get(name) { return name.toLowerCase() === 'authorization' ? (token ? `Bearer ${token}` : '') : undefined; } });
  const response = new Response(onChunk);
  await h.bridges[form](request, response);
  return response;
}
async function prepare(h, form, large = false) {
  const i = h.identities, jobId = form === 'narrator' ? i.narratorId : form === 'short' ? i.childIds[0] : i.assemblyId;
  const job = h.get(`jobs/${jobId}`);
  const ref = form === 'narrator' ? job.output.artifactPath : job.output.outputs[0].ref;
  const bytes = large ? Buffer.alloc(3 * 64 * 1024, 7) : h.objects.get(ref);
  h.objects.set(ref, bytes);
  if (form !== 'narrator') h.change(`jobs/${jobId}`, value => { value.output.outputs[0].checksum = crypto.createHash('sha256').update(bytes).digest('hex'); });
  const response = await http(h, form, { action: 'playback' });
  assert.equal(response.statusCode, 200); assert.equal(response.body.ok, true);
  const playback = response.body.playback;
  const descriptor = form === 'narrator' ? playback.delivery : form === 'short' ? playback.video.delivery : playback.finalFile.video.delivery;
  assert.equal(descriptor.requiresAuthorization, true); assert.equal(descriptor.action, 'deliver');
  assert.equal(JSON.stringify(response.body).includes('https://fixture.invalid'), false);
  assert.equal(JSON.stringify(response.body).includes('gs://'), false); assert.equal(h.state.signs.length, 0);
  const delivery = Object.fromEntries(['action', 'kind', 'authorityHash', 'expiresAt', 'generation', 'artifact', 'disposition']
    .filter(key => descriptor[key] !== undefined).map(key => [key, descriptor[key]]));
  return { delivery, bytes, jobId };
}
function rejected(response, label) {
  assert.ok(response.statusCode !== 200 || !response.writableFinished, label);
  assert.equal(response.chunks.length, 0, label);
  assert.equal(JSON.stringify(response.body).includes('gs://'), false, label);
}
let cases = 0;
for (const form of ['short', 'long', 'narrator']) {
  const h = harness(), p = await prepare(h, form), response = await http(h, form, p.delivery);
  assert.equal(response.writableFinished, true); assert.deepEqual(Buffer.concat(response.chunks), p.bytes);
  assert.match(response.headers['Cache-Control'], /no-store/); assert.equal(h.state.signs.length, 0); cases++;
}
for (const form of ['short', 'long', 'narrator']) for (const reason of ['consent', 'local-delete', 'central-delete', 'output-change', 'generation', 'expired', 'no-token', 'foreign-token']) {
  const h = harness(), p = await prepare(h, form), i = h.identities;
  if (reason === 'consent') h.set('jobConsentBlocks/synthetic', { active: true });
  if (reason === 'local-delete') { const hash = crypto.createHash('sha256').update(i.userId).digest('hex'); h.set(`uraiPrivateLifeModelOwnerFences/${hash}`, { ownerHash: hash, deleted: true }); }
  if (reason === 'central-delete') h.set(`privacyDeletionTombstones/${i.userId}`, { uid: i.userId, active: true });
  if (reason === 'output-change') h.change(`jobs/${p.jobId}`, job => { job.output.correctedRevision = 'new-source'; });
  if (reason === 'generation') p.delivery.generation = '2';
  if (reason === 'expired') h.state.now = p.delivery.expiresAt;
  rejected(await http(h, form, p.delivery, { token: reason === 'no-token' ? '' : reason === 'foreign-token' ? 'foreign-token' : 'synthetic-token' }), `${form} ${reason}`);
  assert.equal(h.state.signs.length, 0); cases++;
}
for (const form of ['short', 'long', 'narrator']) for (const reason of ['consent', 'token-rotation', 'deadline', 'owner-delete']) {
  const h = harness(), p = await prepare(h, form, true);
  const response = await http(h, form, p.delivery, { onChunk(count) {
    if (count !== 1) return;
    if (reason === 'consent') h.set('jobConsentBlocks/synthetic', { active: true });
    if (reason === 'token-rotation') h.state.token = 'rotated-token';
    if (reason === 'deadline') h.state.now = p.delivery.expiresAt;
    if (reason === 'owner-delete') h.set(`privacyDeletionTombstones/${h.identities.userId}`, { uid: h.identities.userId, active: true });
  } });
  assert.equal(response.writableFinished, false, `${form} ${reason} must close current stream`);
  assert.equal(Buffer.concat(response.chunks).length, 64 * 1024, `${form} ${reason} admits no later chunks`);
  assert.equal(h.state.signs.length, 0); cases++;
}
for (const form of ['short', 'long', 'narrator']) {
  const h = harness(), p = await prepare(h, form);
  h.state.onObservation = async () => { h.state.onObservation = null; h.set('jobConsentBlocks/synthetic', { active: true }); };
  rejected(await http(h, form, p.delivery), `${form} withdrawal during actual metadata await`); cases++;
}
console.log(`[PASS] ${cases} actual authenticated HTTP/Storage stream cases: descriptor reuse, generation, deadlines, per-chunk consent/deletion/token rotation; Storage signing/provider calls/spending=0`);
