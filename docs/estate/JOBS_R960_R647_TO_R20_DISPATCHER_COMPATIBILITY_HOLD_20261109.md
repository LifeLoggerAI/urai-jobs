# ONE URAI GENESIS — R960 R647 dispatcher-to-R20 compatibility proof and safe reconciliation plan

**Date:** 2026-11-09 UTC. **Disposition: PRODUCTION HOLD / NO-GO.**
**Scope:** immutable GitHub source comparison of historical Privacy dispatcher donor and latest Privacy R20 publisher plus Jobs R923 receiver. Documentation-only checkpoint; no application edits, tests, cloud/provider access, endpoint calls, IAM changes, merges, deployments or media processing.

## 1. Finding

The R647 dispatcher is a genuine prepared implementation worth preserving, but **it is not compatible with Privacy R20 and must not be cherry-picked/deployed unchanged**. Four concrete incompatibilities are source-proven:

1. R20 no longer writes the four queue fields the dispatcher query requires.
2. R20 changed the publisher integrity-hash input by adding prior-grant evidence; the R647 mapper recomputes the older hash and will reject R20 events.
3. R647 v2 projection discards `priorGrantReceiptHash` and `priorGrantEvidenceState`.
4. R647 derives Jobs `revokedAt` from outbox `createdAt` (server time when the outbox row is created), while R20 publisher does not preserve the actual source event time as a distinct immutable revocation timestamp. Those timestamps must not be silently treated as equivalent.

This confirms the correct recovery path is **port the donor's bounded lease/retry/ACK mechanics under a newly reviewed v2 envelope**, not restore old fields blindly or treat R647 as an already working end-to-end integration.

## 2. Exact source pins

### Historical Privacy donor — R647 #214

Repo `LifeLoggerAI/urai-privacy`, head `cc0692053db3b1b8df8267d43856b1a3357de8a0`.

| File | Git blob |
|---|---|
| `functions/src/consent-revocation-jobs-dispatcher.ts` | `4126167b4350ba8afe6b19d7b60dec1ca891189f` |
| `functions/src/consent-revocation-jobs-contract.ts` | `6cca2b9456319927cf22511c7d51c1f16ddf051c` |
| `functions/src/consent-revocation.ts` (donor publisher) | `5b069b79d657b5c2006dd0ab45c8e60709ff0a89` |
| `functions/src/functions-entry.ts` | `f81171feb058be606be19134928c4baf9830f664` |

### Current Privacy R20 #256

Repo `LifeLoggerAI/urai-privacy`, head `cfc9de884dc112210c20b5b680e8eb08fdf8396c` (immutable head as returned by PR metadata: `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`).

| File | Git blob |
|---|---|
| `functions/src/consent-revocation.ts` | `84f1e77d5c1cf55f80aaa0a559b6a3eac781386e` |
| `functions/src/consent-revocation-transition.ts` | `0ddee615f1284a58459aae48b915a574da7c9c9e` |
| `functions/src/functions-entry.ts` | `59a6dcda725a322081f0609f5f01e81de801ee81` |

### Jobs R923 #371 receiver

Repo `LifeLoggerAI/urai-jobs`, head `df19633466eaebdda844569ed0d562245bd31dc6`.

| File | Git blob |
|---|---|
| `functions/src/privacy/consentRevocation.ts` | `bf28abe6dec01330909f6e6f8bdea909d5a3b920` |

## 3. Four exact incompatibilities

### A. Missing dispatcher queue fields on R20 outbox

R647 dispatcher scans for all of:
- `jobsDeliveryConsumerId === "urai-jobs"`
- `jobsDeliveryState` in `pending | retry | leased`
- `jobsNextAttemptAt <= now`

The R647 donor publisher initializes:
- `jobsDeliveryConsumerId: "urai-jobs"`
- `jobsDeliveryState: "pending"`
- `jobsDeliveryAttempts: 0`
- `jobsNextAttemptAt: FieldValue.serverTimestamp()`

R20 publisher does not initialize those four fields. Thus new R20 outbox events are invisible to the old dispatcher query unless a separately reviewed migration/backfill or publisher repair supplies compatible delivery state. Legacy rows missing queue metadata must be explicitly classified; do not blanket-backfill them as safe to deliver.

### B. Publisher integrity hash changed

R647 mapper verifies:
`integrityHash = SHA256({ eventId, recordId, uid, purpose })`

R20 publisher writes:
`integrityHash = SHA256({ eventId, recordId, uid, purpose, priorGrantReceiptHash, priorGrantEvidenceState })`

The exact object differs; therefore the old R647 mapper's `data.integrityHash !== hash({eventId, recordId, uid, purpose})` check rejects current R20 events. Restoring the four query fields alone cannot make delivery succeed.

### C. Prior-grant evidence gets discarded

R20 outbox includes:
- `priorGrantReceiptHash`
- `priorGrantEvidenceState` (`present`, `missing_or_invalid`, `not_applicable`)

R647 `JobsRevocationEventV2` and `buildJobsRevocationEventV2` only map:
- type, eventId, ownerUid, purpose, policyVersion, correlationId, revokedAt, sourceReceiptHash.

The prior grant receipt and evidence state are not part of the Jobs event type, ACK hash, receiver receipt, or integrity comparison. A consumer cannot prove which previously granted receipt was superseded.

### D. Source revocation time and outbox creation time are conflated

R647 mapper's `isoDate(data.createdAt)` explicitly converts a Firestore server timestamp on the outbox row to Jobs `revokedAt`. R20 publisher computes event identity from the consent record before/after values but does not write a distinct immutable `revokedAt` source timestamp into the outbox. Outbox creation/delivery scheduling time is not a safe substitute for when the consent transition occurred. New contract must define the authoritative timestamp source and include it in the event identity/integrity calculation; if unavailable, mark source time unknown and require reconciliation, not invent one.

## 4. What remains worth reusing from R647

The dispatcher donor has meaningful mechanics:
- strict endpoint host/path and bearer shape validation before leasing;
- bounded batch (20), per-record UUID lease and ownership metadata;
- maximum 12 attempts and bounded exponential backoff;
- corruption/invalid lease/exhausted attempt quarantine to `needs-review`;
- validates canonical consent record identity and Firestore updateTime before network transit;
- revalidates event immutable data, lease ownership and consent authority stamp after delivery before finalizing;
- remote network send occurs outside Firestore transactions;
- only a verified Jobs response lets the Privacy outbox root field transition to `applied`.

These are useful donor semantics. They are not activated: the donor explicitly says prepared/not deployed, and its Functions entrypoints do not export it.

## 5. ACK semantics still need a deliberate decision

The donor dispatcher treats the returned Jobs HTTP response and verified `acknowledgementHash` as the receipt needed to update `jobsDeliveryState = applied` and `jobsDeliveryAckHash` on the root outbox record.

R20 also has a distinct trusted `acknowledgeConsentRevocation` callable, which writes `acknowledgements/{consumerId}` plus audit data. The donor does not call this callable.

A new design must choose one canonical ACK path or explicitly define a single transactionally reconciled projection. Do not permit root `applied`, subcollection `applied`, last-ACK summaries and a Jobs local receipt to drift as four apparent sources of truth. Any Privacy ACK should say precisely “Jobs consent block accepted/applied”; it must not certify physical media purge.

## 6. Required new canonical contract (proposal, not code)

Define a new, versioned event, separate from incompatible historical v1 meanings. Minimum bound fields:

- `schemaVersion`, immutable `eventId`, `consentRecordId`, canonical owner UID and purpose;
- current receipt hash plus prior-grant receipt hash and explicit prior evidence state;
- consent tier, policy version, source transition timestamp with provenance;
- immutable source-transition digest and integrity hash over **all** immutable fields;
- stable correlation ID, tenant/service scope and event source identity;
- explicit mapping/version identifier and creation timestamp kept separately from source revocation timestamp.

The v2 mapper must validate the exact complete publisher envelope; Jobs must persist all security-relevant lineage and return an ACK hash bound to that full envelope. Missing/legacy lineage must be quarantined or follow a separately reviewed disposition, never silently backfilled.

## 7. Next execution sequence

1. Preserve the R647 dispatcher and contract blobs as donor-only; no cherry-pick or deployment.
2. Draft the new shared event schema and tests as separate review-only changes across Privacy and Jobs.
3. Add queue metadata to newly created R20 outbox records only under the new validated schema, preserving immutable identity and deterministic retry semantics.
4. Upgrade mapper and Jobs receiver to verify and persist all prior-grant evidence and source timestamp provenance.
5. Reconcile root delivery ACK and Privacy trusted ACK semantics; define whether the ACK callable remains an audit projection or the sole canonical consumer ACK.
6. Add the system-only scheduler/task wrapper only after secret audience, runtime service identity, service IAM, exact endpoint and retry/DLQ policy are approved.
7. Execute the original donor dispatcher test suite only after it is adapted to the new immutable contract, then run Privacy publisher → dispatcher → Jobs receiver → canonical ACK using disposable Firebase emulators on one source manifest.
8. Separately prove real nonproduction privileged Storage write-denial, active upload drain, exact-generation deletion and downstream purge ACK.

## 8. Related newer review context

Jobs PR #390 / R932 is a draft test of Studio #201's Life Movie create-request Zod schema. Its fixture explicitly uses a synthetic receipt and asserts that Jobs consent authority remains unavailable and job deferral remains true. This is a useful parser contract, but it is not the revocation dispatcher protocol and it does not certify cross-service consent or rendering.

## 9. Final classification

**Confirmed:** R647 dispatcher exists as an unmerged library; it has sound bounded-delivery mechanics worth preserving; R20's outbox payload is not compatible with it because queue metadata, integrity hash semantics, prior-grant lineage projection and source-time provenance differ; Jobs R923 accepts the reduced older v2 projection; no deployment or integrated acceptance has been established.

**Unknown:** any external deployed dispatcher, actual cloud function/service revisions, secret bindings, scheduler/tasks, effective IAM, real event delivery, full consumer ACK roster, GCS denial, upload drain and physical purge.

**NO CHERRY-PICK / NO MERGE / NO DEPLOY / NO DISPATCH / NO PRIVATE MEDIA / NO IAM CHANGE. ONE URAI GENESIS — PRODUCTION HOLD.**
