import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const ts = createRequire(new URL('../functions/package.json', import.meta.url))('typescript');
const sourceFile = process.env.LIFE_MOVIE_PREFLIGHT_SOURCE || new URL('../functions/src/privacy/lifeMovieAdmissionPreflight.ts', import.meta.url);
const source = readFileSync(sourceFile, 'utf8');
const {outputText,diagnostics} = ts.transpileModule(source, {fileName:'lifeMovieAdmissionPreflight.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
assert.equal((diagnostics || []).filter(d=>d.category===ts.DiagnosticCategory.Error).length, 0);
const scope = {projectId:'film-1',renderPlanDigest:'a'.repeat(64),sourceSetDigest:'b'.repeat(64)};
const selection = {projectId:scope.projectId,renderPlanDigest:scope.renderPlanDigest,sources:[{id:'source-1',generation:'1793378565000001'}]};
const request={ownerUid:'owner-1',tenantId:'tenant-1',consent:{purpose:'life-movie.render',policyVersion:'1.1.0',decisionReceiptId:'c'.repeat(64)},selection};
const module={exports:{}};
vm.runInNewContext(outputText, {module,exports:module.exports,Date,Number,Array,Object,Reflect,Error,Promise,require(specifier){
  if(specifier==='node:crypto') return {randomUUID:()=> 'clock-race-correlation'};
  if(specifier==='../jobs/studioLifeMovieContract.js') return {deriveStudioLifeMovieRenderScope(value){assert.equal(value,selection);return scope}};
  throw Error('Unexpected import '+specifier);
}}, {filename:'lifeMovieAdmissionPreflight.js'});
const create = module.exports.createLifeMovieAdmissionPreflight;
const time = Date.parse('2026-11-01T14:00:00Z');
const rights = {ownerUid:request.ownerUid,tenantId:request.tenantId,renderScope:scope,rightsEventId:'rights-event-1'};
let assertions = 0;
function fixture({latency=5,misdated=false,excessive=false}={}) {
  let now=time,stage=0;
  const events=[];
  const verifier = create({nowMs:()=>now,
    async verifySourceRights() {
      stage++;
      events.push('rights-'+stage);
      now += excessive && stage===1 ? 31000 : latency;
      return {...rights,rightsEventId:'rights-event-'+stage,verifiedAt:new Date(misdated ? now+10_000 : now).toISOString()};
    },
    async getCurrentPrivacyDecision() {
      events.push('privacy');now+=latency;
      return {decisionEventId:'decision-1',evaluatedAt:new Date(now).toISOString()};
    },
  });
  return {verify:()=>verifier(request),events};
}
{
  const x=fixture();
  const accepted=await x.verify();
  assert.equal(accepted.rightsEventId,'rights-event-2');
  assert.deepEqual(x.events,['rights-1','privacy','rights-2']);
  assertions+=2;
}
{
  const x=fixture({misdated:true});
  await assert.rejects(()=>x.verify(),/life_movie_source_rights_unverified/);
  assert.deepEqual(x.events,['rights-1']);assertions+=2;
}
{
  const x=fixture({excessive:true});
  await assert.rejects(()=>x.verify(),/life_movie_source_rights_unverified/);
  assert.deepEqual(x.events,['rights-1']);assertions+=2;
}
console.log('[PASS] '+assertions+' asynchronous rights timestamp assertions; source-matched synthetic trust boundaries');
