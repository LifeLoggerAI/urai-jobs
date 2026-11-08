import test from 'node:test';
import assert from 'node:assert/strict';
import {serverLifeMovieOwnerOrgId,assertLifeMoviePlanCurrentOrg,assertLifeMovieJobPlanOrg} from '../functions/src/jobs/lifeMovieLongformOwnerOrg.ts';
const denied=/life_movie_owner_org_authority_unavailable/;
const jobDenied=/life_movie_job_org_binding_mismatch/;
test('server canonical owner scope',{concurrency:false},()=>{
  assert.equal(serverLifeMovieOwnerOrgId({orgId:' org-A '}),'org-A');
  assert.equal(serverLifeMovieOwnerOrgId({orgId:null}),null);
});
test('matching organization and truly unscoped legacy records',()=>{
  assert.doesNotThrow(()=>assertLifeMoviePlanCurrentOrg({orgId:'org-A'},{orgId:'org-A'}));
  assert.doesNotThrow(()=>assertLifeMovieJobPlanOrg({orgId:'org-A'},{orgId:'org-A'}));
  assert.doesNotThrow(()=>assertLifeMoviePlanCurrentOrg({},{}));
});
test('tenant transfer does not imply organization transfer permission',()=>{
  assert.throws(()=>assertLifeMoviePlanCurrentOrg({orgId:'org-A'},{orgId:'org-B'}),denied);
  assert.throws(()=>assertLifeMovieJobPlanOrg({orgId:'org-A'},{orgId:'org-B'}),jobDenied);
});
test('legacy unscoped plan and newly scoped owner denied',()=>{
  assert.throws(()=>assertLifeMoviePlanCurrentOrg({},{orgId:'org-A'}),denied);
});
test('scoped plan with removed owner organization denied',()=>{
  assert.throws(()=>assertLifeMoviePlanCurrentOrg({orgId:'org-A'},{}),denied);
});
test('scoped plan rejects missing/blank/foreign org children',()=>{
  for(const job of [{},{orgId:''},{orgId:'org-B'}])assert.throws(()=>assertLifeMovieJobPlanOrg({orgId:'org-A'},job),jobDenied);
});
test('malformed owner organizations fail closed',()=>{
 for(const orgId of [true,false,4,{},[],['org-A']]) assert.throws(()=>serverLifeMovieOwnerOrgId({orgId}),denied);
});
test('malformed persisted organizations fail closed',()=>{
 for(const orgId of [true,4,{},[],['org-A']])assert.throws(()=>assertLifeMoviePlanCurrentOrg({orgId},{orgId:'org-A'}),denied);
});
test('noncanonical stored organization rejects even if matching trimmed owner',()=>{
 assert.throws(()=>assertLifeMoviePlanCurrentOrg({orgId:' org-A '},{orgId:'org-A'}),denied);
 assert.doesNotThrow(()=>assertLifeMoviePlanCurrentOrg({orgId:'org-A'},{orgId:' org-A '}));
});
test('invalid organization syntax denied',()=>{
 for(const orgId of ['a/b','org\\bad','_leading','a'.repeat(130)])assert.throws(()=>serverLifeMovieOwnerOrgId({orgId}),denied);
});
test('inherited scope and accessor scope denied',()=>{
 const x=Object.create({orgId:'org-A'});assert.throws(()=>serverLifeMovieOwnerOrgId(x),denied);
 const y={};Object.defineProperty(y,'orgId',{get(){return 'org-A'}});assert.throws(()=>serverLifeMovieOwnerOrgId(y),denied);
});
test('invalid owner records denied',()=>{
 for(const val of [null,0,'org-A',[],new Date()])assert.throws(()=>serverLifeMovieOwnerOrgId(val),denied);
});
