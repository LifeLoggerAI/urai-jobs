const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');

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
function firestoreReconstructionAuthority(db, manifestPath) {
  return async (body) => {
    const manifest = await readManifest(manifestPath);
    const entries = body.sourceHandles.map((sourceHandle) => manifest.entries.find((row) => row.jobId === body.jobId && row.sourceHandle === sourceHandle));
    if (entries.some((row) => !row || Date.parse(row.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(row.expiresAt)))) throw new Error('SOURCE_GRANT_EXPIRED');
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.collection('jobs').doc(body.jobId)), job = snap.exists ? snap.data() : null;
      if (!job || !['RUNNING', 'SUCCESS'].includes(job.status) || entries.some((row) => row.ownerUid !== job.ownerUid || !job.payload?.sourceReceiptRefs?.includes(row.sourceReceiptRef))) throw new Error('SOURCE_OWNER_OR_JOB_DENIED');
      const attemptHash = job.status === 'SUCCESS' ? job.execution?.capturedRealityAcceptedCallbackHash : job.execution?.callbackTokenHash;
      if (!SHA256.test(String(body.callbackTokenHash || '')) || attemptHash !== body.callbackTokenHash) throw new Error('SOURCE_ATTEMPT_DENIED');
      if (job.status === 'RUNNING' && (job.execution?.asyncCallbackPending !== true || job.execution?.callbackLeaseToken !== job.execution?.leaseToken
        || (job.execution?.callbackDeadlineAt?.toMillis?.() || 0) <= Date.now())) throw new Error('SOURCE_LEASE_DENIED');
      const purposes = [...new Set((Array.isArray(job.consents) ? job.consents : []).map((row) => row.purpose))];
      if (!['memory.storage', 'location.context'].every((purpose) => purposes.includes(purpose))) throw new Error('SOURCE_CONSENT_DENIED');
      for (const purpose of purposes) {
        const blockId = sha(Buffer.from(job.ownerUid + '\n' + purpose)), block = await tx.get(db.collection('jobConsentBlocks').doc(blockId));
        if (block.exists && block.data()?.active === true) throw new Error('SOURCE_CONSENT_REVOKED');
      }
    });
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
    await check({ jobId: body.jobId, sourceHandles: [body.sourceHandle], callbackTokenHash: body.callbackTokenHash });
    if (!manifestPath || !sourceRoot) throw new Error('RESOLVER_STORAGE_UNCONFIGURED');
    const manifest = await readManifest(manifestPath);
    const entry = manifest.entries?.find((row) => row.jobId === body.jobId && row.sourceHandle === body.sourceHandle);
    if (!entry || Date.parse(entry.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(entry.expiresAt)) || !HANDLE.test(String(entry.sourceReceiptRef || ''))
      || !Array.isArray(entry.acceptedInputs) || !entry.acceptedInputs.length || entry.acceptedInputs.length > 3000) throw new Error('SOURCE_GRANT_INVALID');
    for (const input of entry.acceptedInputs) {
      if (input.accepted !== true || !HANDLE.test(String(input.inputRef || '')) || !HANDLE.test(String(input.frameProvenanceRef || '')) || !SHA256.test(String(input.sha256 || ''))
        || !Number.isSafeInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > 256 * 1024 * 1024
        || !['image/png', 'image/jpeg'].includes(input.mimeType)) throw new Error('ACCEPTED_INPUT_INVALID');
    }
    if (new Set(entry.acceptedInputs.map((row) => row.inputRef)).size !== entry.acceptedInputs.length) throw new Error('DUPLICATE_INPUT_REF');
    return entry;
  }
  async function resolve(body) {
    const entry = await load(body);
    return { authorized: true, jobId: body.jobId, sourceHandle: body.sourceHandle, sourceReceiptRef: entry.sourceReceiptRef,
      expiresAt: entry.expiresAt, acceptedInputs: entry.acceptedInputs.map(({ inputRef, frameProvenanceRef, sha256, byteSize, mimeType }) => ({ inputRef, frameProvenanceRef, sha256, byteSize, mimeType })) };
  }
  async function redeem(body) {
    const entry = await load(body), input = entry.acceptedInputs.find((row) => row.inputRef === body.inputRef);
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
      return { bytes, mimeType: input.mimeType, sha256: input.sha256 };
    } finally { await file.close(); }
  }
  const server = http.createServer(async (req, res) => {
    if (!authorized(req, token)) return send(res, 401, { ok: false, code: 'UNAUTHORIZED' });
    if (req.method !== 'POST') return send(res, 404, { ok: false, code: 'NOT_FOUND' });
    try {
      const body = await readBody(req);
      if (req.url === '/check') return send(res, 200, await check(body));
      if (req.url === '/resolve') return send(res, 200, await resolve(body));
      if (req.url === '/redeem') {
        const result = await redeem(body);
        res.writeHead(200, { 'content-type': result.mimeType, 'content-length': result.bytes.length, 'cache-control': 'no-store', 'x-content-sha256': result.sha256 });
        return res.end(result.bytes);
      }
      send(res, 404, { ok: false, code: 'NOT_FOUND' });
    } catch { send(res, 403, { ok: false, code: 'PRIVATE_SOURCE_DENIED' }); }
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
    validateAuthority = firestoreReconstructionAuthority(admin.firestore(), process.env.CAPTURED_REALITY_PRIVATE_MANIFEST);
  }
  const service = createResolver({ manifestPath: process.env.CAPTURED_REALITY_PRIVATE_MANIFEST, sourceRoot: process.env.CAPTURED_REALITY_PRIVATE_SOURCE_ROOT,
    token: process.env.CAPTURED_REALITY_RESOLVER_TOKEN, authorityUrl: process.env.PRIVATE_SOURCE_AUTHORITY_URL,
    authorityToken: process.env.PRIVATE_SOURCE_AUTHORITY_TOKEN, validateAuthority, local: ['local', 'test'].includes(process.env.URAI_ENV || '') });
  service.server.listen(Number(process.env.PORT || 8081), process.env.HOST || '127.0.0.1');
}
module.exports = { createResolver, firestoreReconstructionAuthority, jsonRequest, privateUrl, readBody, authorized, send, HANDLE, SHA256, sha };
