# ONE URAI GENESIS — R963 canonical revocation event and acknowledgement design proposal

**Date:** 2026-11-09 UTC  
**Status:** DESIGN PROPOSAL ONLY · PRODUCTION HOLD / NO-GO  
**Repositories:** LifeLoggerAI/urai-privacy and LifeLoggerAI/urai-jobs  
**Purpose:** Define the contract needed to reconcile the preserved R647 dispatcher mechanics with Privacy R20 lineage and Jobs R923 receiver. This document does not authorize implementation, deployment, dispatch or any live data operation.

## 1. Decision required

R647 provides useful, prepared bounded-delivery mechanics, but cannot be cherry-picked unchanged into R20. R960 records four concrete incompatibilities. R962 inspected the donor implementation and its original tests, confirmed the test fixtures use mocks/VM rather than Firebase emulators, and could not run the tests because the current environment could not resolve github.com.

R963 proposes one clean protocol boundary before source work:

- One new explicit event version, not an overloaded interpretation of v1/v2.
- Immutable source authorization evidence is separate from mutable outbox delivery state.
- Jobs must persist and acknowledge the complete consent lineage envelope.
- Privacy's per-consumer ACK document is the canonical consumer application ACK.
- Jobs HTTP responses and Privacy outbox lease/delivery metadata are transport evidence, not canonical consumer-completion truth.
- A Jobs consent-block ACK never means physical GCS deletion or purge completion.

This is a proposal for Privacy, Jobs, security and legal review. It is not approved policy or implemented code.

## 2. Proposed canonical event envelope

Proposed version label: `consent.revoked.v3`. Do not reuse `consent.revoked.v1` or the existing Jobs v2 interpretation because they have incompatible field and integrity semantics.

Closed immutable envelope (illustrative type):

```ts
type ConsentRevokedV3 = Readonly<{
  schemaVersion: "consent.revoked.v3";
  eventId: string;                    // digest of immutable event identity
  consentRecordId: string;
  source: "urai-privacy";
  ownerUid: string;
  purpose: string;
  consentTier: string;
  policyVersion: string;

  sourceReceiptHash: string;          // receipt for the source transition/decision
  priorGrantReceiptHash: string | null;
  priorGrantEvidenceState:
    | "present"
    | "missing_or_invalid"
    | "not_applicable";

  sourceTransitionAt: string | null;  // never substitute outbox createdAt
  sourceTimeProvenance:
    | "firestore_snapshot_update_time"
    | "firestore_cloud_event_time"
    | "unknown";

  correlationId: string;
  contractVersion: "3";
  immutableDigest: string;            // digest of event identity fields
  integrityHash: string;              // digest of full immutable envelope sans itself
}>;
```

The exact fields, enum spellings and digest standard require joint approval. Unknown or missing values must be explicit, not defaulted.

### 2.1 Identity and integrity rules

1. Define a fixed canonical serialization across TypeScript publisher, dispatcher and Jobs receiver. Prefer a vetted canonical JSON implementation or a fixed ordered tuple with explicit null slots; do not depend on accidental property insertion order across independently constructed objects.
2. Derive `eventId` from the full immutable event identity, including the prior-grant receipt/evidence state and source-time value/provenance. Do not include mutable lease, retry, delivery, ACK or outbox creation fields.
3. Derive `immutableDigest` from the exact identity tuple. Derive `integrityHash` from the closed immutable envelope excluding only `integrityHash` itself. Document the exact algorithm, encoding, field order and test vectors.
4. The receiver recomputes both values and rejects unexpected fields, missing fields, duplicate/ambiguous identity, malformed/null combinations and a record whose document ID differs from eventId.
5. Jobs' ACK hash must bind the complete v3 event identity and the exact applied action. It must include the prior-grant pair and source-time provenance; it must not include mutable cleanup counters or delivery-attempt metadata.
6. The digest is integrity/collision evidence, not a digital signature and not proof of trusted provenance by itself. Transport identity, service IAM and token claims remain separately required.

## 3. Source time must not be invented

R647 maps the outbox row's `createdAt` into Jobs `revokedAt`. R960 correctly rejects that semantic substitution.

The Privacy publisher must carry source-transition time as a distinct immutable field and label where it came from. Candidate evidence sources are the Firestore source snapshot's update time or the Firestore CloudEvent time, according to the exact event type and documented provider semantics. The implementation owner must prove which is available and appropriate for each transition, including document deletion and identity replacement.

If neither source can be established, set `sourceTransitionAt: null` and `sourceTimeProvenance: "unknown"`. Such an event should be quarantined for review or handled under an explicit approved legacy policy. It must not be made dispatchable by substituting `createdAt`, `updatedAt`, dispatcher claim time or retry time.

Keep these times separate:
- source consent transition time and provenance;
- outbox creation time;
- delivery due/lease time;
- HTTP dispatch/response time;
- canonical consumer ACK time;
- Storage object generation deletion/verification time.

## 4. Immutable event versus mutable delivery state

Keep immutable consent facts distinct from delivery scheduling and mutable progress.

Proposed immutable event fields are only those in the v3 envelope.

Proposed mutable outbox delivery metadata (illustrative):
- `delivery.consumerId = "urai-jobs"`;
- `delivery.state = pending | leased | retry | delivered | needs-review`;
- `delivery.attempts`;
- `delivery.nextAttemptAt`;
- `delivery.leaseToken`;
- `delivery.leaseExpiresAt`;
- `delivery.lastFailureCode`;
- `delivery.lastTransportAckHash`;
- `delivery.deliveredAt`.

The implementation must choose either nested delivery metadata or an equally unambiguous flat namespace. The example is not a mandate to restore the legacy `jobsDelivery*` fields.

Rules:
- Dispatcher query may select only valid, due, explicitly initialized deliveries.
- A missing delivery block is not automatically safe to backfill. Legacy events require explicit classification.
- All lease claim/finalization operations verify state, token, attempt, event digest and current consent authority.
- Every external send occurs outside a Firestore transaction.
- A timeout after Jobs commit is an at-least-once delivery case; Jobs must be idempotent and return the same canonical receipt for the same event identity.
- A response timeout or unverifiable ACK remains retry/reconciliation, never applied.
- Invalid source, missing required lineage, unknown source time, contradictory lease or conflicting ACK moves to needs-review, not silent retry forever.

## 5. Acknowledgement authority — proposed one-source-of-truth model

### Canonical application ACK

Use Privacy's per-consumer `consentRevocationOutbox/<eventId>/acknowledgements/<consumerId>` record as the canonical consumer application ACK, after reviewed changes to its schema and integrity checks.

It records:
- eventId and v3 schema;
- consumerId bound to trusted system token claims;
- status `applied` or `rejected`;
- correlationId;
- detailHash over the complete v3 event digest, Jobs receipt hash and exact action;
- actor/service identity and acknowledgement time;
- its own integrity hash.

The current R20 callable already binds `consumerId` to a trusted system token claim and refuses conflicting immutable ACKs. Preserve those strengths, but upgrade event version and make the ACK transaction verify the full outbox immutable digest, not only eventId/schema presence.

### Jobs HTTP response

Jobs returns a bounded, strictly validated response after its transaction has committed:
- exact eventId and schema version;
- consumerId `urai-jobs`;
- Jobs local receipt ID/hash;
- exact action: consent block applied for owner + purpose + lineage;
- action status `applied` or explicit `rejected/needs-review`;
- ACK hash over immutable event identity and action.

This HTTP response is the dispatcher's authenticated transport proof. It is not the final Privacy-side canonical ACK until the dispatcher submits it through the separately authenticated Privacy ACK operation.

### Outbox delivery projection

The mutable outbox delivery state is a scheduling/transport projection:
- `pending/leased/retry/needs-review` describes dispatcher work.
- `delivered` means the canonical Privacy ACK transaction succeeded for Jobs.
- Root summary fields may be maintained transactionally as projections of the per-consumer ACK, but they are not independent sources of truth.
- Do not use ambiguous `applied` for both “HTTP response received” and “consumer ACK committed”.
- If root delivery status and ACK subdocument disagree, stop and reconcile; do not overwrite either silently.

### Explicit semantic boundary

A Jobs ACK can certify only the action actually performed by Jobs, such as committing its local owner/purpose consent block and a durable event receipt.

It does not certify:
- privileged GCS writer denial;
- in-flight upload/stream drain;
- exact generation deletion;
- derivative purge in unrelated services;
- final absence from every downstream store;
- completion of every required consumer.

Those are separate consumer and provider acceptance gates.

## 6. Delivery sequence and failure recovery

Proposed sequence, for review:

1. Privacy detects canonical consent transition and builds v3 immutable envelope.
2. Privacy transactionally creates immutable outbox event and explicit mutable delivery state. Replay classifier compares the complete immutable envelope; same event is idempotent, partial legacy lineage is classified, conflict is rejected.
3. A reviewed system-only dispatcher claims a bounded lease after validating its exact service identity, token, destination and current consent state.
4. Dispatcher sends v3 event to pinned Jobs endpoint outside Firestore transaction.
5. Jobs strictly validates schema, event digest, source provenance and tenant/owner scope; transactionally applies the consent block and creates an immutable local receipt idempotently.
6. Jobs returns a verifiable response binding the complete v3 event and its local action receipt.
7. Dispatcher invokes the authenticated Privacy ACK operation with token-bound consumer identity and a detailHash of the Jobs response + immutable envelope.
8. Privacy ACK transaction creates exactly one immutable per-consumer ACK and updates a projection. A byte-for-byte identical retry is idempotent; a conflicting retry is rejected.
9. Dispatcher marks its delivery projection delivered only after it can read/verify the canonical Privacy ACK. If step 7/8 timed out after success, the retry reads the existing ACK and recognizes identical completion.
10. Physical Storage denial and purge proceed as a separate, independently authorized workflow with exact generation and final absence evidence.

### Required failure tests

- Duplicate publisher trigger and exact same immutable outbox replay.
- Event ID collision with different prior grant or source time.
- Partial/legacy missing lineage, malformed hash and unknown source time.
- Dispatcher crash after lease claim and lease expiry.
- Jobs commits block but HTTP response times out.
- HTTP response returns but Privacy ACK transaction times out after commit.
- Same ACK replay and conflicting ACK replay.
- Consent regrant/replacement while network transit is in progress.
- Canonical Firestore updateTime changes between claim and finalization.
- Wrong service token, wrong token consumerId, wrong endpoint/host and redirect response.
- Maximum retry exhaustion and dead-letter/reconciliation.
- ACK from Jobs does not set storage-purge-complete or deletion-finalized status.

## 7. Legacy disposition proposal

Do not rewrite old outbox records in place to look like v3. Do not infer prior grant receipts.

Classify legacy records:
- exact old v1 with complete original immutable evidence and a separately approved mapping policy;
- legacy-missing-lineage;
- conflicting/partial lineage;
- unknown source transition time;
- missing delivery metadata;
- existing ACK/root delivery state mismatch.

Only exact, policy-approved records may be mapped into a new delivery representation, and the migration must preserve the original event and integrity hash. Otherwise mark for manual/privacy review or leave undispatched. Record who approved each disposition and why. This migration requires a separate review and test plan.

## 8. Required source work after approval

Privacy review-only changes:
- new v3 schema/contract and stable serializer/test vectors;
- publisher stores source transition time with provenance and both receipt hashes;
- publisher creates delivery metadata under the new envelope version;
- replay classifier compares the entire immutable envelope and preserves R20 collision refusal;
- dispatcher mapper verifies v3 and carries every field;
- dispatcher keeps R647 lease/retry/stale-worker protections;
- dispatcher invokes and verifies the canonical Privacy ACK and reads it back before marking delivery projection delivered;
- wrapper is separately reviewed and system-only, with dedicated secret/IAM and no client activation.

Jobs review-only changes:
- strict v3 Zod schema and exact canonical digest verifier;
- idempotent local block/receipt bound to owner, purpose, prior grant, policy, source time and event digest;
- response ACK binds the complete event and exact block action;
- explicit response semantics that do not imply storage purge;
- regression tests for each negative/failure mode.

Do not implement until privacy/legal/security owners accept the meaning of source-time, missing-lineage and consumer-ACK fields.

## 9. R963 current evidence boundary and next tasks

R962 verified six donor source/blob pins by GitHub readback. It inspected both original donor test files:
- dispatcher state test: 10 top-level tests;
- contract/transport test: 16 top-level tests.

These files use Node test, TypeScript transpilation, VM loading, fake Firestore and mocked HTTP/transport. They are not emulator acceptance.

R962 did not run tests or typecheck: a read-only git ls-remote attempt failed with DNS error “Could not resolve host: github.com”. No checkout, dependency install, emulator, dispatcher invocation or provider access occurred.

Immediate next execution:
1. When GitHub DNS/network is available, clean detached checkout of exact R647 head.
2. Verify commit/tree and six exact blobs.
3. Locked dependency install; run both original focused Node commands separately; then Functions typecheck.
4. Capture raw TAP, exit code, Node/TS versions, lockfile hash, commit/tree and log SHA256. Do not edit donor files to force a pass.
5. Obtain privacy/legal/security review of this v3 event and ACK proposal.
6. Only then make separate Privacy and Jobs review-only source changes and create same-SHA emulator acceptance.
7. Keep live provider inventory and real nonproduction GCS 403/upload drain/purge ACK separate.

## 10. Final classification

**R963 delivered:** a proposed canonical event envelope, source-time provenance requirement, immutable/mutable state separation, single canonical consumer-ACK model, at-least-once delivery recovery model, legacy disposition and test matrix.

**Not implemented or approved:** v3 schema, dispatcher changes, Jobs receiver changes, ACK wiring, scheduler/task wrapper, migration or provider behavior.

**NO MERGE / NO DEPLOY / NO DISPATCH / NO PRIVATE MEDIA / NO IAM CHANGE / NO PAID COMPUTE. ONE URAI GENESIS — PRODUCTION HOLD.**
