import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

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
assert.ok(source.includes("test -z \"$TRANSCRIBE_TOKEN_VERSION\""));
assert.ok(source.includes("test -z \"$INDEX_TOKEN_VERSION\""));
assert.ok(source.includes("test -z \"$OPENAI_SECRET_NAME\""));
assert.ok(source.includes("test -z \"$OPENAI_SECRET_VERSION\""));
assert.ok(source.includes("[[ \"$OPENAI_SECRET_NAME\" =~ ^[A-Za-z0-9_-]{1,255}$ ]]"));
assert.ok(source.includes("if(labels['urai-source-sha']!==process.env.TARGET_SHA) fail.push('source label')"));
assert.ok(source.includes("if(labels['urai-environment']!=='staging') fail.push('environment label')"));
assert.ok(source.includes("if(digest!==process.env.EXPECTED_IMAGE_DIGEST) fail.push('image digest drift')"));
assert.ok(source.includes("if(String(r.spec?.serviceAccountName||'')!==process.env.EXPECTED_SERVICE_ACCOUNT) fail.push('runtime service account drift')"));
assert.ok(index.includes("spendingAuthority: PRIVATE_REF.test(String(process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF || ''))"));
assert.ok(protectedSource.includes("spendingAuthority: PRIVATE_REF.test(String(process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF || ''))"));
assert.ok(index.includes('spendingAuthorityRef: process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF'));
assert.ok(protectedSource.includes('spendingAuthorityRef:process.env.URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF'));
// Execute the deployed-revision verifier from the actual workflow. Presence of
// an arbitrary numeric secret version is insufficient for exact activation.
const verifyStep = source.indexOf('- name: Verify exact activation state');
const verifierStart = source.indexOf('const r=JSON.parse(process.env.REVISION_JSON);', verifyStep);
const verifierEnd = source.indexOf('\n          NODE', verifierStart);
assert.ok(verifyStep >= 0 && verifierStart > verifyStep && verifierEnd > verifierStart);
const verifier = source.slice(verifierStart, verifierEnd);
function readbackFixture(transcription = true, lifeModel = true) {
  const env = {
    TARGET_SHA: 'a'.repeat(40), ENABLE_TRANSCRIPTION: String(transcription), ENABLE_LIFE_MODEL: String(lifeModel),
    SPENDING_AUTHORITY_REF: transcription || lifeModel ? 'private:synthetic/spending' : '',
    TRANSCRIPTION_AUTHORITY_REF: transcription ? 'private:synthetic/transcription' : '',
    LIFE_MODEL_AUTHORITY_REF: lifeModel ? 'private:synthetic/life-model' : '',
    PRIVATE_SOURCE_ALLOWED_BUCKET: transcription ? 'synthetic-private-bucket' : '',
    LIFE_MODEL_EXTRACTOR_MODEL: lifeModel ? 'synthetic-model-01' : '',
    DIARIZATION_MODEL: 'gpt-4o-transcribe-diarize', URL: 'https://synthetic-provider.invalid',
    EXPECTED_IMAGE_DIGEST: 'sha256:' + 'b'.repeat(64), EXPECTED_SERVICE_ACCOUNT: 'synthetic-runtime',
    TRANSCRIBE_SECRET: 'urai-private-source-transcribe-token', TRANSCRIBE_TOKEN_VERSION: transcription ? '3' : '',
    INDEX_SECRET: 'urai-private-source-index-token', INDEX_TOKEN_VERSION: lifeModel ? '4' : '',
    OPENAI_SECRET_NAME: transcription || lifeModel ? 'synthetic-provider-key' : '',
    OPENAI_SECRET_VERSION: transcription || lifeModel ? '5' : '',
  };
  const values = {
    URAI_SOURCE_SHA: env.TARGET_SHA, URAI_PRIVATE_SOURCE_TRANSCRIPTION_ENABLED: env.ENABLE_TRANSCRIPTION,
    URAI_PRIVATE_LIFE_MODEL_EXECUTION_ENABLED: env.ENABLE_LIFE_MODEL,
    URAI_PRIVATE_PROVIDER_SPENDING_AUTHORITY_REF: env.SPENDING_AUTHORITY_REF,
    URAI_PRIVATE_SOURCE_TRANSCRIPTION_AUTHORITY_REF: env.TRANSCRIPTION_AUTHORITY_REF,
    URAI_PRIVATE_LIFE_MODEL_EXECUTION_AUTHORITY_REF: env.LIFE_MODEL_AUTHORITY_REF,
    PRIVATE_SOURCE_REF_RESOLVER_URL: env.URL, PRIVATE_SOURCE_ALLOWED_BUCKET: env.PRIVATE_SOURCE_ALLOWED_BUCKET,
    URAI_LIFE_MODEL_EXTRACTOR_MODEL: env.LIFE_MODEL_EXTRACTOR_MODEL, URAI_PRIVATE_SOURCE_DIARIZATION_MODEL: env.DIARIZATION_MODEL,
  };
  const entries = Object.entries(values).map(([name, value]) => ({ name, value }));
  const addSecret = (name, secretName, key) => entries.push({ name, valueFrom: { secretKeyRef: { name: secretName, key } } });
  if (transcription) addSecret('PRIVATE_SOURCE_TRANSCRIBE_TOKEN', env.TRANSCRIBE_SECRET, env.TRANSCRIBE_TOKEN_VERSION);
  if (lifeModel) addSecret('PRIVATE_SOURCE_INDEX_TOKEN', env.INDEX_SECRET, env.INDEX_TOKEN_VERSION);
  if (transcription || lifeModel) addSecret('OPENAI_API_KEY', env.OPENAI_SECRET_NAME, env.OPENAI_SECRET_VERSION);
  const revision = {
    metadata: { labels: { 'urai-source-sha': env.TARGET_SHA, 'urai-environment': 'staging',
      'urai-paid-execution': transcription || lifeModel ? 'enabled' : 'disabled' } },
    spec: { serviceAccountName: env.EXPECTED_SERVICE_ACCOUNT, containers: [{ env: entries }] },
    status: { imageDigest: env.EXPECTED_IMAGE_DIGEST },
  };
  return { env, revision, entries };
}
function verifyReadback(fixture) {
  vm.runInNewContext(verifier, { process: { env: { ...fixture.env, REVISION_JSON: JSON.stringify(fixture.revision) } } });
}
let readbackCases = 0;
for (const transcription of [false, true]) for (const lifeModel of [false, true]) {
  assert.doesNotThrow(() => verifyReadback(readbackFixture(transcription, lifeModel))); readbackCases++;
}
for (const name of ['PRIVATE_SOURCE_TRANSCRIBE_TOKEN', 'PRIVATE_SOURCE_INDEX_TOKEN', 'OPENAI_API_KEY']) {
  for (const field of ['name', 'key']) {
    const fixture = readbackFixture();
    fixture.entries.find(entry => entry.name === name).valueFrom.secretKeyRef[field] = field === 'name' ? 'foreign-secret' : '99';
    assert.throws(() => verifyReadback(fixture), /activation readback mismatch/); readbackCases++;
  }
  const fixture = readbackFixture();
  fixture.entries.find(entry => entry.name === name).valueFrom.secretKeyRef.key = 'latest';
  assert.throws(() => verifyReadback(fixture), /activation readback mismatch/); readbackCases++;
  const disabled = readbackFixture(false, false);
  disabled.entries.push({ name, valueFrom: { secretKeyRef: { name: 'foreign-secret', key: '1' } } });
  assert.throws(() => verifyReadback(disabled), /secret not removed/); readbackCases++;
}
for (const mutate of [
  fixture => { fixture.revision.spec.serviceAccountName = 'foreign-runtime'; },
  fixture => { fixture.revision.status.imageDigest = 'sha256:' + 'c'.repeat(64); },
  fixture => { fixture.revision.metadata.labels['urai-source-sha'] = 'd'.repeat(40); },
  fixture => { fixture.revision.metadata.labels['urai-environment'] = 'production'; },
]) {
  const fixture = readbackFixture(); mutate(fixture);
  assert.throws(() => verifyReadback(fixture), /activation readback mismatch/); readbackCases++;
}
console.log(`[PASS] ${readbackCases} actual workflow readback cases: exact secret names/versions, disabled secret removal and source/image/runtime identity`);
console.log('[PASS] PRIVATE_PROVIDER_ACTIVATION_CONTRACT');
