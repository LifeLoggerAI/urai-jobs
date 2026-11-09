const REQUIRED_PURPOSES = ['memory.storage', 'location.context'];

function requireDispatchAuthority(job, attempt) {
  if (!job || job.status !== 'RUNNING' || job.execution?.leaseToken !== attempt.leaseToken) {
    throw new Error('stale job or lease');
  }
  if (!job.ownerUid || job.ownerUid !== attempt.ownerUid) {
    throw new Error('captured reality owner mismatch');
  }
  if ((job.jobType || job.type) !== 'memory.private-source.reconstruct-place'
    || JSON.stringify(job.payload?.sourceReceiptRefs) !== JSON.stringify(attempt.payload?.sourceReceiptRefs)
    || ['spatialAuthorityHead', 'studioProjectRef', 'assetFactoryGovernanceRef', 'reconstructionMethod']
      .some((key) => String(job.payload?.[key] || '') !== String(attempt.payload?.[key] || ''))) {
    throw new Error('captured reality stored payload mismatch');
  }
  const purposes = requiredConsentPurposes(job);
  if (REQUIRED_PURPOSES.some((purpose) => !purposes.includes(purpose))) {
    throw new Error('required consent receipts missing from active job');
  }
  return purposes;
}

function requiredConsentPurposes(job) {
  return [...new Set((Array.isArray(job?.consents) ? job.consents : [])
    .map((receipt) => String(receipt?.purpose || '')).filter(Boolean))];
}

function requireCallbackLease(job) {
  const callbackLease = String(job?.execution?.callbackLeaseToken || '');
  if (!callbackLease || job?.execution?.leaseToken !== callbackLease) {
    throw new Error('stale callback lease');
  }
}

module.exports = { requireDispatchAuthority, requireCallbackLease, requiredConsentPurposes };
