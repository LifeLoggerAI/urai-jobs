# NEXT CHALK — ONE URAI GENESIS R967 CONTINUATION COMMAND

Continue the existing LifeLogger → LifeOS → UrAi Genesis integration. Preserve original code, source history, branches and forensic evidence. Do not restart the project or rebuild surviving implementations.

## Read first

Repository: LifeLoggerAI/urai-jobs  
Forensic documentation PR #379: https://github.com/LifeLoggerAI/urai-jobs/pull/379  
Documentation branch: `docs/genesis-jobs-firebase-forensics-20261109`

Read in order:
1. `docs/estate/JOBS_R966_EMULATOR_HARNESS_AND_DERIVATIVE_CLEANUP_RECONCILIATION_HOLD_20261109.md`
2. `docs/estate/JOBS_R966_MACHINE_CHECKPOINT_20261109.json`
3. `docs/estate/JOBS_R965_RECEIPT_ACK_PURGE_BOUNDARY_RECONCILIATION_HOLD_20261109.md`
4. `docs/estate/JOBS_R965_MACHINE_CHECKPOINT_20261109.json`
5. `docs/estate/JOBS_R964_ACK_RECEIVER_AND_EVENT_IDENTITY_REVIEW_HOLD_20261109.md`
6. `docs/estate/JOBS_R963_CANONICAL_REVOCATION_EVENT_ACK_DESIGN_PROPOSAL_20261109.md`
7. R962 donor audit, R961 master, R960–R953 and R944 source/runtime/cloud matrix, test-history ledger, P0–P3 taskbook and START NEXT CHALK.
8. Privacy #214 and #253–#256; Jobs #371, #377 and #384/#386–#390.

## Exact source references last refreshed

- Jobs main: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`
- Jobs R923 #371: `df19633466eaebdda844569ed0d562245bd31dc6`
- Jobs R900 #377: `f8578ea281e818b01811aecc2fe4dfb8c3dc8203`
- Jobs R951 #388: `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`
- Jobs R952 #389: `b865209cc352241602d8b9714672f3401aed7669`
- Jobs R932 #390: `e8ba07fc26f154169f2e065d9aa65e77014635d2`
- Privacy R647 #214: `cc0692053db3b1b8df8267d43856b1a3357de8a0`
- Privacy R20 #256: `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`

All these relevant reviews were open/draft/unmerged at R966 metadata refresh. Re-read live PR metadata before relying on this state. These refs do not establish deployed code.

## Immediate priority: recover the Privacy checkout that the Jobs emulator harness expects

Jobs R923 source `tests/emulator/privacy-jobs-storage-revocation.test.mjs` blob:
`e9662a979a72a0e39a61fe896a79f8379658d963`.

It has three Node test cases and requires `URAI_PRIVACY_SOURCE_ROOT` pointing to a complete installed Privacy checkout. That checkout must contain:
- `functions/src/consent-revocation-transition.ts`
- `functions/src/consent-jobs-delivery.ts`
- `functions/src/consent-jobs-http.ts`
- `functions/src/consent-revocation.ts`
- `functions/src/consent-jobs-dispatch.ts`

It expects the export `deliverJobsConsentRevocation` from `consent-jobs-dispatch.ts`.

**Important:** This is NOT the R647 donor dispatcher. R647 contains `consent-revocation-jobs-dispatcher.ts` exporting `dispatchPendingJobsRevocations`, plus `consent-revocation-jobs-contract.ts`. They are different files/APIs. The R647 and R20 trees inspected in R966 do not contain the three `consent-jobs-*` modules expected by the Jobs harness. Do not rename, fake or substitute the R647 implementation to force the harness to load.

R967 must search the historical Privacy branch/commit estate for those exact modules. For every candidate, read the exact tree and files, pin commit/tree/blob IDs and compare the five modules plus package manifests. If no compatible source exists, state that accurately and produce a review-only harness compatibility plan. No guessed paths or source recreation presented as recovered originals.

## Donor test execution — still blocked

R647 #214 exact donor:
- head `cc0692053db3b1b8df8267d43856b1a3357de8a0`
- dispatcher `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- contract `6cca2b9456319927cf22511c7d51c1f16ddf051c`
- dispatcher test `def1048aa4838f7ff990d792a27d1fb94e7f6441`
- Jobs contract test `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`

The two test files have 10 and 16 top-level Node test declarations, with VM-loaded TypeScript and fake Firestore/mock transport. They are not emulator tests.

R962–R966 Git clone attempts all failed with exit 128 due DNS: `Could not resolve host: github.com`. No checkout, install or tests took place.

When GitHub network is available:
1. clean detached checkout exact R647 commit;
2. verify commit/tree and blobs;
3. use locked install without modifying package files;
4. run each original Node test command separately and Functions typecheck;
5. capture raw TAP, exit codes, versions, lock hashes and log SHA256.
If network remains blocked, keep NOT RUN and do not fabricate passes.

## R966 Jobs emulator harness facts

The Jobs harness has three top-level cases:
1. local Privacy-to-Jobs delivery deletes a referenced synthetic object before Privacy per-consumer ACK;
2. unresolved in-flight RUNNING attempt blocks ACK and retains marker despite known-reference cleanup;
3. synthetic 110-job/30-plan workload finishes under injected 85ms per-transaction delay.

It uses actual local Firestore and Storage emulator APIs for synthetic fixtures and operations, plus a real loopback HTTP server around Jobs' actual `ingestConsentRevocation` handler. Firebase callable/HTTP/trigger wrappers and token/actor are mocked. It manually seeds a synthetic `life-movie.render` grant/revocation; this is not an authorized production grant. It does not prove hosted delivery or privileged GCS IAM.

The documented runner invocation uses:
`URAI_PRIVACY_SOURCE_ROOT=/path/to/compatible/privacy-checkout firebase emulators:exec --project demo-urai-jobs-cleanup --only firestore,storage 'node --test tests/emulator/privacy-jobs-storage-revocation.test.mjs'`
Check exact emulator config/toolchain and the source root before running.

## Jobs derivative cleanup source facts

File `functions/src/privacy/lifeMovieDerivativeRevocation.ts`, blob `d441b4971d456f2e861b2640067cbde6a2dfff32`:
- validates server-owned job/plan references and tenant/project/bucket scope;
- pins Storage object generation and deletes with `ifGenerationMatch`;
- does not delete unknown/unattributed objects;
- blocks completion when unknown paths, missing list permissions, invalid scope or overbroad scope exist;
- preserves `consentRevocationInFlightUnresolved` on RUNNING/LEASED attempts;
- refuses to claim private output deletion or storage write fence verified.
A successful prefix listing is a point-in-time check, not a future-write fence. Historical erasure, versions/soft-deletes, signed URLs, backups and unrecorded outputs remain outside proven scope.

Jobs `docs/CONSENT_REVOCATION_REPLAY.md` blob `31886c5ce46a39f2a0424aa377c157874a62ac84` describes these boundaries and emulator commands.

## Protocol architecture still unresolved

Keep three distinct:
1. Jobs local consent-block receipt;
2. Privacy canonical per-consumer application ACK;
3. provider-level physical purge evidence.

The R963 v3 proposal and R964/R965 refinements remain proposals, not approved or implemented:
- explicit event version and immutable canonical digest;
- current and prior grant receipt lineage;
- source timestamp provenance separate from outbox createdAt;
- Privacy ACK binding to full event, Jobs receipt ID/hash and exact action;
- stable token-bound consumer workload identity;
- idempotent ACK recovery after lost response;
- separate mutable delivery/lease/retry projection;
- explicit legacy missing-lineage disposition.

R647 mechanics are donor material, not an active dispatcher. R960 has four incompatibilities: missing queue metadata in R20, changed integrity hash, dropped prior-grant pair, and createdAt/revokedAt conflation. Never cherry-pick unchanged. Do not run two competing dispatchers.

## Other gates remain independent

Jobs #377 post-admission operator withdrawal requires Privacy/legal/security policy. Worker authentication #388/#389 is review-only. Rollback exact healthy-revision restoration is unproven. Studio private render consent/output-write authority remain hard-off. R879 58 source pins and 78 command segments are not completed execution. Protected CI, branch rules, nonauthor reviewer, deployed source/image/service identity, secrets/ingress and effective IAM remain open. Real nonproduction GCS late-writer 403, upload drain, exact-generation purge and durable final ACK are separate. Full C6 lifecycle, physical devices/accessibility/visual, external operations and founder GO remain outstanding.

## Work discipline

Classify every claim as exact source, executed test, prior report, failure/HOLD or unknown. Preserve logs, versions, exit codes and immutable source IDs. Do not sum overlapping tests. Do not equate emulator success with effective privileged GCS IAM. Do not equate Jobs ACK with physical deletion. Stop on source mismatch, missing lineage, unknown time, ambiguous lease, forged ACK or late-write success.

No merge, deploy, dispatch, private-media processing, IAM change, paid compute or production GO.

Resume at R967 with exact recovery of the harness-compatible Privacy source, then execute real donor/emulator tests only when clean checkouts and dependencies are actually available.
