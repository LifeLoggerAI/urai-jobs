import './privacy-request-export-smoke.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const contractPath = 'contracts/privacy/urai-jobs-data-rights-contributor.v1.json';
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const dataRights = fs.readFileSync('functions/src/privacy/dataRights.ts', 'utf8');
const index = fs.readFileSync('functions/src/index.ts', 'utf8');
const workflow = fs.readFileSync('docs/DATA_RIGHTS_WORKFLOW.md', 'utf8');

assert.equal(contract.contractVersion, '1.0.0');
assert.equal(contract.system, 'urai-jobs');
assert.equal(contract.authority, 'request-control-plane');
assert.equal(contract.centralStatus, 'pending');
assert.equal(contract.executionState, 'PROTECTED_STAGING_EXECUTOR_SOURCE_READY_HARD_OFF');

assert.deepEqual(contract.requestTypes, ['EXPORT', 'DELETE']);
for (const name of ['submitDataRightsRequest', 'getDataRightsRequest', 'listDataRightsRequests']) {
  assert.ok(contract.requestSurface.includes(name), `contract missing request surface ${name}`);
  assert.ok(index.includes(name), `Functions entrypoint missing ${name}`);
}

assert.ok(dataRights.includes("executionState: 'PROTECTED_STAGING_EXECUTOR_SOURCE_READY_HARD_OFF'"));
assert.ok(dataRights.includes("z.enum(['EXPORT', 'DELETE'])"));
assert.ok(workflow.includes('Request intake must not be interpreted as completed export/deletion execution.'));

assert.equal(contract.claims.requestIntakeImplemented, true);
assert.equal(contract.claims.exportExecutionActive, false);
assert.equal(contract.claims.deletionExecutionActive, false);
assert.equal(contract.claims.crossSystemComplete, false);

for (const requirement of [
  'central-privacy-orchestration-and-final-completion-authority',
  'private-export-delivery-receipt',
  'retention-and-legal-hold-policy',
  'provider-deletion-propagation-where-applicable',
  'cross-tenant-tests',
  'protected-staging-e2e-proof',
  'backup-restore-recovery-proof',
  'legal-privacy-review',
  'deployment-and-rollback-receipts',
]) {
  assert.ok(contract.activationRequirements.includes(requirement), `activation requirement missing: ${requirement}`);
}

console.log('[PASS] URAI Jobs privacy data-rights contributor contract remains request-only and fail-closed');
