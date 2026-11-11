/**
 * ONE URAI R1057: REVIEW-ONLY owner/purpose-wide drain model.
 * In-memory, no trusted identity, cloud provider, IAM, durability or real deletion ACK.
 * Never import into production code or use as a write/consent authorization service.
 */
import { newReviewSnapshot, advanceReviewSnapshot } from './life-movie-writer-fence-model.mjs';

export const REVIEW_DENIED = 'R1057_OWNER_PURPOSE_REVIEW_DENIED';
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const PURPOSE = 'life-movie.render';
const deny = () => { throw new Error(REVIEW_DENIED); };
const id = v => typeof v === 'string' && VALID_ID.test(v);
const key = s => JSON.stringify([s.tenantId, s.projectId]);

export class OwnerPurposeDrainReview {
  #owner;
  #purpose;
  #event = null;
  #scopes = new Map();
  #attemptIds = new Set();

  constructor(ownerUid, purpose = PURPOSE) {
    if (!id(ownerUid) || purpose !== PURPOSE) deny();
    this.#owner = ownerUid;
    this.#purpose = purpose;
  }
  #validate(scope) {
    if (!scope || scope.ownerUid !== this.#owner || scope.purpose !== this.#purpose ||
      !id(scope.tenantId) || !id(scope.projectId)) deny();
  }
  register(scope) {
    this.#validate(scope);
    const k = key(scope);
    if (!this.#scopes.has(k)) {
      let snapshot = newReviewSnapshot(scope);
      // A scope created after owner-wide withdrawal MUST NOT begin OPEN.
      if (this.#event) snapshot = advanceReviewSnapshot(snapshot, {
        kind: 'withdraw', scope, eventId: this.#event, expectedEpoch: 1,
      });
      this.#scopes.set(k, snapshot);
    }
    return structuredClone(this.#scopes.get(k));
  }
  transition(scope, kind, fields = {}) {
    this.#validate(scope);
    const k = key(scope);
    const current = this.#scopes.get(k);
    if (!current || !['reserve','begin-upload','bytes-committed','finalize','settle-attempt'].includes(kind)) deny();
    if (this.#event && ['reserve','begin-upload','finalize'].includes(kind)) deny();
    if (kind === 'reserve' && this.#attemptIds.has(fields.attemptId)) deny();
    const next = advanceReviewSnapshot(current, { ...fields, kind, scope: current.scope,
      expectedEpoch: current.epoch });
    if (kind === 'reserve') this.#attemptIds.add(fields.attemptId);
    this.#scopes.set(k, next);
    return structuredClone(next);
  }
  withdraw(eventId) {
    if (!id(eventId) || (this.#event && this.#event !== eventId)) deny();
    if (this.#event === eventId) return this.summary();
    const updates = new Map();
    for (const [k, current] of this.#scopes) {
      updates.set(k, advanceReviewSnapshot(current, {kind: 'withdraw',
        eventId, scope: current.scope, expectedEpoch: current.epoch}));
    }
    this.#scopes = updates;
    this.#event = eventId; // Sticky even when there were no scopes.
    return this.summary();
  }
  summary() {
    const values = [...this.#scopes.values()];
    const affectedAttempts = values.flatMap(s => s.attempts);
    const outstanding = affectedAttempts.filter(a => a.phase !== 'REVIEW_ONLY_SETTLED');
    const phase = this.#event ? 'FENCING' : 'OPEN';
    // Deliberately never produce an ACK. Point-in-time synthetic observations
    // cannot establish provider IAM, network stream termination, or generation absence.
    return Object.freeze({
      reviewOnly: true, productionAuthorized: false, deletionAcknowledgementPermitted: false,
      storageWriteFenceVerified: false, storageInventoryVerified: false,
      phase, scopeCount: values.length, attemptCount: affectedAttempts.length,
      unsettledAttemptCount: outstanding.length, allReviewAttemptsSettled: outstanding.length === 0,
      ownerUid: this.#owner, purpose: this.#purpose,
    });
  }
  acknowledge() { deny(); }
}
