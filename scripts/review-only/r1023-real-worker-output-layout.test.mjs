import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectWorkerOutputPath, DENIED } from './r1023-real-worker-output-layout.mjs';
const base = 'tenants/tenant1/life-movies/project1/';
const render = ['life-movie.mp4','life-movie.srt','life-movie.render-manifest.json'];
const finalKinds = ['life-movie-final.mp4','life-movie-final.srt','life-movie-final.assembly-manifest.json'];
const input = path => ({tenantId:'tenant1',projectId:'project1',attemptId:'attempt1',objectPath:path});
const denied = path => assert.throws(() => inspectWorkerOutputPath(input(path)), {message:DENIED}, path);
test('original worker still has hard-off checks in both upload helpers', () => {
  const code = readFileSync(new URL('../../workers/studio-worker/index.js',import.meta.url),'utf8');
  assert.equal((code.match(/assertPrivateOutputWriteAuthority\(\);/g)||[]).length,2);
  for(const name of [...render,...finalKinds]) assert.ok(code.includes('/'+name),name);
});
for(const kind of render) for(const prefix of ['','segments/','segments/segment42/']) {
  test('recognize review render '+prefix+kind, () => {
    const out=inspectWorkerOutputPath(input(base+prefix+'attempt-attempt1/'+kind));
    assert.equal(out.fileKind,kind); assert.equal(out.storageWriteAuthorized,false);
    assert.equal(out.deletionAcknowledged,false); assert.equal(out.providerProofAuthenticated,false);
  });
}
for(const kind of finalKinds) for(const prefix of ['final/','final/plan42/']) {
  test('recognize review final '+prefix+kind, () => {
    const out=inspectWorkerOutputPath(input(base+prefix+'attempt-attempt1/'+kind));
    assert.equal(out.stage,'final'); assert.equal(out.storageWriteAuthorized,false);
    assert.equal(out.deletionAcknowledged,false);
  });
}
for(const path of [
 base+'final/attempt-attempt1/life-movie.mp4',
 base+'segments/attempt-attempt1/life-movie-final.mp4',
 base+'attempt-attempt1/life-movie-final.mp4',
 base+'unknown/attempt-attempt1/life-movie.mp4',
 base+'segments/.hidden/attempt-attempt1/life-movie.mp4',
 base+'segments/segment42/extra/attempt-attempt1/life-movie.mp4',
 base+'segments//attempt-attempt1/life-movie.mp4',
 base+'segments/../attempt-attempt1/life-movie.mp4',
 base+'final/plan42/attempt-other/life-movie-final.mp4',
 base+'final/plan42/attempt-attempt1/life-movie-final.mp4/extra',
 base+'final/plan42/attempt-attempt1/evil.exe',
 base+'final/plan42/attempt-attempt1/life-movie-final.mp4\\evil',
 'tenants/tenant2/life-movies/project1/segments/attempt-attempt1/life-movie.mp4',
 'tenants/tenant1/life-movies/project2/final/attempt-attempt1/life-movie-final.mp4',
]) test('deny invalid '+path, () => denied(path));
test('reject caller injected privilege flags and malformed identity', () => {
 const v=input(base+'segments/attempt-attempt1/life-movie.mp4');
 for(const k of ['storageWriteAuthorized','releaseAuthorized','verifiedByCloud'])
  assert.throws(() => inspectWorkerOutputPath({...v,[k]:true}),{message:DENIED});
 assert.throws(() => inspectWorkerOutputPath({...v,attemptId:'../other'}),{message:DENIED});
});
