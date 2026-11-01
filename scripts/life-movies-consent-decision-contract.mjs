import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../functions/src/privacy/lifeMovieConsentDecision.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, Date, Error, Reflect, Number, Object });
const verify = module.exports.assertLifeMovieConsentDecision;
const now = Date.parse('2026-11-01T12:00:00.000Z');
const renderScope = { projectId: 'project-1', renderPlanDigest: 'a'.repeat(64), sourceSetDigest: 'b'.repeat(64) };
const expected = { subjectUid: 'owner-1', tenantId: 'tenant-1', correlationId: 'corr-12345678',
  decisionReceiptId: 'c'.repeat(64), renderScope };
const allowed = { allowed: true, reason: 'ALLOWED', purpose: 'life-movie.render', policyVersion: '1.1.0',
  requiredTier: 'C6', subjectUid: expected.subjectUid, tenantId: expected.tenantId,
  correlationId: expected.correlationId, receiptHash: expected.decisionReceiptId, renderScope,
  evaluatedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60_000).toISOString(),
  decisionEventId: 'event-123' };
let passes = 0;
const accept = (value = allowed) => { assert.doesNotThrow(() => verify(value, expected, now)); passes++; };
const reject = (value, binding = expected) => { assert.throws(() => verify(value, binding, now)); passes++; };
accept();
reject(null);
reject({ ...allowed, allowed: false });
reject({ ...allowed, reason: 'DENIED' });
reject({ ...allowed, purpose: 'memory.storage' });
reject({ ...allowed, policyVersion: '1.0.0' });
reject({ ...allowed, requiredTier: 'C1' });
reject({ ...allowed, subjectUid: 'other' });
reject({ ...allowed, tenantId: 'other' });
reject({ ...allowed, correlationId: 'other' });
reject({ ...allowed, receiptHash: 'd'.repeat(64) });
reject({ ...allowed, renderScope: { ...renderScope, sourceSetDigest: 'd'.repeat(64) } });
reject({ ...allowed, renderScope: { ...renderScope, extra: true } });
reject({ ...allowed, renderScope: Object.create(renderScope) });
reject({ ...allowed, evaluatedAt: new Date(now - 31_000).toISOString() });
reject({ ...allowed, evaluatedAt: new Date(now + 1000).toISOString() });
reject({ ...allowed, expiresAt: new Date(now - 1000).toISOString() });
reject({ ...allowed, decisionEventId: null });
reject(allowed, { ...expected, decisionReceiptId: 'not-a-hash' });
reject({ ...allowed, renderScope: { ...renderScope, [Symbol('critical')]: true } });
assert.equal(source.includes('lifeMovieConsentAuthorityAvailable'), true, 'gate must remain referenced as unavailable');
console.log('[PASS] ' + passes + ' synthetic decision-contract cases; no transport or processing enabled.');
