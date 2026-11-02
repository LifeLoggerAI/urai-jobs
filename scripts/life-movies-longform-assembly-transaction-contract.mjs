import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source=readFileSync(new URL('../functions/src/jobs/studioLifeMovieLongformBridge.ts',import.meta.url),'utf8');
const start=source.indexOf('async function assemblePlan(');
const end=source.indexOf('async function readPlanPlayback(',start);
assert.ok(start>=0&&end>start,'source-bound assembly function required');
const fn=source.slice(start,end);
test('assembly transaction reads current consent and plan before writes',()=>{
  assert.match(fn,/transaction\.get\(consentBlockRef\(plan\.ownerUid, plan\.consent\.purpose\)\)/);
  assert.match(fn,/transaction\.get\(planRef\(planId\)\)/);
  assert.match(fn,/assertJobConsentBlockClear\(liveConsentBlock, 'life_movie_longform_consent_revoked'\)/);
  assert.ok(fn.indexOf('assertJobConsentBlockClear(liveConsentBlock')<fn.indexOf('transaction.create(jobDoc(jobId)'), 'consent veto precedes assembly writes');
});
test('assembly rereads all child jobs before publishing',()=>{
  assert.match(fn,/transaction\.getAll\(\.\.\.plan\.childJobIds\.map\(\(childId\) => jobDoc\(childId\)\)\)/);
  assert.match(fn,/if \(currentChild\.status !== 'SUCCESS'\)/);
  assert.match(fn,/assertBoundSegmentForUse\(currentPlan, currentChild, index\)/);
});
test('assembly rejects source drift and owner cancellation before dedupe',()=>{
  assert.match(fn,/assertPlanStructure\(currentPlan, planId\)/);
  assert.match(fn,/if \(currentPlan\.status === 'CANCELLED'\)/);
  for(const key of ['childJobIds','segments','consent','projectId','renderPlanDigest','sceneTruthDigest','sceneTruthReceiptRef','width','height','fps']) assert.ok(fn.includes('currentPlan.'+key),'missing '+key+' drift check');
  assert.ok(fn.indexOf('longform_plan_changed')<fn.indexOf('if (existing.exists)'),'no dedupe before plan verification');
});
test('assembly rereads selected outputs and consent before dedupe',()=>{
  for(const key of ['payload','output','consent'])assert.match(fn,new RegExp('isDeepStrictEqual\\(currentChild\\.'+key+', selectedChild\\.'+key+'\\)'));
  assert.ok(fn.indexOf('currentChildSnapshots.entries()')<fn.indexOf('if (existing.exists)'));
});
