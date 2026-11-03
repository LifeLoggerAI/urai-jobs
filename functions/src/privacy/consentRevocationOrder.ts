/** Fail-closed ordering fence for a new revocation delivered to Jobs.
 * This is a veto on stale incoming events, not an assertion of a consent grant.
 * In particular, a cleared block requires an independently verified grant
 * reconciliation protocol before subsequent revocations may be applied. */
export type IncomingRevocationIdentity = Readonly<{
  eventId: string;
  ownerUid: string;
  purpose: string;
  revokedAt: string;
}>;

function trustedTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) return null;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 19) !== value.slice(0, 19)) return null;
  return millis;
}

export function mayApplyNewConsentRevocation(
  previousBlockExists: boolean,
  previousBlock: unknown,
  incoming: IncomingRevocationIdentity,
): boolean {
  if (typeof previousBlockExists !== 'boolean' || !incoming || typeof incoming !== 'object') return false;
  if (!incoming.eventId || !incoming.ownerUid || !incoming.purpose ||
      trustedTimestamp(incoming.revokedAt) === null) return false;
  if (!previousBlockExists) return true;
  if (!previousBlock || typeof previousBlock !== 'object' || Array.isArray(previousBlock)) return false;
  const prior = previousBlock as Record<string, unknown>;
  // Never overwrite an unverified block, a cleared grant boundary, or another
  // owner's state. A new revocation must have STRICTLY newer timestamp proof.
  if (prior.active !== true || prior.ownerUid !== incoming.ownerUid ||
      prior.purpose !== incoming.purpose || typeof prior.eventId !== 'string' ||
      !prior.eventId || prior.eventId === incoming.eventId) return false;
  const priorAt = trustedTimestamp(prior.revokedAt);
  const incomingAt = trustedTimestamp(incoming.revokedAt);
  if (priorAt === null || incomingAt === null || incomingAt <= priorAt) return false;
  return true;
}
