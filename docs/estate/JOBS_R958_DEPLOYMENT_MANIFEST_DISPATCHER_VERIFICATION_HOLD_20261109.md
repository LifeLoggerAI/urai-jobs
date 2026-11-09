# ONE URAI GENESIS — R958 deployment-manifest and function-export dispatcher verification

**Date:** 2026-11-09 UTC. **Disposition: PRODUCTION HOLD / NO-GO.**
**Scope:** exact immutable GitHub file readbacks for Privacy R20 and Jobs R923/main deployment manifests and function entrypoints; 12 read-only source-text assertions. No full checkout, native Node test, cloud/provider query, endpoint call, credentials, IAM, merge, deploy, payment or media processing.

## 1. Immutable sources inspected

| Repository/file | Ref | Git blob |
|---|---|---|
| Privacy `functions/src/consent-revocation.ts` | R20 #256 `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6` | `84f1e77d5c1cf55f80aaa0a559b6a3eac781386e` |
| Privacy `functions/src/functions-entry.ts` | R20 #256 | `59a6dcda725a322081f0609f5f01e81de801ee81` |
| Privacy `firebase.json` | main `1163d6f32a123ef9a6638e092a3eee5ec4a3b317` | `04a0a54c96abde147a61ab800d924a8c56130109` |
| Jobs `functions/src/index.ts` | main `9d29be1bcd3a45a4b9a743df9c9706c00811f38b` | `8ab440758ad10ccdc40a5f2cbfaa1cc412fe3a86` |
| Jobs `functions/src/privacy/consentRevocation.ts` | R923 #371 `df19633466eaebdda844569ed0d562245bd31dc6` | `bf28abe6dec01330909f6e6f8bdea909d5a3b920` |
| Jobs `firebase.json` | main `9d29be1bcd3a45a4b9a743df9c9706c00811f38b` | `f001d5130f4b2583c0d5030c393586180e38172e` |

## 2. Direct source-structure checks

**12/12 PASS** across the exact retrieved files:

1. Privacy producer is a Firestore `onDocumentWritten("consentRecords/{recordId}")` trigger and writes `consentRevocationOutbox`.
2. Privacy producer calls `priorGrantReceiptEvidence(before)` and spreads the evidence into the immutable outbox event.
3. The inspected Privacy producer contains no direct HTTP/fetch dispatch call.
4. Privacy Functions entry exports `publishConsentRevocation` and `acknowledgeConsentRevocation`.
5. That exported Privacy entry surface contains no `onSchedule`, `onTaskDispatched`, or named outbox dispatch/poll function.
6. Jobs Functions entry exports `ingestConsentRevocation`.
7. The inspected Jobs Functions export surface contains no named Privacy outbox poller or dispatcher.
8. Jobs R923 v2 schema accepts `sourceReceiptHash`.
9. Jobs R923 receiver does not accept/persist `priorGrantReceiptHash` or `priorGrantEvidenceState`.
10. Jobs R923 receiver explicitly returns `privateOutputDeletionAcknowledged: false` and `storageWriteFenceVerified: false`.
11. Privacy `firebase.json` declares a Node 22 Functions codebase named `privacy` and no schedule/task declaration.
12. Jobs `firebase.json` declares a Node 22 Functions codebase named `default` and no schedule/task declaration.

These are read-only string/source-contract assertions executed in the tool orchestration context. They are **not** native repository Node tests, a full TypeScript build, Firebase emulator acceptance, live Cloud Scheduler/Tasks/PubSub/Eventarc inventory, or proof that no other deployment mechanism exists.

## 3. Architecture conclusion

The inspected Privacy function surface supplies a producer and an ACK callable, not a visible delivery loop. The inspected Jobs function surface supplies a consumer endpoint, not a visible Privacy outbox poller. Neither inspected Firebase manifest advertises a schedule/task function for this outbox flow.

Therefore the source-defined chain remains:

**Privacy Firestore outbox record → [dispatcher/adapter not found in inspected function surfaces] → Jobs authenticated HTTP consumer → Jobs local block/receipt → [Privacy ACK invocation not found] → Privacy per-consumer ACK record.**

The event contract mismatch from R956 remains. R20 stores `uid`, `consentTier`, `sourceReceiptHash`, and prior-grant lineage; Jobs R923 v2 expects `ownerUid`, `sourceReceiptHash`, `correlationId`, and `revokedAt`, and does not retain the R20 prior-grant lineage pair.

The missing source-visible component must be resolved by discovering a separate deployed service with immutable source/deployment evidence, or designing a review-only dispatcher. Do not deploy a new dispatcher until the canonical envelope, retry/lease/DLQ policy, trusted consumer identity and Privacy acknowledgement semantics are specified.

## 4. Explicit limitations

- Firebase manifests prove source configuration only, not actual deployed Functions, schedules, task queues, Pub/Sub subscriptions or Cloud Run services.
- GitHub search across the 19-repository estate did not identify an external dispatcher, but search/index/branch coverage is not exhaustive. External deployment remains UNKNOWN.
- Jobs local receipt and Privacy ACK callable are distinct. No inspected Jobs call site invokes the Privacy callable.
- Even a Privacy ACK after Jobs applies its consent block would not prove privileged Storage write denial or physical deletion.
- Jobs P0 #252 remains open: real nonproduction privileged GCS 403 after revocation, active-upload drain, exact-generation deletion, final absence and durable downstream purge acknowledgment are still required.
- Jobs #376 remains open: post-admission data-rights operator withdrawal must follow an approved Privacy/legal durable-continuation policy, not an unreviewed blanket cancellation.

## 5. Next safe action

1. Obtain authorized read-only inventory of deployed Privacy/Jobs Functions, Cloud Scheduler, Cloud Tasks, Pub/Sub, Eventarc and Cloud Run services, plus exact source/build fingerprints.
2. If an external dispatcher exists, recover its source and prove it maps the immutable R20 envelope into an approved Jobs event contract, handles retries and calls Privacy ACK with the correct trusted consumer identity.
3. If none exists, draft the shared v2 schema and bounded outbox dispatcher/adapter in a separate review-only branch. Keep all rendering, private output and destructive provider actions disabled.
4. Test producer → outbox → delivery → Jobs block/receipt → Privacy ACK in one same-SHA native emulator suite; separately test real protected-nonproduction IAM 403, upload drain and purge ACK.
5. Preserve protected CI, independent approval and founder release GO as mandatory gates.

**R958 final classification:** 12/12 source-structure checks PASS; no dispatcher was found in the inspected Firebase function entrypoints/manifests; external dispatcher/deployed resources remain UNKNOWN; protocol integration and physical Storage purge remain uncertified.

**NO MERGE / NO DEPLOY / NO DISPATCH / NO PRIVATE MEDIA / NO IAM CHANGE. ONE URAI GENESIS — PRODUCTION HOLD.**
