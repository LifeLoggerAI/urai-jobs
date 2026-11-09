# START HERE — ONE URAI GENESIS JOBS NEXT CHALK, R959

**Current checkpoint:** R959 · November 9, 2026  
**Release:** **PRODUCTION HOLD / NO-GO**  
**Canonical R959 report:** [JOBS_R959_FULL_NEXT_CHALK_MAIN_AND_ISSUE_RECONCILIATION_20261109.md](JOBS_R959_FULL_NEXT_CHALK_MAIN_AND_ISSUE_RECONCILIATION_20261109.md)  
**Machine checkpoint:** [JOBS_R959_MACHINE_CHECKPOINT_20261109.json](JOBS_R959_MACHINE_CHECKPOINT_20261109.json)

## R959 new facts — read before doing anything
- Jobs main is now `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`; commit reverts one accidentally added 90-line R933 test file. Its tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a` matches the earlier main tree. The revert commit is unsigned. Preserve history; do not rewrite.
- Main remains unprotected: `protected=false`, required checks enforcement off, no required contexts; Rulesets including parents returned an empty list.
- Jobs PR #389 remains open/draft/unmerged at `b865209cc352241602d8b9714672f3401aed7669`. Its 78 root commands are enrolled, not executed.
- Ten prior Actions failures still show pre-runner allocation (runner ID 0, no recorded steps). Exact GitHub cause remains UNKNOWN. No blind retries.
- Issues #252 (P0 GCS revocation), #376 (post-admission data rights), #380 (server-owned deletion binding Rules), and #345 (quota concurrency) remain open.
- Four worker implementation files are covered by the original R951 source-expression test. This is not HTTP middleware or deployed-route testing.
- Studio Life Movie consent authority and private GCS output writes remain hard-off. Live GCS 403, upload drain, exact-generation deletion/ACK and owner Replay remain uncertified.

## R959 required sequence
1. Read the R959 report and JSON checkpoint.
2. Refresh PRs #387–#389, #379, #304, main branch, Rulesets, issues #252/#376/#380/#345, and Actions.
3. Have an authorized admin establish and verify main protection; do not change settings from an unprivileged forensic pass.
4. Diagnose Actions runner allocation from complete GitHub-side evidence. Do not rerun blindly.
5. Run original auth test, 78 root commands, typecheck/build and guarded four-emulator R879 on one immutable SHA in an approved free, credential-free full checkout.
6. Add real HTTP auth tests; independently prove P0 GCS revocation, drain, generation deletion, purge ACK and owner-only Replay.
7. Verify deployed resource/IAM/revision parity and operational rollback.
8. Update Jobs #379 and Genesis #304 with receipts and exact heads.

**No merge, deployment, CI bypass, production IAM/Rules mutation, paid compute, real jobs or private media. Production HOLD.**

---

# START HERE — ONE URAI GENESIS JOBS NEXT CHALK, R958

**Current checkpoint:** R958 · November 9, 2026  
**Release:** **PRODUCTION HOLD / NO-GO**  
**Current Jobs engineering candidate:** PR #389, open/draft/unmerged, exact head `b865209cc352241602d8b9714672f3401aed7669`.  
**Do not assume any branch head is unchanged. Re-fetch GitHub metadata before action.**

## R958 supersedes this older R944 entrypoint as the first reading step

Read these current documents first:
1. [R958 canonical next-Chalk reconciliation](JOBS_R958_CANONICAL_NEXT_CHALK_RECONCILIATION_20261109.md)
2. [R958 machine-readable checkpoint](JOBS_R958_MACHINE_CHECKPOINT_20261109.json)
3. [R957 branch protection and Actions governance audit](JOBS_R957_BRANCH_PROTECTION_ACTIONS_GOVERNANCE_HOLD_20261109.md)
4. [R956 Actions runner-allocation forensics](JOBS_R956_ACTIONS_RUNNER_ALLOCATION_FORENSICS_HOLD_20261109.md)
5. [R955 independent authentication gate and CI review](JOBS_R955_INDEPENDENT_REVIEW_R952_GATE_AND_CI_HOLD_20261109.md)
6. [R954 complete-source authentication reconciliation](JOBS_R954_FULL_SOURCE_RECONCILIATION_NEXT_CHALK_HOLD_20261109.md)
7. Continue with the original R944 forensic inventory, evidence ledger and P0–P3 taskbook below.

## Immediate critical conditions
- Jobs `main` observed SHA: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`; GitHub API reports `protected=false`, required status-check enforcement `off`, empty required contexts/checks, and Rulesets including parents returned `[]`.
- The ten recorded #389 Actions failures had 12 executed jobs with runner ID 0, empty runner metadata and zero steps. Workflow source uses `ubuntu-latest`. Exact GitHub-side cause remains **UNKNOWN**; do not rerun blindly or claim app tests failed.
- PR #389 includes the R951 auth regression in the root and R879 gates; 78 command segments are enrolled, **not executed**.
- The checked-in R951 test reads four worker source files and evaluates source guard expressions. It is not an HTTP route test.
- Studio consent authority and private output writes remain hard-off. Live IAM/GCS 403, upload drain, exact-generation purge ACK and owner Replay remain uncertified.
- No merge, deployment, IAM/Rules changes, CI bypass, paid compute or private media.

## Mandatory next Chalk actions
1. Diagnose hosted runner allocation from complete GitHub-side error details before retrying.
2. Have authorized repository administration establish main protection, required checks and independent review/no-bypass policy; read settings back.
3. On an approved free credential-free complete checkout, execute the original auth test, all 78 root command segments, builds/typechecks and guarded four-emulator R879 acceptance on one immutable SHA.
4. Add actual HTTP auth tests.
5. Independently prove live Storage post-revocation denial, upload drain, exact-generation deletion/ACK and owner-authorized private Replay.
6. Verify actual Firebase/GCP deployed resources, identities, effective IAM, image digests and rollback.
7. Update Jobs #379 and Genesis #304 with exact receipts and unresolved blockers.

**Do not interpret UNKNOWN as absent, source code as deployed, test enrollment as test execution, or local pass as production certification. Production HOLD remains mandatory.**

---

# START HERE — ONE URAI GENESIS JOBS NEXT CHALK, R944

**Date:** November 9, 2026 UTC. **Production:** HARD HOLD / NO-GO. **Project discovery seed:** `urai-jobs`. **Expense authorization:** **$0**. **Private media / production cloud writes:** NONE.

## 0. What has already been preserved, where it lives

The original Jobs GitHub repository is `LifeLoggerAI/urai-jobs`. This documentation-only continuation is [Jobs draft #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379), branch `docs/genesis-jobs-firebase-forensics-20261109` (re-fetch exact current HEAD before continuing). The master 19-repository Genesis registry is [LifeLoggerAI/urai-labs-llc draft #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262) and `docs/estate/00_START_HERE.md`. **Do NOT invent a new Jobs architecture or silently merge abandoned/historical code.**

Read these in this exact order:

1. `docs/estate/JOBS_R944_SOURCE_RUNTIME_CLOUD_RESOURCE_MATRIX_20261109.md`: 27 Function exports, 12 actively registered job types versus legacy job registry, Firebase aliases, configured schedules/topics/indexes/Storage/Hosting, deployment code and **every live resource inspection gap**.
2. `docs/estate/JOBS_R944_TEST_HISTORY_CROSS_SERVICE_EVIDENCE_LEDGER_20261109.md`: source SHA-scoped Jobs and Privacy/Studio/Staging/Spatial test receipts, historical failed/green classifications, CI startup failures, deliberate expected-red diagnostics. **Do not sum counts across branches.**
3. `docs/estate/JOBS_R944_P0_P3_TASKBOOK_AND_EXACT_VERIFICATION_20261109.md`: all work remaining, owners/acceptance criteria and exact safe commands.
4. `docs/estate/JOBS_R944_MACHINE_CHECKPOINT_20261109.json`: portable structured source SHAs, proofs, results, open issues and currently unverified cloud inventory.
5. Preceding first audit `docs/estate/GENESIS_JOBS_FIREBASE_RECONCILIATION_20261109.md`, first JSON checkpoint and R941 source-field continuation.
6. Current source handoffs in [Jobs #381](https://github.com/LifeLoggerAI/urai-jobs/pull/381) and [Jobs #382](https://github.com/LifeLoggerAI/urai-jobs/pull/382), read their patches and original test source. Main is **NOT** these review candidates.
7. Independent P0 [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) and P1 [#376](https://github.com/LifeLoggerAI/urai-jobs/issues/376), [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380), [#337](https://github.com/LifeLoggerAI/urai-jobs/issues/337), P2 [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345).
8. Cross-service [Privacy #239](https://github.com/LifeLoggerAI/urai-privacy/pull/239), [Studio #182](https://github.com/LifeLoggerAI/urai-studio/pull/182), [Staging #176](https://github.com/LifeLoggerAI/urai-staging/pull/176), [Spatial #2072](https://github.com/LifeLoggerAI/urai-spatial/pull/2072), [Labs #297](https://github.com/LifeLoggerAI/urai-labs-llc/pull/297).

## 1. Where the source currently is (reconfirm!)

- Latest observed Jobs `main` = `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`; GitHub branch API `protected:false`. No live production deployment SHA confirmed.
- Security/runtime convergence [#371](https://github.com/LifeLoggerAI/urai-jobs/pull/371): `df19633466eaebdda844569ed0d562245bd31dc6`, 76 root **commands enrolled**, not a current full-suite PASS.
- Test-only parent [#378](https://github.com/LifeLoggerAI/urai-jobs/pull/378): `5881a650230c55245c87a001c58f3ebc6835196b`; original longform idempotency 13/14 prior cases, one test-only missing bound plan. Does not prove full suite.
- Two sibling patches off #378: [#381](https://github.com/LifeLoggerAI/urai-jobs/pull/381) `a295fd834c1cc01710a36b04523b023de2283240` **Rules deletion-request ID protection**; [#382](https://github.com/LifeLoggerAI/urai-jobs/pull/382) `d87cc22b798b6894861a344125f57747e016c1ba` **longform 17-case fixture**. **They are NOT merged into one reviewed head.**
- Jobs #381 original static Rules Node suite was actually reconstructed from three exact Git blob files and executed twice (R943 and R944) `15/15 PASS`; R944 TAP SHA256 `3e5f5f247d7449fd805022972fde18f74367593385b2773a484cee8f3a733dcb`. Native Firebase test source syntax PASS. **No native Firebase emulator, no full Jobs workspace execution this session.**
- Jobs #382 original 17-case test **NOT_RUN**; preceding R942 helper-focused 7/7 reported PASS is not that test.
- GitHub Actions most recent Jobs #381 workflows failed within seconds; previously inspected CI build job had **zero recorded steps**, log unavailable. Treat as infrastructure/runner admission unknown, not proven code failure.
- Local container `git ls-remote https://github.com/LifeLoggerAI/urai-jobs.git HEAD` returned `Could not resolve host: github.com`, exit 128. There is no original full clone or pnpm/Firebase dependencies in this container. `/mnt/data/r942_verify/` contains **only 3 original source files + TAP receipts**, not a full Jobs checkout. Don't call that a full native build.
- Live Firebase/GCP project number, app IDs, databases, bucket names, Functions/Cloud Run revisions, service principals/IAM, deployed Rules, logs and billing **NOT INSPECTED**. User forbids TinyFish credits, paid cloud computer or other paid methods; do not retry.

## 2. What the next Chalk should actually execute first

**Do not revisit R941 without checking #381**: the missing `dataRightsDeletionRequestId` source Rules protection has already been patched in an independent unmerged review branch; next action is native verification, not another duplicate code fix.

**Next code task:** independently reconcile #381 and #382 disjoint changes in a **new** isolated branch on the reviewed R940 parent, without modifying existing PR branches, code safety guards, original Git history, source hashes, test names, `main` or production resources. Detect any intervening commits; use identical Git blobs for donor files and re-pin original R879 guarded acceptance. Preserve a missing-plan **deny** case and actual owner/org validation.

**Next verification task:** on a safe and *already authorized* free CPU host with full GitHub/package connectivity and clean source, run the actual original 17-case idempotency script, original 15-case static Rules script, frozen `pnpm urai-jobs:verify` full 76-command suite/typecheck/build, and original guarded nested four Firebase emulators. Confirm real authenticated client ID-token Firestore REST denies user deletion ID change/remove/legacy add, while a normal owner profile edit succeeds; Admin service safely retains authorized deletion writes. Every test must share a reviewed immutable SHA.

**Next cloud metadata task:** obtain previously authorized read-only Firebase/GCP resource inventory without paying, list every resource and location, deployment source/build SHA, effective Rules/IAM, service account/old credential boundary, GCS buckets/generation (no user contents). Source `firebase.json` declares site `urai-jobs-563121397472` whereas deploy script defaults `urai-jobs`; identify actual target by readback. Main indexes 8 vs review 9; verify installed indexes and readiness before atomic quota claim.

**Next security task:** hard P0 #252 remains independent of any local Rules fix. Actual privileged Storage writer after revocation must receive real GCS 403, in-flight upload drain and exact-generation deletion ACK verified under approved protected staging; then positive signed owner C6 consent, source rights, Studio→Jobs private render, protected Spatial Replay, owner-only delivery and post-revocation denial. Do not issue C6, enable paid provider, render actual private media or deploy without separate authorization.

**Next governance task:** restore protected CI without bypass, independent reviewer and rollback source parity; only explicit founder release GO after all P0/P1 acceptance can lift HOLD.

## 3. What not to confuse

- GitHub source existence `!=` deployed Functions/Cloud Run.
- `firestore.rules` direct client deny `!=` privileged GCS IAM deny or consent-checked private delivery.
- `jobsCreateRateLimit` transactional source `!=` full concurrent signed-in native proof.
- 76 unique `pnpm urai-jobs:verify` commands `!=` 76 executed commands.
- Prior 695 passing TAP checks at Jobs #320 `!=` present review head passing.
- R900 `12/12` diagnostic green `!=` post-admission security green; its 4 required counterfactual cases are RED.
- Older true Firebase emulators at different SHAs `!=` current source or real IAM certification.
- Historical retained `functions/src/core/jobRegistry.ts` (spatial/career/etc) `!=` the narrower 12 active runtime job types.
- Privacy Jobs-scope anonymization `!=` central ecosystem privacy deletion acknowledged.
- No live access `!=` no live resource. Label UNKNOWN, not absent.
- No private-media processing authorized; `URAI_LIFE_MOVIE_LONGFORM_ENABLED` and Studio dispatch remain hard-off until governed approval.

## 4. Required handoff after your continuation

Record every changed original path and full Git blob SHA, SHA256 of raw logs, test command+exit, exact source commit/tree, actual emulator/service identity, current PR/head, unmet gate and next safe action in a **new review-only child document** on an isolated branch. Link to Genesis Labs and Jobs #379 without rewriting certified historical receipts. If cloud access fails, state the precise boundary. Do not claim production GO, no matter how many local tests pass, until independent release certification and founder authorization.

**Final disposition: ONE URAI GENESIS JOBS — SOURCE RECOVERED, PARTIAL TESTS VERIFIED, CLOUD/POST-REVOKE/CROSS-SERVICE AND RELEASE CERTIFICATION UNVERIFIED; PRODUCTION HOLD.**
