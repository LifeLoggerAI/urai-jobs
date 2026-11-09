# ONE URAI GENESIS — R980 COMPLETE NEXT-CHALK RECONCILIATION AND STUDIO 202 / JOBS / PRIVACY CONVERGENCE

**Date:** 2026-11-09. **Status:** PRODUCTION HOLD / NO-GO. **Evidence class:** GitHub source/PR metadata and previously recorded native receipts; this pass did not execute tests or mutate runtime source.

## Canonical starting point

Read Jobs R978 and R979 handoffs first, then this R980. Canonical estate master is Labs draft #262, current observed head **f753af79a7e3a60d919fe8a9258338759137b1a1**, 21 commits ahead / zero behind the R978-observed head 5be84013d406299872610ca423090a16760e62b9. Its entrypoint blob remains 18dfcb985f4303bd73a2a2eec918462e54fadd6b; newer 21-commit delta consists of 21 archive/source/evidence files for Studio #202, Jobs Rules and R879. These archives are on the draft branch, not merged main.

Jobs forensic #379 was **27478c406c2094131f9e8686ca9583150043c48f** before this write, open/draft. R979 and R978 handoffs remain intact. Current PR heads in this pass: Jobs #381 a295fd834c1cc01710a36b04523b023de2283240, #383 1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c, #384 fd05a376f876f9b835929a2074c09f47638659e2, #391 9f5759f072370fbd42a82560ff6c5d4f37169c6b, **#392 23dbbe6bf802ac3350776c476699f6e33540c689**, **#393 5fc1def0be77c75f7d9073efbeb41599d4dcd717**; Privacy #257 fbdc590376376b758be968f174d71709f326c61f and **#258 cec2e685c1154395590bc6c20520d15daffc3550**; Studio #201 a6187abfd12ffc8f534ddf66246da91ed032e1dc and **#202 501ac5c325f906cdeb32b0638dd15f5622ea1304**. All open/draft. This pass did not refresh all 19 main refs.

## New actual convergence evidence: Studio #202 → Jobs #392

Labs current master now archives:
- docs/estate/JOBS_STUDIO202_CONSUMER_ACCEPTANCE_20261109.md, blob a01708a8b4f7530823aa22520ac4e718fb6c2c85;
- docs/estate/manifests/JOBS_STUDIO202_ACCEPTANCE_EXECUTED_RESULTS_20261109.json, blob 8cda0ad1ed8c53ed42ae6cdf90faee91490568c0;
- docs/estate/manifests/JOBS_STUDIO202_SOURCE_PINS_20261109.json, blob 0296dd7155347fbbbb1e39a9f85c57d2b8f3fe92;
- raw TAP files, environment manifest and six source-pinned producer/consumer fixture records.

Studio #202 fixes an actual boundary mismatch: sceneTruthReceiptRef and sceneTruthDigest previously allowed coercible JSON array/object values through regex/string coercion in direct producer; Jobs strict Zod correctly rejected those. #202 requires primitive strings, retains valid envelope bytes, and does not authorize dispatch. It is a child of #201. Studio PR #202 reports four red tests before fix, five focused green after; 57 regression files (39 Node tests), focused Life Movie 11/11, three real Jobs Zod synthetic tests, isolated typecheck PASS on local Node 24.22.1 outside declared Node 20; therefore full supported-runtime build and release acceptance remain missing.

Jobs #392 enrolls the actual #202 producer source as a separate immutable fixture alongside preserved #201 fixture and tests, with six source pins. Labs archive records exact red/green results: Node 22.23.0 + Zod 3.25.76, **22/22 PASS** (12 synthetic consumer and 10 historical/current producer tests); Node 20.19.0 original Studio #202 focused regression **5/5 PASS**; isolated producer strict typecheck PASS. Actual #392 PR body additionally reports on exact head **23dbbe6bf802ac3350776c476699f6e33540c689** / tree **94a5d8d9cc46206d63dc137bcf17c49db58a0a8e**: frozen pnpm install across 13 workspaces, Functions typecheck/build/test and root typecheck/build PASS, clean worktree, source/manifest/lockfile hashes unchanged. These are **recorded prior-worker native results**, not reruns in R980. Their scope is candidate source, not authenticated runtime or protected CI. The Jobs source still correctly denies the producer because canonical life-movie.render consent is missing.

Critical correction to earlier R973: Jobs #390 and #391 have divergent **commit ancestry** but their complete endpoint trees were independently compared and are **identical**, tree 4bd3d28a81d28f7507db98ce2f7359bb477e432a (1,470 matching object records), including corrected test blob 74e94da0a118a043ab76af611474f3f73d329cea. Do not mistake GitHub merge-base compare file differences for endpoint-tree divergence; preserve both histories. #392 branches from #390 and contains further fixture/tests.

Jobs #393 is a distinct review-only candidate to enroll the existing actual-producer denial test in root urai-jobs:verify and the R879 native runner. Its PR records static source-pin checks only; **native Node/Zod, R879, build and emulator NOT RUN** for #393. #392 and #393 both branch from #390; do not assume one contains the other's changes or blindly merge either. Plan a minimal lossless convergence branch, source-pin both patches, then run exact combined native suite and full R879.

## Privacy #258: denial-only integration candidate

Privacy #258 is child of #257 current R27 head and ports historical R818 Jobs-to-Privacy denial-only emulator harness to current Jobs #390 source. It adds a runner, native Auth/Firestore/Functions/Storage test, exact source manifest and Node 22.23.0/Java 21/pnpm 8.15.9 workflow. Requires read-only private Jobs repository token with contents:read; credential persistence disabled and token excluded from emulator runner. PR reports three hosted workflow failures (42615689157, 42615958473, 42616101945) with **no steps, artifacts or logs**. Root cause unknown. **Do not claim Privacy #258 native authenticated acceptance**. Privacy R27 historical exact-head R945 receipt is 200/200 units, 10/10 R27, 13/13 Rules + 3/3 integration-smoke, but still forced-deny, purpose unregistered, no positive grant. #258 does not change that.

## Jobs #252 P0 and #380 P1 remain

Jobs issue #252 confirmed OPEN/P0 by issue search in this pass. Source-pinned historical negative test: #253 worker hard-off 4/4, #254 reservation emulator 11/11, #255 race model 17/17, #384 late-write negative reproduction 10/10 with **privilegedBypassObserved=true**. A privileged Admin Storage writer can recreate synthetic bytes after revocation and empty inventory in the disposable emulator; not proof of a live breach. Storage-level fence not established, real GCS 403 and active-upload drain/purge ACK not established. Private rendering remains disabled.

Jobs #380 OPEN/P1: user self-update Rules omit server-owned dataRightsDeletionRequestId on earlier source; #381 adds guard. Its exact original Node static test 15/15 PASS per R943, but authenticated native Rules emulator still NOT RUN. #383 full 77-command suite not run. Other open Jobs issues #376 operator continuation, #372 legacy authority, #337 stale claims, #345 concurrent quota, #129 longform runtime remain.

## Shared Firebase, Council and estate

Multiple reviewed repos select urai-4dc1d/(default) with different Rules; Admin has reviewed WIF Firestore/Storage publisher path, Spatial reviewed path does not publish Rules, B2Bportal reviewed CI does not. Actual deployed Rules, IAM, manual publishers, DB/project number and 23 historically listed Firebase project seeds are not independently verified. Do not deploy guessed merged Rules.

Communications five-provider sequential failover is not parallel Council debate. Labs R965 further warns that dedicated Spatial Council/Orb handlers do not visibly use Communications' canonical protected provider-spend helper; separate equivalent gateway not ruled out. Public build-time 'live' labels do not certify provider runtime. Require spend boundary and provider/consent evidence before enabling multi-model operation.

Historical LifeLogger/LifeOS/UrAi/RuAi code and user-data preservation are separate questions. Keep 19-repo donor provenance, canonical Spatial journey, private owner-only Replay, accessibility/20+ languages/physical devices/AAA visuals and legal/operational release gates intact. Never claim cloud media preservation without provider inventory.

## Explicit integration sequence for next Chalk

1. Re-read Labs #262 current entrypoint and R945/R946/R950/R961 archives; Jobs R978/R979/R980; PRs Studio #202, Jobs #392/#393, Privacy #258, Jobs #381/#383/#384. Re-fetch all 19 main SHAs, branch rulesets and review heads before code edits.
2. Diff #392 vs #393 against common #390; preserve exact #201/#202 producer fixtures, six source pins and existing native runner pins. Produce a **single review-only combined candidate**, never change canonical consent hard-off. Run frozen Node22/pnpm8.15.9 install, complete root/Functions suites, R879, emulator and worktree/lockfile SHA checks. Distinguish 22/22 isolated tests from full integration acceptance.
3. Execute Privacy #258 direct Jobs identity/denial-only emulator with real observable logs, source-pinned synthetic tokens and deletion fences; no grant.
4. Execute Jobs #381 authenticated owner Rules emulator, then full #383 acceptance; retain benign profile updates and Admin deletion semantics.
5. Implement sole broker and real disposable GCS stale-writer 403, durable reservations/epoch fence, active/resumable drain, generation-pinned deletion, durable ACK to close #252. No private media or production mutation.
6. Obtain approved positive consent purpose/issuer design, then same-source-SHA owner consent→Studio→Jobs→private output→protected Replay→revocation/deletion→purge/ACK on authorized disposable staging.
7. Restore protected CI and independent review; source-to-deployed revision, rollback, backups, legal/store/billing, Windows/web/iOS/Android/XR, accessibility, localization and AAA visual signoff. Only explicit Founder GO after evidence.

## Execution ledger R980

Performed: GitHub metadata refresh of key PRs, Labs master commit comparison (21 ahead/0 behind), open Jobs issue search, read exact Labs Studio202 report/manifests, read #392/#393/#258/#202 PR descriptions, and documentation-only write of this handoff. Not performed: any new native test, code change, merge, CI dispatch, Firebase/GCP provider API, IAM/Rules mutation, user media access, paid compute, deployment or production GO.

**NO MERGE / NO DEPLOY / NO C1 OR C6 ENABLEMENT / NO PRIVATE OUTPUT / NO IAM OR RULES CHANGE / NO PAID COMPUTE / NO PRODUCTION GO.**

**R980 handoff is source-evidence continuity, not full production certification.**
