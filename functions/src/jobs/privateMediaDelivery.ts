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
  if ((local.exists && (own?.ownerHash !== ownerHash || own?.deleted === true))
    || (central.exists && (canonical?.uid !== ownerUid || canonical?.active === true))) {
    throw new Error('private_media_owner_deleted');
  }
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
  const file = getStorage().bucket(location.bucket).file(location.objectPath, { generation: descriptor.generation });
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  if (String(metadata.generation) !== descriptor.generation || !Number.isSafeInteger(size)
    || size < 1 || size > PRIVATE_MEDIA_MAX_BYTES) throw new Error('private_media_object_invalid');
  await args.revalidate();
  if (Date.now() >= descriptor.expiresAt) throw new Error('private_media_delivery_expired');
  // Keep the controller's original 60-second native timeout; rendering remains
  // queued and one private byte request has a shorter cleanup deadline.
  const deliveryDeadline = Math.min(descriptor.expiresAt, Date.now() + 55_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, deliveryDeadline - Date.now()));
  timer.unref?.();
  const abort = () => controller.abort();
  const close = () => { if (!response.writableFinished) abort(); };
  request.once?.('aborted', abort); response.once?.('close', close);
  let bytes = 0;
  const hash = createHash('sha256');
  const check = async () => {
    if (controller.signal.aborted || Date.now() >= deliveryDeadline) throw new Error('private_media_delivery_expired');
    await args.revalidate();
    if (controller.signal.aborted || Date.now() >= deliveryDeadline) throw new Error('private_media_delivery_expired');
  };
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
  try { await pipeline(file.createReadStream({ validation: 'crc32c' }), guard, response, { signal: controller.signal }); }
  finally { clearTimeout(timer); request.removeListener?.('aborted', abort); response.removeListener?.('close', close); }
}
