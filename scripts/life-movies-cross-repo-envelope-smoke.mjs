#!/usr/bin/env node
/** R345 cross-repository source contract. Synthetic only; not a render authorization.
 * Required env: URAI_JOBS_SHA, URAI_STUDIO_DIR, URAI_STUDIO_SHA,
 * URAI_PRIVACY_DIR, URAI_PRIVACY_SHA. Fail closed on unpinned or dirty sources. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
const jobsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireFn = createRequire(join(jobsRoot, 'functions/package.json'));
const ts = requireFn('typescript'), zod = requireFn('zod');
function checkout(path, sha, name) {
  assert.ok(path && /^[0-9a-f]{40}$/.test(sha || ''), name + ': exact SHA required');
  const root = resolve(path);
  assert.equal(lstatSync(root).isSymbolicLink(), false, name + ': linked checkout');
  assert.equal(realpathSync(root), root, name + ': noncanonical checkout');
  function git(...args) { return execFileSync('git', ['-C', root, ...args], {encoding:'utf8', timeout:10000}).trim(); }
  assert.equal(git('rev-parse', '--show-toplevel'), root, name + ': wrong checkout root');
  assert.equal(git('rev-parse', 'HEAD'), sha, name + ': stale commit');
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', name + ': tracked source modified');
  return root;
}
const jobs=checkout(jobsRoot,process.env.URAI_JOBS_SHA,'Jobs');
const studio=checkout(process.env.URAI_STUDIO_DIR,process.env.URAI_STUDIO_SHA,'Studio');
const privacy=checkout(process.env.URAI_PRIVACY_DIR,process.env.URAI_PRIVACY_SHA,'Privacy');
function source(path) {
  const js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  const realm={module:m,exports:m.exports,Buffer,URL,Error,require(n) {
    if (n==='node:crypto') return requireFn(n);
    if (n==='zod') return zod;
    throw Error('unexpected import '+n);
  }};
  runInNewContext(js,realm,{filename:path,timeout:5000});
  // The production boundary deserializes JSON in Privacy's own JavaScript
  // realm. The strict receipt verifier intentionally rejects foreign-realm
  // prototypes, so simulate that actual wire boundary rather than passing
  // a foreign in-process fixture as though it were a Firestore object.
  if(path.endsWith('/life-movie-scoped-receipt.ts')) {
    runInNewContext('module.exports.parseWireData = text => JSON.parse(text)',realm,
      {filename:path,timeout:5000});
  }
  return m.exports;
}
const S=source(join(studio,'apps/studio/lib/studio-life-movie-jobs-bridge.ts'));
const J=source(join(jobs,'functions/src/jobs/studioLifeMovieContract.ts'));
const P=source(join(privacy,'functions/src/life-movie-scoped-receipt.ts'));
const G=source(join(jobs,'functions/src/privacy/lifeMovieConsentGate.ts'));
let n=0;const test=(title,fn)=>{fn();n++;console.log('PASS '+title)};
const input={
 tenantId:'tenant-1',projectId:'movie-1',
 sceneTruthReceiptRef:'str_'+'A'.repeat(20)+'_'+'a'.repeat(10)+'_'+'B'.repeat(44),
 sceneTruthDigest:'a'.repeat(64),
 sources:[{id:'source-1',bucket:'sample-bucket',objectPath:'tenants/tenant-1/original.mp4',generation:'123456789',
 mimeType:'video/mp4',provenance:'original-source',sourceRefs:[' source-ref-1 '],consentRef:'consent-1',ownerOrRightsRef:'rights-1'}],
 timeline:[{sourceId:'source-1',startMs:0,endMs:2000,sourceStartMs:0}],
 audioCues:[{sourceId:'source-1',role:'ambience',startMs:0,endMs:2000,sourceStartMs:500}],
 width:1280,height:720,fps:30
};
const envelope=S.buildJobsLifeMovieEnvelope(input);
const parsed=J.StudioLifeMovieCreateRequestSchema.safeParse({
 tenantId:input.tenantId,userId:'owner-1',action:'create',idempotencyKey:envelope.idempotencyKey,
 consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:'e'.repeat(64)},payload:envelope.payload
});
test('Studio envelope accepted by Jobs original schema',()=>assert.equal(parsed.success,true,JSON.stringify(parsed.error?.issues)));
const payload=parsed.data.payload;
test('Jobs recomputes Studio plan digest',()=>assert.equal(J.assertStudioLifeMovieRenderPlanDigest(payload).renderPlanDigest,envelope.payload.renderPlanDigest));
test('Jobs tenant and output path match',()=>assert.equal(J.assertLifeMovieTenantPaths(payload,input.tenantId).projectId,input.projectId));
const studioScope=S.deriveStudioLifeMovieRenderScope(envelope.payload),jobsScope=J.deriveStudioLifeMovieRenderScope(payload);
test('Studio and Jobs render scopes agree',()=>assert.deepEqual(JSON.parse(JSON.stringify(studioScope)),JSON.parse(JSON.stringify(jobsScope))));
const receipt={
 uid:'owner-1',tenantId:input.tenantId,purpose:'life-movie.render',consentTier:'C6',status:'granted',
 policyVersion:'1.1.0',expiresAt:'2026-11-03T14:00:00.000Z',surface:'movie-selection',
 jurisdiction:'US',noticeVersion:'v1',noticeHash:'b'.repeat(64),evidenceHash:'c'.repeat(64),
 renderScope:studioScope,updatedAt:'2026-11-02T14:00:00.000Z'
};
const receiptHash=P.hashLifeMovieScopedReceipt(receipt),stored={...receipt,receiptHash};
const expected={subjectUid:receipt.uid,tenantId:receipt.tenantId,decisionReceiptId:receiptHash,renderScope:jobsScope};
const wire = value => P.parseWireData(JSON.stringify(value));
const privacyStored=wire(stored);
test('Privacy validates JSON-deserialized Studio+Jobs scope',()=>assert.equal(
 P.verifiesLifeMovieScopedReceipt(privacyStored,wire(expected)),true));
test('Privacy rejects foreign-realm in-process objects',()=>assert.equal(
 P.verifiesLifeMovieScopedReceipt(stored,expected),false));
for(const field of ['generation','objectPath','consentRef','ownerOrRightsRef','provenance']) {
 const altered=structuredClone(payload);altered.sources[0][field]+='x';
 test(field+' mutation invalidates plan digest',()=>assert.throws(()=>J.assertStudioLifeMovieRenderPlanDigest(altered),/digest_mismatch/));
 test(field+' mutation invalidates Privacy receipt',()=>assert.equal(P.verifiesLifeMovieScopedReceipt(privacyStored,wire({
 ...expected,renderScope:J.deriveStudioLifeMovieRenderScope(altered)
 })),false));
}
test('cross-tenant output denied',()=>assert.throws(()=>J.assertLifeMovieTenantPaths(payload,'tenant-2'),/outside_tenant/));
for(const [label,change] of [
 ['owner mismatch',{subjectUid:'owner-2'}],['tenant mismatch',{tenantId:'tenant-2'}],
 ['receipt mismatch',{decisionReceiptId:'0'.repeat(64)}],
 ['source mismatch',{renderScope:{...jobsScope,sourceSetDigest:'0'.repeat(64)}}]
]) test(label+' rejected',()=>assert.equal(P.verifiesLifeMovieScopedReceipt(privacyStored,wire({...expected,...change})),false));
test('Jobs consent authority remains off',()=>assert.equal(G.lifeMovieConsentAuthorityAvailable(),false));
test('Jobs life movie stays deferred',()=>assert.equal(G.deferLifeMovieJob({jobType:'studio.render.video'}),true));
console.log('R345_CROSS_REPO_ENVELOPE_PASS '+n+'/'+n);
console.log('REVISIONS Jobs='+process.env.URAI_JOBS_SHA+' Studio='+process.env.URAI_STUDIO_SHA+' Privacy='+process.env.URAI_PRIVACY_SHA);
console.log('SYNTHETIC ONLY - NO IAM, LIVE CONSENT, RENDER OR RELEASE');
