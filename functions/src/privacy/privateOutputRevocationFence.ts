import { createHash } from 'node:crypto';
/**
 * R1027 server-owned revocation epoch state, written in the SAME Firestore
 * transaction as the canonical Jobs consent block and event receipt.
 * No broker reads this yet. This state NEVER grants private Storage writes,
 * proves GCS IAM, drains a previous upload, or acknowledges deletion.
 */
export const PRIVATE_OUTPUT_FENCE_COLLECTION = 'lifeMoviePrivateOutputRevocationFences';
export const PRIVATE_OUTPUT_FENCE_DENIED = 'life_movie_private_output_fence_unverified';
export type PrivateOutputFenceEvent = Readonly<{ eventId:string; ownerUid:string; purpose:string }>;
export type PrivateOutputFenceTransition =
  | Readonly<{kind:'create' | 'update'; state:Readonly<Record<string, unknown>>}>
  | Readonly<{kind:'replay'}>;
export function privateOutputFenceId(ownerUid: string, purpose: string): string {
  return createHash('sha256').update('urai-private-output-revocation-fence-v1\n'+ownerUid+'\n'+purpose).digest('hex');
}
export function nextPrivateOutputFence(
  existing: unknown, event: PrivateOutputFenceEvent,
  context: Readonly<{replay:boolean; priorBlockExists:boolean; priorBlock:unknown}>,
): PrivateOutputFenceTransition {
  const deny = (): never => { throw new Error(PRIVATE_OUTPUT_FENCE_DENIED); };
  // Treat server document data as untrusted until its exact schema is checked.
  // Reject extra privilege-like fields rather than letting a future broker
  // accidentally consume an attacker/legacy-written `authorized` alias.
  const safeId = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);
  if (!event || !context || !safeId(event.eventId) || !safeId(event.ownerUid) ||
      event.purpose !== 'life-movie.render' ||
      typeof context.replay !== 'boolean' || typeof context.priorBlockExists !== 'boolean') deny();
  if (existing === undefined || existing === null) {
    return {kind:'create',state:{schemaVersion:'R1027_PRIVATE_OUTPUT_FENCE_V1',
      ownerUid:event.ownerUid,purpose:event.purpose,eventId:event.eventId,
      epoch:1,phase:'FENCING', legacyLineageUnverified:context.replay || context.priorBlockExists,
      storageWriteAuthorized:false, storageWriteFenceVerified:false,
      allWritersDrained:false, privateOutputDeletionAcknowledged:false}};
  }
  // VM-based original-handler contract tests return plain objects created in
  // another JavaScript realm. Compare prototype shape rather than realm identity.
  if (typeof existing !== 'object' || Array.isArray(existing)) deny();
  const prototype = Object.getPrototypeOf(existing);
  if (prototype !== null &&
      (Object.getPrototypeOf(prototype) !== null ||
       Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value?.name !== 'Object')) deny();
  const value = existing as Record<string, unknown>;
  const required = new Set(['schemaVersion','ownerUid','purpose','eventId','epoch',
    'phase','legacyLineageUnverified','storageWriteAuthorized',
    'storageWriteFenceVerified','allWritersDrained','privateOutputDeletionAcknowledged']);
  const allowed = new Set([...required,'createdAt','updatedAt']);
  if (Reflect.ownKeys(value).some(k => {
        if (typeof k !== 'string' || !allowed.has(k)) return true;
        const descriptor = Object.getOwnPropertyDescriptor(value, k);
        return !descriptor || !Object.hasOwn(descriptor, 'value');
      }) || [...required].some(k => !Object.hasOwn(value,k))) deny();
  if (value.schemaVersion !== 'R1027_PRIVATE_OUTPUT_FENCE_V1' ||
      value.ownerUid !== event.ownerUid || value.purpose !== event.purpose ||
      !safeId(value.eventId) ||
      !Number.isSafeInteger(value.epoch) || (value.epoch as number) < 1 ||
      (value.epoch as number) >= Number.MAX_SAFE_INTEGER ||
      value.phase !== 'FENCING' ||
      typeof value.legacyLineageUnverified !== 'boolean' ||
      value.storageWriteAuthorized !== false ||
      value.storageWriteFenceVerified !== false ||
      value.allWritersDrained !== false ||
      value.privateOutputDeletionAcknowledged !== false) deny();
  if (context.replay) {
    if (value.eventId !== event.eventId) deny();
    return {kind:'replay'};
  }
  if (!context.priorBlockExists || !context.priorBlock ||
      typeof context.priorBlock !== 'object' || Array.isArray(context.priorBlock)) deny();
  const prior = context.priorBlock as Record<string, unknown>;
  if (prior.eventId !== value.eventId || prior.ownerUid !== event.ownerUid ||
      prior.purpose !== event.purpose || prior.active !== true ||
      event.eventId === value.eventId) deny();
  return {kind:'update',state:{epoch:(value.epoch as number)+1,eventId:event.eventId,
    phase:'FENCING',legacyLineageUnverified:value.legacyLineageUnverified,
    storageWriteAuthorized:false,storageWriteFenceVerified:false,
    allWritersDrained:false,privateOutputDeletionAcknowledged:false}};
}
