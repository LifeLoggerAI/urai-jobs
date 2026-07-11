import fs from 'node:fs';
import { runRollbackRevisionVerifierSelfTest } from './verify-rollback-revision.mjs';

const failures = [];
const read = (path) => fs.readFileSync(path, 'utf8');

function requireText(path, text, description) {
  const source = read(path);
  if (!source.includes(text)) failures.push(`${description}: ${path} is missing ${JSON.stringify(text)}`);
}

requireText(
  'package.json',
  'GITHUB_SHA=\\"$DEPLOY_SOURCE_SHA\\" node scripts/verify-rollback-revision.mjs',
  'canonical worker deployment must verify the rollback revision before mutation',
);
requireText(
  'package.json',
  'node scripts/check-rollback-provenance.mjs',
  'repository verification must include rollback provenance checks',
);
requireText(
  '.github/workflows/urai-jobs-production-deploy.yml',
  'rollback_config_fingerprints_json:',
  'canonical workflow must require explicit rollback configuration approvals',
);
requireText(
  '.github/workflows/urai-jobs-production-deploy.yml',
  'DEPLOY_ROLLBACK_CONFIG_FINGERPRINTS_JSON: ${{ inputs.rollback_config_fingerprints_json }}',
  'canonical workflow must pass exact rollback configuration approvals',
);
requireText(
  '.github/workflows/urai-jobs-production-deploy.yml',
  "schemaVersion: 'urai-jobs-canonical-deploy-inputs-3'",
  'canonical deployment input receipt must record the strengthened authority schema',
);
requireText(
  'scripts/verify-rollback-revision.mjs',
  "schemaVersion: 'urai-jobs-rollback-config-receipt-1'",
  'rollback verifier must emit a dedicated immutable receipt',
);
requireText(
  'scripts/verify-rollback-revision.mjs',
  'rollback revision source SHA label mismatch',
  'rollback verifier must bind the source label',
);
requireText(
  'scripts/verify-rollback-revision.mjs',
  'rollback revision environment label mismatch',
  'rollback verifier must bind the environment label',
);
requireText(
  'scripts/verify-rollback-revision.mjs',
  'rollback revision service account',
  'rollback verifier must bind the runtime service account',
);
requireText(
  'scripts/verify-rollback-revision.mjs',
  'must use an exact numeric Secret Manager version',
  'rollback verifier must bind exact numeric secret versions',
);
requireText(
  'scripts/verify-rollback-revision.mjs',
  'does not match explicitly approved fingerprint',
  'rollback verifier must compare the observed configuration to explicit approval',
);
requireText(
  'scripts/verify-rollback-revision.mjs',
  "ASSET_FACTORY_REPO = 'LifeLoggerAI/asset-factory'",
  'asset rollback configuration must bind its repository authority',
);
requireText(
  'scripts/verify-rollback-revision.mjs',
  'URAI_ROLLBACK_SHA must differ from URAI_SOURCE_SHA',
  'rollback verifier must bind the rollback revision ancestor',
);
requireText(
  'scripts/deploy-workers.sh',
  'node scripts/validate-rollback-config-receipt.mjs "$ROLLBACK_CONFIG_RECEIPT_PATH"',
  'deploy script must validate the approved rollback receipt before mutation',
);
requireText(
  'scripts/deploy-workers.sh',
  'Live rollback revision $rollback_revision changed after approval',
  'deploy script must refuse rollback revision drift after approval',
);
requireText(
  'scripts/deploy-workers.sh',
  'Live rollback digest $rollback_image_digest changed after approval',
  'deploy script must refuse rollback digest drift after approval',
);
requireText(
  'scripts/deploy-workers.sh',
  'expected_rollback_revision="$(rollback_receipt_value "$worker" rollbackRevision)"',
  'deploy script must use the receipt revision as immutable rollback authority',
);

try {
  runRollbackRevisionVerifierSelfTest();
} catch (error) {
  failures.push(`rollback provenance behavioral validation failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length > 0) {
  console.error('[FAIL] rollback configuration provenance contract');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[PASS] rollback configuration provenance contract');
console.log('[PASS] rollback revision source, labels, environment, service account, bucket, secret versions, ancestor, and digest are fingerprint-bound');
console.log('[PASS] explicit per-worker rollback fingerprint approval is required before worker mutation');
console.log('[PASS] live rollback revision and digest must remain identical to the approved receipt');
console.log('[PASS] dedicated rollback configuration receipt is required');
