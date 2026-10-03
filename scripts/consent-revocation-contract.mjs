import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const shared = read('packages/shared-types/src/index.ts');
const consumer = read('functions/src/jobs/consentRevocation.ts');
const create = read('functions/src/jobs/createJob.ts');
const tick = read('functions/src/jobs/processQueueTick.ts');
const now = read('functions/src/jobs/processQueueNow.ts');
const execute = read('functions/src/jobs/executeJob.ts');
const worker = read('workers/src/index.ts');
const index = read('functions/src/index.ts');

for (const token of ['JobConsentContext', 'consent?: JobConsentContext', "decision: 'granted'"]) {
  assert.ok(shared.includes(token), 'missing shared contract: ' + token);
}
for (const token of [
  'consent.revoked.v1',
  'URAI_JOBS_CONSENT_REVOCATION_SECRET',
  'x-urai-consent-signature',
  'consentRevocationBlocks',
  'consentRevocationEvents',
  'timingSafeEqual',
  'idempotent',
]) assert.ok(consumer.includes(token), 'missing consumer contract: ' + token);

assert.match(create, /Canonical consent context is required/);
assert.match(tick, /isConsentBlocked\(job, transaction\)/);
assert.match(now, /isConsentBlocked\(job, transaction\)/);
assert.match(execute, /isConsentBlocked\(job, transaction\)/);
assert.match(worker, /consentRevocationBlocks/);
assert.match(worker, /status: 'CANCELLED'/);
assert.match(index, /ingestConsentRevocation/);

console.log('URAI Jobs atomic consent revocation contract passed.');
