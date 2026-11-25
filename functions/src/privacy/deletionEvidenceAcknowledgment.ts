import { createHash } from 'node:crypto';

// Must match Privacy jobsDeleteEvidenceHash: ordered immutable identity fields;
// resultDigest already binds the validated result body.
export function deletionEvidenceHash(receipt: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify({
    schemaVersion: receipt.schemaVersion,
    event: receipt.event,
    requestId: receipt.requestId,
    requestType: receipt.requestType,
    ownerHash: receipt.ownerHash,
    resultDigest: receipt.resultDigest,
    terminalState: receipt.terminalState,
  })).digest('hex');
}

export function isBoundDeletionAcknowledgment(
  result: Record<string, unknown> | undefined,
  receipt: Record<string, unknown>
): boolean {
  return !!result && result.accepted === true && result.participant === 'urai-jobs' &&
    result.globalDeletionComplete === false &&
    result.acknowledgmentState === 'evidence-received-verification-pending' &&
    result.originVerificationState === 'independent-source-readback-matched' &&
    typeof result.idempotent === 'boolean' &&
    result.evidenceHash === deletionEvidenceHash(receipt);
}
