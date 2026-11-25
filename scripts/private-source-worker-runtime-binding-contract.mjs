import assert from 'node:assert/strict';
import fs from 'node:fs';

const deploy=fs.readFileSync('scripts/deploy-workers.sh','utf8');
const workflow=fs.readFileSync('.github/workflows/urai-jobs-production-deploy.yml','utf8');

for (const marker of [
  'URAI_PRIVATE_SOURCE_CONTRACT="${URAI_PRIVATE_SOURCE_CONTRACT:-urai-private-source-receipt-v2}"',
  'URAI_PRIVATE_SOURCE_EXECUTION_ENABLED="${URAI_PRIVATE_SOURCE_EXECUTION_ENABLED:-false}"',
  'URAI_PRIVATE_SOURCE_EXECUTION_AUTHORITY_REF="${URAI_PRIVATE_SOURCE_EXECUTION_AUTHORITY_REF:-}"',
  'URAI_PRIVATE_SOURCE_CONTRACT=$URAI_PRIVATE_SOURCE_CONTRACT',
  'URAI_PRIVATE_SOURCE_EXECUTION_ENABLED=$URAI_PRIVATE_SOURCE_EXECUTION_ENABLED',
  'URAI_PRIVATE_SOURCE_EXECUTION_AUTHORITY_REF=$URAI_PRIVATE_SOURCE_EXECUTION_AUTHORITY_REF',
  "privateSourceContract: String(process.env.URAI_PRIVATE_SOURCE_CONTRACT || '')",
  "privateSourceExecutionEnabled: process.env.URAI_PRIVATE_SOURCE_EXECUTION_ENABLED === 'true'",
  "privateSourceExecutionAuthorityRef: String(process.env.URAI_PRIVATE_SOURCE_EXECUTION_AUTHORITY_REF || '')",
  'private-source execution enabled mismatch',
  'private-source execution authority mismatch',
  'expected_private_ready_code',
]) assert.ok(deploy.includes(marker),marker);

for (const marker of [
  'enable_private_source_execution:',
  'private_source_execution_authority_ref:',
  'INPUT_ENABLE_PRIVATE_SOURCE_EXECUTION:',
  'INPUT_PRIVATE_SOURCE_EXECUTION_AUTHORITY_REF:',
  'ENABLE_PRIVATE_SOURCE_EXECUTION:',
  'PRIVATE_SOURCE_EXECUTION_AUTHORITY_REF:',
  'URAI_PRIVATE_SOURCE_CONTRACT: urai-private-source-receipt-v2',
  'URAI_PRIVATE_SOURCE_EXECUTION_ENABLED: ${{ env.ENABLE_PRIVATE_SOURCE_EXECUTION }}',
  'URAI_PRIVATE_SOURCE_EXECUTION_AUTHORITY_REF: ${{ env.PRIVATE_SOURCE_EXECUTION_AUTHORITY_REF }}',
  'private-source execution state binding',
]) assert.ok(workflow.includes(marker),marker);

assert.match(workflow,/enabled private-source execution requires an opaque private authority ref/);
assert.match(deploy,/enabled private-source execution requires an opaque private authority ref/);
assert.match(workflow,/private_source_execution_authority_ref must be empty while execution is disabled/);
assert.match(deploy,/private-source execution authority ref must be empty while execution is disabled/);
// Exercise the same detector used on the actual workflow. A double-escaped
// whitespace token here would silently stop recognizing ordinary YAML values.
const hardEnabledWorkflow = /URAI_PRIVATE_SOURCE_EXECUTION_ENABLED:\s*true/;
const hardEnableCases = [
  ['URAI_PRIVATE_SOURCE_EXECUTION_ENABLED:true', true],
  ['URAI_PRIVATE_SOURCE_EXECUTION_ENABLED: true', true],
  ['URAI_PRIVATE_SOURCE_EXECUTION_ENABLED:  true', true],
  ['URAI_PRIVATE_SOURCE_EXECUTION_ENABLED:\ttrue', true],
  ['URAI_PRIVATE_SOURCE_EXECUTION_ENABLED:\n  true', true],
  ['URAI_PRIVATE_SOURCE_EXECUTION_ENABLED:\r\n  true', true],
  ['  URAI_PRIVATE_SOURCE_EXECUTION_ENABLED: true # forbidden', true],
  ['URAI_PRIVATE_SOURCE_EXECUTION_ENABLED:false', false],
  ['URAI_PRIVATE_SOURCE_EXECUTION_ENABLED: false', false],
  ['URAI_PRIVATE_SOURCE_EXECUTION_ENABLED: ${{ env.ENABLE_PRIVATE_SOURCE_EXECUTION }}', false],
  ['URAI_PRIVATE_SOURCE_EXECUTION_ENABLED: ${{ inputs.enable_private_source_execution }}', false],
  ['REQUIRE_PRIVATE_SOURCE_EXECUTION_ENABLED: true', false],
  ['', false],
];
for (const [input, expected] of hardEnableCases) {
  assert.equal(hardEnabledWorkflow.test(input), expected, `hard-enable detector: ${JSON.stringify(input)}`);
}
assert.ok(!hardEnabledWorkflow.test(workflow),'workflow must not hard-enable private execution');
assert.ok(!/URAI_PRIVATE_SOURCE_EXECUTION_ENABLED="true"/.test(deploy),'deploy script must not hard-enable private execution');

console.log('[PASS] private-source worker runtime enable binding is explicit, fail-closed, revision-verified, and receipt-bound');
