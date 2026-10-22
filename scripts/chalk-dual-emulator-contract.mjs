// Pure, offline-verifiable safety and receipt contract for the TWO-project
// Chalk emulator proof. Never authorizes a production call or resource.
export const CHALK_DEMO_JOBS = 'demo-urai-jobs';
export const CHALK_DEMO_SPATIAL = 'demo-urai-auth-journey';
const SHA = /^[a-f0-9]{40}$/;
const LOCAL = /^(?:127\.0\.0\.1|localhost):([0-9]{2,5})$/;
const deny = why => { throw new Error('CHALK_DUAL_EMULATOR_' + why); };
function localPort(value) {
  const match = typeof value === 'string' ? LOCAL.exec(value) : null;
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 65535) deny('LOCAL_HOST_REQUIRED');
  return value;
}
export function requireChalkDualEmulators(env, nodeVersion = process.versions.node) {
  if (Number(String(nodeVersion).split('.')[0]) !== 22) deny('NODE22_ONLY');
  if (!env || env.CHALK_EMULATOR_PROOF !== '1' || env.CHALK_NONPRODUCTION_INTAKE !== 'true' ||
      env.NODE_ENV === 'production') deny('EXPLICIT_OPT_IN');
  if (env.GOOGLE_CLOUD_PROJECT !== undefined && env.GOOGLE_CLOUD_PROJECT !== CHALK_DEMO_JOBS) deny('WRONG_PROJECT');
  if (env.GCLOUD_PROJECT !== undefined && env.GCLOUD_PROJECT !== CHALK_DEMO_JOBS) deny('WRONG_PROJECT');
  if (env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_CONFIG?.includes('urai-4dc1d')) deny('CLOUD_CREDENTIALS');
  if (!SHA.test(env.CHALK_PINNED_SPATIAL_SHA ?? '')) deny('SOURCE_SHA');
  const firestore = localPort(env.FIRESTORE_EMULATOR_HOST);
  const auth = localPort(env.FIREBASE_AUTH_EMULATOR_HOST);
  const functions = localPort(env.CHALK_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001');
  return Object.freeze({jobsProject:CHALK_DEMO_JOBS,spatialProject:CHALK_DEMO_SPATIAL,
    sourceSha:env.CHALK_PINNED_SPATIAL_SHA,firestore,auth,functions});
}
export function checkChalkHeldProof(record, queueExists, logExists, quota, sourceSha, jobId) {
  if (!record || record.jobId !== jobId || record.status !== 'PENDING' ||
      record.ownerUid === undefined || record.type !== 'engineering.verify' ||
      record.jobType !== 'engineering.verify' || record.payload?.baseSha !== sourceSha ||
      record.admission?.state !== 'HELD_UNQUEUED' || record.admission?.workerAdmitted !== false ||
      record.admission?.providerSpendUsd !== 0 || queueExists !== false || logExists !== true ||
      !Number.isSafeInteger(quota) || quota !== 1) deny('BAD_HELD_RECEIPT');
  return true;
}


// The held master AND its audit entry must agree with both independently
// authenticated synthetic test accounts and the pinned binding generation.
export function checkChalkDualIdentityReceipt(master, audit, jobsUid, spatialUid, revision) {
  if (!/^chalkjobs_[a-f0-9]{16}$/.test(jobsUid ?? '') ||
      !/^chalkspatial_[a-f0-9]{16}$/.test(spatialUid ?? '') ||
      !Number.isSafeInteger(revision) || revision !== 1 ||
      !master || master.ownerUid !== jobsUid ||
      master.chalkOriginSpatialUid !== spatialUid ||
      master.chalkBindingRevision !== revision ||
      master.admission?.state !== 'HELD_UNQUEUED' ||
      master.admission?.workerAdmitted !== false ||
      !audit || audit.source !== 'chalk-emulator-intake' ||
      audit.metadata?.originSpatialUid !== spatialUid ||
      audit.metadata?.bindingRevision !== revision ||
      audit.metadata?.requestDigest !== master.payload?.requestDigest ||
      audit.metadata?.sourceSha !== master.payload?.baseSha ||
      audit.metadata?.queued !== false ||
      audit.metadata?.providerSpendUsd !== 0) deny('BAD_IDENTITY_RECEIPT');
  return true;
}
