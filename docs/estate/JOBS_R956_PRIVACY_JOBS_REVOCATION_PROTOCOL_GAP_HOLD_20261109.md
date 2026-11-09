# ONE URAI GENESIS — R956 Privacy-to-Jobs revocation protocol integration gap

**Date:** 2026-11-09 UTC. **Disposition: PRODUCTION HOLD / NO-GO.**
**Scope:** immutable source readback of Privacy R20 outbox producer/acknowledger and Jobs main/R923 revocation receiver; read-only source searches across Jobs, Studio, Spatial, Content and Marketing. Documentation-only handoff. No endpoint invocation, cloud/provider access, secrets, IAM change, merge, deploy or media processing.

## 1. Executive finding

Privacy and Jobs contain substantial revocation implementations, but the inspected source does not yet form one executable producer → delivery → consumer → Privacy-acknowledgement protocol.

Three independently verified seams remain:

1. **Event shape/version mismatch:** Privacy R20 writes an outbox record with `schemaVersion: consent.revoked.v1`, fields `uid`, `consentTier`, `sourceReceiptHash`, `priorGrantReceiptHash` and `priorGrantEvidenceState`. Jobs main's HTTP endpoint admits a different strict v1 body requiring `ownerUid`, `decisionReceiptId`, `correlationId` and `revokedAt`. Jobs R923 adds a v2 body requiring `ownerUid`, `sourceReceiptHash` and `correlationId = revocation:<eventId>`, but it still does not accept or persist the R20 prior-grant lineage pair.
2. **No source-visible dispatcher/adapter:** R20's `publishConsentRevocation` trigger writes the Firestore outbox document. In the inspected Privacy Functions source, the only other direct outbox function is the trusted acknowledgement callable; export code reads the outbox for data export. No outbox polling, delivery task, HTTP dispatcher to Jobs, or payload adapter was found in the reviewed producer source.
3. **Acknowledgement is not joined end-to-end:** Jobs records a local `jobConsentEventReceipts` receipt and returns it to its HTTP caller. Privacy separately exposes `acknowledgeConsentRevocation`, which writes a trusted consumer acknowledgement under the Privacy outbox. No call site from the inspected Jobs/Studio/Spatial/Content/Marketing repositories invokes that Privacy acknowledgement API. Jobs' local receipt is not automatically the Privacy outbox ACK.

These are source-integration gaps. They do **not** prove that no separately deployed external dispatcher exists, that any endpoint is publicly exploitable, or that production is using these source revisions. Any such external service/deployment must be independently discovered and source-pinned before being credited.

## 2. Immutable source identities

### Privacy

- Privacy current `main`: `1163d6f32a123ef9a6638e092a3eee5ec4a3b317`
- Privacy R20 draft #256: `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`
- R20 producer/ack function: `functions/src/consent-revocation.ts`, blob `84f1e77d5c1cf55f80aaa0a559b6a3eac781386e`
- R20 replay/lineage helper: `functions/src/consent-revocation-transition.ts`, blob `0ddee615f1284a58459aae48b915a574da7c9c9e`
- Privacy function entry exports both `publishConsentRevocation` and `acknowledgeConsentRevocation` from `functions/src/functions-entry.ts`, blob `59a6dcda725a322081f0609f5f01e81de801ee81`.

Privacy R20 publisher constructs `immutableEvent` containing:
- `schemaVersion: "consent.revoked.v1"`
- `eventId`, `consentRecordId`, `uid`, `purpose`, `consentTier`, `policyVersion`
- `sourceReceiptHash`, `priorGrantReceiptHash`, `priorGrantEvidenceState`
- `integrityHash`

It transactionally creates that record in `consentRevocationOutbox/<eventId>`. It does not add Jobs receiver fields `ownerUid`, `correlationId`, `revokedAt` or legacy `decisionReceiptId`, and does not call the Jobs HTTP endpoint in this function.

Privacy R20's `acknowledgeConsentRevocation` is a separate callable. It expects authenticated trusted-system claims (`system === true` or `role === "system"`, plus token-bound `consumerId`), and request fields `eventId`, `consumerId`, `status` (`applied|rejected`), `correlationId`, `detailHash`. It verifies event ID/schema presence, immutably creates one ACK per consumer, updates last-ACK summary fields and writes an audit row. The R20 implementation does not itself dispatch the outbox to consumers or prove a required consumer roster has completed.

### Jobs

- Jobs current `main`: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`
- Jobs main receiver: `functions/src/privacy/consentRevocation.ts`, blob `a1e042b04ce5b9f9223f4c8b64b92924fc75db92`
- Jobs R923/R371 receiver: `functions/src/privacy/consentRevocation.ts`, blob `bf28abe6dec01330909f6e6f8bdea909d5a3b920`
- R923 ordering helper: `functions/src/privacy/consentRevocationOrder.ts`, blob `33c71b71a7a505d17f8b5b51189573a954873593`
- Jobs main static source contract: `scripts/consent-revocation-contract.mjs`, blob `3f2bd4fad52f89ee33a64bf5c89281eee156c442`.

Jobs main's strict HTTP `ConsentRevokedEventSchema` only accepts `consent.revoked.v1` with `eventId`, `ownerUid`, `purpose`, `policyVersion`, `decisionReceiptId`, `correlationId` and `revokedAt`. It rejects unknown fields. It authenticates the bearer using `URAI_JOBS_PRIVACY_EVENT_TOKEN`.

Jobs R923 adds two strict variants:
- v1 retains the legacy `decisionReceiptId` contract.
- v2 requires a 64-hex event ID, `ownerUid`, `purpose`, `policyVersion`, `correlationId`, `revokedAt` and `sourceReceiptHash`; correlation must equal `revocation:<eventId>`.

The R923 v2 consumer does not accept `priorGrantReceiptHash` or `priorGrantEvidenceState`. It records a local `jobConsentEventReceipts` receipt and consent block; its response explicitly reports `privateOutputDeletionAcknowledged: false` and `storageWriteFenceVerified: false`. That explicit hard boundary is correct and must remain.

## 3. Contract mismatch matrix

| Semantic field | Privacy R20 outbox | Jobs main v1 | Jobs R923 v2 |
|---|---|---|---|
| Version | `schemaVersion=consent.revoked.v1` | `type=consent.revoked.v1` | `type=consent.revoked.v2` |
| Owner | `uid` | `ownerUid` | `ownerUid` |
| Purpose | `purpose` | `purpose` | `purpose` |
| Tier | `consentTier` | Not accepted | Not accepted |
| Policy | `policyVersion` | `policyVersion` | `policyVersion` |
| Current receipt | `sourceReceiptHash` | Not accepted; expects `decisionReceiptId` | `sourceReceiptHash` |
| Prior grant lineage | `priorGrantReceiptHash`, `priorGrantEvidenceState` | Not accepted | Not accepted |
| Correlation | Not emitted by R20 publisher | Required | Required as `revocation:<eventId>` |
| Revocation time | Not emitted by R20 publisher | Required | Required |
| Dispatch/auth | Firestore outbox record | HTTP bearer endpoint | HTTP bearer endpoint |
| Final ACK | Privacy trusted-consumer callable | Jobs local receipt/HTTP response | Jobs local receipt/HTTP response |

Therefore, a direct POST of the R20 outbox record into either strict Jobs receiver would fail validation. An adapter could transform it, but no such source-visible adapter/dispatcher was identified in this inspection. Do not silently infer one.

## 4. What is and is not proven

**Proven by source readback:** strict payload shapes differ; R20 trigger writes the outbox; Jobs main/R923 expose HTTP receivers; Privacy exposes a separate authenticated ACK callable; Jobs receiver does not call that callable in the inspected file; R923 v2 response explicitly refuses to certify physical deletion or the Storage write fence.

**Not proven:** live deployment revisions, whether a separately hosted dispatcher exists outside the inspected repositories, actual Secret Manager bindings, effective ingress/IAM, event delivery/retry behavior, real consumer ACKs, GCS denial, active upload drain or physical purge.

## 5. Safe integration design required before code changes

1. **Publish a versioned shared event contract** with explicit canonical fields, event ID derivation, source receipt, prior grant receipt/state, revocation epoch/time, tenant/owner scope, policy version and correlation. Avoid reusing the same v1 identifier for incompatible meanings.
2. **Add an explicit Privacy outbox dispatcher** (or identify and source-pin the already-existing external dispatcher) with bounded lease, retry/backoff, event-age limit, duplicate delivery and dead-letter/reconciliation handling. It must read an immutable outbox record and serialize the agreed version only.
3. **Preserve prior-grant lineage end to end.** The Jobs v2 consumer must either persist/validate the R20 prior-grant pair under a new contract or receive a cryptographically/centrally verified envelope that binds it. Do not reduce R20 to a plain receipt ID or hash without a documented security decision.
4. **Join the ACK path.** After the Jobs consumer has durably blocked the affected owner/purpose and recorded its local receipt, it must submit an immutable acknowledgement to Privacy using the trusted consumer identity, exact event/correlation and detail hash. Distinguish `applied` (consent block applied) from physical deletion; never let this ACK imply GCS writer denial or purge completion.
5. **Track required consumers and finality centrally.** An ACK from Jobs cannot mean all downstream services are complete. Define the expected consumer roster, terminal/rejected states, retry deadlines and reconciliation. Only a separate verified Storage fence, generation-pinned cleanup, and durable purge ACK may close the physical deletion gate.
6. **Execute one same-SHA cross-service suite** covering producer transition, outbox create, dispatcher retry, v1/v2 migration/negative cases, Jobs block receipt, Privacy ACK callable, duplicate/conflicting ACK, stale ordering, consumer outage and revocation during in-flight write. Use disposable native Firebase emulators plus a separately approved real nonproduction IAM 403 test.

No app code changed during this checkpoint. The source interfaces are not yet reconciled, and contract design must precede another blind patch.

## 6. Next Chalk action

- Obtain and pin any external dispatcher service if one exists; otherwise propose a review-only Privacy outbox dispatcher branch.
- Draft a shared v2 schema and explicit mapping policy, including how original prior-grant lineage is carried and verified.
- Add Jobs-side Privacy ACK client only after the Privacy trusted token/identity transport and allowed consumer roster are specified.
- Preserve the current hard-off on private rendering and keep Jobs P0 #252 open.
- Re-run exact source, native Firebase and real protected staging acceptance on one immutable cross-service manifest.

**NO MERGE / NO DEPLOY / NO PRIVATE MEDIA / NO IAM CHANGE. ONE URAI GENESIS — PRODUCTION HOLD.**
