# NEXT CHALK — ONE URAI GENESIS R966 CONTINUATION COMMAND

Continue the existing LifeLogger → LifeOS → UrAi Genesis effort. Preserve original implementations, review branches and forensic records. Do not restart or rebuild known work.

## Read first

Repository: LifeLoggerAI/urai-jobs  
Forensic documentation PR #379: https://github.com/LifeLoggerAI/urai-jobs/pull/379  
Documentation branch: `docs/genesis-jobs-firebase-forensics-20261109`

Read in order:
1. `docs/estate/JOBS_R965_RECEIPT_ACK_PURGE_BOUNDARY_RECONCILIATION_HOLD_20261109.md`
2. `docs/estate/JOBS_R965_MACHINE_CHECKPOINT_20261109.json`
3. `docs/estate/JOBS_R964_ACK_RECEIVER_AND_EVENT_IDENTITY_REVIEW_HOLD_20261109.md`
4. `docs/estate/JOBS_R964_MACHINE_CHECKPOINT_20261109.json`
5. `docs/estate/JOBS_R963_CANONICAL_REVOCATION_EVENT_ACK_DESIGN_PROPOSAL_20261109.md`
6. `docs/estate/JOBS_R963_MACHINE_CHECKPOINT_20261109.json`
7. `docs/estate/JOBS_R962_R647_DONOR_EXECUTION_READINESS_HOLD_20261109.md`
8. R961 master handoff, R960 through R953.
9. R944 source/runtime/cloud matrix, test-history ledger, P0–P3 taskbook and START NEXT CHALK.
10. Privacy PRs #214, #253–#256; Jobs PRs #371, #377, #384, #386–#390.

## Refreshed source graph as of R965

All these review PRs remain open/draft/unmerged at last readback; refresh again:
- Jobs main: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`
- Jobs #371 R923: `df19633466eaebdda844569ed0d562245bd31dc6`
- Jobs #377 R900: `f8578ea281e818b01811aecc2fe4dfb8c3dc8203`
- Jobs #388 R951: `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`
- Jobs #389 R952: `b865209cc352241602d8b9714672f3401aed7669`
- Jobs #390 R932: `e8ba07fc26f154169f2e065d9aa65e77014635d2`
- Privacy #214 R647: `cc0692053db3b1b8df8267d43856b1a3357de8a0`
- Privacy #253 R17: `90a4e581e8494f52d85eab3c576d02b926e7d0d9`
- Privacy #254 R18: `dbc193763dc112210c20b5b680e8eb08fdf8396c`
- Privacy #255 R19: `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a`
- Privacy #256 R20: `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`

## Immediate task: donor tests

R647 donor source pins:
- Dispatcher `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- Contract `6cca2b9456319927cf22511c7d51c1f16ddf051c`
- Dispatcher Node test `def1048aa4838f7ff990d792a27d1fb94e7f6441`
- Contract/transport Node test `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`

There are 10 dispatcher and 16 contract/transport top-level test declarations. They use Node test, TypeScript transpileModule, VM, fake Firestore and mocked transport; they are not Firebase emulator or live HTTP tests.

R962 and R964/R965 attempts hit DNS failure: `git ls-remote` exit 128, “Could not resolve host: github.com”. No checkout, install, tests, typecheck or emulator run took place. Local workspace check found no complete Privacy checkout/node_modules.

R966:
1. Test GitHub network again. If available, make clean detached checkout exact R647 head.
2. Verify commit, tree and exact donor blobs.
3. Use locked package install without changing manifest/lockfiles.
4. Run separately:
   `node --test tests/consent-revocation-jobs-contract.test.mjs`
   `node --test tests/consent-revocation-dispatcher-contract.test.mjs`
5. Run Functions typecheck separately.
6. Record raw TAP, exit codes, Node/TypeScript versions, lock identity, source commit/tree and log hashes.
7. If DNS still fails, preserve NOT RUN and continue source/design work only.

## R965 critical reconciliation

Three separate facts must not collapse:
1. Jobs durable consent-block event receipt.
2. Privacy canonical per-consumer application ACK.
3. Real provider-level physical Storage purge evidence.

Jobs R923 receiver:
- authenticated bearer and strict v1/v2 schema;
- creates/validates durable Jobs event receipt and owner/purpose block transactionally;
- retries derivative invalidation on replay;
- returns HTTP 500 if derivative invalidation attempt throws;
- on successful attempt, response/receipt explicitly keep `privateOutputDeletionAcknowledged=false` and `storageWriteFenceVerified=false`.
A successful Jobs response is not physical purge.

Privacy R20 ACK callable:
- requires authenticated actor, system/role claim and token-bound consumerId;
- validates detailHash only as 64-hex and consumerId/token match;
- checks outbox eventId and schemaVersion, but does not recompute full outbox integrity or detailHash from a canonical Jobs receipt/action;
- duplicate ACK comparison includes actorUid;
- conflicting immutable ACK is rejected.

R965 requirements:
- Privacy ACK must bind full immutable event digest, Jobs receipt ID/hash, exact consumer action and status, OR an explicitly approved attestation trust model must specify this trust boundary.
- Define stable consumer workload identity across retries/deploy rollovers; do not silently remove actor binding.
- Define crash-safe identical-ACK recovery after ACK commit but lost response: reread exact canonical ACK and treat identical as idempotent; conflicting ACK => needs-review.
- Decide v3 eventId/full identity digest; R20 eventId excludes priorGrantReceiptHash/evidence, while integrityHash and replay classifier include them.
- Keep source transition time and provenance distinct from outbox creation/delivery time.
- R647 queue fields absent in R20; R647 digest rejects R20; R647 mapper drops prior grant fields; R647 maps createdAt to revokedAt. Never cherry-pick unchanged.
- ACK cannot mean physical purge.

## Canonical v3 design

R963 proposal suggests `consent.revoked.v3`, explicit prior grant lineage, source-transition time provenance, fixed canonical serialization, immutable digest separated from mutable delivery state, Privacy per-consumer ACK as canonical application ACK, and Jobs HTTP response as transport evidence.

This remains a **proposal**, not an approved or implemented contract. Get Privacy/legal/security review before code changes. Define:
- exact canonical fields/serialization/hash test vectors;
- whether eventId includes prior grant evidence;
- source timestamp provenance and unknown state;
- legacy/missing lineage disposition;
- Jobs response semantics separating block commit from derivative invalidation attempt;
- Privacy ACK detail hash recomputation or approved trusted attestation;
- stable consumer identity and actor UID semantics;
- root outbox delivery projection vs per-consumer ACK source of truth;
- crash-safe retry transitions.

## Required emulator and provider tests after approval

Same-SHA native Firebase Auth/Firestore/Functions/Storage:
publisher → outbox → dispatcher → Jobs block/receipt → Privacy canonical ACK → readback/final delivery projection.

Include duplicate, conflicting lineage, stale lease, timeout after Jobs commit, timeout after ACK commit, identical/conflicting ACK, regrant during network transit, corrupt payload, missing prior lineage, unknown source time, wrong token consumer and retry exhaustion.

Separately verify real protected nonproduction GCS late-writer denial (stale and alternate identities), upload/stream draining, exact generation cleanup and durable final purge ACK. Emulator success cannot establish privileged live Storage IAM.

## Other release gates remain separate

- Jobs #377 post-admission operator-withdrawal behavior needs Privacy/legal/security policy.
- Jobs worker-auth #388/#389 remains review-only; source tests don't prove deployed behavior.
- Rollback fix is source-level; exact prior healthy revision restoration not rehearsed.
- Studio private output/consent authority remain hard-off.
- R879 58 source pins and 78 command segments are not an executed suite.
- Protected CI, effective branch rules and independent reviewer remain outstanding.
- Actual deployed source/image, identities, ingress, secret bindings and IAM remain unknown.
- Full authenticated C6 lifecycle, devices/accessibility/visual acceptance, external operations and founder GO remain required.

## Operating rules

Classify evidence as source, actual test execution, predecessor report, failure/HOLD or unknown. Preserve logs, exit codes, source hashes. Do not sum overlapping historical tests. Do not equate emulator with effective privileged GCS IAM or Jobs ACK with physical deletion.

No merge, deployment, dispatch, private-media processing, IAM mutation, paid compute or production GO.

Continue at R966, execute donor tests if possible, otherwise document the exact blocker and progress review-only contract design.
