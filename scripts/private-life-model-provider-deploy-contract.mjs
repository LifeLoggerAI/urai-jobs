import assert from 'node:assert/strict';
import fs from 'node:fs';

const path='.github/workflows/private-life-model-provider-deploy.yml';
const source=fs.readFileSync(path,'utf8');
const receiptSource=fs.readFileSync('scripts/private-life-model-provider-deployment-receipt.mjs','utf8');

for(const marker of [
  'workflow_dispatch:',
  'id-token: write',
  'GCP_WIF_PROVIDER',
  'GCP_DEPLOY_SERVICE_ACCOUNT',
  'workers/private-life-model-index-provider',
  'private-life-model-index-provider',
  'URAI_SOURCE_SHA=$TARGET_SHA',
  'URAI_PRIVATE_SOURCE_CONTRACT=urai-private-source-receipt-v2',
  'URAI_PRIVATE_SOURCE_TRANSCRIPTION_ENABLED=false',
  'URAI_PRIVATE_LIFE_MODEL_EXECUTION_ENABLED=false',
  'PRIVATE_SOURCE_AUTHORITY_TOKEN=',
  'PRIVATE_SOURCE_REF_RESOLVER_TOKEN=',
  '/healthz',
  '/readyz',
  '/private-source-readyz',
  'AUTH_CODE',
  'paidExecutionAuthorized:false',
  'familyMediaProcessed:false',
  'publicReleaseAuthorized:false',
]) assert.ok((source+'\n'+receiptSource).includes(marker),marker);

assert.ok(!source.includes('OPENAI_API_KEY='),'deployment must not bind paid provider API key');
assert.ok(!source.includes('URAI_PRIVATE_SOURCE_TRANSCRIPTION_ENABLED=true'),'transcription must stay hard-off');
assert.ok(!source.includes('URAI_PRIVATE_LIFE_MODEL_EXECUTION_ENABLED=true'),'Life Model extraction must stay hard-off');
assert.ok(!/credentials_json\s*:/.test(source),'raw JSON credentials forbidden');
assert.ok(!/FIREBASE_TOKEN|GCP_SERVICE_ACCOUNT_JSON|GCP_SA_KEY/.test(source),'legacy credential secret forbidden');
assert.match(source,/authority_token_version:/);
assert.match(source,/resolver_token_version:/);
assert.match(source,/\^\[1-9\]\[0-9\]\*\$/);
assert.ok(source.includes('git merge-base --is-ancestor'),'rollback must be an ancestor');
assert.ok(source.includes('test "$TARGET_SHA" = "$(git rev-parse HEAD)"'),'source must be exact');
console.log('[PASS] PRIVATE_LIFE_MODEL_PROVIDER_DEPLOY_CONTRACT');

assert.ok(source.includes("test \"$GITHUB_REF\" = 'refs/heads/main'"),'standalone lane preserves canonical main authority');
assert.ok(source.includes('test "$TARGET_SHA" = "$GITHUB_SHA"'),'standalone lane binds exact workflow source');
assert.ok(source.indexOf('npm test')<source.indexOf('Authenticate with Google Workload Identity Federation'),'native exact source proof must precede cloud authority');
assert.ok(source.includes('[BLOCKED] Production provider mutation requires the canonical frozen and independently approved release path.'),'production must not bypass canonical release governance');
assert.ok(source.includes('steps.verify.outputs.verified'),'always-run receipt is bound to actual completed readback');
assert.ok(!source.includes('authoritySurfaceConfigured:true'),'failure cannot claim configured authority');
