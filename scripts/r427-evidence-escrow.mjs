import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 17 * 1024 * 1024;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function validatedEndpoint(raw, synthetic) {
  if (!raw) throw new Error('R427_EVIDENCE_DESTINATION_REQUIRED');
  let url;
  try { url = new URL(raw); } catch { throw new Error('R427_EVIDENCE_URL_INVALID'); }
  if (url.username || url.password || url.hash) throw new Error('R427_EVIDENCE_URL_INVALID');
  const local = synthetic && url.protocol === 'http:' && url.hostname === '127.0.0.1';
  const google = url.protocol === 'https:' && !url.port &&
    (url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.storage.googleapis.com'));
  if (!local && !google) throw new Error('R427_EVIDENCE_DESTINATION_NOT_ALLOWLISTED');
  if (google && !url.searchParams.has('X-Goog-Signature') && !url.searchParams.has('Signature')) {
    throw new Error('R427_SIGNED_URL_REQUIRED');
  }
  return url;
}

export function evidenceAdmission(env = process.env, synthetic = false) {
  const put = env.URAI_EVIDENCE_ARCHIVE_PUT_URL;
  const get = env.URAI_EVIDENCE_ARCHIVE_GET_URL;
  if (synthetic && !put && !get) return null;
  return {
    put: validatedEndpoint(put, synthetic),
    get: validatedEndpoint(get, synthetic),
  };
}

async function boundedBytes(response) {
  if (!response.body) throw new Error('R427_READBACK_EMPTY');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new Error('R427_READBACK_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function publishEvidence({ evidenceDir, endpoints, synthetic = false }) {
  if (!endpoints) throw new Error('R427_EVIDENCE_DESTINATION_REQUIRED');
  // Always validate again at the trust boundary. Never expose signed URLs in logs.
  const put = validatedEndpoint(endpoints.put.href, synthetic);
  const get = validatedEndpoint(endpoints.get.href, synthetic);
  const reportFile = join(evidenceDir, 'r426-report.json');
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  if (!Array.isArray(report.steps)) throw new Error('R427_REPORT_INVALID');
  const filenames = ['r426-report.json'];
  for (const step of report.steps) {
    if (!/^[a-z0-9-]{1,60}$/.test(step.name)) throw new Error('R427_REPORT_INVALID');
    filenames.push(step.name + '.log');
  }
  for (const name of filenames) {
    const path = join(evidenceDir, name);
    if (!existsSync(path) || !lstatSync(path).isFile()) throw new Error('R427_EVIDENCE_FILE_MISSING');
  }
  const temp = mkdtempSync(join(tmpdir(), 'urai-r427-'));
  try {
    const archive = join(temp, 'original-source-evidence.tar.gz');
    const tar = spawnSync('tar', ['-czf', archive, '-C', evidenceDir, ...filenames], {
      timeout: 20000, stdio: 'pipe', maxBuffer: 65536,
    });
    if (tar.status !== 0 || tar.error) throw new Error('R427_ARCHIVE_FAILED');
    const content = readFileSync(archive);
    if (!content.length || content.length > MAX_ARCHIVE_BYTES) throw new Error('R427_ARCHIVE_SIZE_INVALID');
    const digest = sha256(content);
    const upload = await fetch(put, {
      method: 'PUT', headers: { 'content-type': 'application/gzip' }, body: content,
      redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    if (!upload.ok) throw new Error('R427_UPLOAD_FAILED');
    const readback = await fetch(get, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!readback.ok) throw new Error('R427_READBACK_FAILED');
    const received = await boundedBytes(readback);
    if (received.length !== content.length || sha256(received) !== digest) {
      throw new Error('R427_READBACK_MISMATCH');
    }
    return { status: 'READBACK_VERIFIED', archiveSha256: digest, archiveBytes: content.length,
      includedFiles: filenames, destination: synthetic ? 'SYNTHETIC_LOCAL_HTTP' : 'GCS_SIGNED_URL' };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
