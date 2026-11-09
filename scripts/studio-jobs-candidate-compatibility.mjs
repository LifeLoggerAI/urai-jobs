#!/usr/bin/env node
// Candidate-only, source-executable Studio -> Jobs compatibility proof.
// Read exact checked-out owner implementations; never admit a candidate pin here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const candidateSha = process.env.TARGET_SHA || '';
const studioSha = process.env.URAI_STUDIO_CONSUMER_SHA || '';
const studioRoot = process.env.URAI_STUDIO_CONSUMER_ROOT || '';
assert.match(candidateSha,/^[0-9a-f]{40}$/);
assert.match(studioSha,/^[0-9a-f]{40}$/);
assert.ok(studioRoot && path.isAbsolute(studioRoot),'Studio exact-source root required');
const require = createRequire(new URL('../functions/package.json',import.meta.url));
const ts = require('typescript');
const {z} = require('zod');
const transpile = source => ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const source = (file) => fs.readFileSync(file,'utf8');
const compile = (file, localRequire) => {
  const exports={};
  vm.runInNewContext(transpile(source(file)),{
    exports,require:localRequire, Buffer, console, process,
    setTimeout,clearTimeout
  },{filename:file,timeout:10000});
  return exports;
};
const functionsDir = path.resolve('functions/src/jobs');
const studioPath=path.join(studioRoot,'apps/studio/lib/studio-life-movie-longform-contract.ts');
const studio = compile(studioPath,require);
const base=compile(path.join(functionsDir,'studioLifeMovieContract.ts'),require);
const jobs=compile(path.join(functionsDir,'studioLifeMovieLongformContract.ts'),
  (name) => name==='./studioLifeMovieContract.js' ? base : require(name));
const bridgeSource=source(path.join(functionsDir,'studioLifeMovieLongformBridge.ts'));
const start=bridgeSource.indexOf('const IdentitySchema =');
const end=bridgeSource.indexOf('function productionRuntime()',start);
assert.ok(start>0 && end>start,'Could not locate exact Jobs HTTP request parsers');
const schemas=vm.runInNewContext(bridgeSource.slice(start,end)+
  '\n({ CreateSchema, PlanActionSchema, DeliverSchema, RequestSchema })',{
  z,StudioLifeMovieLongformPayloadSchema:jobs.StudioLifeMovieLongformPayloadSchema
},{timeout:10000});
assert.equal(studio.STUDIO_LONGFORM_JOBS_CONTRACT.jobsSourceSha,
  '9d29be1bcd3a45a4b9a743df9c9706c00811f38b',
  'Previously approved Jobs main pin must remain untouched');
assert.equal(studio.STUDIO_LONGFORM_JOBS_CONTRACT.schemaVersion,
  'urai-life-movie-longform-v1');

let passed=0;const checks=[];
const check=(name,run)=>{run();passed++;checks.push(name)};
const copy=(value)=>JSON.parse(JSON.stringify(value));
const identity={tenantId:'studio-fixture',userId:'owner-fixture'};
const fixture={
  action:'create',projectId:'movie-fixture',
  sceneTruthReceiptRef:'str_'+'a'.repeat(16)+'_'+'b'.repeat(8)+'_'+'C'.repeat(40),
  sceneTruthDigest:'d'.repeat(64),
  consent:{purpose:'life-movie.render',policyVersion:'fixture-v1',
    decisionReceiptId:'synthetic-consent-approval'},
  width:640,height:360,fps:30,
  sources:[
    {id:'visual-1',bucket:'private-fixture-bucket',
      objectPath:'tenants/studio-fixture/source/visual.mp4',
      mimeType:'video/mp4',provenance:'original-source',
      sourceRefs:['synthetic-camera-source'],consentRef:'consent-fixture',
      ownerOrRightsRef:'rights-fixture'},
    {id:'narrator-1',bucket:'private-fixture-bucket',
      objectPath:'tenants/studio-fixture/source/narration.wav',
      mimeType:'audio/wav',provenance:'generated',
      sourceRefs:['synthetic-voice-only'],consentRef:'consent-fixture',
      ownerOrRightsRef:'rights-fixture'}
  ],
  timeline:[
    {sourceId:'visual-1',startMs:0,endMs:12000,sourceStartMs:250},
    {sourceId:'visual-1',startMs:12000,endMs:21000,sourceStartMs:12250}
  ],
  audioCues:[{sourceId:'narrator-1',role:'narration',
    startMs:100,endMs:11000,sourceStartMs:0,gainDb:0}],
  subtitleText:'1\n00:00:00,000 --> 00:00:04,000\nSynthetic line one\n\n'+
    '2\n00:00:12,000 --> 00:00:17,000\nSynthetic line two\n'
};
const request=studio.buildStudioLongformRequest(copy(fixture),identity);
check('actual_Studio_builder_to_actual_Jobs_create_Zod_parser',()=>{
  assert.equal(request.action,'create');
  assert.equal(schemas.CreateSchema.safeParse(request).success,true);
  assert.equal(schemas.RequestSchema.safeParse(request).success,true);
  assert.equal(request.tenantId,identity.tenantId);
  assert.equal(request.userId,identity.userId);
  assert.equal(request.payload.providerGenerationAuthorized,false);
  assert.equal(request.payload.publicReleaseAuthorized,false);
  assert.equal(request.payload.spatialRequired,false);
});
check('actual_Jobs_payload_tenant_source_and_output_authority',()=>{
  const parsed=jobs.StudioLifeMovieLongformPayloadSchema.parse(request.payload);
  const admitted=jobs.assertLifeMovieLongformTenantPaths(parsed,identity.tenantId);
  assert.equal(admitted.outputPrefix,'tenants/studio-fixture/life-movies/movie-fixture/');
});
check('actual_Jobs_greedy_child_segments_audio_offsets_and_SRT_timing',()=>{
  const segments=jobs.planLifeMovieLongformSegments(request.payload);
  assert.equal(segments.length,2);
  assert.equal(segments[0].startMs,0);assert.equal(segments[0].endMs,12000);
  assert.equal(segments[1].startMs,12000);assert.equal(segments[1].endMs,21000);
  assert.equal(segments[0].payload.timeline[0].sourceStartMs,250);
  assert.equal(segments[1].payload.timeline[0].sourceStartMs,12250);
  assert.equal(segments[0].payload.audioCues[0].sourceId,'narrator-1');
  assert.ok(segments[0].payload.subtitleText.includes('Synthetic line one'));
  assert.ok(segments[1].payload.subtitleText.includes('Synthetic line two'));
  for(const segment of segments){
    assert.equal(base.StudioLifeMovieRenderPayloadSchema.safeParse(segment.payload).success,true);
  }
});
check('actual_Jobs_plan_action_envelopes_positive_and_negative',()=>{
  const validId='lmp_'+'a'.repeat(24);
  for(const action of ['status','cancel','playback','download','resume','assemble','delete-output']){
    const object=studio.buildStudioLongformRequest({action,planId:validId},identity);
    assert.equal(schemas.PlanActionSchema.safeParse(object).success,true,action);
  }
  assert.equal(schemas.RequestSchema.safeParse({action:'deliver',planId:validId,
    tenantId:identity.tenantId,userId:identity.userId}).success,false);
  assert.equal(schemas.RequestSchema.safeParse({...request,extra:'unexpected'}).success,false);
  assert.equal(schemas.RequestSchema.safeParse({...request,idempotencyKey:'bad'}).success,false);
  assert.equal(schemas.RequestSchema.safeParse({...request,consent:{...request.consent,purpose:'analytics'}}).success,false);
});
check('wrong_tenant_and_disallowed_generation_fail_closed',()=>{
  const forged=copy(request.payload);
  forged.sources[0].objectPath='tenants/foreign-studio/visual.mp4';
  assert.throws(()=>jobs.assertLifeMovieLongformTenantPaths(forged,identity.tenantId),
    /life_movie_longform_source_outside_tenant/);
  const escape=copy(request.payload);
  escape.outputPrefix='tenants/foreign-studio/life-movies/movie-fixture/';
  assert.throws(()=>jobs.assertLifeMovieLongformTenantPaths(escape,identity.tenantId),
    /life_movie_longform_output_outside_tenant_project/);
  const paid=copy(request);paid.payload.providerGenerationAuthorized=true;
  assert.equal(schemas.RequestSchema.safeParse(paid).success,false);
  const publicRelease=copy(request);publicRelease.payload.publicReleaseAuthorized=true;
  assert.equal(schemas.RequestSchema.safeParse(publicRelease).success,false);
});
check('invalid_source_time_overlap_and_oversized_interval_denied',()=>{
  const still=copy(fixture);still.sources[0].mimeType='image/png';
  assert.throws(()=>studio.buildStudioLongformRequest(still,identity),
    /longform_image_source_start_must_be_zero/);
  const oversized=copy(fixture);oversized.timeline[0].endMs=16000;
  assert.throws(()=>studio.buildStudioLongformRequest(oversized,identity),
    /longform_pre_cut_source_required/);
  const invalid=copy(request.payload);invalid.timeline[0].endMs=16000;
  assert.equal(jobs.StudioLifeMovieLongformPayloadSchema.safeParse(invalid).success,false);
  const badCue=copy(request.payload);badCue.audioCues[0].endMs=22000;
  assert.equal(jobs.StudioLifeMovieLongformPayloadSchema.safeParse(badCue).success,false);
});
check('cross_tenant_and_revoked_consent_cannot_enter_Studio_builder',()=>{
  const outside=copy(fixture);
  outside.sources[0].objectPath='tenants/foreign/visual.mp4';
  assert.throws(()=>studio.buildStudioLongformRequest(outside,identity),
    /longform_source_outside_tenant/);
  const wrong=copy(fixture);wrong.consent.purpose='marketing';
  assert.throws(()=>studio.buildStudioLongformRequest(wrong,identity),
    /longform_render_consent_required/);
});
const receipt={
  schemaVersion:'urai-studio-jobs-candidate-parser-compatibility-1',
  exactStudioSourceSha:studioSha,exactJobsCandidateSha:candidateSha,
  studioAdmittedJobsMainSha:studio.STUDIO_LONGFORM_JOBS_CONTRACT.jobsSourceSha,
  executableTestsPassed:passed,tests:checks,
  whatExecuted:'actual Studio TypeScript request builder; actual candidate Jobs TypeScript Zod schemas, tenant path validator and child segment planner',
  httpHandlerExecuted:false,transactionalConsentAndRevocationExecuted:false,
  sceneTruthSignatureValidated:false,workerDispatched:false,
  sourcePinChanged:false,authenticatedStagingAccepted:false,
  candidateJobsSourceAdmitted:false,providerSpending:false
};
process.stdout.write(JSON.stringify(receipt,null,2)+'\n');
