/**
 * REVIEW-ONLY / NONPRODUCTION
 * Test the ORIGINAL Jobs derivative-revocation implementation with actual
 * disposable Firestore and Storage emulators. A test-controlled storage
 * wrapper injects a replacement after a successful generation-fenced delete
 * to prove that output references cannot be cleared on a replaced path.
 *
 * This is NOT proof of private delivery, a signed Jobs identity, production
 * consent, atomic lifetime deletion, or permanent prevention of future writes.
 */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const PROJECT = 'urai-staging-test';
const REQUIRED = {
  URAI_EMULATOR_PROJECT: PROJECT,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
};
for (const [key, expected] of Object.entries(REQUIRED)) {
  assert.equal(process.env[key], expected, key + ' must use disposable local Firebase');
}
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'GITHUB_TOKEN',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON', 'RUNPOD_API_KEY']) {
  assert.equal(process.env[key] ?? '', '', 'cloud credential forbidden: ' + key);
}
for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[key]) assert.equal(process.env[key], PROJECT, 'unexpected cloud project');
}
process.env.GCS_BUCKET_NAME = PROJECT + '.appspot.com';
process.env.URAI_STUDIO_OUTPUT_BUCKETS = '';

const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp, getApps } = requireFunctions('firebase-admin/app');
const firestoreModule = requireFunctions('firebase-admin/firestore');
const storageModule = requireFunctions('firebase-admin/storage');
const { getFirestore } = firestoreModule;
const { getStorage } = storageModule;
assert.equal(getApps().length, 0, 'no existing Admin apps');
const app = initializeApp({ projectId: PROJECT });
const db = getFirestore(app);
const storage = getStorage(app);
const bucketName = PROJECT + '.appspot.com';
const bucket = storage.bucket(bucketName);
const { invalidateLifeMovieDerivativesForConsent } =
  requireFunctions('./lib/functions/privacy/lifeMovieDerivativeRevocation.js');
const { lifeMovieArtifactBindings } =
  requireFunctions('./lib/functions/privacy/lifeMovieArtifactRefs.js');
const ts = requireFunctions('typescript');
const checks = [];
const activeCases = new Set();
const token = randomUUID().replace(/-/g,'').slice(0,16);

function missing(error) { return error?.code === 404; }
async function missingFile(path) {
  try { await bucket.file(path).getMetadata(); return false; }
  catch (error) { if (missing(error)) return true; throw error; }
}
async function seed(kind, typeFields = { jobType: 'studio.render.video' }) {
  const ownerUid = 'synthetic-owner-' + token + '-' + kind;
  const tenantId = 'tenant-1';
  const projectId = 'movie-' + token + '-' + kind;
  const jobId = 'job-' + token + '-' + kind;
  const eventId = 'event-' + token + '-' + kind;
  const objectPath = 'tenants/' + tenantId + '/life-movies/' + projectId +
    '/render/' + jobId + '.mp4';
  const file = bucket.file(objectPath);
  await file.save(Buffer.from('synthetic-' + kind), {
    resumable: false, metadata: { contentType: 'video/mp4' },
  });
  const [meta] = await file.getMetadata();
  const generation = String(meta.generation);
  assert.match(generation, /^[1-9][0-9]{0,19}$/);
  assert.ok(Number.isSafeInteger(Number(generation)));

  const output = { outputs: [{
    kind: 'mp4', ref: 'gs://' + bucketName + '/' + objectPath,
    generation, mimeType: 'video/mp4',
  }] };
  const jobRef = db.collection('jobs').doc(jobId);
  await jobRef.set({
    jobId, ownerUid, tenantId, sourceSystem: 'urai-studio',
    status: 'SUCCESS', payload: { projectId }, output, ...typeFields,
  });
  const receiptRef = db.collection('jobConsentEventReceipts').doc(
    createHash('sha256').update(eventId).digest('hex'));
  await receiptRef.set({
    eventId, ownerUid, purpose: 'life-movie.render', status: 'blocked',
    consumerId: 'urai-jobs', revokedAt: new Date().toISOString(),
  });
  const event = {
    eventId, ownerUid, purpose: 'life-movie.render',
    revokedAt: new Date().toISOString(),
  };
  activeCases.add(objectPath);
  return { event, file, jobRef, receiptRef, objectPath, generation, output };
}

async function checkReferencesRetained(jobRef) {
  const state = (await jobRef.get()).data();
  assert.equal(state?.derivativeAccessState, 'REVOKED');
  assert.ok(state?.output?.outputs?.length === 1,
    'revoked job retains original output refs for reconciliation');
  assert.equal(state?.outputDeletedAt, undefined,
    'cannot report cleanup complete before verifying Storage absence');
}

function originalSourceWithPostDeleteReplacement(targetObjectPath) {
  const source = readFileSync(
    new URL('../functions/src/privacy/lifeMovieDerivativeRevocation.ts', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });
  assert.equal((compiled.diagnostics||[]).filter(x => x.category === ts.DiagnosticCategory.Error).length,0);
  let replacementCount = 0;
  const fileWrapper = (real, objectPath, opts) => {
    if (objectPath !== targetObjectPath || !opts?.preconditionOpts?.ifGenerationMatch) return real;
    return new Proxy(real, {
      get(target, property) {
        if (property === 'delete') return async (...params) => {
          const result = await target.delete(...params);
          replacementCount++;
          await bucket.file(objectPath).save(Buffer.from('synthetic-late-replacement'), {
            resumable: false, metadata: { contentType: 'video/mp4' },
          });
          return result;
        };
        const value = target[property];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };
  const wrappedStorage = {
    bucket(name) {
      assert.equal(name, bucketName);
      return {
        file(objectPath, options) {
          return fileWrapper(bucket.file(objectPath, options), objectPath, options);
        },
      };
    },
  };
  // The Firestore SDK requires a transaction callback returning a Promise
  // from the SAME Node realm. Use a test-only CJS loader in this realm rather
  // than a vm context, and inject only the Storage wrapper for the race.
  const loaded = { exports: {} };
  const testRequire = (name) => {
      if (name === 'node:crypto') return requireFunctions('node:crypto');
      if (name === 'node:util') return requireFunctions('node:util');
      if (name === 'firebase-admin/firestore') return { ...firestoreModule, getFirestore: () => db };
      if (name === 'firebase-admin/storage') return { getStorage: () => wrappedStorage };
      if (name === '../core/firestore-paths.js') return {
        jobQueueEntryDoc: id => db.collection('jobQueue').doc(id),
      };
      if (name === './consentBlocks.js') return {
        consentEventReceiptRef: id => db.collection('jobConsentEventReceipts').doc(
          createHash('sha256').update(id).digest('hex')),
      };
      if (name === './lifeMovieArtifactRefs.js') return { lifeMovieArtifactBindings };
      throw Error('unexpected original-source import: ' + name);
  };
  const executeOriginalCjs = new Function('module', 'exports', 'require',
    compiled.outputText + '\n//# sourceURL=lifeMovieDerivativeRevocation.actual.ts');
  executeOriginalCjs(loaded, loaded.exports, testRequire);
  assert.equal(typeof loaded.exports.invalidateLifeMovieDerivativesForConsent, 'function');
  return { invalidate: loaded.exports.invalidateLifeMovieDerivativesForConsent,
    replacements: () => replacementCount };
}

try {
  const success = await seed('success');
  const result = await invalidateLifeMovieDerivativesForConsent(success.event);
  assert.equal(result.jobsScanned, 1);
  assert.equal(result.jobsInvalidated, 1);
  assert.equal(result.storageObjectsDeleted, 1);
  assert.equal(result.plansInvalidated, 0);
  assert.equal(await missingFile(success.objectPath), true);
  const state = (await success.jobRef.get()).data();
  assert.equal(state?.derivativeAccessState, 'REVOKED');
  assert.equal(state?.output, undefined);
  assert.equal(state?.outputDeletedAt, undefined, 'point-in-time cleanup cannot claim durable deletion');
  assert.ok(state?.outputCleanupObservedAt != null);
  assert.equal(state?.privateOutputDeletionAcknowledged, false);
  assert.equal(state?.storageWriteFenceVerified, false);
  assert.equal(result.privateOutputDeletionAcknowledged, false);
  assert.equal(result.storageWriteFenceVerified, false);
  checks.push('actual-storage-generation-deleted-before-job-output-clear');

  // Legacy/malformed job records can contain divergent aliases. Cleanup must
  // conservatively fence recognized Studio render/assemble work in EITHER
  // alias (without broadening ownerUid, sourceSystem or GCS deletion scope).
  for (const [kind, typeFields] of [
    ['legacy-jobtype-render', { jobType: 'legacy-other', type: 'studio.render.video' }],
    ['legacy-jobtype-assemble', { jobType: 'legacy-other', type: 'studio.assemble.video' }],
    ['legacy-type-assemble', { jobType: 'studio.assemble.video', type: 'legacy-other' }],
  ]) {
    const divergent = await seed(kind, typeFields);
    const summary = await invalidateLifeMovieDerivativesForConsent(divergent.event);
    assert.equal(summary.jobsScanned, 1);
    assert.equal(summary.jobsInvalidated, 1);
    assert.equal(summary.storageObjectsDeleted, 1);
    assert.equal(await missingFile(divergent.objectPath), true);
    const cleaned = (await divergent.jobRef.get()).data();
    assert.equal(cleaned?.derivativeAccessState, 'REVOKED');
    assert.equal(cleaned?.output, undefined);
    assert.equal(cleaned?.outputDeletedAt, undefined);
    assert.ok(cleaned?.outputCleanupObservedAt != null);
    assert.equal(cleaned?.privateOutputDeletionAcknowledged, false);
    assert.equal(cleaned?.storageWriteFenceVerified, false);
    checks.push('conflicting-job-type-alias-fenced-' + kind);
  }
  const unrelatedSource = await seed('foreign-source',
    { jobType: 'studio.render.video', type: 'studio.assemble.video' });
  await unrelatedSource.jobRef.update({ sourceSystem: 'unrelated-worker' });
  const unrelatedResult = await invalidateLifeMovieDerivativesForConsent(unrelatedSource.event);
  assert.equal(unrelatedResult.jobsScanned, 1);
  assert.equal(unrelatedResult.jobsInvalidated, 0);
  assert.equal(unrelatedResult.storageObjectsDeleted, 0);
  assert.equal(await missingFile(unrelatedSource.objectPath), false);
  assert.ok((await unrelatedSource.jobRef.get()).data()?.output);
  checks.push('non-studio-job-remains-outside-derivative-cleanup');

  // A crashed worker may have successfully uploaded an attempt object
  // before writing its generation into job.output. Generation-bound cleanup
  // deletes the recorded file, but MUST NOT mark revocation complete while
  // any other file still exists under that owner's tenant+project prefix.
  const orphan = await seed('orphan');
  const unknownPath = orphan.objectPath.replace(/\/render\/[^/]+$/, '/attempt-unrecorded/private.mp4');
  assert.notEqual(unknownPath, orphan.objectPath);
  await bucket.file(unknownPath).save(Buffer.from('synthetic-unrecorded-worker-output'), {
    resumable: false, metadata: { contentType: 'video/mp4' },
  });
  activeCases.add(unknownPath);
  await assert.rejects(
    () => invalidateLifeMovieDerivativesForConsent(orphan.event),
    /life_movie_revocation_unattributed_output_unresolved/,
  );
  assert.equal(await missingFile(orphan.objectPath), true,
    'documented original generation may be safely deleted');
  assert.equal(await missingFile(unknownPath), false,
    'unrecorded source stays for explicit reconciliation, not broad delete');
  await checkReferencesRetained(orphan.jobRef);
  checks.push('unrecorded-attempt-output-denies-revocation-complete');

  await bucket.file(unknownPath).delete();
  const retried = await invalidateLifeMovieDerivativesForConsent(orphan.event);
  assert.equal(retried.jobsInvalidated, 1);
  assert.equal((await orphan.jobRef.get()).data()?.output, undefined);
  checks.push('same-event-retry-after-orphan-reconciliation-succeeds');

  // An orphan upload may precede ALL job output references. An affected
  // longform plan alone must keep its canonical project in the inventory,
  // fail closed, and allow only explicit reconciliation on the same event.
  const planOnlyOwner = 'synthetic-owner-' + token + '-plan-only';
  const planOnlyEventId = 'event-' + token + '-plan-only';
  const planOnlyProject = 'movie-' + token + '-plan-only';
  const planOnlyPath = 'tenants/tenant-1/life-movies/' + planOnlyProject +
    '/attempt-unrecorded/private.mp4';
  const planOnlyRef = db.collection('studioLifeMovieLongformPlans').doc('plan-' + token + '-plan-only');
  const planOnlyEvent = {
    eventId: planOnlyEventId, ownerUid: planOnlyOwner,
    purpose: 'life-movie.render', revokedAt: new Date().toISOString(),
  };
  const planOnlyReceiptRef = db.collection('jobConsentEventReceipts').doc(
    createHash('sha256').update(planOnlyEventId).digest('hex'));
  await planOnlyReceiptRef.set({
    eventId: planOnlyEventId, ownerUid: planOnlyOwner,
    purpose: 'life-movie.render', status: 'blocked',
    consumerId: 'urai-jobs', revokedAt: planOnlyEvent.revokedAt,
  });
  await planOnlyRef.set({
    ownerUid: planOnlyOwner, tenantId: 'tenant-1',
    projectId: planOnlyProject, status: 'PLANNED',
  });
  await bucket.file(planOnlyPath).save(Buffer.from('synthetic-plan-only-orphan'), {
    resumable: false, metadata: { contentType: 'video/mp4' },
  });
  activeCases.add(planOnlyPath);
  await assert.rejects(
    () => invalidateLifeMovieDerivativesForConsent(planOnlyEvent),
    /life_movie_revocation_unattributed_output_unresolved/,
  );
  const planOnlyBlocked = (await planOnlyRef.get()).data();
  assert.equal(planOnlyBlocked?.derivativeAccessState, 'REVOKED');
  assert.equal(planOnlyBlocked?.outputDeletedAt, undefined);
  assert.equal(await missingFile(planOnlyPath), false,
    'unknown plan-only object must not be broad-deleted');
  checks.push('plan-only-unrecorded-output-denies-cleanup');

  await bucket.file(planOnlyPath).delete();
  const planOnlyRetry = await invalidateLifeMovieDerivativesForConsent(planOnlyEvent);
  assert.equal(planOnlyRetry.jobsInvalidated, 0);
  assert.equal(planOnlyRetry.plansInvalidated, 1);
  const planCleaned = (await planOnlyRef.get()).data();
  assert.equal(planCleaned?.outputDeletedAt, undefined, 'storage write fence remains unverified');
  assert.ok(planCleaned?.outputCleanupObservedAt != null);
  assert.equal(planCleaned?.privateOutputDeletionAcknowledged, false);
  assert.equal(planCleaned?.storageWriteFenceVerified, false);
  assert.equal(planOnlyRetry.privateOutputDeletionAcknowledged, false);
  checks.push('plan-only-orphan-reconciliation-retry-completes');

  // Files in a different tenant/project are NOT eligible for destructive
  // cleanup by another owner's revocation.
  const otherProject = await seed('other-project');
  const scoped = await seed('scoped');
  const scopedResult = await invalidateLifeMovieDerivativesForConsent(scoped.event);
  assert.equal(scopedResult.jobsInvalidated, 1);
  assert.equal(await missingFile(scoped.objectPath), true);
  assert.equal(await missingFile(otherProject.objectPath), false);
  checks.push('unrelated-project-objects-not-scanned-or-deleted');

  // Original job output records an immutable generation. An object replaced
  // BEFORE the first metadata read must refuse the selected old generation.
  const stale = await seed('stale');
  await stale.file.save(Buffer.from('newer-unapproved-generation'), {
    resumable: false, metadata: { contentType: 'video/mp4' },
  });
  await assert.rejects(
    () => invalidateLifeMovieDerivativesForConsent(stale.event),
    /life_movie_revocation_output_generation_changed/,
  );
  await checkReferencesRetained(stale.jobRef);
  checks.push('actual-storage-generation-changed-before-delete-denies');

  // Deterministic, test-controlled race: when the real generation-fenced
  // delete succeeds, the wrapper immediately writes a new object into the
  // same REAL emulator bucket/path. The original-source revocation module
  // must catch it on its final metadata read and retain the job's references.
  const raced = await seed('raced');
  const injected = originalSourceWithPostDeleteReplacement(raced.objectPath);
  await assert.rejects(
    () => injected.invalidate(raced.event),
    /life_movie_revocation_output_generation_changed/,
  );
  assert.equal(injected.replacements(), 1,
    'the race must occur after successful real generation-bound deletion');
  assert.equal(await missingFile(raced.objectPath), false);
  await checkReferencesRetained(raced.jobRef);
  checks.push('actual-storage-replacement-after-delete-denies-output-clear');

  console.log('R503_REAL_PRIVATE_DERIVATIVE_REVOCATION_PASS ' + JSON.stringify({
    schemaVersion: 'urai-r503-review-only-storage-deletion-fence-v1',
    projectId: PROJECT,
    checksPassed: checks.length, checks,
    actualFirestoreEmulator: true, actualStorageEmulator: true,
    originalJobsRevocationSource: true, postDeleteReplacementInjectedInTestOnly: true,
    noRealMedia: true, noProduction: true,
    ownerConsentIssuerApproved: false, signedJobsIdentityVerified: false,
    privateReplayVerified: false, fullDeletionLifecycleCertified: false,
    releaseApproved: false,
  }));
} finally {
  // Firestore Storage emulator is disposable, but clean up test-created
  // objects and documents before exiting without swallowing assertion errors.
  for (const objectPath of activeCases) {
    await bucket.file(objectPath).delete({ ignoreNotFound: true }).catch(() => {});
  }
  await deleteApp(app).catch(() => {});
}
