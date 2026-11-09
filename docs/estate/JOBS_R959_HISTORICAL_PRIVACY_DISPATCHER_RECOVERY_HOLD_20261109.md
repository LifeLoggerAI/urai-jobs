# ONE URAI GENESIS — R959 historical Privacy dispatcher recovery and integration gap correction

**Date:** 2026-11-09 UTC. **Disposition: PRODUCTION HOLD / NO-GO.**
**Scope:** read-only GitHub history/tree/source inspection correcting R957–R958 dispatcher-discovery wording. No app code changes, tests executed, service invocation, cloud/provider access, credentials, IAM, merge, deployment, paid compute or private media.

## 1. Correction to prior handoffs

R957/R958 found no dispatcher in the current Privacy R20/main or Jobs main/R923 function entrypoints. That remains true. But the broad statement that no dispatcher implementation was found anywhere in Privacy history was too strong.

A substantial **prepared, review-only, explicitly NOT DEPLOYED** Privacy → Jobs dispatcher library exists in an older review lineage: Privacy [#213 R583](https://github.com/LifeLoggerAI/urai-privacy/pull/213) / [#214 R647](https://github.com/LifeLoggerAI/urai-privacy/pull/214), at R647 head:

`cc0692053db3b1b8df8267d43856b1a3357de8a0`

This historical recovery changes the accurate classification to:

- **Dispatcher source exists:** yes, as an unmerged library candidate in an older Privacy review branch.
- **Dispatcher exported/activated as a Firebase Function:** no, at that exact candidate; its own code says NOT DEPLOYED and the Functions entrypoints do not export it.
- **Dispatcher present in latest Privacy R20 #256:** no; the R20 exact tree contains no `consent-revocation-jobs-dispatcher.ts` or companion contract/HTTP/delivery modules.
- **Dispatcher deployed in cloud:** UNKNOWN; no provider inventory or deployed source fingerprint was read.
- **Latest Privacy R20 outbox compatible with the historical dispatcher:** not as currently read back; required queue fields were dropped, and the prior-grant lineage fields introduced by R19/R20 are not carried by the old v2 projection.

## 2. Historical R647 implementation, exact source pins

Repository: `LifeLoggerAI/urai-privacy`; draft PR #214, based on draft PR #213.

| File | Git blob at R647 head |
|---|---|
| `functions/src/consent-revocation-jobs-dispatcher.ts` | `4126167b4350ba8afe6b19d7b60dec1ca891189f` |
| `functions/src/consent-revocation-jobs-contract.ts` | `6cca2b9456319927cf22511c7d51c1f16ddf051c` |
| `tests/consent-revocation-dispatcher-contract.test.mjs` | `def1048aa4838f7ff990d792a27d1fb94e7f6441` |
| `tests/consent-revocation-jobs-contract.test.mjs` | `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa` |
| `functions/src/consent-revocation.ts` | `5b069b79d657b5c2006dd0ab45c8e60709ff0a89` |
| `functions/src/functions-entry.ts` | `f81171feb058be606be19134928c4baf9830f664` |

The dispatcher source header explicitly states:
- “Prepared, NOT DEPLOYED”.
- “No timer, callable, scheduler, or functions-entry export is installed here.”
- A reviewed system-only wrapper must obtain the dedicated secret from Secret Manager, verify runtime IAM, and explicitly call the library.
- It is a library function, not an activated Cloud Scheduler endpoint.

The exact R647 `functions/src/index.ts` and `functions/src/functions-entry.ts` do not export `dispatchPendingJobsRevocations` or import the dispatcher module. R647 `firebase.json` declares the ordinary Privacy Functions codebase only; no dedicated dispatcher codebase/scheduler wrapper exists in this candidate.

## 3. What the historical dispatcher actually implements

This is substantial code, not just a placeholder:

- Bounded Firestore scan of `consentRevocationOutbox` records with `jobsDeliveryConsumerId === "urai-jobs"`, state pending/retry/leased and due next-attempt time; maximum batch 20.
- Per-event transaction claim with UUID lease, strict lease metadata and attempt budget, 60-second lease, maximum 12 attempts, bounded exponential retry from 30 seconds to one hour.
- Validates the current canonical consent document and Firestore updateTime stamp before delivery and rechecks it and the immutable publisher payload again before finalization.
- Uses a pinned HTTPS Jobs destination host/path and a dedicated bearer token.
- Maps the Privacy v1 outbox record to Jobs v2 and verifies the returned Jobs acknowledgement hash, consumer ID and event ID.
- Records `jobsDeliveryState = applied` only after a verified Jobs ACK; otherwise records retry or needs-review. Stale lease owners cannot finalize another worker's attempt.

The dispatcher writes its own root outbox delivery state and ACK hash. This is not the same as calling the separate Privacy `acknowledgeConsentRevocation` callable or creating a per-consumer `acknowledgements/{consumerId}` subdocument. The historical candidate therefore contains a distinct ACK mechanism; the canonical design must decide whether to consolidate the root delivery state and subcollection ACK or define their relationship explicitly.

## 4. Historical contract limitation: prior-grant lineage is not carried

The R647 `buildJobsRevocationEventV2` validates a Privacy v1 outbox record and constructs a Jobs v2 envelope containing:
- eventId, ownerUid, purpose, policyVersion, correlationId, revokedAt, sourceReceiptHash.

It validates the source event ID and integrity hash, source record scope and server timestamp. Its type and mapper do **not** include `priorGrantReceiptHash` or `priorGrantEvidenceState`. The dispatcher therefore predates the R19/R20 prior-grant lineage requirements.

It also relies on `createdAt` to derive the Jobs v2 `revokedAt` timestamp. Any new canonical contract should distinguish source event/decision time from outbox creation time and must not silently reinterpret one as the other.

## 5. Critical current-vs-historical source divergence

### R647 publisher

The R647 historical publisher `functions/src/consent-revocation.ts` blob `5b069b79d657b5c2006dd0ab45c8e60709ff0a89` populated these dispatcher queue fields in newly created outbox documents:
- `jobsDeliveryConsumerId: "urai-jobs"`
- `jobsDeliveryState: "pending"`
- `jobsDeliveryAttempts: 0`
- `jobsNextAttemptAt: FieldValue.serverTimestamp()`

### R20 publisher

The latest reviewed Privacy R20 publisher `functions/src/consent-revocation.ts` blob `84f1e77d5c1cf55f80aaa0a559b6a3eac781386e` adds `priorGrantReceiptHash` / `priorGrantEvidenceState`, but the inspected immutable event it creates does **not** include those four `jobsDelivery*` queue fields. The R20 exact tree does not include the R647 dispatcher, contract, HTTP transport or delivery adapter files.

This creates a precise integration regression: even if the old dispatcher library were copied/exported without reconciliation, its bounded query would not discover new R20 outbox events because the required queue fields are absent. The new prior-grant fields would also be discarded by the old Jobs v2 event projection.

## 6. Review status / evidence boundaries

- Privacy #213 and #214 are open draft review branches; no merge or deployment established.
- PR #214 body records it as a Jobs #272 source-lineage pin/review addition and explicitly does not transfer old four-service emulator proof to the newer source.
- The dispatcher contract and test files exist in the branch, and package scripts reference dispatcher-related tests. This report did not execute them. Source/test presence and script enrollment are not an executed test receipt.
- R647 dispatcher header and missing entrypoint export are direct source facts.
- Current Privacy R20 and main exact trees lack those dispatcher modules. This does not prove no separate hosted service exists.
- Current Jobs R923 v2 receiver still explicitly returns `privateOutputDeletionAcknowledged: false` and `storageWriteFenceVerified: false`. A dispatcher-level ACK means Jobs accepted/applied its defined consent block/derivative operation, not a certified physical purge.
- The actual deployed service revisions, schedules, task queues, Pub/Sub, Eventarc, Cloud Run services, Secret Manager bindings and IAM remain UNKNOWN.

## 7. Required reconciliation, not blind cherry-pick

1. Use R647 as a historical implementation donor, preserving its exact blobs and tests; do not deploy it as-is.
2. Reconcile the R19/R20 publisher's original grant lineage and immutable replay identity into the dispatcher queue schema; ensure event ID, source receipt, prior grant receipt/state, policy version, canonical subject and true revocation timestamp are bound together.
3. Decide whether root `jobsDeliveryState/jobsDeliveryAckHash` is the authoritative per-consumer ACK or whether Privacy's `acknowledgeConsentRevocation` subcollection ACK is also required. Avoid two competing sources of truth.
4. Add a reviewed, system-only scheduled/task wrapper with explicit service identity, secret access, exact endpoint, bounded lease/retry/dead-letter/reconciliation and protected deployment provenance. No client callable or generic environment flag may activate it.
5. Execute R20 publisher → dispatcher → Jobs R923 consumer → Privacy ACK on same immutable source using disposable Firebase emulators. Retest stale leases, delivery timeout after receiver commit, duplicate delivery, consent change during network transit, corrupt/legacy outbox records, prior-grant collisions, wrong consumer identity and ACK conflicts.
6. Separately run real protected nonproduction GCS alternate/stale writer 403, in-flight upload drain, exact-generation purge and final downstream ACK. The dispatcher cannot certify that gate.

## 8. Final classification

**Recovered:** historical R647 Privacy → Jobs dispatcher library and contract with bounded leases/retries and Jobs ACK verification.

**Not integrated:** no R647 dispatcher entrypoint export/wrapper; R647 branch unmerged; R20 lacks dispatcher modules and required queue fields; R647 v2 mapping does not retain R20 prior-grant lineage; Privacy root delivery ACK and subcollection ACK semantics are not reconciled.

**Not known:** any external deployed dispatcher or actual cloud delivery.

**NO MERGE / NO DEPLOY / NO DISPATCH / NO PRIVATE MEDIA / NO IAM CHANGE. ONE URAI GENESIS — PRODUCTION HOLD.**
