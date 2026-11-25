import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deletionEvidenceHash, isBoundDeletionAcknowledgment } from '../functions/lib/functions/privacy/deletionEvidenceAcknowledgment.js';

const receipt = {
  schemaVersion: 'urai-jobs-data-rights-execution-v1',
  event: 'DATA_RIGHTS_EXECUTION_FINISHED', requestId: 'synthetic-request',
  requestType: 'DELETE', ownerHash: 'a'.repeat(64), resultDigest: 'b'.repeat(64),
  terminalState: 'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED',
};
const acknowledgment = {
  accepted: true, participant: 'urai-jobs', globalDeletionComplete: false,
  acknowledgmentState: 'evidence-received-verification-pending',
  originVerificationState: 'independent-source-readback-matched', idempotent: false,
  evidenceHash: deletionEvidenceHash(receipt),
};
test('accepts only source-bound pending evidence, including idempotent replay', () => {
  assert.equal(isBoundDeletionAcknowledgment(acknowledgment, receipt), true);
  assert.equal(isBoundDeletionAcknowledgment({ ...acknowledgment, idempotent: true }, receipt), true);
});
test('rejects valid-looking hash for a different request, owner, result or terminal state', () => {
  for (const key of ['requestId', 'ownerHash', 'resultDigest', 'terminalState']) {
    const other = { ...receipt, [key]: 'different-source' };
    assert.match(deletionEvidenceHash(other), /^[a-f0-9]{64}$/);
    assert.equal(isBoundDeletionAcknowledgment({ ...acknowledgment, evidenceHash: deletionEvidenceHash(other) }, receipt), false);
  }
});
test('does not accept completion, missing acknowledgment or malformed digest', () => {
  assert.equal(isBoundDeletionAcknowledgment(undefined, receipt), false);
  assert.equal(isBoundDeletionAcknowledgment({ ...acknowledgment, globalDeletionComplete: true }, receipt), false);
  assert.equal(isBoundDeletionAcknowledgment({ ...acknowledgment, evidenceHash: 'bad' }, receipt), false);
});
test('matches canonical Privacy hash contract fixture', () => {
  // Independently checked against compiled Privacy #353 jobsDeleteEvidenceHash.
  assert.equal(deletionEvidenceHash(receipt), '28e1bf58867118a888959f65d095699843fc3ca7cfbd889aa0d9845a456aaf93');
});
