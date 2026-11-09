# ONE URAI GENESIS — R965 Jobs receipt / Privacy ACK / physical purge boundary reconciliation

**Date:** 2026-11-09 UTC  
**Disposition:** PRODUCTION HOLD / NO-GO  
**Scope:** refresh review PR metadata; inspect exact Jobs R923 response/receipt path, Privacy R20 publisher/ACK, R647 donor contract/dispatcher and R963 proposal; retry GitHub checkout and inspect local workspace availability. This is read-only source/metadata plus documentation work. No application source edits, tests, emulators, endpoints, provider inventory, IAM changes, merges, deployments, paid compute or private-media processing.

## 1. Executive result

R965 refreshed the relevant Jobs and Privacy PRs. The review candidates remain open drafts/unmerged at the read time. Jobs #390 R932 has a newer head than the earlier R963 machine checkpoint; the refreshed head is `e8ba07fc26f154169f2e065d9aa65e77014635d2`. Other inspected source heads remained the same. Jobs main remains the previously established `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`; no live deployment fingerprint was obtained.

A fresh read-only `git ls-remote` attempt again failed with exit 128 because DNS could not resolve `github.com`. Local workspace inspection found no complete Privacy checkout or node_modules tree; only a small prior R951 truth-table test/log was present under `/workspace`. The original R647 donor tests therefore remain **NOT RUN**; no new application test result is claimed.

R965's core reconciliation is to keep three distinct records/claims separate:

1. **Jobs consent-block receipt:** Jobs' durable idempotent application receipt for the specific owner/purpose revocation.
2. **Privacy per-consumer ACK:** canonical Privacy-side record that the trusted Jobs consumer acknowledged that exact block action.
3. **Physical Storage purge evidence:** provider-enforced future-write denial, in-flight upload/stream drain, exact generation deletion and final durable absence/ACK.

A Jobs HTTP 200 is not physical purge. A Jobs receipt is not automatically a Privacy ACK. A Privacy ACK is not proof of GCS write denial or deletion.

## 2. Refreshed live PR metadata

| Repo / PR | Head SHA | State | Draft | Notes |
|---|---|---|---|---|
| Jobs #379 | `1094f7ac22c8d17ec9f92bdf250fc32241d1d1e1` before R965 writes | open | yes | Forensic documentation branch |
| Jobs #371 | `df19633466eaebdda844569ed0d562245bd31dc6` | open | yes | R923 convergence |
| Jobs #377 | `f8578ea281e818b01811aecc2fe4dfb8c3dc8203` | open | yes | R900 operator-withdrawal reproduction |
| Jobs #388 | `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38` | open | yes | R951 worker auth |
| Jobs #389 | `b865209cc352241602d8b9714672f3401aed7669` | open | yes | R952 required auth regression |
| Jobs #390 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | open | yes | R932 actual Jobs Zod parser test |
| Jobs #386 | `fd1c8d85acd5cc96ef9fcb300173e362b004eb54` | open | yes | R949 rollback false-success |
| Jobs #387 | `04592f8573c708954f95f87ddca1e168efde51f4` | open | yes | R950 Narrator auth/entrypoint |
| Jobs #384 | `fd05a376f876f9b835929a2074c09f47638659e2` | open | yes | R946 source pin closure |
| Privacy #214 | `cc0692053db3b1b8df8267d43856b1a3357de8a0` | open | yes | R647 prepared dispatcher donor |
| Privacy #253 | `90a4e581e8494f52d85eab3c576d02b926e7d0d9` | open | yes | R17 stored UID binding |
| Privacy #254 | `dbc193763dc112210c20b5b680e8eb08fdf8396c` | open | yes | R18 identity replacement |
| Privacy #255 | `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a` | open | yes | R19 prior grant lineage |
| Privacy #256 | `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6` | open | yes | R20 replay collision guard |

Review branches remain separate; do not infer merge, production deployment or approval from their presence.

## 3. Exact source readback

- Jobs R923 receiver `functions/src/privacy/consentRevocation.ts`: blob `bf28abe6dec01330909f6e6f8bdea909d5a3b920`.
- Privacy R20 producer and ACK `functions/src/consent-revocation.ts`: blob `84f1e77d5c1cf55f80aaa0a559b6a3eac781386e`.
- Privacy R20 transition helper `functions/src/consent-revocation-transition.ts`: blob `0ddee615f1284a58459aae48b915a574da7c9c9e`.
- Privacy R20 Functions entry `functions/src/functions-entry.ts`: blob `59a6dcda725a322081f0609f5f01e81de801ee81`.
- R647 dispatcher: blob `4126167b4350ba8afe6b19d7b60dec1ca891189f`.
- R647 contract: blob `6cca2b9456319927cf22511c7d51c1f16ddf051c`.
- R647 dispatcher test: blob `def1048aa4838f7ff990d792a27d1fb94e7f6441`.
- R647 Jobs contract test: blob `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`.
- R963 design proposal as read during R965: blob `0e3ba29ba707b8540230d766b0b9d4ed3a921669`.

## 4. Jobs R923 receipt and HTTP response behavior

The Jobs receiver:
- authenticates an incoming HTTP bearer token against the configured Privacy event secret;
- validates a strict discriminated union for legacy v1 or Jobs v2;
- rejects stale/ambiguous revocation order and conflicting prior receipts;
- transactionally creates or validates a durable Jobs-local event receipt and consent block;
- includes an integrity hash in its stored receipt;
- on exact replay, returns the existing receipt only if the matching active block and event facts remain consistent;
- re-runs Life Movie derivative invalidation on authenticated replay, making cleanup retries possible after transient failure;
- returns HTTP 200 only when that attempt's derivative invalidation function returns successfully.

The response object is deliberately rewritten with:
- `privateOutputDeletionAcknowledged: false`;
- `storageWriteFenceVerified: false`;
- `derivativeInvalidationStatus: STORAGE_WRITE_FENCE_UNVERIFIED`.

The receiver deletes historical generation-fence and completion fields from the public response. The receipt write also sets `derivativeInvalidationCompletedAt: FieldValue.delete()` and retains the explicit false Storage/final deletion fields. If derivative invalidation throws, Jobs returns HTTP 500 and a bounded generic error code, not a raw provider exception.

**Implication:** the current Jobs HTTP response can be evidence that Jobs has applied/retained a consent block and completed its defined point-in-time derivative invalidation attempt. It is not proof of privileged GCS future-write denial, active upload drain or global physical deletion. A future v3 contract must explicitly state whether a Jobs ACK means “block committed” even when derivative invalidation returned a retryable failure, or whether block receipt and derivative attempt status are separate fields. Do not overload one status.

## 5. Privacy R20 ACK receiver behavior and R964 finding

Privacy R20 ACK callable:
- requires authenticated actor UID;
- requires trusted token claim `system === true` or `role === "system"`;
- binds payload `consumerId` to token claim `consumerId`;
- accepts eventId, consumerId, status, correlationId and 64-hex detailHash;
- reads the outbox and per-consumer ACK doc transactionally;
- checks outbox exists, eventId matches and schema is currently v1;
- accepts only an identical existing ACK by comparing consumerId/status/correlationId/detailHash/actorUid;
- rejects conflicting immutable ACK;
- creates the per-consumer ACK and audit record, then updates outbox last-ACK summary fields.

**Receiver-side integrity limitation:** the callable does not recompute the supplied detailHash from the stored complete immutable event plus Jobs receipt/action. It also does not recompute the publisher's complete integrityHash from the outbox row at ACK time. It relies on the trusted consumer to submit an accurate 64-hex detailHash. That may be acceptable under a carefully specified attestation trust model, but R963's stronger v3 design needs this boundary explicitly approved. The next implementation should either:
- recompute and validate a canonical receipt/action digest in Privacy from verifiable stored evidence; or
- document a narrowly scoped trusted-consumer attestation model with signed/token-bound identity, canonical envelope digest and replay/actor semantics.

Do not simply trust a well-formatted hash.

**Actor identity retry:** duplicate ACK matching includes actorUid. Confirm the workload principal remains stable over retries and service rollover, or define an immutable consumer workload identity distinct from transient actor UID. Do not remove actor binding without security approval.

## 6. R20 event identity and replay semantics

R20 eventId input includes schema version, consent record ID, UID, purpose, tier, policy version and source receipt hash. The R20 integrityHash additionally includes prior grant evidence. Replay comparison checks base fields, then the full prior grant pair and integrityHash; old records missing both prior fields are tagged legacy_missing_lineage; partial or mismatched lineage is conflicting.

This means a same eventId with modified prior evidence should fail replay comparison rather than be treated as identical. However event identity and integrity proof are separate layers. The v3 design must explicitly select:
- full eventId including prior-grant evidence; or
- stable eventId for source transition plus separately verified immutable envelope digest that includes prior-grant evidence.

Whichever is selected, same eventId with different lineage must never be accepted, and every producer/dispatcher/Jobs receiver/ACK must share canonical serialization and test vectors.

## 7. R647 donor and test execution blocker

R647 donor source remains exactly pinned at Privacy #214 head `cc0692053db3b1b8df8267d43856b1a3357de8a0`.

Original files:
- dispatcher state test: 10 top-level Node tests;
- contract/transport test: 16 top-level Node tests.

They use TypeScript transpileModule, Node VM, fake Firestore and mocked transport. They do not use Firebase emulators or a live Jobs endpoint.

R965 attempted GitHub remote access again:
`git ls-remote https://github.com/LifeLoggerAI/urai-privacy.git refs/heads/review/r647-jobs272-source-lineage-hold-20261104`
Result: exit 128, `Could not resolve host: github.com`.

Workspace inspection:
- `/workspace` contains only a prior `r951_auth_precedence_truth_table.test.mjs` and TAP log;
- no complete `urai-privacy` checkout or relevant node_modules directory was found in the inspected locations;
- no local donor test execution was possible.

Therefore donor tests, Functions typecheck, root preflight and emulator acceptance remain **NOT RUN**. This is access/tooling blockage, not source test failure.

## 8. R965 action log

1. Refreshed metadata for Jobs #379/#371/#377/#388/#389/#390/#386/#387/#384 and Privacy #214/#253–#256.
2. Reconfirmed #390 head advanced to `e8ba07fc26f154169f2e065d9aa65e77014635d2`.
3. Re-read immutable Jobs R923 receiver and traced durable receipt creation, replay, invalidation call and HTTP success/failure boundary.
4. Re-read Privacy R20 producer, replay helper and ACK callable.
5. Rechecked R647 donor dispatcher's success transition: a verified Jobs HTTP response currently sets root outbox `jobsDeliveryState = applied`. R963 proposes replacing that semantic with a transport/delivery projection only after canonical Privacy ACK is read/verified.
6. Retried remote checkout and checked local workspace; DNS failure and no checkout.
7. No code, tests, provider resources or production systems changed.

## 9. Next Chalk execution sequence

### Immediate
- On a Git-connected machine, clean detached checkout exact R647 head, verify commit/tree/blob IDs, run the two focused tests separately, Functions typecheck and preserve TAP/hash/version/exit receipts.
- If still blocked, do not synthesize or copy a pass from another run. Continue contract review only.

### Contract review
- Get Privacy/legal/security acceptance of R963/R964 design.
- Split Jobs receipt status into exact action semantics: consent block committed, derivative invalidation attempted/result, and physical purge unverified.
- Decide whether Jobs should ACK block commit before or after point-in-time cleanup; define retry and error responses to avoid making a successful block appear unapplied because cleanup failed.
- Strengthen Privacy ACK to bind complete event digest, Jobs receipt ID/hash, exact action and trusted workload identity.
- Define stable consumer identity across deployments and exact identical-ACK retry.
- Decide v3 event identity digest fields and source timestamp provenance; never substitute outbox createdAt.
- Define explicit legacy missing-lineage disposition.

### Review-only implementation and acceptance
- Upgrade Privacy publisher/contract/dispatcher and Jobs strict Zod receiver on separate branches after approval.
- Preserve R647 lease/retry/stale-owner and pinned transport mechanics where adapted v3 tests prove them.
- Native same-SHA Firebase emulator path: publisher → immutable outbox → dispatcher → Jobs block receipt → Privacy canonical ACK → readback/final delivery projection.
- Inject crashes/timeouts after Jobs commit and after Privacy ACK commit; test identical and conflicting ACK, new lease owner, stale event, regrant during transit, malformed/missing lineage and max retry.
- Separately verify nonproduction provider-level GCS denial, upload drain, exact generation purge and durable final ACK.

### Other gates remain independent
- Jobs #377 post-admission operator withdrawal policy.
- Worker auth #388/#389 and deployed identity verification.
- Rollback rehearsal to exact prior healthy revision.
- Protected CI, effective branch rules and independent reviewer.
- Deployment/image/service identity/secret/ingress/effective IAM inventory.
- Studio private media hard-off; do not activate.
- Full C6 lifecycle, devices/accessibility/visual acceptance and founder GO.

## 10. Final R965 classification

**Verified:** current review graph; Jobs R923 durable receipt and HTTP response semantics; Privacy R20 ACK trust/idempotency behavior; R20 identity/replay structure; R647 donor test design.

**Not verified:** real test execution, native emulators, live deployed source, dispatcher activation, actual cloud delivery, effective IAM, GCS future-write denial, upload drain or physical purge.

**No source changes, no merge, no deployment, no dispatch, no private media, no IAM change, no paid compute.**

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**
