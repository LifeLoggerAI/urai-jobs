import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const socket = createServer();
await new Promise((resolve, reject) => socket.once('error', reject).listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const token = 'synthetic-worker-token';
const worker = spawn(process.execPath, [fileURLToPath(new URL('../workers/studio-worker/index.js', import.meta.url))], {
  env: { ...process.env, URAI_ENV: 'test', URAI_JOBS_WORKER_TOKEN: token, HOST: '127.0.0.1', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
worker.stdout.on('data', chunk => { output += chunk; });
worker.stderr.on('data', chunk => { output += chunk; });
function call(method, path, body, authorization) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({ hostname: '127.0.0.1', port, method, path,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...(authorization ? { authorization } : {}) } }, response => {
      let raw = '';
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.end(data);
  });
}
let startupTimer;
try {
  await Promise.race([
    new Promise((resolve, reject) => {
      worker.stdout.on('data', chunk => { if (String(chunk).includes('listening on')) resolve(); });
      worker.once('exit', code => reject(new Error(`Worker exited before startup (${code}): ${output}`)));
    }),
    new Promise((_, reject) => { startupTimer = setTimeout(() => reject(new Error(`Worker startup timed out: ${output}`)), 15000); }),
  ]);
  clearTimeout(startupTimer);
  const ready = await call('GET', '/readyz');
  assert.equal(ready.status, 503);
  assert.equal(ready.body.checks.consentAuthorityConnected, false);
  const input = { jobId: 'synthetic-job', leaseToken: 'synthetic-lease', jobType: 'studio.render.video',
    consent: { purpose: 'life-movie.render', decisionReceiptId: 'invented', policyVersion: 'invented' } };
  assert.equal((await call('POST', '/', input, 'Bearer invalid')).status, 401);
  const denied = await call('POST', '/', input, `Bearer ${token}`);
  assert.equal(denied.status, 503);
  assert.equal(denied.body.code, 'CONSENT_AUTHORITY_UNAVAILABLE');
  const assembly = await call('POST', '/', { ...input, jobType: 'studio.assemble.video' }, `Bearer ${token}`);
  assert.equal(assembly.status, 503);
  assert.equal(assembly.body.code, 'CONSENT_AUTHORITY_UNAVAILABLE');
  console.log('[PASS] The real local worker reports unready and denies authenticated render and assembly requests.');
  console.log('Synthetic HTTP requests only: no cloud service or media data was accessed.');
} finally {
  clearTimeout(startupTimer);
  worker.kill('SIGTERM');
  if (worker.exitCode === null && worker.signalCode === null) await once(worker, 'exit');
}
