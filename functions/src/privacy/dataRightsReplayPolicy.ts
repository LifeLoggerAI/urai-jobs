import { createHash } from 'node:crypto';

export const DATA_RIGHTS_EXECUTION_RECEIPT_SCHEMA = 'urai-jobs-data-rights-execution-v1';

export type DataRightsReplayBinding = {
  requestId: string;
  ownerUid: string;
  requestType: 'EXPORT' | 'DELETE';
};

export function isCompletedDataRightsReplayReceipt(
  receipt: unknown,
  binding: DataRightsReplayBinding,
): boolean {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;
  const r = receipt as Record<string, unknown>;
  if (r.event !== 'DATA_RIGHTS_EXECUTION_FINISHED' ||
      r.schemaVersion !== DATA_RIGHTS_EXECUTION_RECEIPT_SCHEMA ||
      r.requestId !== binding.requestId ||
      r.requestType !== binding.requestType ||
      r.ownerHash !== createHash('sha256').update(binding.ownerUid).digest('hex')) return false;
  const expectedState = binding.requestType === 'EXPORT'
    ? 'PROTECTED_STAGING_EXPORT_READY_CENTRAL_DELIVERY_REQUIRED'
    : 'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED';
  if (r.terminalState !== expectedState ||
      typeof r.resultDigest !== 'string' ||
      !/^[a-f0-9]{64}$/.test(r.resultDigest) ||
      !r.result || typeof r.result !== 'object' || Array.isArray(r.result)) return false;
  return r.resultDigest === createHash('sha256')
    .update(JSON.stringify(r.result)).digest('hex');
}
