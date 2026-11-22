import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalDataRightsDigest } from '../functions/lib/functions/privacy/dataRightsDigest.js';
import { isCompletedDataRightsReplayReceipt } from '../functions/lib/functions/privacy/dataRightsReplayPolicy.js';

const sameA={jobsAnonymized:1,queueDeletes:0,jobResultDeletes:2,logDeletes:0,
  unresolvedDomains:['provider-side-derivatives','cross-system-data-owned-by-other-urai-services']};
const sameB={unresolvedDomains:['provider-side-derivatives','cross-system-data-owned-by-other-urai-services'],
  logDeletes:0,jobResultDeletes:2,queueDeletes:0,jobsAnonymized:1};
assert.notEqual(JSON.stringify(sameA),JSON.stringify(sameB));
assert.equal(canonicalDataRightsDigest(sameA),canonicalDataRightsDigest(sameB));
console.log('R1625_CANONICAL_PASS','Firestore map-key reorder preserves owner result digest');
const uid='r1625-canonical-synthetic-owner',requestId='r1625-canonical-request';
const receipt={schemaVersion:'urai-jobs-data-rights-execution-v1',
  event:'DATA_RIGHTS_EXECUTION_FINISHED',requestId,requestType:'DELETE',
  ownerHash:createHash('sha256').update(uid).digest('hex'),
  terminalState:'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED',
  resultDigest:canonicalDataRightsDigest(sameA),result:sameB};
assert.equal(isCompletedDataRightsReplayReceipt(receipt,{ownerUid:uid,requestId,requestType:'DELETE'}),true);
console.log('R1625_CANONICAL_PASS','native replay accepts source-bound canonical digest');
assert.equal(isCompletedDataRightsReplayReceipt({...receipt,result:{...sameB,jobsAnonymized:99}},
  {ownerUid:uid,requestId,requestType:'DELETE'}),false);
assert.equal(isCompletedDataRightsReplayReceipt({...receipt,ownerHash:'a'.repeat(64)},
  {ownerUid:uid,requestId,requestType:'DELETE'}),false);
console.log('R1625_CANONICAL_PASS','tampering or owner substitution stays denied');
