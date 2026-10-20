import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getStorage } from 'firebase-admin/storage';

export const PRIVATE_MEDIA_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const PRIVATE_MEDIA_DELIVERY_TTL_MS = 5 * 60 * 1000;
type Location = { bucket: string; objectPath: string };
export type PrivateMediaDescriptor = {
  schemaVersion: 'urai-authenticated-private-media-v1';
  requiresAuthorization: true; action: 'deliver'; kind: 'mp4' | 'srt' | 'audio';
  authorityHash: string; expiresAt: number; generation: string;
};

export async function assertPrivateMediaOwnerActive(transaction: any, db: any, ownerUid: string) {
  const ownerHash = createHash('sha256').update(ownerUid).digest('hex');
  const [local, central] = await Promise.all([
    transaction.get(db.collection('uraiPrivateLifeModelOwnerFences').doc(ownerHash)),
    transaction.get(db.collection('privacyDeletionTombstones').doc(ownerUid)),
  ]);
  const own = local.data(), canonical = central.data();
  // Existing owner fences must have explicit, correctly scoped false state.
  // Missing, non-Boolean or malformed fields are not affirmative permission
  // to deliver private media, matching the life-movie rendering worker.
  if ((local.exists && (own?.ownerHash !== ownerHash || own?.deleted !== false))
    || (central.exists && (canonical?.uid !== ownerUid || canonical?.active !== false))) {
    throw new Error('private_media_owner_deleted');
  }
}


/** Remove only an owned immutable worker-generated object generation.
 * Missing provenance must remain pending for explicit reconciliation rather
 * than deleting a later replacement or someone else's media. */
export async function deleteOwnedLifeMovieArtifact(location: Location & { ownerUid: string; jobId: string }) {
  const file = getStorage().bucket(location.bucket).file(location.objectPath);
  let metadata;
  try {
    [metadata] = await file.getMetadata();
  } catch (error) {
    if ((error as { code?: unknown })?.code === 404) return;
    throw error;
  }
  const generation = String(metadata?.generation || '');
  const markers = metadata?.metadata;
  const ownerHash = createHash('sha256').update(location.ownerUid).digest('hex');
  if (!/^[1-9][0-9]*$/.test(generation)
    || markers?.uraiLifeMovieJobId !== location.jobId
    || markers?.uraiLifeMovieOwnerSha256 !== ownerHash
    || !/^[a-f0-9]{64}$/.test(String(markers?.uraiLifeMovieLeaseSha256 || ''))
    || !/^[a-f0-9]{64}$/.test(String(markers?.uraiLifeMovieAttemptSha256 || ''))) {
    throw new Error('private_media_deletion_binding_mismatch');
  }
  // A 412 must remain an error: retain permanent access fences and cleanup
  // references until the changed generation is independently reconciled.
  await file.delete({ ignoreNotFound: true, ifGenerationMatch: generation });
}

export async function inspectPrivateMedia(location: Location) {
  const [metadata] = await getStorage().bucket(location.bucket).file(location.objectPath).getMetadata();
  const generation = String(metadata.generation || ''), bytes = Number(metadata.size);
  if (!/^[1-9][0-9]*$/.test(generation) || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > PRIVATE_MEDIA_MAX_BYTES) {
    throw new Error('private_media_object_invalid');
  }
  return { generation, bytes };
}

export function privateMediaDescriptor(kind: PrivateMediaDescriptor['kind'], authorityHash: string,
  expiresAt: number, generation: string): PrivateMediaDescriptor {
  if (!/^[a-f0-9]{64}$/.test(authorityHash) || !/^[1-9][0-9]*$/.test(generation)
    || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) throw new Error('private_media_delivery_invalid');
  return { schemaVersion: 'urai-authenticated-private-media-v1', requiresAuthorization: true,
    action: 'deliver', kind, authorityHash, expiresAt, generation };
}

/** The existing bridge authenticates the request. A descriptor is an identity,
 * never a bearer capability: current bound authority is read for every chunk. */
export async function streamPrivateMedia(args: {
  descriptor: { authorityHash: string; expiresAt: number; generation: string };
  location: Location; mimeType: string; checksum?: string; disposition: 'inline' | 'attachment';
  revalidate: () => Promise<unknown>; request: any; response: any;
}) {
  const { descriptor, location, response, request } = args;
  if (!/^[a-f0-9]{64}$/.test(descriptor.authorityHash) || !/^[1-9][0-9]*$/.test(descriptor.generation)
    || !Number.isSafeInteger(descriptor.expiresAt) || descriptor.expiresAt <= Date.now()
    || descriptor.expiresAt > Date.now() + PRIVATE_MEDIA_DELIVERY_TTL_MS) throw new Error('private_media_delivery_expired');
  const allowedMime = new Set(['video/mp4', 'application/x-subrip', 'audio/mpeg', 'audio/ogg', 'audio/wav']);
  if (!allowedMime.has(args.mimeType) || (args.checksum && !/^[a-f0-9]{64}$/.test(args.checksum))) {
    throw new Error('private_media_object_invalid');
  }
  // Register cancellation before all provider and authority preflight work.
  // A caller can disconnect before the metadata promise or owner check resolves.
  const deliveryDeadline = Math.min(descriptor.expiresAt, Date.now() + 55_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, deliveryDeadline - Date.now()));
  timer.unref?.();
  const abort = () => controller.abort();
  const close = () => { if (!response.writableFinished) abort(); };
  request.once?.('aborted', abort); response.once?.('close', close);
  if (request.aborted === true) abort();
  const alive = () => {
    if (controller.signal.aborted || Date.now() >= deliveryDeadline) throw new Error('private_media_delivery_expired');
  };
  const guardedWait = async <T>(work: () => Promise<T>): Promise<T> => {
    alive();
    let detach = () => {};
    try {
      const stopped = new Promise<never>((_resolve, reject) => {
        const refuse = () => reject(new Error('private_media_delivery_expired'));
        controller.signal.addEventListener('abort', refuse, { once: true });
        detach = () => controller.signal.removeEventListener('abort', refuse);
        if (controller.signal.aborted) refuse();
      });
      return await Promise.race([
        Promise.resolve().then(() => { alive(); return work(); }),
        stopped,
      ]);
    } finally { detach(); }
  };
  try {
  alive();
  const file = getStorage().bucket(location.bucket).file(location.objectPath, { generation: descriptor.generation });
  const [metadata] = await guardedWait(() => file.getMetadata());
  const size = Number(metadata.size);
  if (String(metadata.generation) !== descriptor.generation || !Number.isSafeInteger(size)
    || size < 1 || size > PRIVATE_MEDIA_MAX_BYTES) throw new Error('private_media_object_invalid');
  await guardedWait(args.revalidate);
  let bytes = 0;
  const hash = createHash('sha256');
  const check = async () => { await guardedWait(args.revalidate); };
  const guard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      (async () => {
        if (chunk.length > 1024 * 1024) throw new Error('private_media_object_invalid');
        for (let offset = 0; offset < chunk.length; offset += 64 * 1024) {
          const part = chunk.subarray(offset, offset + 64 * 1024);
          bytes += part.length;
          if (bytes > size || bytes > PRIVATE_MEDIA_MAX_BYTES) throw new Error('private_media_object_invalid');
          await check(); hash.update(part); this.push(part);
        }
      })().then(() => callback(), error => callback(error));
    },
    flush(callback) {
      (async () => {
        await check();
        if (bytes !== size || (args.checksum && hash.digest('hex') !== args.checksum)) throw new Error('private_media_checksum_mismatch');
      })().then(() => callback(), error => callback(error));
    },
  });
  response.set({ 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'Content-Type': args.mimeType,
    'Content-Disposition': `${args.disposition}; filename="urai-private-media"` });
  await pipeline(file.createReadStream({ validation: 'crc32c' }), guard, response, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    request.removeListener?.('aborted', abort);
    response.removeListener?.('close', close);
  }
}
