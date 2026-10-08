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
  "transcribeUrl:process.env.VERIFIED_URL+'/transcribe'",
  'authorityUrl:process.env.VERIFIED_URL',
  'resolverUrl:process.env.VERIFIED_URL',
  'indexUrl:process.env.VERIFIED_URL',
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

assert.ok(source.includes("if(env.URAI_SOURCE_SHA!==process.env.TARGET_SHA) fail.push('source SHA')"));
assert.ok(source.includes("if((env.PRIVATE_SOURCE_ALLOWED_BUCKET||'')!==process.env.PRIVATE_SOURCE_ALLOWED_BUCKET) fail.push('private bucket')"));
assert.ok(source.includes("if((env.URAI_LIFE_MODEL_EXTRACTOR_MODEL||'')!==process.env.LIFE_MODEL_EXTRACTOR_MODEL) fail.push('extractor model')"));
assert.ok(source.includes("if(env.URAI_PRIVATE_SOURCE_DIARIZATION_MODEL!==process.env.DIARIZATION_MODEL) fail.push('diarization model')"));
assert.ok(source.includes("if(labels['urai-paid-execution']!==expectedPaid) fail.push('paid execution label')"));
assert.ok(source.includes("fail.push('transcribe secret not removed')"));
assert.ok(source.includes("fail.push('index secret not removed')"));
assert.ok(source.includes("fail.push('OpenAI secret not removed')"));
assert.ok(source.includes('--update-labels "urai-paid-execution=$PAID_LABEL"'));
assert.ok(index.includes("spendingAuthority: PRIVATE_REF.test(String(process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF || ''))"));
assert.ok(protectedSource.includes("spendingAuthority: PRIVATE_REF.test(String(process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF || ''))"));
assert.ok(index.includes('spendingAuthorityRef: process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF'));
assert.ok(protectedSource.includes('spendingAuthorityRef:process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF'));
console.log('[PASS] PRIVATE_PROVIDER_ACTIVATION_CONTRACT');
