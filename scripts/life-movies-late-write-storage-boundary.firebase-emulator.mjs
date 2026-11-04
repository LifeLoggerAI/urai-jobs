/**
 * R522 — real disposable Firebase Storage/Firestore emulator LATE-WRITE GAP proof.
 *
 * This is an intentionally NEGATIVE security demonstration. It tests that
 * privileged Firebase Admin Storage writes can still succeed AFTER a
 * Firestore-only revocation epoch is committed, even when a point-in-time
 * Storage listing showed no objects. Such success is evidence that the real
 * production broker MUST remove legacy Storage write IAM and control upload
 * finalization. It is NOT successful enforcement of a future-write fence.
 *
 * NO credentials, production data, public URLs, real consent or media. The
 * prototype review ledger is NOT connected to Studio; Studio stays hard-off.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const PROJECT = 'urai-staging-test';
for (const [key, required] of Object.entries({
  URAI_EMULATOR_PROJECT: PROJECT,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
})) assert.equal(process.env[key], required, key + ' must be disposable local emulator');
for (const name of ['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'FIREBASE_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN', 'RUNPOD_API_KEY', 'STRIPE_SECRET_KEY']) {
  assert.equal(process.env[name] || '', '', 'cloud credential must be absent: ' + name);
}
for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[name]) assert.equal(process.env[name], PROJECT, 'must remain disposable');
}
const rootRequire = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, getApps, deleteApp } = rootRequire('firebase-admin/app');
const { getFirestore } = rootRequire('firebase-admin/firestore');
const { getStorage } = rootRequire('firebase-admin/storage');
assert.equal(getApps().length, 0, 'isolate original Admin app');
const app = initializeApp({ projectId: PROJECT });
const db = getFirestore(app);
const bucket = getStorage(app).bucket(PROJECT + '.appspot.com');
const ledger = rootRequire('./lib/functions/privacy/lifeMovieWriteReservationsReview.js');
const checks = [];
const token = randomUUID().replaceAll('-', '').slice(0, 14);
const scope = suffix => ({
  ownerUid: 'synthetic-r522-owner-' + token + suffix,
  tenantId: 'tenant-1', projectId: 'synthetic-r522-movie-' + token + suffix,
});
const attempt = (s, suffix) => ({
  ...s, jobId: 'synthetic-r522-job-' + token + suffix,
  attemptId: 'synthetic-r522-attempt-' + token + suffix,
});
const pathFor = (s, label) => 'tenants/' + s.tenantId +
  '/life-movies/' + s.projectId + '/render/' + label + '.mp4';
const prefixFor = s => 'tenants/' + s.tenantId + '/life-movies/' + s.projectId + '/';
const g = metadata => {
  const value = String(metadata?.generation || '');
  assert.match(value, /^[1-9][0-9]+$/, 'actual Storage generation is mandatory');
  return value;
};
const present = async file => {
  try { const [data] = await file.getMetadata(); return g(data); }
  catch (error) { if (error?.code === 404) return null; throw error; }
};
const listOne = async s => {
  const x = await bucket.getFiles({
    prefix: prefixFor(s), autoPaginate: false, maxResults: 1,
  });
  assert.ok(Array.isArray(x) && Array.isArray(x[0]));
  return x[0].length > 0;
};
const saveSynthetic = async (file, value) => {
  await file.save(Buffer.from('R522-' + value), {
    resumable: false, metadata: { contentType: 'video/mp4' },
  });
  const generation = await present(file);
  assert.ok(generation);
  return generation;
};
const deleteExact = async (file, generation) => {
  await bucket.file(file.name, {
    preconditionOpts: { ifGenerationMatch: generation },
  }).delete();
};
const denies = async (action, message) =>
  assert.rejects(action, error => typeof error?.message === 'string' &&
    error.message.includes(message));
const check = async (name, action) => {
  await action();
  checks.push(name);
  console.log('R522 PASS', name); // no private paths or source data in logs
};
async function fixture(s, a) {
  await db.collection('users').doc(s.ownerUid).set({
    role: 'user', disabled: false, deletionPending: false,
  });
  await db.collection('jobs').doc(a.jobId).set({
    ownerUid: s.ownerUid, tenantId: s.tenantId,
    sourceSystem: 'urai-studio', jobType: 'studio.render.video',
    status: 'RUNNING', payload: { projectId: s.projectId },
    consent: { purpose: 'life-movie.render' },
  });
  await ledger.seedReviewOnlyOutputScope(s);
}
const sA = scope('a'), sB = scope('b'), sC = scope('c');
const a = attempt(sA,'a'), b = attempt(sB,'b');
const fileA = bucket.file(pathFor(sA,'synthetic-a'));
const fileB = bucket.file(pathFor(sB,'synthetic-b'));
const fileC = bucket.file(pathFor(sC,'synthetic-unattributed'));
const allFiles = [fileA, fileB, fileC];
try {
  await check('source hard-off interlock preserved', async () => {
    const guard = readFileSync(new URL('../workers/studio-worker/private-output-write-authority.js', import.meta.url), 'utf8');
    const worker = readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
    assert.match(guard, /return false;/);
    assert.equal((worker.match(/assertPrivateOutputWriteAuthority\(\);/g)||[]).length, 2);
  });

  await fixture(sA,a);
  await fixture(sB,b);
  await check('reservation is transactionally registered before synthetic upload', async () => {
    const result = await ledger.reserveReviewOnlyOutputAttempt(a,1);
    assert.equal(result.productionAuthorized,false);
    await ledger.beginReviewOnlySimulatedUpload(a);
    assert.equal((await ledger.reviewOnlyDrainStatus(sA)).activeOrUnproven,1);
    assert.equal(await listOne(sA),false);
    const generation = await saveSynthetic(fileA,'before-revoke');
    assert.ok(generation);
  });

  const generationA1 = await present(fileA);
  await check('revocation epoch blocks new reservations, NOT Admin Storage identity', async () => {
    const r = await ledger.revokeReviewOnlyOutputScope(sA,'synthetic-event-a');
    assert.equal(r.epoch,2);
    await denies(() => ledger.reserveReviewOnlyOutputAttempt({...a,attemptId:'synthetic-new-attempt'},1),
      'fence_revoked_or_stale');
    await denies(() => ledger.cancelUnstartedReviewOnlyAttempt(a),
      'attempt_cannot_reconcile');
    assert.equal((await ledger.reviewOnlyDrainStatus(sA)).revocationAcknowledgementPermitted,false);
  });

  await check('exact pre-revocation generation can be deleted', async () => {
    await deleteExact(fileA,generationA1);
    assert.equal(await present(fileA),null);
    assert.equal(await listOne(sA),false);
    assert.equal((await ledger.reviewOnlyDrainStatus(sA)).activeOrUnproven,1);
  });

  let generationA2;
  await check('NEGATIVE: legacy Admin writer can recreate bytes AFTER revocation and empty inventory', async () => {
    generationA2 = await saveSynthetic(fileA,'post-revocation-legacy-write');
    assert.notEqual(generationA2,generationA1,'late upload must have a distinct generation');
    assert.equal(await listOne(sA),true,'new object exists despite previously empty listing');
    const state = await ledger.reviewOnlyDrainStatus(sA);
    assert.equal(state.storageWriteFenceVerified,false);
    assert.equal(state.revocationAcknowledgementPermitted,false);
  });

  let constructorGuardHonored = false;
  let explicitGuardHonored = false;
  let generationToReconcile = generationA2;
  await check('diagnose SDK stale-generation guards without masking emulator mismatches', async () => {
    // The production implementation uses a precondition on bucket.file().
    // Inspect the pinned SDK request template as well as the remote result.
    const constructorGuard = bucket.file(fileA.name, {
      preconditionOpts: { ifGenerationMatch: generationA1 },
    });
    const q = constructorGuard.methods?.delete?.reqOpts?.qs ?? {};
    assert.equal(String(q.ifGenerationMatch), generationA1,
      'pinned SDK must put old generation into DELETE request');
    try {
      await constructorGuard.delete();
    } catch (error) {
      assert.equal(Number(error?.code), 412,
        'with an existing replacement, GCS should reject stale generation');
      constructorGuardHonored = true;
    }
    if (constructorGuardHonored) {
      assert.equal(await present(fileA), generationA2,
        'correct conditional delete cannot remove replacement');
    } else {
      assert.equal(await present(fileA), null,
        'observed: emulator removed replacement despite request precondition');
      console.log('R522_EMULATOR_UNSAFE_STALE_DELETE constructor=true');
    }

    // Compare Google's documented call form: file.delete({ifGenerationMatch}).
    // This does NOT authorize production; Firebase emulator is not cloud IAM.
    generationToReconcile = (await present(fileA)) ??
      await saveSynthetic(fileA, 'for-explicit-delete-options-probe');
    assert.notEqual(generationToReconcile, generationA1);
    try {
      await fileA.delete({ ifGenerationMatch: generationA1 });
    } catch (error) {
      assert.equal(Number(error?.code), 412);
      explicitGuardHonored = true;
    }
    if (explicitGuardHonored) {
      assert.equal(await present(fileA), generationToReconcile);
    } else {
      assert.equal(await present(fileA), null,
        'emulator also removed replacement using explicit delete options');
      console.log('R522_EMULATOR_UNSAFE_STALE_DELETE explicit=true');
      generationToReconcile = await saveSynthetic(fileA,'for-controlled-reconciliation');
    }
    assert.equal((await ledger.reviewOnlyDrainStatus(sA)).productionAuthorized,false);
    console.log('R522_PRECONDITION_DIAGNOSTIC constructorHonored=' + constructorGuardHonored +
      ' explicitHonored=' + explicitGuardHonored +
      ' productionCloudUnverified=true');
  });

  await check('precise reconciliation uses the actually observed live generation', async () => {
    // Only this disposable object is touched, and revocation ACK stays denied.
    assert.equal(await present(fileA), generationToReconcile);
    await deleteExact(fileA,generationToReconcile);
    assert.equal(await present(fileA),null);
    assert.equal(await listOne(sA),false);
    assert.equal((await ledger.reviewOnlyDrainStatus(sA)).revocationAcknowledgementPermitted,false);
  });

    await check('project-isolated foreign media survives target cleanup', async () => {
    await ledger.reserveReviewOnlyOutputAttempt(b,1);
    const foreignGeneration = await saveSynthetic(fileB,'unrelated-project');
    assert.equal((await ledger.reviewOnlyDrainStatus(sB)).state,'OPEN');
    assert.equal(await listOne(sA),false);
    assert.equal(await present(fileB),foreignGeneration);
  });

  await check('NEGATIVE: even with zero reservations, Admin writer bypasses withdrawn scope', async () => {
    await ledger.seedReviewOnlyOutputScope(sC);
    await ledger.revokeReviewOnlyOutputScope(sC,'synthetic-event-c');
    const state = await ledger.reviewOnlyDrainStatus(sC);
    assert.equal(state.activeOrUnproven,0);
    assert.equal(state.revocationAcknowledgementPermitted,false);
    assert.equal(await listOne(sC),false);
    await saveSynthetic(fileC,'unattributed-after-revocation');
    assert.equal(await listOne(sC),true);
    assert.equal((await ledger.reviewOnlyDrainStatus(sC)).storageWriteFenceVerified,false);
  });

  await check('all tracked synthetic objects cleaned at exact generations', async () => {
    for (const file of allFiles) {
      const generation = await present(file);
      if (generation) await deleteExact(file,generation);
      assert.equal(await present(file),null);
    }
    assert.equal(await listOne(sA),false);
    assert.equal(await listOne(sB),false);
    assert.equal(await listOne(sC),false);
    assert.equal((await ledger.reviewOnlyDrainStatus(sA)).revocationAcknowledgementPermitted,false);
    assert.equal((await ledger.reviewOnlyDrainStatus(sC)).revocationAcknowledgementPermitted,false);
  });
  assert.equal(checks.length,10);
  console.log('R522_REAL_FIREBASE_LATE_WRITE_BOUNDARY_REPRODUCED checks=' + checks.length +
    ' privilegedBypassObserved=true emulatorConstructorGuardHonored=' + constructorGuardHonored +
    ' emulatorExplicitGuardHonored=' + explicitGuardHonored +
    ' storageLevelFenceVerified=false productionAuthorized=false');
} finally {
  // No broad prefix deletes. Cleanup only exact synthetic paths created here.
  const settled = await Promise.allSettled(allFiles.map(async file => {
    const generation = await present(file);
    if (generation) await deleteExact(file,generation);
  }));
  for (const result of settled) {
    if (result.status === 'rejected') console.error('R522 cleanup required', result.reason?.code);
  }
  await deleteApp(app);
}
