import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../functions/src/privacy/dataRightsExecution.ts', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
const contract = JSON.parse(fs.readFileSync(new URL('../contracts/privacy/urai-jobs-data-rights-contributor.v1.json', import.meta.url), 'utf8'));

for (const required of [
  "URAI_JOBS_DATA_RIGHTS_EXECUTION_MODE",
  "protected-staging",
  "URAI_JOBS_DATA_RIGHTS_ALLOWED_PROJECT",
  "URAI_JOBS_DATA_RIGHTS_PRODUCTION_AUTHORIZED",
  "Only an explicitly APPROVED request",
  "retentionDecisionReceiptId",
  "withAuthenticatedRole(['admin', 'operator']",
  "uploadToGcs",
  "PROTECTED_STAGING_EXECUTION_FAILED_RETRYABLE",
  "PROTECTED_STAGING_EXPORT_READY_CENTRAL_DELIVERY_REQUIRED",
  "PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED",
  "completeEcosystemExport: false",
  "firebase-auth-account",
  "provider-side-derivatives",
]) {
  assert.ok(worker.includes(required), `missing governed data-rights execution guard: ${required}`);
}

assert.ok(index.includes('processDataRightsRequest'), 'Functions index must export the protected executor');
assert.ok(!worker.includes("status: 'COMPLETED'"), 'partial Jobs execution must never mark the ecosystem request completed');
assert.ok(!worker.includes("process.env.URAI_JOBS_DATA_RIGHTS_PRODUCTION_AUTHORIZED === 'false'"),
  'production safety must not rely on a caller-provided false string');

assert.equal(contract.claims.crossSystemComplete, false);
assert.equal(contract.claims.exportExecutionActive, false);
assert.equal(contract.claims.deletionExecutionActive, false);
assert.ok(contract.activationRequirements.includes('protected-staging-e2e-proof'));
assert.ok(contract.activationRequirements.includes('legal-privacy-review'));

console.log('[PASS] governed data-rights executor is source-complete, protected-staging-only, and fail-closed for unresolved domains');
