# ONE URAI GENESIS — R957 estate-wide revocation dispatcher discovery and contract boundary

**Date:** 2026-11-09 UTC. **Disposition: PRODUCTION HOLD / NO-GO.**
**Scope:** follow-up to Jobs R956. Read-only source/PR searches across the 19 known LifeLoggerAI repositories and immutable Privacy/Jobs source readback. Documentation-only record. No runtime source edits, dispatcher invocation, endpoint call, credentials, provider access, IAM, merge, deployment, paid services or private media.

## 1. Search result: no external dispatcher has been identified yet

Searched the known repository estate for the Privacy callable name `acknowledgeConsentRevocation`, outbox collection name `consentRevocationOutbox`, event version `consent.revoked.v2`, Jobs shared event token name, and revocation/dispatcher terms.

Repositories included UrAi, UrAi-Dev, UrAiProd, urai-spatial, urai-privacy, urai-jobs, urai-studio, urai-staging, urai-admin, urai-analytics, urai-marketing, urai-investors, urai-labs-llc, asset-factory, urai-content, urai-foundation, urai-communications, B2Bportal and urai-storytime.

Search results located the Privacy producer/ACK implementation and Jobs receiver/contract. No source hit identifying a separate dispatcher, scheduler, queue consumer or payload adapter was returned from the other repository names. This is **not exhaustive proof of absence**: GitHub code-search indexing, private/unindexed repositories, external services, historical branches and deployed cloud resources may not be fully represented. Treat dispatcher location/status as UNKNOWN, not nonexistent.

## 2. Cross-service code facts reconfirmed

### Privacy R20 producer

- PR #256 immutable head: `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`.
- `functions/src/consent-revocation.ts` blob: `84f1e77d5c1cf55f80aaa0a559b6a3eac781386e`.
- `functions/src/consent-revocation-transition.ts` blob: `0ddee615f1284a58459aae48b915a574da7c9c9e`.
- Trigger `publishConsentRevocation` on `consentRecords/{recordId}` creates immutable event evidence in `consentRevocationOutbox/<eventId>`.
- Payload has `schemaVersion`, `eventId`, `consentRecordId`, `uid`, `purpose`, `consentTier`, `policyVersion`, `sourceReceiptHash`, `priorGrantReceiptHash`, `priorGrantEvidenceState`, `integrityHash`.
- The R20 function does not include Jobs HTTP receiver fields `ownerUid`, `correlationId`, `revokedAt`, or legacy `decisionReceiptId`; it writes the Firestore outbox and does not send HTTP in that trigger.

### Privacy trusted ACK

- `acknowledgeConsentRevocation` is separately exported in `functions/src/functions-entry.ts` blob `59a6dcda725a322081f0609f5f01e81de801ee81`.
- It requires Firebase auth plus token claim `system === true` or `role === "system"`, and a validated token-bound `consumerId`.
- Payload: `eventId`, `consumerId`, `status` (`applied` or `rejected`), `correlationId`, `detailHash`.
- It creates an immutable per-consumer acknowledgement and an audit row, then updates last-ACK summary fields on the outbox.
- It does not itself prove every expected consumer is complete, physical object removal, or Storage write denial. An `applied` ACK must describe a narrowly defined consumer action, not global deletion.

### Jobs consumer

- Jobs current `main`: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`, receiver blob `a1e042b04ce5b9f9223f4c8b64b92924fc75db92`.
- Jobs R923 review #371: `df19633466eaebdda844569ed0d562245bd31dc6`, receiver blob `bf28abe6dec01330909f6e6f8bdea909d5a3b920`.
- R923 accepts v1 legacy `decisionReceiptId` payload or v2 with `ownerUid`, `sourceReceiptHash`, `correlationId = revocation:<eventId>`, and `revokedAt`.
- R923 v2 does not accept or persist `priorGrantReceiptHash` / `priorGrantEvidenceState`; it does not preserve all R20 immutable grant-lineage fields at the consumer boundary.
- Jobs writes local `jobConsentEventReceipts` and consent block, then invokes local Life Movie derivative invalidation. It returns explicit `privateOutputDeletionAcknowledged: false` and `storageWriteFenceVerified: false`.
- No call to Privacy's `acknowledgeConsentRevocation` exists in the inspected Jobs receiver or returned estate-wide search results.

## 3. Important distinction: outbox write, consumer receipt, ACK, physical deletion

These are four different facts and must remain separate:

1. **Outbox created:** Privacy durably recorded a consent event.
2. **Consumer applied:** Jobs durably set its local consent block and wrote its local receipt.
3. **Privacy received a consumer ACK:** trusted consumer identity submitted the matching immutable ACK to Privacy.
4. **Physical purge certified:** Storage-level future writes are denied; in-flight attempts drained or invalidated; exact object generations reconciled and deleted; final absence and downstream purge acknowledged.

An HTTP 200 from Jobs, a local Jobs receipt, or a Privacy acknowledgement row cannot be treated as step 4. Even step 3 does not establish step 4.

## 4. Contract integration requirements

- Agree a shared versioned event envelope; preserve original consent grant lineage and explicit event/receipt provenance.
- Add an outbox dispatcher or identify an external dispatcher with exact repository, source SHA, identity, queue/lease/retry and deployment provenance.
- Deliver the immutable R20 event to Jobs via an explicitly versioned adapter that does not discard prior-grant evidence.
- Define consumer ACK semantics and use trusted, token-bound consumer identity; persist Privacy ACK only after Jobs has committed its block and local receipt.
- Define expected consumers and the rule for partial/rejected/missing acknowledgements, retry/dead-letter/reconciliation and request age.
- Keep physical deletion completion as a separate finality barrier requiring real privileged GCS 403, upload drain, exact-generation cleanup, and durable purge ACK.

## 5. Next investigation

Before writing a dispatcher, inspect the current cross-service registry, Privacy deployment exports and Jobs deploy manifest for any scheduled function, task queue, event subscription or external runtime not represented in source search. Obtain authorized read-only inventory and exact source fingerprints. If no existing dispatcher is found, create a review-only proposal for the canonical v2 contract and bounded outbox delivery; do not activate it before consumer and Privacy ACK identities are approved.

## 6. Final classification

**Confirmed:** Privacy R20 outbox producer and trusted ACK callable are distinct; Jobs main/R923 event schemas differ from the R20 outbox shape; Jobs consumer's receipt is local and does not automatically write a Privacy ACK; R923 response refuses to claim physical deletion or Storage fence completion.

**Unknown:** whether an external dispatcher exists; actual deployed producer/receiver/ACK function revisions; secrets, token audience, IAM/ingress, event delivery and retry; actual consumer roster; GCS privileged denial, upload drain, physical purge and provider acknowledgment.

**NO MERGE / NO DEPLOY / NO DISPATCH / NO PRIVATE MEDIA / NO IAM CHANGE. ONE URAI GENESIS — PRODUCTION HOLD.**
