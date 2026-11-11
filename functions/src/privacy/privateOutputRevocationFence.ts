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
  if (!event || !context || !event.eventId || !event.ownerUid ||
      event.purpose !== 'life-movie.render' ||
      typeof context.replay !== 'boolean' || typeof context.priorBlockExists !== 'boolean') deny();
  if (existing === undefined || existing === null) {
    return {kind:'create',state:{schemaVersion:'R1027_PRIVATE_OUTPUT_FENCE_V1',
      ownerUid:event.ownerUid,purpose:event.purpose,eventId:event.eventId,
      epoch:1,phase:'FENCING', legacyLineageUnverified:context.replay || context.priorBlockExists,
      storageWriteAuthorized:false, storageWriteFenceVerified:false,
      allWritersDrained:false, privateOutputDeletionAcknowledged:false}};
  }
  if (typeof existing !== 'object' || Array.isArray(existing)) deny();
  const value = existing as Record<string, unknown>;
  if (value.schemaVersion !== 'R1027_PRIVATE_OUTPUT_FENCE_V1' ||
      value.ownerUid !== event.ownerUid || value.purpose !== event.purpose ||
      typeof value.eventId !== 'string' || !value.eventId ||
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
