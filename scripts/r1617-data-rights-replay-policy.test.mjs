import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {isCompletedDataRightsReplayReceipt} from '../functions/lib/functions/privacy/dataRightsReplayPolicy.js';

const checks=[];
const mark=(name,fn)=>{fn();checks.push(name)};
const requestId='r1617-synthetic-request-id';
const ownerUid='r1617-disposable-owner';
const binding={requestId,ownerUid,requestType:'DELETE'};
const result={jobsAnonymized:1,queueDeletes:1,logDeletes:0,unresolvedDomains:['provider-side-derivatives']};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ownerHash=createHash('sha256').update(ownerUid).digest('hex');
const receipt={
 event:'DATA_RIGHTS_EXECUTION_FINISHED',
 schemaVersion:'urai-jobs-data-rights-execution-v1',
 requestId,requestType:'DELETE',ownerHash,
 terminalState:'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED',
 result,resultDigest:digest(result),
};
mark('valid completed scope receipt',()=>assert.equal(isCompletedDataRightsReplayReceipt(receipt,binding),true));
mark('started is not complete',()=>assert.equal(isCompletedDataRightsReplayReceipt({...receipt,event:'DATA_RIGHTS_EXECUTION_STARTED'},binding),false));
mark('failed is not complete',()=>assert.equal(isCompletedDataRightsReplayReceipt({...receipt,event:'DATA_RIGHTS_EXECUTION_FAILED'},binding),false));
mark('other owner rejected',()=>assert.equal(isCompletedDataRightsReplayReceipt(receipt,{...binding,ownerUid:'other'}),false));
mark('other request rejected',()=>assert.equal(isCompletedDataRightsReplayReceipt(receipt,{...binding,requestId:'other'}),false));
mark('other type rejected',()=>assert.equal(isCompletedDataRightsReplayReceipt(receipt,{...binding,requestType:'EXPORT'}),false));
mark('altered scope rejected',()=>assert.equal(isCompletedDataRightsReplayReceipt({...receipt,result:{...result,jobsAnonymized:99}},binding),false));
mark('altered digest rejected',()=>assert.equal(isCompletedDataRightsReplayReceipt({...receipt,resultDigest:'0'.repeat(64)},binding),false));
mark('wrong final state rejected',()=>assert.equal(isCompletedDataRightsReplayReceipt({...receipt,terminalState:'COMPLETED'},binding),false));
mark('wrong schema rejected',()=>assert.equal(isCompletedDataRightsReplayReceipt({...receipt,schemaVersion:'v0'},binding),false));
mark('blank object rejected',()=>assert.equal(isCompletedDataRightsReplayReceipt({},binding),false));
const exportResult={recordCount:1,sha256:'f'.repeat(64)};
const exportReceipt={...receipt,requestType:'EXPORT',terminalState:'PROTECTED_STAGING_EXPORT_READY_CENTRAL_DELIVERY_REQUIRED',result:exportResult,resultDigest:digest(exportResult)};
mark('valid export scope receipt',()=>assert.equal(isCompletedDataRightsReplayReceipt(exportReceipt,{...binding,requestType:'EXPORT'}),true));
const source=readFileSync(new URL('../functions/src/privacy/dataRightsExecution.ts',import.meta.url),'utf8');
mark('replay requires finished receipt',()=>assert.match(source,/isCompletedDataRightsReplayReceipt\(priorExecution\.data\(\)/));
mark('replay requires matching review-state',()=>assert.match(source,/record\.executionState !== priorExecution\.data\(\)\?\.terminalState/));
mark('no success on incomplete retry',()=>assert.match(source,/Prior data-rights execution is unfinished or its receipt does not match/));
mark('not global deletion',()=>assert.doesNotMatch(source,/status: 'COMPLETED'/));
console.log('R1617_JOBS_DATA_RIGHTS_REPLAY_GUARD_PASS '+JSON.stringify({checksPassed:checks.length,checks}));
