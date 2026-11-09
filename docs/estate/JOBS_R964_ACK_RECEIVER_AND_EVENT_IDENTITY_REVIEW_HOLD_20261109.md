# ONE URAI GENESIS — R964 ACK receiver enforcement and immutable event identity review

**Date:** 2026-11-09 UTC  
**Disposition:** PRODUCTION HOLD / NO-GO  
**Scope:** live PR metadata refresh; immutable readback of Privacy R20 ACK/publisher and Jobs R923 receiver; comparison with R647 donor dispatcher/contract and R963 design proposal; retry of read-only Git checkout connectivity. Documentation-only. No app-source edits, tests, emulators, endpoints, provider inventory, IAM, merge, deployment, paid compute or private media.

## 1. Executive summary

R964 found no promotion of the relevant review work: Jobs #371/#377/#388/#389/#390 and Privacy #214/#253–#256 remain open draft reviews at the refreshed metadata read. Jobs main remains the previously established source head; actual deployed revisions remain unknown.

The R647 donor tests still cannot be run in this environment. A fresh `git ls-remote` returned exit 128 because the environment cannot resolve `github.com`. The 10 dispatcher and 16 contract/transport top-level donor tests remain NOT RUN. This is a network/DNS blocker, not a test failure.

R964 also made three source-derived protocol observations that should be addressed before implementation:

1. **ACK detail is not independently bound by current Privacy R20 receiver.** The callable validates that `detailHash` is 64 lowercase hex characters and that `consumerId` matches the trusted system token claim. It does not recompute detailHash from the stored immutable event, a Jobs receipt hash and a defined action. The callable's outbox check currently verifies eventId and schemaVersion, but not the full outbox integrity hash or complete immutable event digest.
2. **R20 eventId omits the prior-grant pair although integrityHash/replay comparison includes it.** This is not automatically a vulnerability: a same eventId with changed prior evidence is rejected by the replay classifier. But the canonical v3 identity proposal should expressly decide whether eventId binds priorGrantReceiptHash and priorGrantEvidenceState as part of immutable identity, and supply test vectors for the decision.
3. **The proposed ACK lifecycle needs a crash-safe reconciliation rule.** Jobs may commit its local consent block and return a valid HTTP receipt, while the subsequent Privacy ACK transaction times out or the dispatcher loses its response. The design must allow the dispatcher to read and recognize an identical already-committed Privacy ACK before retrying or finalizing delivery; it must not create a second ACK or downgrade a committed ACK to retry/failed.

These are design/integration findings, not executed test failures or proof of a deployed vulnerability.

## 2. Refreshed review graph (R964)

| Repository / PR | Head SHA | State | Meaning |
|---|---|---|---|
| Jobs #379 forensic docs | `7a1329a74e1a7004676dff2185950b26ccdc0f73` before R964 writes | Open, draft | Documentation branch only |
| Jobs #371 R923 | `df19633466eaebdda844569ed0d562245bd31dc6` | Open, draft | Two-parent Jobs review candidate |
| Jobs #377 R900 | `f8578ea281e818b01811aecc2fe4dfb8c3dc8203` | Open, draft | Operator withdrawal continuation reproduction |
| Jobs #388 R951 | `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38` | Open, draft | Production-first worker bearer guards |
| Jobs #389 R952 | `b865209cc352241602d8b9714672f3401aed7669` | Open, draft | Mandatory auth regression enrollment |
| Jobs #390 R932 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | Open, draft | Studio-to-Jobs Zod parser test |
| Privacy #214 R647 | `cc0692053db3b1b8df8267d43856b1a3357de8a0` | Open, draft | Prepared historical dispatcher donor |
| Privacy #253 R17 | `90a4e581e8494f52d85eab3c576d02b926e7d0d9` | Open, draft | Stored-subject UID binding |
| Privacy #254 R18 | `dbc193763dc112210c20b5b680e8eb08fdf8396c` | Open, draft | Original grant invalidation on identity replacement |
| Privacy #255 R19 | `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a` | Open, draft | Prior granted receipt lineage |
| Privacy #256 R20 | `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6` | Open, draft | Outbox replay collision classifier |

Fresh metadata readback did not show a merge or close for these PRs. Re-fetch heads before any later implementation; do not treat these source SHAs as deployed code.

## 3. Immutable source pins read in R964

### Privacy R20
- `functions/src/consent-revocation.ts` blob: `84f1e77d5c1cf55f80aaa0a559b6a3eac781386e`
- `functions/src/consent-revocation-transition.ts` blob: `0ddee615f1284a58459aae48b915a574da7c9c9e`
- `functions/src/functions-entry.ts` blob: `59a6dcda725a322081f0609f5f01e81de801ee81`

### Jobs R923
- `functions/src/privacy/consentRevocation.ts` blob: `bf28abe6dec01330909f6e6f8bdea909d5a3b920`

### Privacy R647 donor
- Dispatcher: `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- Contract: `6cca2b9456319927cf22511c7d51c1f16ddf051c`
- Dispatcher test: `def1048aa4838f7ff990d792a27d1fb94e7f6441`
- Jobs contract test: `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`

### Jobs R963 proposal
- Canonical revocation event/ACK proposal blob at R963 readback: `0e3ba29ba707b8540230d766b0b9d4ed3a921669`

All six main donor/R20/Jobs files were fetched directly from their exact refs in R964. No local checkout/hash-object recomputation was possible due the network failure.

## 4. Current Privacy R20 ACK receiver: exact code behavior

The R20 ACK schema accepts:
- `eventId`: 64 lowercase hex;
- `consumerId`: constrained identifier;
- `status`: applied or rejected;
- `correlationId`: bounded string;
- `detailHash`: 64 lowercase hex.

The trusted caller guard requires:
- authenticated Firebase actor UID;
- token claim `system === true` or `role === "system"`;
- token-bound `consumerId` matching the payload consumerId.

Within its Firestore transaction, current code:
- reads the outbox and consumer ACK subdocument;
- verifies outbox exists;
- checks only `outboxData.eventId === request.eventId` and `outboxData.schemaVersion === consent.revoked.v1` at the event boundary;
- on duplicate ACK, compares consumerId, status, correlationId, detailHash and actorUid;
- rejects a different immutable ACK for that consumer;
- on first ACK, stores consumerId/status/correlationId/detailHash/actorUid/time and an integrity hash over the submitted ACK data and actor/token identity;
- updates the outbox last-ACK summary and creates audit evidence.

It does **not** recompute `detailHash` against a canonical Jobs receipt or action, nor recompute the full stored outbox event integrity hash in the ACK callable. The callable relies on its trusted system consumer to submit the accurate detailHash. This can be an intentional trust model, but v3 requires explicit receiver-side event/action binding or an approved trusted-consumer attestation model.

The existing idempotency comparison includes `actorUid`. Review whether a stable workload service identity will be used across retries and deploy rollovers. If actor UID can legitimately change for the same token-bound consumer, exact ACK retry may fail as a conflict. Do not remove actor binding without a security decision; specify stable identity semantics first.

## 5. Current R20 event identity: separate eventId and integrity evidence

R20 publisher computes eventId from:
- schemaVersion;
- consent record ID;
- UID;
- purpose;
- consent tier;
- policy version;
- source receipt hash.

It separately derives `integrityHash` over eventId, record ID, UID, purpose and prior grant evidence.

The R20 replay classifier compares immutable base fields and then priorGrantReceiptHash/priorGrantEvidenceState/integrityHash. If both prior fields are absent it returns legacy_missing_lineage; one missing or a changed pair returns conflicting. Mutable delivery/ACK bookkeeping is deliberately excluded.

For v3:
- decide whether eventId binds the prior grant pair or remains a digest of source transition identity with a separate immutable envelope digest;
- prevent two records with the same eventId but different immutable lineage from being accepted;
- provide cross-language canonical serialization and test vectors;
- ensure the Jobs receipt and ACK bind the exact same identity.

The R963 proposal's illustrative v3 eventId binds the full immutable event identity. This is design only, not implementation.

## 6. Required crash-safe ACK protocol refinement

Define explicit state transitions:

A. Jobs transaction commits owner/purpose block and immutable local event receipt.

B. Jobs response binds exact event ID/schema, immutable envelope digest, consumer ID, local receipt ID/hash, exact action/status and ACK hash.

C. Privacy ACK callable validates trusted service identity, token-bound consumer ID, existing outbox complete immutable digest, Jobs receipt/response binding, approved consumer/action scope and correlation.

D. Privacy transaction creates the single immutable per-consumer ACK.

E. Dispatcher reads the ACK back and verifies exact identity/content before marking delivery projection delivered.

Crash/retry handling:
- Crash before Jobs commit: retry delivery; no ACK exists.
- Jobs commit but HTTP response lost: redelivery returns same Jobs receipt/hash idempotently.
- HTTP response received but Privacy ACK not committed: retry ACK submission.
- Privacy ACK committed but callable response lost: retry reads existing byte-for-byte identical ACK as idempotent success.
- Conflicting existing ACK: needs-review; never overwrite.
- Dispatcher loses lease after ACK committed: new lease owner reads canonical ACK and safely finalizes only if event digest and ACK match.
- ACK says rejected: persist rejected terminal/reconciliation state; do not mark delivered/applied.
- Jobs response must never imply Storage purge without separate provider evidence.

The outbox delivery state is only a projection of dispatcher work and verified canonical ACK. Do not allow root status, ACK subdocument and summary fields to drift as independent authorities.

## 7. Checkout remains blocked; original donor tests NOT RUN

R964 retried `git ls-remote` to the exact R647 branch. Result: exit 128, `Could not resolve host: github.com`.

Therefore: no checkout, dependency installation, donor Node commands, Functions typecheck, emulator startup, dispatch or provider operation occurred.

Original donor tests remain 10 dispatcher state tests and 16 contract/transport declarations. They use Node tests, TypeScript transpilation, VM, fake Firestore and mocked transport. This is not native emulator acceptance.

## 8. R964 actions

- Refreshed Jobs #379/#371/#377/#388/#389/#390 and Privacy #214/#253–#256 metadata.
- Re-read R20 ACK/publisher and transition helper, Jobs R923 receiver, R647 dispatcher/contract and R963 proposal.
- Identified receiver-side detailHash/event-digest verification and retry identity semantics for v3.
- Retried Git checkout connectivity; DNS failed.
- No app source, tests or cloud resources changed.

## 9. Next Chalk execution priorities

1. On a network-capable host, clean checkout Privacy R647 exact head; verify tree/blob identities; run both original focused Node tests separately; run Functions typecheck; preserve logs, versions, lock hash and exits.
2. Review R963 proposal plus R964 ACK refinement with Privacy/legal/security owners. Decide v3 event identity, source-time provenance, actor identity stability, canonical ACK receiver verification and legacy disposition.
3. Create separate review-only Privacy and Jobs v3 protocol changes preserving R647 donor and R20 replay history. Do not cherry-pick old source unchanged.
4. Run same-SHA native Firebase Auth/Firestore/Functions/Storage emulator producer → outbox → dispatcher → Jobs → Privacy ACK tests, including the crash/retry matrix.
5. Independently verify real protected nonproduction GCS stale/alternate writer 403, active upload/stream drain, exact generation purge and durable final ACK.
6. Keep worker auth, operator-withdrawal policy, CI/branch protection, deployment provenance, rollback, C6 lifecycle, devices/accessibility/visual and founder GO as separate gates.

## 10. Final R964 classification

**Verified source facts:** live draft PR graph unchanged; exact R20 ACK/publisher and Jobs receiver behavior; R647 donor contracts/tests; R20 eventId/integrity split.

**New design risk to close:** ACK detail hash and complete event digest must be checked at Privacy receiver or covered by an explicitly approved trusted-consumer attestation model; actor identity semantics must support safe idempotent retry.

**NOT RUN:** donor tests, typecheck, full checkout, emulators, cloud/provider verification.

**NO CHERRY-PICK UNCHANGED / NO MERGE / NO DEPLOY / NO DISPATCH / NO PRIVATE MEDIA / NO IAM CHANGE / NO PAID COMPUTE. ONE URAI GENESIS — PRODUCTION HOLD.**
