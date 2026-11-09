# NEXT CHALK — ONE URAI GENESIS R975 EXECUTION DIRECTIVE

## Read first
1. `JOBS_R974_RULES_REPAIR_PRIVACY_OWN_CLAIMS_AND_CI_EXECUTION_RECONCILIATION_20261109.md`
2. `JOBS_R974_MACHINE_CHECKPOINT_20261109.json`
3. `JOBS_R972_FULL_SYSTEM_RECONCILIATION_RULES_CONSENT_JOBS_PRIVACY_HOLD_20261109.md`
4. `JOBS_R971_FULL_ESTATE_MASTER_CROSSWALK_AND_RELEASE_HOLD_20261109.md`
5. R970 stack/Rules audits, R969 governance/C1 Rules reports, R968 integration lineages, R967 source provenance and R966/R965 ACK/purge reports.

## Correct current state — do not repeat outdated claims
- Jobs main remains `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`; unprotected per branch API, required checks off. Preserve add/revert history.
- Jobs #381 contains the #380 Rules repair; exact Rules blob `d30c3e8fbbfcbf25767501e351edcb18d6080c6d` adds `dataRightsDeletionRequestId` to the protected `affectedKeys()` set. Do not claim the source fix is missing.
- Exact #381 static test blob `45c9e80c0aca2b8288d2e6ddf0650873dc4bdb75` was genuinely executed under R943 and passed 15/15; TAP SHA256 `a68a5b4e7709387bcaa8aa1d856824817efa4b53104bea91d29525664e13da9e`. This is static Node suite only.
- #381 native Auth/Firestore emulator test blob `95f4b72b1d7260a191b0cdc77c5cf008b57011e0` is authored/source-pinned but body NOT run.
- #383 head `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c`, based on #381 head `a295fd834c1cc01710a36b04523b023de2283240`, inherits the Rules fix and exact static/native test blobs, and includes #382's original 17-case longform test blob `9af97cd9b2bd7e2a8e5e66d805c90791da60a52c`. It enrolls 77 root command segments and requires #pass 17 in guarded R879. Neither the 17-case test nor 77-command suite nor R879 native suite has executed on #383. Issue #380 remains open until native/deployed Rules evidence and approval.
- Jobs #382 donor head `abdc13016fd83fbb4a3d7589645c1310d2344be0`. Its 17-case donor adds missing plan, wrong owner and wrong org cases and requires read-only idempotent replay.
- Privacy #257 current head is now `fbdc590376376b758be968f174d71709f326c61f` (not a3f711). Two-commit delta hardens generic cross-user authority using own-claims helper. Exact blobs: consent API `db8619c6d7fdf1309d5d89d7cfc8e77e346dbbf1`; helper `443097baa409c289b4189f98e4c56c7ab70aaa31`; R27 test `4ff5e6ca30a0152d22a05347f405b8c20ad2c8ed`. Life Movie purpose remains unregistered and verifier forced-deny; no grant/assembler.
- Sampled Jobs #381/#383 and Privacy #257 Actions jobs show runner ID 0, blank runner and empty steps. Workflow conclusions red but application test execution is not evidenced; root cause remains unknown.
- Jobs #252/#345/#376/#380 and Privacy #83 remain open. Shared Firebase Rules provider state remains UNKNOWN.
- R647, Jobs #371, R818/R836 and R27 remain distinct test/implementation paths.

## R975 work order
1. Refresh all current refs/PRs/issues/runs: Jobs main/#378/#381/#382/#383/#379/#389/#390/#391; Privacy #257/#186/#83/#214/#232; Labs #262/#304/#261/#284; Spatial #1962/#1964; Jobs #252/#345/#376/#380.
2. Obtain a clean, network-capable, approved credential-free runner. Checkout immutable exact #383 HEAD; verify SHA, tree, clean worktree, blobs and tool versions.
3. Execute separate gates and preserve full raw evidence:
   - `node --test scripts/owner_authority_rules.static.test.mjs` (15 expected);
   - `node --test scripts/life-movies-idempotency-revocation-race-contract.mjs` (17 expected);
   - full 77-command `pnpm urai-jobs:verify`;
   - `pnpm typecheck`, `pnpm build`;
   - guarded `scripts/run-r879-unified-native-acceptance.sh` with disposable demo project only.
4. Run native authenticated Rules test under guarded Auth/Firestore emulator. Confirm client ID-token add/change/remove of every protected field denied (403), valid displayName update permitted, Admin readback unchanged, trusted server-side deletion update preserved. No production credentials.
5. Investigate the R879 positive idempotency fixture and all 17 assertions. Do not say R940 13/14 is fixed unless exact test prints 17/17 pass.
6. Separately checkout exact Privacy #257 `fbdc590...`; run root + Functions frozen installs, R27 Vitest, typecheck/build and approved demo Auth/Firestore/Functions/Storage denial-path test. Preserve own-claims guard and hard-deny. Diagnose Actions pre-runner allocation separately; no blind reruns.
7. Confirm all execution receipts against exact commit/tree/blob IDs; write TAP/log SHA256, versions, exit status, emulator project identity, test counts and clean status. No copied/summary-only logs.
8. Obtain owner-authorized read-only Firebase provider inventory: real project number, database, deployed Rules release/etag/source, deploy principals/history, actual Privacy project/region. Do not infer from source aliases.
9. Resolve one accountable shared Firestore Rules publisher or approved database split. No Rules deploy in discovery.
10. Prove Jobs #252 in authorized nonproduction Storage: stale/alternate privileged writer 403 after revoke, in-flight/resumable upload drain, exact-generation deletion, final absence and durable downstream ACK.
11. Resolve #376 continuation policy, #345 concurrency/index parity, deployed identity/revisions/IAM, protected CI and independent review.
12. Preserve Studio consent/private-output hard-offs and Life Movie forced denial until privacy/legal approval and same-SHA owner consent→render→Replay→revoke→provider suppression→purge/ACK acceptance. Complete devices/accessibility/visual/legal/ops and Founder GO separately.

## Boundaries
No merge, deploy, Rules/IAM change, CI bypass, C1/C6 enablement, positive Life Movie grant, render, dispatch, private media, paid compute or Production GO. Static test pass is not native Rules acceptance. Workflow red with no runner steps is not application test failure. Jobs ACK is not physical purge.

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**
