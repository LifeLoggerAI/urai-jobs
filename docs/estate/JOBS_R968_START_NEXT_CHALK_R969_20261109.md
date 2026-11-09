# NEXT CHALK — ONE URAI GENESIS R969 FULL RECONCILIATION CONTINUATION

**R968 supplemental report:** [JOBS_R968_PRIVACY_JOBS_THREE_LINEAGES_AND_RELEASE_GATES_HOLD_20261109.md](JOBS_R968_PRIVACY_JOBS_THREE_LINEAGES_AND_RELEASE_GATES_HOLD_20261109.md). The primary consolidated ledger remains [JOBS_R968_CONSOLIDATED_CROSS_LINEAGE_RECONCILIATION_AND_RELEASE_LEDGER_20261109.md](JOBS_R968_CONSOLIDATED_CROSS_LINEAGE_RECONCILIATION_AND_RELEASE_LEDGER_20261109.md), with machine checkpoint [JOBS_R968_MACHINE_CHECKPOINT_20261109.json](JOBS_R968_MACHINE_CHECKPOINT_20261109.json).

**Main SHA correction before action:** older R968 consolidated tables record Jobs main as `9d29be1...`; live readback in the R967 continuation confirms current main is `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`. This revert removes one 90-line R933 file and restores the prior tree. It is unsigned. Branch protection is still disabled and required checks are off. Re-fetch this state before any action.

R968 tracks remain three distinct systems: R647 donor; Jobs #371 harness with missing Privacy modules; R818/R836 native Jobs→Privacy callable path. Do not transfer test results between them.

---

Continue the existing LifeLogger → LifeOS → UrAi Genesis. Do not rebuild or restart surviving implementations. Preserve all branches, source histories and evidence. Production remains HOLD / NO-GO.

## Read first

Repository: LifeLoggerAI/urai-jobs  
Forensic documentation PR #379: https://github.com/LifeLoggerAI/urai-jobs/pull/379  
Branch: `docs/genesis-jobs-firebase-forensics-20261109`

Read:
1. `docs/estate/JOBS_R968_CONSOLIDATED_CROSS_LINEAGE_RECONCILIATION_AND_RELEASE_LEDGER_20261109.md`
2. `docs/estate/JOBS_R968_MACHINE_CHECKPOINT_20261109.json`
3. R967 historical Privacy harness provenance report and checkpoint.
4. R966 harness/cleanup report and checkpoint.
5. R965 receipt/ACK/purge report.
6. R964 ACK/event identity report.
7. R963 canonical v3 design proposal.
8. R962 donor execution readiness report.
9. R961 definitive master handoff.
10. R960–R953 reports and R944 source/runtime/cloud matrix, test-history ledger, P0–P3 taskbook and original START NEXT CHALK.
11. Privacy #83, #192, #213/#214, #229–#232, #253–#256.
12. Jobs #371, #377, #379, #384, #386–#390.

## Refreshed review graph as of R968

Jobs:
- #379 docs PR: `bcb7c187a8c5f5d228721779d5479d6cebb224c6` before R968 writes.
- #371: `df19633466eaebdda844569ed0d562245bd31dc6`
- #377: `f8578ea281e818b01811aecc2fe4dfb8c3dc8203`
- #388: `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`
- #389: `b865209cc352241602d8b9714672f3401aed7669`
- #390: `e8ba07fc26f154169f2e065d9aa65e77014635d2`
- #384: `fd05a376f876f9b835929a2074c09f47638659e2`
- #386: `fd1c8d85acd5cc96ef9fcb300173e362b004eb54`
- #387: `04592f8573c708954f95f87ddca1e168efde51f4`

Privacy:
- #192 R506: `7f5f4ad2f157a9d3eb4ed12b679d499fe5888bdc`
- #213 R583: `4a4656d6283aa7e627bf220b447436df82865f99`
- #214 R647: `cc0692053db3b1b8df8267d43856b1a3357de8a0`
- #229 R834: `79e71fd6137947d2ed7c416a2596090572fef978`
- #230: `846d2ffa469af5634374bd77fbdc2d41bca8e964`
- #231 R835: `42aad96404c4f0de01a448031df80f7b5c06f7c0`
- #232 R836: `e1e2dee63c39590d343d727aa53618ac97a52691`
- #253 R17: `90a4e581e8494f52d85eab3c576d02b926e7d0d9`
- #254 R18: `dbc193763dc112210c20b5b51189573a954873593`
- #255 R19: `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a`
- #256 R20: `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`

Re-fetch before action. These are review heads, not deployed fingerprints.

## Critical reconciliation: three distinct tracks

### Track A — R647 dispatcher donor
Privacy #214 exact head `cc0692053db3b1b8df8267d43856b1a3357de8a0`.
- Dispatcher blob `4126167b4350ba8afe6b19d7b60dec1ca891189f`.
- Contract blob `6cca2b9456319927cf22511c7d51c1f16ddf051c`.
- Dispatcher tests blob `def1048aa4838f7ff990d792a27d1fb94e7f6441`.
- Contract tests blob `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`.
It exports `dispatchPendingJobsRevocations`; explicitly prepared, NOT DEPLOYED, no wrapper/scheduler/export. It uses bounded batch 20, 60s UUID leases, 12 attempts, exponential retries, stale lease protection, immutable source checks, pinned HTTPS Jobs destination and ACK verification.

Do not cherry-pick unchanged into R20: missing queue fields, changed integrity hash, prior-grant pair dropped, createdAt wrongly used as revokedAt.

### Track B — Jobs #371 synthetic revocation/Storage harness
Test blob `e9662a979a72a0e39a61fe896a79f8379658d963`, 3 tests.
Requires `URAI_PRIVACY_SOURCE_ROOT` with:
- consent-revocation-transition.ts
- consent-jobs-delivery.ts
- consent-jobs-http.ts
- consent-revocation.ts
- consent-jobs-dispatch.ts

Expects `deliverJobsConsentRevocation`. It uses local Firestore/Storage emulators, loopback HTTP for Jobs receiver, mocked Firebase wrappers/auth and synthetic fixtures. It is NOT Track A.

R967 inspected Privacy #192/#213/#214, R818/R819/R823–R826/R834/R836 and R20 trees; none had the three exact `consent-jobs-*` files. Path history queries were empty and 19-repository search had no hits. Exact source provenance remains unrecovered. Do not substitute R647 or invent and label as original. Recover original source from a grounded workspace/archive or clearly label a reviewed harness rewrite.

### Track C — Privacy R818/R836 native Jobs→Privacy callable acceptance
R836 #232 head `e1e2dee63c39590d343d727aa53618ac97a52691`.
- Runner `scripts/run-r818-native-jobs-privacy-acceptance.sh` blob `589fbbb8cb4903946b3adc1b2aa707038e61d3df`.
- Test `tests/integration/life-movie-jobs-native-transport.emulator.mjs` blob `cafd32784b4c95f72214938290637b819557f3bb`.
This tests Jobs compiled identity/transport client against actual Privacy `verifyLifeMovieRenderConsent` callable in demo Firebase Auth/Functions/Firestore/Storage emulators: denial of unscoped C6 and review-only synthetic issuer path. It is NOT the outbox dispatcher or Jobs #371 Storage-revocation harness.

Runner pins exact Privacy head and Jobs #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`, requires clean disposable checkouts, Node22/pnpm8.15.9/Java, no inherited credentials/project overrides, performs locked installs/typecheck/build and four emulators. R836 PR body says its full four-emulator run was NOT RUN due Unix socket EPERM; do not transfer prior parent passes.

## Jobs derivative cleanup boundary
Jobs #371 `lifeMovieDerivativeRevocation.ts` blob `d441b4971d456f2e861b2640067cbde6a2dfff32` has tenant/project/bucket checks, generation-pinned ifGenerationMatch deletion, refuses unknown objects, retains unresolved in-flight marker and explicitly reports:
- `privateOutputDeletionAcknowledged: false`
- `storageWriteFenceVerified: false`

Point-in-time list is not future-write fence. Historical erasure, object versions/soft delete, signed URL invalidation, backups and late privileged writes remain unproven.

## Privacy R20 and v3 proposal
R20 publisher blob `84f1e77d5c1cf55f80aaa0a559b6a3eac781386e`; transition blob `0ddee615f1284a58459aae48b915a574da7c9c9e`.
R20 has immutable outbox, prior grant lineage and trusted ACK callable. R964/R965 found ACK callable validates detailHash format/token-bound consumerId but does not recompute full event + Jobs receipt/action digest; duplicate comparison includes actorUid. R20 eventId excludes prior-grant pair while integrityHash/replay classifier include it.

R963 proposed consent.revoked.v3 with canonical serialization, full lineage, source transition timestamp/provenance separate from outbox createdAt, immutable digest vs mutable delivery metadata, Privacy per-consumer canonical ACK and crash-safe retry. It remains proposal only, unapproved/unimplemented.

## Privacy issue #83
Issue #83 remains OPEN: source canonical consent decision service exists, but protected deployed runtime, downstream consumer ACK, provider-call suppression and exact deployment/rollback evidence remain open. Do not close on source-only pass.

## R968 execution status
R968 refreshed relevant PR metadata; reviewed exact runner, harness, dispatcher and replay docs; repo-wide code search for missing modules returned no hits. Container git attempt:
`git ls-remote https://github.com/LifeLoggerAI/urai-privacy.git refs/heads/review/r647-jobs272-source-lineage-hold-20261104`
failed exit 128: `Could not resolve host: github.com`.
No clone, install, test, typecheck, emulators, endpoint, cloud inventory or GCS tests ran. Do not report new passes.

## R969 execution
1. Find exact original Track B Privacy modules only via grounded archive/workspace/repository provenance. If unavailable, explicitly plan a review-only harness rewrite.
2. Compare Tracks A/B/C with exact source/API/runner/test lineage; decide which acceptance contract covers each boundary. Do not conflate or run two dispatch loops.
3. On Git-connected host clean-checkout exact R647, Jobs #371 and Privacy R836 sources; verify commit/tree/blob/lock hashes.
4. Run R647 10-test and 16-test Node suites separately.
5. Run Track B 3-case emulator harness only with exact Privacy source or reviewed rewrite.
6. Run Track C R836 native runner separately; capture every stage/log/hash/exit and don't transfer #230/#231 results.
7. Review canonical v3 contract with Privacy/legal/security and approve event identity, source timestamp, prior lineage, legacy disposition, ACK semantics, stable service identity, timeout retry and root/subcollection projections.
8. Run same-SHA integrated producer/outbox/dispatcher/Jobs block/Privacy ACK emulator tests.
9. Separately read-only inventory actual deployed functions, Cloud Run, Scheduler, Tasks, Pub/Sub, Eventarc, workload identities, secret audiences, ingress, image/source digests and effective IAM.
10. Run approved nonproduction GCS stale/alternate writer 403, upload drain, exact generation cleanup and durable final ACK.
11. Close independent gates: operator-withdrawal legal/privacy policy, worker auth, rollback rehearsal, protected CI/branch protection/non-author approval, C6 lifecycle, device/accessibility/visual, vendor operations, founder GO.

## Evidence discipline
Label source readback vs executed local test vs emulator vs provider evidence vs prior report vs unknown. Keep exact source SHA/tree, Node/TS/Java/pnpm/firebase versions, logs, exit codes, SHA256. Never sum overlapping suites. Emulator is not live GCS IAM. Jobs ACK is not physical deletion. Stop on source mismatch, missing lineage, ambiguous lease, forged ACK, unresolved in-flight or late-write success.

## Required R969 deliverables
Create:
- comprehensive R969 reconciliation report;
- machine-readable checkpoint JSON;
- copy/paste R970 start prompt.

Commit them to the existing Jobs forensic PR #379 documentation branch, read them back from GitHub, report exact blob SHAs and latest PR head.

No cherry-pick unchanged. No merge. No deploy. No dispatch. No private media. No IAM changes. No paid compute. **PRODUCTION HOLD / NO-GO.**
