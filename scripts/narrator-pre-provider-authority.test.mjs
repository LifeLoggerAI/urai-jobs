import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

// The full checked-in handler is extracted at runtime using TypeScript AST.
// Service calls are synthetic; no TTS provider, GCS, IAM or Firebase is used.
const ts = createRequire(new URL('../workers/narrator-worker/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../workers/narrator-worker/src/handlers/narrator-tts.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('narrator-tts.ts', source, ts.ScriptTarget.Latest, true);
const node = ast.statements.find(x => ts.isFunctionDeclaration(x) && x.name?.text === 'handleNarratorTts');
assert.ok(node?.body, 'missing checked-in narrator handler');
const compiled = ts.transpileModule(node.getText(ast) + '\nmodule.exports = { handleNarratorTts };', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
});
assert.equal((compiled.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);

function fixture({ denyReservation = false, denyBeforeUpload = false, providerFailure = false, provider = 'google', format = 'MP3',
  returnedExtension, sealFailure = false } = {}) {
  const events = [];
  const module = { exports: {} };
  const ext = returnedExtension ?? (provider === 'elevenlabs' || format !== 'OGG_OPUS' ? 'mp3' : 'ogg');
  let uuid = 0;
  const generated = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const file = {
    save: async (_bytes, opts) => { events.push('upload'); assert.equal(opts.preconditionOpts.ifGenerationMatch, 0); },
    getMetadata: async () => { events.push('metadata'); return [{ generation:'42', metadata:{ uraiUploadId: generated[1] } }]; },
    delete: async () => { events.push('delete'); },
  };
  const handlerCtx = {
    module, exports: module.exports, Buffer, String, Number, Error,
    BUCKET_NAME: 'synthetic-audio-bucket',
    console: { log: () => {}, error: () => {} },
    randomUUID: () => generated[uuid++],
    storage: { bucket: () => ({ file: () => file }) },
    normalizePayload: value => value,
    normalizeAudioEncoding: value => value === 'OGG_OPUS' ? 'OGG_OPUS' : 'MP3',
    trustedProviderAuthorization: () => ({ provenanceRef: 'synthetic-provider-auth' }),
    storytimeNarratorWriteIdentity: () => ({ reservationId:'synthetic-reservation' }),
    reserveStorytimeNarratorWrite: async () => {
      events.push('reserve');
      if (denyReservation) throw new Error('storytime_narrator_write_authority_revoked');
    },
    assertStorytimeNarratorWriteActiveBeforeUpload: async () => {
      events.push('recheck');
      if (denyBeforeUpload) throw new Error('storytime_narrator_write_authority_revoked_before_upload');
    },
    sealStorytimeNarratorWrite: async () => {
      events.push('seal');
      if (sealFailure) throw new Error('storytime_narrator_write_authority_revoked_after_upload');
    },
    noteStorytimeNarratorWriteCompensation: async () => events.push('compensated'),
    synthesizeGoogle: async () => {
      events.push('google-provider');
      if (providerFailure) throw new Error('synthetic_provider_error');
      return { audioBuffer: Buffer.from('fake-audio'), fileExtension:ext, mimeType:ext==='ogg'?'audio/ogg':'audio/mpeg', provider:'google', modelId:'synthetic-google', voiceId:'synthetic-voice' };
    },
    synthesizeElevenLabs: async () => {
      events.push('elevenlabs-provider');
      if (providerFailure) throw new Error('synthetic_provider_error');
      return { audioBuffer: Buffer.from('fake-audio'), fileExtension:ext, mimeType:'audio/mpeg', provider:'elevenlabs', modelId:'synthetic-elevenlabs', voiceId:'synthetic-voice' };
    },
  };
  vm.runInNewContext(compiled.outputText, handlerCtx);
  const job = { jobId:'synthetic-job', ownerUid:'synthetic-owner', payload:{text:'synthetic private script',provider,format,outputPrefix:'storytime/synthetic-owner/session/script'} };
  return { events, job, run: () => module.exports.handleNarratorTts(job) };
}

test('denied reservation must prevent all private text provider disclosure', async () => {
  const f = fixture({denyReservation:true});
  await assert.rejects(f.run(),/storytime_narrator_write_authority_revoked/);
  assert.deepEqual(f.events,['reserve']);
});
test('normal Google MP3 path reserves before provider and upload', async () => {
  const f=fixture(); const result=await f.run();
  assert.deepEqual(f.events,['reserve','google-provider','recheck','upload','metadata','seal']);
  assert.equal(result.artifactGeneration,'42');
  assert.match(result.artifactPath,/\.mp3$/);
});
test('Google OGG path reserves before provider and honors filename format', async () => {
  const f=fixture({format:'OGG_OPUS'}); const r=await f.run();
  assert.deepEqual(f.events,['reserve','google-provider','recheck','upload','metadata','seal']);
  assert.match(r.artifactPath,/\.ogg$/);
});
test('authorized ElevenLabs also reserves before external provider', async () => {
  const f=fixture({provider:'elevenlabs'}); const result=await f.run();
  assert.deepEqual(f.events,['reserve','elevenlabs-provider','recheck','upload','metadata','seal']);
  assert.match(result.artifactPath,/\.mp3$/);
});
test('provider exception never causes a storage upload', async () => {
  const f=fixture({providerFailure:true});
  await assert.rejects(f.run(),/synthetic_provider_error/);
  assert.deepEqual(f.events,['reserve','google-provider']);
});
test('unexpected returned extension cannot upload a mismatched object', async () => {
  const f=fixture({returnedExtension:'ogg'});
  await assert.rejects(f.run(),/narrator_audio_format_mismatch/);
  assert.deepEqual(f.events,['reserve','google-provider']);
});
test('post-upload lease refusal attempts exact-version compensation', async () => {
  const f=fixture({sealFailure:true});
  await assert.rejects(f.run(),/storytime_narrator_write_authority_revoked_after_upload/);
  assert.equal(f.events[0],'reserve');
  assert.deepEqual(f.events.slice(0,6), ['reserve','google-provider','recheck','upload','metadata','seal']);
  assert.ok(f.events.includes('delete'));
});

test('consent revoked during synthesis prevents any Storage upload', async () => {
  const f=fixture({denyBeforeUpload:true});
  await assert.rejects(f.run(),/storytime_narrator_write_authority_revoked_before_upload/);
  assert.deepEqual(f.events,['reserve','google-provider','recheck']);
});
test('ElevenLabs authority loss after synthesis prevents upload', async () => {
  const f=fixture({provider:'elevenlabs',denyBeforeUpload:true});
  await assert.rejects(f.run(),/storytime_narrator_write_authority_revoked_before_upload/);
  assert.deepEqual(f.events,['reserve','elevenlabs-provider','recheck']);
});
