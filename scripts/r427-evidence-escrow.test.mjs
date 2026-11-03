import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evidenceAdmission, publishEvidence } from './r427-evidence-escrow.mjs';

function fixture({ name = 'root-build' } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'urai-r427-fixture-'));
  const evidenceDir = join(tmp, 'evidence');
  mkdirSync(evidenceDir);
  const log = Buffer.from('SYNTHETIC_NODE_TEST_ONLY\n');
  writeFileSync(join(evidenceDir, 'r426-report.json'), JSON.stringify({
    schema: 'urai-r426-original-source-evidence-v1', status: 'EVIDENCE_PENDING',
    steps: [{ name, status: 'PASS', logSha256: createHash('sha256').update(log).digest('hex'),
      logBytes: log.length, logTruncated: false }],
  }));
  writeFileSync(join(evidenceDir, name + '.log'), log);
  return { tmp, evidenceDir, cleanup: () => rmSync(tmp, { recursive:true, force:true }) };
}
async function server(mode = 'ok') {
  let stored, putCount = 0;
  const app = createServer(async (req, res) => {
    if (req.method === 'PUT') {
      putCount++;
      const chunks=[];for await (const chunk of req) chunks.push(Buffer.from(chunk));
      stored=Buffer.concat(chunks);
      res.statusCode = mode === 'reject' ? 403 : 200;
      res.end('synthetic only');
    } else if (req.method === 'GET' && stored) {
      res.statusCode=200;
      res.end(mode === 'corrupt' ? Buffer.from('corrupt archive') : stored);
    } else { res.statusCode=404;res.end(); }
  });
  await new Promise(ok => app.listen(0, '127.0.0.1', ok));
  const base = 'http://127.0.0.1:' + app.address().port + '/test-signed-url';
  return { base, get putCount(){ return putCount; }, close: () => new Promise(ok => app.close(ok)) };
}
test('missing external destination denies real run', () => {
  assert.throws(() => evidenceAdmission({}, false), /R427_EVIDENCE_DESTINATION_REQUIRED/);
  assert.equal(evidenceAdmission({}, true), null);
});
test('rejects unsafe and unsigned upload destinations', () => {
  for (const bad of ['http://127.0.0.1:12345/secret','https://evil.example/test',
    'https://storage.googleapis.com/bucket/object',
    'https://storage.googleapis.com.evil.test/x?X-Goog-Signature=s']) {
    assert.throws(() => evidenceAdmission({
      URAI_EVIDENCE_ARCHIVE_PUT_URL: bad, URAI_EVIDENCE_ARCHIVE_GET_URL: bad,
    }, false), /R427_/);
  }
  assert.ok(evidenceAdmission({
    URAI_EVIDENCE_ARCHIVE_PUT_URL: 'https://storage.googleapis.com/my-bucket/artifact?X-Goog-Signature=synthetic',
    URAI_EVIDENCE_ARCHIVE_GET_URL: 'https://storage.googleapis.com/my-bucket/artifact?X-Goog-Signature=synthetic',
  }, false));
});
test('synthetic archived logs are uploaded and read back exactly', async () => {
  const f=fixture(), srv=await server();
  try {
    const endpoints=evidenceAdmission({
      URAI_EVIDENCE_ARCHIVE_PUT_URL:srv.base+'?secret=do-not-print',
      URAI_EVIDENCE_ARCHIVE_GET_URL:srv.base+'?secret=do-not-print'},true);
    const result=await publishEvidence({evidenceDir:f.evidenceDir,endpoints,synthetic:true});
    assert.equal(result.status,'READBACK_VERIFIED');
    assert.equal(result.destination,'SYNTHETIC_LOCAL_HTTP');
    assert.equal(result.archiveSha256.length,64);
    assert.deepEqual(result.includedFiles,['r426-report.json','root-build.log']);
    assert.equal(srv.putCount,1);
    assert.equal(JSON.stringify(result).includes('do-not-print'),false);
  } finally { f.cleanup(); await srv.close(); }
});
test('corrupted readback rejects archived evidence', async () => {
  const f=fixture(),srv=await server('corrupt');
  try {await assert.rejects(publishEvidence({evidenceDir:f.evidenceDir,
    endpoints:evidenceAdmission({URAI_EVIDENCE_ARCHIVE_PUT_URL:srv.base,
      URAI_EVIDENCE_ARCHIVE_GET_URL:srv.base},true),synthetic:true}),/R427_READBACK_MISMATCH/);}
  finally{f.cleanup();await srv.close();}
});
test('failed uploads never certify evidence', async () => {
  const f=fixture(),srv=await server('reject');
  try {await assert.rejects(publishEvidence({evidenceDir:f.evidenceDir,
    endpoints:evidenceAdmission({URAI_EVIDENCE_ARCHIVE_PUT_URL:srv.base,
      URAI_EVIDENCE_ARCHIVE_GET_URL:srv.base},true),synthetic:true}),/R427_UPLOAD_FAILED/);}
  finally{f.cleanup();await srv.close();}
});
test('malformed receipt paths cannot leave evidence directory', async () => {
  const f=fixture(),srv=await server();
  try {
    writeFileSync(join(f.evidenceDir,'r426-report.json'),JSON.stringify({steps:[{name:'../../secrets'}]}));
    await assert.rejects(publishEvidence({evidenceDir:f.evidenceDir,
      endpoints:evidenceAdmission({URAI_EVIDENCE_ARCHIVE_PUT_URL:srv.base,
        URAI_EVIDENCE_ARCHIVE_GET_URL:srv.base},true),synthetic:true}),/R428_REPORT_INVALID/);
    assert.equal(srv.putCount,0);
  } finally{f.cleanup();await srv.close();}
});


test('altered log bytes cannot be certified or uploaded', async () => {
  const f=fixture(), srv=await server();
  try {
    writeFileSync(join(f.evidenceDir, 'root-build.log'), 'FORGED_PASS_LOG\n');
    await assert.rejects(publishEvidence({ evidenceDir: f.evidenceDir,
      endpoints:evidenceAdmission({URAI_EVIDENCE_ARCHIVE_PUT_URL:srv.base,
        URAI_EVIDENCE_ARCHIVE_GET_URL:srv.base},true),synthetic:true}),/R428_LOCAL_LOG_DIGEST_MISMATCH/);
    assert.equal(srv.putCount,0);
  } finally { f.cleanup(); await srv.close(); }
});
test('altered hash in report blocks the upload', async () => {
  const f=fixture(), srv=await server();
  try {
    const path=join(f.evidenceDir,'r426-report.json');
    const report=JSON.parse(readFileSync(path,'utf8'));
    report.steps[0].logSha256='a'.repeat(64);
    writeFileSync(path,JSON.stringify(report));
    await assert.rejects(publishEvidence({evidenceDir:f.evidenceDir,
      endpoints:evidenceAdmission({URAI_EVIDENCE_ARCHIVE_PUT_URL:srv.base,
        URAI_EVIDENCE_ARCHIVE_GET_URL:srv.base},true),synthetic:true}),/R428_LOCAL_LOG_DIGEST_MISMATCH/);
    assert.equal(srv.putCount,0);
  } finally { f.cleanup(); await srv.close(); }
});
test('duplicate step records cannot be uploaded', async () => {
  const f=fixture(),srv=await server();
  try {
    const path=join(f.evidenceDir,'r426-report.json');
    const report=JSON.parse(readFileSync(path,'utf8'));
    report.steps.push({...report.steps[0]});
    writeFileSync(path,JSON.stringify(report));
    await assert.rejects(publishEvidence({evidenceDir:f.evidenceDir,
      endpoints:evidenceAdmission({URAI_EVIDENCE_ARCHIVE_PUT_URL:srv.base,
        URAI_EVIDENCE_ARCHIVE_GET_URL:srv.base},true),synthetic:true}),/R428_LOG_MANIFEST_INVALID/);
    assert.equal(srv.putCount,0);
  } finally { f.cleanup(); await srv.close(); }
});
test('missing per-stage checksum cannot be uploaded', async () => {
  const f=fixture(),srv=await server();
  try {
    const path=join(f.evidenceDir,'r426-report.json');
    const report=JSON.parse(readFileSync(path,'utf8'));
    delete report.steps[0].logSha256;
    writeFileSync(path,JSON.stringify(report));
    await assert.rejects(publishEvidence({evidenceDir:f.evidenceDir,
      endpoints:evidenceAdmission({URAI_EVIDENCE_ARCHIVE_PUT_URL:srv.base,
        URAI_EVIDENCE_ARCHIVE_GET_URL:srv.base},true),synthetic:true}),/R428_LOG_MANIFEST_INVALID/);
    assert.equal(srv.putCount,0);
  } finally { f.cleanup(); await srv.close(); }
});
