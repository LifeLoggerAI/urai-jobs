import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ConsentRevokedEventSchema, verifyNativeLineage } from '../functions/lib/functions/privacy/consentRevocation.js';
function sha(v) { return createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
function validV2() {
  const e={type:'consent.revoked.v2',schemaVersion:'consent.revoked.v1',consentRecordId:'record-one',uid:'synthetic-owner',purpose:'memory.storage',consentTier:'private',policyVersion:'v2',sourceReceiptHash:'a'.repeat(64),priorGrantReceiptHash:'b'.repeat(64),priorGrantEvidenceState:'present',revokedAt:'2026-11-19T18:00:00.000Z'};
  const eventId=sha({schemaVersion:e.schemaVersion,recordId:e.consentRecordId,uid:e.uid,purpose:e.purpose,consentTier:e.consentTier,policyVersion:e.policyVersion,receiptHash:e.sourceReceiptHash});
  return {...e,eventId,correlationId:eventId,integrityHash:sha({eventId,recordId:e.consentRecordId,uid:e.uid,purpose:e.purpose,priorGrantReceiptHash:e.priorGrantReceiptHash,priorGrantEvidenceState:e.priorGrantEvidenceState})};
}
test('genuine Privacy canonical outbox projection admits only matching lineage',()=>{
 const v=validV2(); assert.equal(ConsentRevokedEventSchema.safeParse(v).success,true); assert.equal(verifyNativeLineage(v),true);
});
for (const [name,patch] of [
 ['different source receipt',{sourceReceiptHash:'b'.repeat(64)}],
 ['different subject',{uid:'stranger'}],
 ['different consent record',{consentRecordId:'other-record'}],
 ['different purpose',{purpose:'location.context'}],
 ['different event ID',{eventId:'c'.repeat(64)}],
 ['different correlation',{correlationId:'c'.repeat(64)}],
 ['forged integrity hash',{integrityHash:'c'.repeat(64)}],
 ['different policy version',{policyVersion:'v3'}],
 ['different prior grant receipt',{priorGrantReceiptHash:'c'.repeat(64)}],
 ['different prior grant state',{priorGrantEvidenceState:'missing_or_invalid'}]
]) test('v2 rejects '+name,()=>assert.equal(verifyNativeLineage({...validV2(),...patch}),false));
test('v2 envelope is strict',()=>assert.equal(ConsentRevokedEventSchema.safeParse({...validV2(),untrusted:true}).success,false));
test('v1 admission preserved',()=>assert.equal(ConsentRevokedEventSchema.safeParse({type:'consent.revoked.v1',eventId:'legacy-event',ownerUid:'owner',purpose:'memory.storage',policyVersion:'v1',decisionReceiptId:'legacy-receipt',correlationId:'legacy-correlation',revokedAt:'2026-11-19T18:00:00.000Z'}).success,true));


test('valid revoked without earlier grant has explicit not-applicable evidence',()=>{
 const v=validV2();
 v.priorGrantReceiptHash=null;
 v.priorGrantEvidenceState='not_applicable';
 v.integrityHash=sha({eventId:v.eventId,recordId:v.consentRecordId,uid:v.uid,purpose:v.purpose,priorGrantReceiptHash:null,priorGrantEvidenceState:'not_applicable'});
 assert.equal(ConsentRevokedEventSchema.safeParse(v).success,true);
 assert.equal(verifyNativeLineage(v),true);
});
