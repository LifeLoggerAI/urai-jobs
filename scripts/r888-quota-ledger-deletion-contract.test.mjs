/** R888 original-source privacy deletion + quota ledger contract.
 * Static/security contract only; Firestore emulator execution is separate.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const source = readFileSync(new URL('../functions/src/privacy/dataRightsExecution.ts', import.meta.url), 'utf8');
const create = readFileSync(new URL('../functions/src/jobs/createJob.ts', import.meta.url), 'utf8');
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const ts = requireFunctions('typescript');

test('R888 privacy executor is valid TypeScript syntax', () => {
  const ast = ts.createSourceFile('dataRightsExecution.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  assert.deepEqual(ast.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});

test('R888 existing deletion fence commits before scoped deletion starts', () => {
  const approved = source.indexOf("if (record.status !== 'APPROVED')");
  const execution = source.indexOf("const result = record.requestType === 'EXPORT'");
  assert.ok(approved >= 0 && execution > approved);
  const initial = source.slice(approved, execution);
  assert.match(initial, /transaction\.get\(ownerRef\)/);
  assert.match(initial, /transaction\.set\(ownerRef, \{[\s\S]*?dataRightsDeletionPendingCentralPrivacy: true/);
});

test('R888 deletes quota timestamps only after terminal job reconciliation', () => {
  const start = source.indexOf('async function executeDelete(');
  const end = source.indexOf('\n  return {\n    jobsAnonymized,', start);
  assert.ok(start > 0 && end > start);
  const body = source.slice(start, end);
  const terminal = body.indexOf('TERMINAL_DELETE_JOB.has');
  const transaction = body.indexOf('await db.runTransaction');
  const redact = body.indexOf('ownerUid: `deleted:${ownerHash}`');
  const ownerMerge = body.indexOf("await db.collection('users').doc(ownerUid).set({");
  const quotaDelete = body.indexOf('jobsCreateRateLimit: FieldValue.delete()');
  assert.ok(terminal >= 0 && terminal < transaction && transaction < redact);
  assert.ok(redact < ownerMerge && ownerMerge < quotaDelete);
  assert.match(body.slice(ownerMerge), /\}, \{ merge: true \}\)/);
});

test('R888 deletion retains central privacy fence and source request', () => {
  const start = source.indexOf('async function executeDelete(');
  const end = source.indexOf('\n  return {\n    jobsAnonymized,', start);
  const body = source.slice(start, end);
  assert.match(body, /jobsCreateRateLimit: FieldValue\.delete\(\),\s*dataRightsDeletionPendingCentralPrivacy: true,\s*dataRightsDeletionRequestId: requestId/);
  assert.doesNotMatch(body, /dataRightsDeletionPendingCentralPrivacy: false/);
});

test('R888 live job creation still checks that fence before quota write', () => {
  const start = create.indexOf('return await db.runTransaction(async (transaction) => {');
  const end = create.indexOf('  } catch (error: unknown)', start);
  assert.ok(start > 0 && end > start);
  const admission = create.slice(start, end);
  assert.match(admission, /assertOwnerJobsNotDeleting\(currentOwner\)/);
  assert.ok(admission.indexOf('assertOwnerJobsNotDeleting(currentOwner)') <
    admission.indexOf('transaction.update(ownerRef, { jobsCreateRateLimit: nextRateLimit })'));
});

test('R888 Firebase clients cannot modify server-owned quota ledger', () => {
  const start = rules.indexOf('function userProfileFieldsUnchanged()');
  const end = rules.indexOf('match /users/{uid}', start);
  assert.ok(start >= 0 && end > start);
  assert.match(rules.slice(start, end), /'jobsCreateRateLimit'/);
});
