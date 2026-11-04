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
import vm from 'node:vm';

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
async function seed(kind) {
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
    jobType: 'studio.render.video', status: 'SUCCESS',
    payload: { projectId }, output,
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
  // Firebase's Firestore SDK requires the transaction callback to return a
  // Promise from the same JavaScript realm. Compiling the ORIGINAL source
  // into a new VM context creates realm-local async Promises that the SDK
  // rejects before the Storage race can be tested. Evaluate a CommonJS
  // wrapper in THIS realm, injecting only the test-controlled dependencies;
  // never change the original verifier or weaken its generation fencing.
  const module = { exports: {} };
  const runOriginalSource = vm.runInThisContext(
    '(function (require, module, exports) {\n' + compiled.outputText + '\n})',
    { filename: 'lifeMovieDerivativeRevocation.actual.ts' },
  );
  function testRequire(name) {
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
  }
  runOriginalSource(testRequire, module, module.exports);
  assert.equal(typeof module.exports.invalidateLifeMovieDerivativesForConsent, 'function');
  return { invalidate: module.exports.invalidateLifeMovieDerivativesForConsent,
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
  assert.ok(state?.outputDeletedAt != null);
  checks.push('actual-storage-generation-deleted-before-job-output-clear');

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
