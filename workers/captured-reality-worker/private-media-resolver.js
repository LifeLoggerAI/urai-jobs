const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { validateMaskMetadata } = require('./reconstruction-masks');

const HANDLE = /^[A-Za-z0-9._:-]{8,512}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const equal = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
function privateUrl(raw, local) {
  const url = new URL(raw);
  if (url.username || url.password || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))) throw new Error('PRIVATE_ENDPOINT_INVALID');
  return url;
}
async function jsonRequest(url, token, body, local, signal) {
  const response = await fetch(privateUrl(url, local), { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body), signal: signal || AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error('PRIVATE_AUTHORITY_DENIED');
  const parts = []; let length = 0;
  for await (const chunk of response.body) { length += chunk.length; if (length > 4 * 1024 * 1024) throw new Error('PRIVATE_RESPONSE_LIMIT'); parts.push(chunk); }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
async function readBody(req) {
  const parts = []; let size = 0;
  for await (const part of req) { size += part.length; if (size > 65536) throw new Error('REQUEST_SIZE_LIMIT'); parts.push(part); }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
function authorized(req, token) {
  const header = String(req.headers.authorization || '');
  return Boolean(token) && /^Bearer [^\s]+$/i.test(header) && equal(header.slice(7), token);
}
function send(res, status, data) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); }

async function readManifest(manifestPath) {
  if (!manifestPath) throw new Error('PRIVATE_MANIFEST_UNCONFIGURED');
  const stat = await fs.stat(manifestPath);
  if (stat.size > 4 * 1024 * 1024 || (stat.mode & 0o077)) throw new Error('PRIVATE_MANIFEST_UNSAFE');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.entries) || manifest.entries.length > 10000) throw new Error('PRIVATE_MANIFEST_INVALID');
  return manifest;
}

// Consume the existing Jobs consent blocks and stored job identity. This is an
// adapter to canonical authority, not another purpose/consent decision registry.
function firestoreReconstructionAuthority(db, manifestPath, { getOwner } = {}) {
  return async (body) => {
    if (typeof getOwner !== 'function') throw new Error('SOURCE_ACCOUNT_AUTHORITY_UNCONFIGURED');
    const manifest = await readManifest(manifestPath);
    const entries = body.sourceHandles.map((sourceHandle) => manifest.entries.find((row) => row.jobId === body.jobId && row.sourceHandle === sourceHandle));
    if (entries.some((row) => !row || Date.parse(row.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(row.expiresAt)))) throw new Error('SOURCE_GRANT_EXPIRED');
    const ownerUid = entries[0].ownerUid;
    const owner = await getOwner(ownerUid);
    if (owner?.uid !== ownerUid || owner.disabled !== false || !owner.metadata?.creationTime) throw new Error('SOURCE_ACCOUNT_DENIED');
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.collection('jobs').doc(body.jobId)), job = snap.exists ? snap.data() : null;
      if (!job || (job.type || job.jobType) !== 'memory.private-source.reconstruct-place' || !['RUNNING', 'SUCCESS'].includes(job.status)
        || String(job.derivativeAccessState || '').startsWith('REVOKED') || job.ownerUid !== ownerUid
        || entries.some((row) => row.ownerUid !== job.ownerUid || !job.payload?.sourceReceiptRefs?.includes(row.sourceReceiptRef))) throw new Error('SOURCE_OWNER_OR_JOB_DENIED');
      const attemptHash = job.status === 'SUCCESS' ? job.execution?.capturedRealityAcceptedCallbackHash : job.execution?.callbackTokenHash;
      if (!SHA256.test(String(body.callbackTokenHash || '')) || attemptHash !== body.callbackTokenHash) throw new Error('SOURCE_ATTEMPT_DENIED');
      if (job.status === 'RUNNING' && (job.execution?.asyncCallbackPending !== true || job.execution?.callbackLeaseToken !== job.execution?.leaseToken
        || (job.execution?.callbackDeadlineAt?.toMillis?.() || 0) <= Date.now())) throw new Error('SOURCE_LEASE_DENIED');
      const consents = Array.isArray(job.consents) ? job.consents : [];
      const purposes = [...new Set(consents.map((row) => row?.purpose))];
      if (consents.length !== 2 || purposes.length !== 2 || !['memory.storage', 'location.context'].every((purpose) => purposes.includes(purpose))
        || consents.some((row) => typeof row.policyVersion !== 'string' || !row.policyVersion || typeof row.decisionReceiptId !== 'string' || !row.decisionReceiptId)) throw new Error('SOURCE_CONSENT_DENIED');
      const ownerHash = sha(Buffer.from(ownerUid));
      const fence = await tx.get(db.collection('uraiPrivateLifeModelOwnerFences').doc(ownerHash));
      if (fence.exists && (fence.data()?.ownerHash !== ownerHash || fence.data()?.deleted !== false
        || fence.data()?.deletionEpoch !== 0)) throw new Error('SOURCE_OWNER_DELETED');
      const deletion = await tx.get(db.collection('privacyDeletionTombstones').doc(ownerUid));
      if (deletion.exists) {
        const marker = deletion.data(), keys = Object.keys(marker || {});
        const stamp = marker?.updatedAt;
        const validStamp = stamp instanceof Date ? Number.isFinite(stamp.getTime()) : typeof stamp?.toMillis === 'function' && Number.isFinite(stamp.toMillis());
        const released = !keys.includes('active') && keys.every((key) => ['uid', 'updatedAt'].includes(key)) && validStamp;
        if (marker?.uid !== ownerUid || keys.some((key) => key.startsWith('deletionPlanningLease')) || (marker.active !== false && !released)) throw new Error('SOURCE_OWNER_DELETED');
      }
      for (const purpose of purposes) {
        const blockId = sha(Buffer.from(job.ownerUid + '\n' + purpose)), block = await tx.get(db.collection('jobConsentBlocks').doc(blockId));
        if (block.exists && (block.data()?.ownerUid !== ownerUid || block.data()?.purpose !== purpose || block.data()?.active !== false)) throw new Error('SOURCE_CONSENT_REVOKED');
      }
      for (const row of entries) {
        const source = await tx.get(db.collection('uraiPrivateSourceReceipts').doc(sha(Buffer.from(row.sourceReceiptRef))));
        const grant = source.data();
        if (!source.exists || grant?.schemaVersion !== 'urai-private-source-receipt-v2' || grant.ownerUid !== ownerUid
          || grant.status !== 'ACTIVE' || grant.synthetic !== false || grant.fixtureOnly === true
          || grant.sourceReceiptRef !== row.sourceReceiptRef || grant.sourceHandle !== row.sourceHandle
          || !Number.isSafeInteger(row.sourceRevision) || row.sourceRevision < 1 || !SHA256.test(String(row.sourceSha256 || ''))
          || !Number.isSafeInteger(row.sourceByteLength) || row.sourceByteLength < 1 || typeof row.sourceFixityRef !== 'string'
          || !row.sourceFixityRef.startsWith('private:') || !Array.isArray(grant.purposes) || !grant.purposes.includes('reconstruct-place')
          || ['sourceRevision', 'sourceSha256', 'sourceByteLength', 'sourceFixityRef'].some((key) => grant[key] !== row[key])
          || !consents.every((consent) => Array.isArray(grant.consents) && grant.consents.filter((entry) => entry?.purpose === consent.purpose).length === 1
            && grant.consents.some((entry) => entry?.purpose === consent.purpose && entry.policyVersion === consent.policyVersion && entry.decisionReceiptId === consent.decisionReceiptId))) throw new Error('SOURCE_REVISION_OR_GRANT_DENIED');
      }
    });
    const currentOwner = await getOwner(ownerUid);
    if (currentOwner?.uid !== ownerUid || currentOwner.disabled !== false || currentOwner.metadata?.creationTime !== owner.metadata.creationTime) throw new Error('SOURCE_ACCOUNT_CHANGED');
    return { authorized: true, ownerBound: true, jobId: body.jobId, sourceHandles: body.sourceHandles, callbackTokenHash: body.callbackTokenHash, purposes: ['memory.storage', 'location.context'] };
  };
}

function createResolver({ manifestPath, sourceRoot, token, authorityUrl, authorityToken, local = false, validateAuthority } = {}) {
  async function check(body) {
    if (!HANDLE.test(String(body.jobId || '')) || !SHA256.test(String(body.callbackTokenHash || '')) || !Array.isArray(body.sourceHandles) || !body.sourceHandles.length
      || body.sourceHandles.length > 32 || body.sourceHandles.some((value) => !HANDLE.test(String(value)))) throw new Error('RESOLVER_REQUEST_INVALID');
    if (!authorityToken && !validateAuthority) throw new Error('PRIVATE_AUTHORITY_UNCONFIGURED');
    const result = validateAuthority ? await validateAuthority(body)
      : await jsonRequest(`${String(authorityUrl).replace(/\/$/, '')}/validate-reconstruction-handles`, authorityToken,
        { jobId: body.jobId, sourceHandles: body.sourceHandles, callbackTokenHash: body.callbackTokenHash, requestedPurpose: 'reconstruct-place', requiredPurposes: ['memory.storage', 'location.context'] }, local);
    if (result.authorized !== true || result.ownerBound !== true || result.jobId !== body.jobId
      || result.callbackTokenHash !== body.callbackTokenHash
      || !Array.isArray(result.sourceHandles) || JSON.stringify([...result.sourceHandles].sort()) !== JSON.stringify([...body.sourceHandles].sort())
      || !Array.isArray(result.purposes) || !['memory.storage', 'location.context'].every((purpose) => result.purposes.includes(purpose))) throw new Error('PRIVATE_AUTHORITY_DENIED');
    return { authorized: true, jobId: body.jobId, sourceHandles: body.sourceHandles, callbackTokenHash: body.callbackTokenHash };
  }
  async function load(body) {
    if (!manifestPath || !sourceRoot) throw new Error('RESOLVER_STORAGE_UNCONFIGURED');
    const manifest = await readManifest(manifestPath);
    const entry = manifest.entries?.find((row) => row.jobId === body.jobId && row.sourceHandle === body.sourceHandle);
    if (!entry || Date.parse(entry.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(entry.expiresAt)) || !HANDLE.test(String(entry.sourceReceiptRef || ''))
      || !Array.isArray(entry.acceptedInputs) || !entry.acceptedInputs.length || entry.acceptedInputs.length > 3000) throw new Error('SOURCE_GRANT_INVALID');
    for (const input of entry.acceptedInputs) {
      if (input.accepted !== true || !HANDLE.test(String(input.inputRef || '')) || !HANDLE.test(String(input.frameProvenanceRef || '')) || !SHA256.test(String(input.sha256 || ''))
        || !Number.isSafeInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > 256 * 1024 * 1024
        || !['image/png', 'image/jpeg'].includes(input.mimeType)) throw new Error('ACCEPTED_INPUT_INVALID');
      if (typeof input.dynamicsPresent !== 'boolean' || typeof input.maskRequired !== 'boolean') throw new Error('SOURCE_DYNAMIC_CLASSIFICATION_REQUIRED');
      validateMaskMetadata(input);
    }
    if (new Set(entry.acceptedInputs.map((row) => row.inputRef)).size !== entry.acceptedInputs.length) throw new Error('DUPLICATE_INPUT_REF');
    await check({ jobId: body.jobId, sourceHandles: [body.sourceHandle], callbackTokenHash: body.callbackTokenHash });
    const current = await readManifest(manifestPath);
    if (JSON.stringify(current.entries.find((row) => row.jobId === body.jobId && row.sourceHandle === body.sourceHandle)) !== JSON.stringify(entry)) throw new Error('SOURCE_MANIFEST_CHANGED');
    return entry;
  }
  async function resolve(body) {
    const entry = await load(body);
    return { authorized: true, jobId: body.jobId, sourceHandle: body.sourceHandle, sourceReceiptRef: entry.sourceReceiptRef,
      expiresAt: entry.expiresAt, acceptedInputs: entry.acceptedInputs.map((input) => {
        const { inputRef, frameProvenanceRef, sha256, byteSize, mimeType, dynamicsPresent, maskRequired } = input;
        const mask = validateMaskMetadata(input);
        return { inputRef, frameProvenanceRef, sha256, byteSize, mimeType, dynamicsPresent, maskRequired, ...(mask ? { mask } : {}) };
      }) };
  }
  async function redeem(body, maskOnly = false) {
    const entry = await load(body), frame = entry.acceptedInputs.find((row) => row.inputRef === body.inputRef);
    let input = frame;
    if (maskOnly) {
      const mask = validateMaskMetadata(frame);
      if (!mask || mask.inputRef !== body.maskInputRef) throw new Error('PRIVATE_MASK_DENIED');
      input = frame.mask;
    }
    if (!input || typeof input.path !== 'string' || path.isAbsolute(input.path)) throw new Error('PRIVATE_INPUT_DENIED');
    const root = await fs.realpath(sourceRoot), candidate = path.resolve(root, input.path), relative = path.relative(root, candidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('PRIVATE_PATH_DENIED');
    const real = await fs.realpath(candidate);
    if (real !== candidate) throw new Error('PRIVATE_SYMLINK_DENIED');
    const file = await fs.open(real, 'r');
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size !== input.byteSize) throw new Error('SOURCE_SIZE_MISMATCH');
      const bytes = await file.readFile();
      if (sha(bytes) !== input.sha256) throw new Error('SOURCE_HASH_MISMATCH');
      try { await requireCurrentEntry(body, entry); } catch (error) { bytes.fill(0); throw error; }
      return { bytes, mimeType: input.mimeType, sha256: input.sha256, requireCurrent: () => requireCurrentEntry(body, entry) };
    } finally { await file.close(); }
  }
  async function requireCurrentEntry(body, entry) {
    if (JSON.stringify(await load(body)) !== JSON.stringify(entry)) throw new Error('SOURCE_MANIFEST_CHANGED');
  }
  const server = http.createServer(async (req, res) => {
    if (!authorized(req, token)) return send(res, 401, { ok: false, code: 'UNAUTHORIZED' });
    if (req.method !== 'POST') return send(res, 404, { ok: false, code: 'NOT_FOUND' });
    try {
      const body = await readBody(req);
      if (req.url === '/check') return send(res, 200, await check(body));
      if (req.url === '/resolve') return send(res, 200, await resolve(body));
      if (req.url === '/redeem' || req.url === '/redeem-mask') {
        const result = await redeem(body, req.url === '/redeem-mask');
        try {
          for (let offset = 0; offset < result.bytes.length; offset += 65536) {
            await result.requireCurrent();
            if (req.aborted || res.destroyed) throw new Error('SOURCE_CONNECTION_CLOSED');
            if (!res.headersSent) res.writeHead(200, { 'content-type': result.mimeType, 'content-length': result.bytes.length, 'cache-control': 'private, no-store', 'x-content-sha256': result.sha256 });
            if (!res.write(result.bytes.subarray(offset, offset + 65536))) await new Promise((resolve, reject) => {
              const closed = () => { res.off('drain', drained); reject(new Error('SOURCE_CONNECTION_CLOSED')); };
              const drained = () => { res.off('close', closed); resolve(); };
              res.once('drain', drained); res.once('close', closed);
            });
          }
          await result.requireCurrent();
          return res.end();
        } finally { result.bytes.fill(0); }
      }
      send(res, 404, { ok: false, code: 'NOT_FOUND' });
    } catch { if (res.headersSent || res.destroyed) res.destroy(); else send(res, 403, { ok: false, code: 'PRIVATE_SOURCE_DENIED' }); }
  });
  server.requestTimeout = 30000;
  return { server, check, resolve, redeem };
}

if (require.main === module) {
  let validateAuthority;
  if (!process.env.PRIVATE_SOURCE_AUTHORITY_URL) {
    const admin = require('firebase-admin');
    if (!process.env.FIREBASE_PROJECT_ID) throw new Error('PRIVATE_CANONICAL_PROJECT_UNCONFIGURED');
    if (!admin.apps.length) admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    validateAuthority = firestoreReconstructionAuthority(admin.firestore(), process.env.CAPTURED_REALITY_PRIVATE_MANIFEST, { getOwner: (uid) => admin.auth().getUser(uid) });
  }
  const service = createResolver({ manifestPath: process.env.CAPTURED_REALITY_PRIVATE_MANIFEST, sourceRoot: process.env.CAPTURED_REALITY_PRIVATE_SOURCE_ROOT,
    token: process.env.CAPTURED_REALITY_RESOLVER_TOKEN, authorityUrl: process.env.PRIVATE_SOURCE_AUTHORITY_URL,
    authorityToken: process.env.PRIVATE_SOURCE_AUTHORITY_TOKEN, validateAuthority, local: ['local', 'test'].includes(process.env.URAI_ENV || '') });
  service.server.listen(Number(process.env.PORT || 8081), process.env.HOST || '127.0.0.1');
}
module.exports = { createResolver, firestoreReconstructionAuthority, jsonRequest, privateUrl, readBody, authorized, send, HANDLE, SHA256, sha };
