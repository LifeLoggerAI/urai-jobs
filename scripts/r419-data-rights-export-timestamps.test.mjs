import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

// Extract and execute the actual checked-in helper declarations. No Firebase,
// Storage, customer data, credentials or network calls are needed.
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../functions/src/privacy/dataRightsExecution.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('dataRightsExecution.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const names = new Set(['timestamp', 'redact', 'buildExport']);
const snippets = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).map(node => source.slice(node.getStart(ast), node.end));
assert.equal(snippets.length, 3, 'Require original privacy-export helper declarations');
const compiled = ts.transpileModule("const EXECUTION_SCHEMA = 'urai-jobs-data-rights-execution-v1';\n" + snippets.join('\n') + '\nmodule.exports = { timestamp, redact, buildExport };', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

class FirestoreTimestamp {
  constructor(date) {
    this.seconds = Math.floor(Date.parse(date) / 1000);
    this.nanoseconds = 0;
  }
  toDate() { return new Date(this.seconds * 1000); }
}

function harness(job) {
  const uploads = [];
  const scope = {
    module: { exports: {} }, Buffer, createHash,
    ownedJobs: async () => [{ id: 'job-safe-1', data: () => job }],
    uploadToGcs: async (bytes, destination, mime) => {
      uploads.push({ bytes, destination, mime });
      return `gs://synthetic-bucket/${destination}`;
    },
  };
  scope.exports = scope.module.exports;
  vm.runInNewContext(compiled, scope, { timeout: 2000 });
  const db = { collection: key => {
    assert.equal(key, 'users');
    return { doc: owner => {
      assert.equal(owner, 'synthetic-owner');
      return { get: async () => ({ exists: true, data: () => ({ name: 'Synthetic', apiKey: 'redact-me' }) }) };
    } };
  } };
  return { run: () => scope.module.exports.buildExport(db, 'synthetic-request', 'synthetic-owner'), uploads };
}

test('export retains Firestore times while recursive redaction still removes secrets', async () => {
  const { run, uploads } = harness({
    type: 'studio.render.video', status: 'SUCCESS', ownerUid: 'synthetic-owner',
    createdAt: new FirestoreTimestamp('2026-11-01T02:03:04.000Z'),
    updatedAt: new FirestoreTimestamp('2026-11-02T03:04:05.000Z'),
    completedAt: new FirestoreTimestamp('2026-11-03T04:05:06.000Z'),
    payload: { title: 'Synthetic', password: 'redact-me', nested: { apiKey: 'redact-me' } },
  });
  const result = await run();
  const job = result.payload.jobs[0];
  assert.equal(job.createdAt, '2026-11-01T02:03:04.000Z');
  assert.equal(job.updatedAt, '2026-11-02T03:04:05.000Z');
  assert.equal(job.completedAt, '2026-11-03T04:05:06.000Z');
  assert.equal(job.payload.title, 'Synthetic');
  assert.equal(job.payload.password, undefined);
  assert.equal(job.payload.nested.apiKey, undefined);
  assert.equal(result.payload.user.apiKey, undefined);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].mime, 'application/json');
  assert.equal(result.sha256, createHash('sha256').update(uploads[0].bytes).digest('hex'));
  assert.equal(JSON.parse(uploads[0].bytes.toString('utf8')).jobs[0].createdAt, job.createdAt);
});

test('missing original timestamps remain null', async () => {
  const result = await harness({ ownerUid: 'synthetic-owner', status: 'FAILED', payload: { password: 'secret' } }).run();
  assert.equal(result.payload.jobs[0].createdAt, null);
  assert.equal(result.payload.jobs[0].updatedAt, null);
  assert.equal(result.payload.jobs[0].completedAt, null);
});

test('private export strips recovery and verification credentials without erasing ordinary memories', async () => {
  const { run, uploads } = harness({
    ownerUid: 'synthetic-owner', status: 'SUCCESS',
    payload: {
      title: 'Synthetic memory', notes: 'Keep this ordinary memory text',
      credentials: {
        recoveryCode: 'secret-recovery', verification_code: 'secret-verification',
        oneTimeCode: 'secret-one-time', mfaCode: 'secret-mfa',
        totp_code: 'secret-totp', otp: 'secret-otp',
        access_token: 'secret-token', password: 'secret-password',
      },
    },
  });
  const result = await run();
  const payload = result.payload.jobs[0].payload;
  assert.equal(payload.title, 'Synthetic memory');
  assert.equal(payload.notes, 'Keep this ordinary memory text');
  for (const key of ['recoveryCode', 'verification_code', 'oneTimeCode', 'mfaCode',
    'totp_code', 'otp', 'access_token', 'password']) {
    assert.equal(payload.credentials[key], undefined, `Sensitive ${key} must not be exported`);
  }
  assert.equal(uploads.length, 1);
  const uploaded = JSON.parse(uploads[0].bytes.toString('utf8'));
  assert.equal(uploaded.jobs[0].payload.notes, 'Keep this ordinary memory text');
  assert.equal(JSON.stringify(uploaded).includes('secret-recovery'), false);
  assert.equal(JSON.stringify(uploaded).includes('secret-totp'), false);
});
