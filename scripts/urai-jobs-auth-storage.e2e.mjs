import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * Real four-emulator acceptance: Auth ID tokens + Functions-created Job +
 * Firestore owner binding + Storage Rules. All bytes and identities are
 * synthetic. No production credential or external TTS provider is used.
 *
 * This is an ACL integration probe, not proof of Replay media playback,
 * cross-service consent revocation, or production IAM enforcement.
 */
export async function verifyJobsPrivateStorageE2E({
  projectId, ownerUid, jobId, ownerToken, otherToken,
}) {
  const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  assert.match(projectId, /^demo-[a-z0-9-]+$/, 'only a disposable demo emulator project is allowed');
  assert.equal(storageHost, '127.0.0.1:9199', 'Storage must be bound to the local emulator');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  assert.ok(ownerUid && jobId && ownerToken && otherToken, 'authenticated owner, other user and job are required');

  const snap = await getFirestore().collection('jobs').doc(jobId).get();
  assert.equal(snap.exists, true, 'Functions-created job must exist in Firestore');
  assert.equal(snap.data()?.ownerUid, ownerUid, 'job must belong to the authenticated owner');

  const bucketName = projectId + '.appspot.com';
  const prefix = 'jobs/' + ownerUid + '/' + jobId + '/four-emulator-' + randomUUID();
  const objectPath = prefix + '/synthetic.mp3';
  const clientPath = prefix + '/forbidden-client-upload.mp3';
  const temporaryPath = 'tmp/four-emulator-' + randomUUID() + '/synthetic.mp3';
  const fixture = Buffer.from('URAI_SYNTHETIC_FOUR_EMULATOR_PRIVATE_MEDIA');
  const bucket = getStorage().bucket(bucketName);
  const object = bucket.file(objectPath);
  const temporary = bucket.file(temporaryPath);
  const mediaUrl = (name) => 'http://' + storageHost + '/v0/b/' +
    encodeURIComponent(bucketName) + '/o/' + encodeURIComponent(name) + '?alt=media';
  const readAs = (name, token) => fetch(mediaUrl(name), {
    headers: token ? {authorization: 'Firebase ' + token} : {},
  });
  const denial = async (response, label) => {
    assert.ok([401, 403].includes(response.status),
      label + ' must fail in Storage Rules, got HTTP ' + response.status);
    const body = await response.text();
    assert.equal(body.includes(fixture.toString()), false, label + ' leaked private bytes');
  };

  try {
    // Admin SDK represents a backend-generated output and bypasses client
    // Storage Rules. The four assertions below exercise actual client rules.
    await object.save(fixture, {resumable: false, contentType: 'audio/mpeg'});
    await temporary.save(fixture, {resumable: false, contentType: 'audio/mpeg'});

    const owner = await readAs(objectPath, ownerToken);
    assert.equal(owner.status, 200, 'owner must read their job artifact');
    assert.equal(await owner.text(), fixture.toString());

    await denial(await readAs(objectPath, otherToken), 'foreign owner read');
    await denial(await readAs(objectPath, null), 'anonymous read');
    await denial(await readAs(temporaryPath, ownerToken), 'temporary worker media read');

    // Mirror the real Firebase Storage client protocol, not a malformed
    // request that might fail before Storage Rules are evaluated.
    const boundary = 'urai-e2e-' + randomUUID().replaceAll('-', '');
    const preamble = Buffer.from([
      '--' + boundary,
      'Content-Type: application/json; charset=utf-8',
      '',
      JSON.stringify({name: clientPath, contentType: 'audio/mpeg'}),
      '--' + boundary,
      'Content-Type: audio/mpeg',
      '',
      '',
    ].join('\r\n'));
    const multipart = Buffer.concat([
      preamble, fixture, Buffer.from('\r\n--' + boundary + '--'),
    ]);
    const upload = await fetch('http://' + storageHost + '/v0/b/' +
      encodeURIComponent(bucketName) + '/o?name=' + encodeURIComponent(clientPath), {
      method: 'POST',
      headers: {
        authorization: 'Firebase ' + ownerToken,
        'x-goog-upload-protocol': 'multipart',
        'content-type': 'multipart/related; boundary=' + boundary,
      },
      body: multipart,
    });
    await denial(upload, 'client-generated job output upload');
    const [clientCreated] = await bucket.file(clientPath).exists();
    assert.equal(clientCreated, false, 'denied client upload must not persist bytes');

    console.log('[PASS] FOUR_EMULATOR_STORAGE_OWNER_RULES; owner read, foreign/anonymous/tmp read and client write denied');
  } finally {
    // Exact synthetic paths only; the temporary emulator project has no real
    // user media. Cleanup is not a production revocation/deletion receipt.
    await Promise.all([object, temporary].map((file) => file.delete({ignoreNotFound: true})));
  }
}
