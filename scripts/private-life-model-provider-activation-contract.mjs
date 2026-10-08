import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('.github/workflows/private-life-model-provider-activation.yml','utf8');
const index=fs.readFileSync('workers/private-life-model-index-provider/src/index.ts','utf8');
const protectedSource=fs.readFileSync('workers/private-life-model-index-provider/src/protected-source-provider.ts','utf8');

for(const marker of [
  'workflow_dispatch:',
  'environment: staging',
  'enable_transcription:',
  'enable_life_model:',
  'spending_authority_ref:',
  'transcription_authority_ref:',
  'life_model_authority_ref:',
  'URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF',
  'URAI_PRIVATE_SOURCE_TRANSCRIPTION_AUTHORITY_REF',
  'URAI_PRIVATE_LIFE_MODEL_EXECUTION_AUTHORITY_REF',
  'PRIVATE_SOURCE_REF_RESOLVER_URL=$URL',
  'gcloud run services update',
  'PRIVATE_SOURCE_TRANSCRIBE_TOKEN=',
  'PRIVATE_SOURCE_INDEX_TOKEN=',
  'OPENAI_API_KEY=',
  'private-provider-activation.json',
  'paidProviderCallExecuted:false',
  'familyMediaProcessed:false',
  'publicReleaseAuthorized:false'
]) assert.ok(source.includes(marker),marker);

assert.ok(source.includes("test \"$GITHUB_REF\" = 'refs/heads/main'"));
assert.ok(source.includes('test "$TARGET_SHA" = "$GITHUB_SHA"'));
assert.ok(source.indexOf('npm test')<source.indexOf('Authenticate with Google Workload Identity Federation'));
assert.ok(source.includes("EXPECT_PRIVATE=\"$([ \"$ENABLE_TRANSCRIPTION\" = true ] && printf 200 || printf 503)\""));
assert.ok(source.includes("EXPECT_LIFE=\"$([ \"$ENABLE_LIFE_MODEL\" = true ] && printf 200 || printf 503)\""));
assert.ok(!source.includes('providerCallExecuted:true'));
assert.ok(!source.includes('paidProviderCallExecuted:true'));
assert.ok(index.includes("spendingAuthority: PRIVATE_REF.test(String(process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF || ''))"));
assert.ok(protectedSource.includes("spendingAuthority: PRIVATE_REF.test(String(process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF || ''))"));
assert.ok(index.includes('spendingAuthorityRef: process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF'));
assert.ok(protectedSource.includes('spendingAuthorityRef:process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF'));
console.log('[PASS] PRIVATE_PROVIDER_ACTIVATION_CONTRACT');
