# NEXT CHALK — ONE URAI GENESIS R972 FULL-ESTATE CONTINUATION

**Checkpoint:** R971 · November 9, 2026 · **PRODUCTION HOLD / NO-GO**  
**Jobs forensic PR:** https://github.com/LifeLoggerAI/urai-jobs/pull/379  
**Central master:** https://github.com/LifeLoggerAI/urai-labs-llc/pull/262  
**Jobs documentation branch:** docs/genesis-jobs-firebase-forensics-20261109

## Read first
1. docs/estate/JOBS_R971_FULL_ESTATE_MASTER_CROSSWALK_AND_RELEASE_HOLD_20261109.md
2. docs/estate/JOBS_R971_FULL_ESTATE_MACHINE_CHECKPOINT_20261109.json
3. docs/estate/JOBS_R971_FIREBASE_RULES_AUTHORITY_AND_OWNER_FIELD_RECONCILIATION_HOLD_20261109.md
4. docs/estate/JOBS_R971_MACHINE_CHECKPOINT_20261109.json (preserve this separate complementary R971 Rules checkpoint; do not overwrite it)
5. docs/estate/JOBS_R970_19_REPO_FIREBASE_RULES_AND_CI_RECONCILIATION_HOLD_20261109.md
6. docs/estate/JOBS_R970_MACHINE_CHECKPOINT_20261109.json
7. Labs #262 branch docs/estate/00_START_HERE.md, R958 report + manifest, R959, R955 shared Rules authority, R956 Jobs private-media, R957 consent lineage, R929 master reconciliation, R960 cross-model continuity and R961 addendum.
8. Labs #261/#284 and Jobs #252/#345/#376/#380, Jobs #378/#379/#389/#390/#391, Privacy #183/#186/#214/#224/#232/#256/#257, Spatial #1962/#1964/#2073, Studio #198–#201, Admin #113 and B2Bportal/RuAi source.

## Starting truth
R971 refreshed 19 GitHub main refs: 19/19 match the Round24/R958 head manifest. This is ref metadata only. Labs master #262 is open/draft/unmerged; latest observed head at R971 intake is 0dcc6e5ddfad8662f8111f1ffe10bc8e9e9d16db and covers R958-R960 plus R961 addendum. Jobs #379 is an independent open/draft forensic documentation lane. Neither grants production authority.

Re-fetch every relevant main and PR head before source changes or test claims. Current Jobs main is 2bcdbcf34da4a3fe58619286d6917e2d4fa624e1, tree 282bd75464cc23d9a6add6a1340c6ae7d3adfc9a. The older 9d29be1... SHA is stale because current main explicitly reverted the accidental R933 90-line producer/consumer test addition.

## Priority 1 — Jobs #380 owner-field Rules repair (new R971 P1)

Jobs issue #380 is OPEN. Source pins:
- current Jobs main firestore.rules blob: 7dc63626c6e1a2e7b20ded280ea2dd070f16abc9;
- R940 #378 head 5881a650230c55245c87a001c58f3ebc6835196b;
- R940 inherited Rules blob: cfa77a8fa5e69327ab352b31450c59a036d21e38;
- R940 dataRightsExecution.ts blob: 756547684397788d8051acace70ac0e5c03e2e17.

Main self-update predicate leaves server-owned lifecycle fields including dataRightsDeletionRequestId mutable. R940 protects most related fields using affectedKeys but still omits dataRightsDeletionRequestId. Jobs #378's exact changed-file list is seven documentation/test/runner files and does NOT include firestore.rules; the Rules blob is inherited from its base. Do not call #378 a Rules fix.

Issue #380 classification is deliberately narrow: source self-update Rules gap, not a proven deployed exploit. A tampered request binding may create a fail-closed mismatch and stall legitimate deletion. Do not claim unauthorized Jobs execution or active exploit.

Create a separate review-only Rules candidate only after refreshing tree/PR topology. At minimum add dataRightsDeletionRequestId to affectedKeys. Consider positive allowlist of client-editable profile fields. Add genuine authenticated Firestore Rules emulator coverage for set/change/remove on this and all lifecycle/tenant/quota fields; cross-owner, anonymous, admin client, legacy missing fields, allowed profile edits and authorized trusted server/admin update. Preserve legitimate data-rights deletion. No deploy/IAM mutation.

## Priority 2 — Shared Firebase Rules publisher authority

Source configs show Spatial, B2Bportal/RuAi and Admin all choose urai-4dc1d/(default), but each selects a different Rules file. Labs #261 is a source-only collision detector; R955 confirms Admin main source can publish Firestore Rules to urai-4dc1d if its governed workflow runs. This is not proof any deployment occurred or which Rules is live.

Privacy main/#186 lack root .firebaserc. Its firebase.json defines Firestore/Storage Rules and Functions codebase privacy. #186 guarded deploy wrapper only targets functions:privacy, so the changed Privacy firestore.rules is not deployed by that wrapper. The founder-supplied urai-privacy ID is not proof of live project or deploy target.

R972 must get owner-authorized read-only provider evidence: project number, database identity, deployed Rules release/hash, effective deploy IAM principals, runtime sources and rollback. Choose one accountable shared Rules publisher or approved service DB isolation. Do not deploy a whole Rules file or change project aliases/IAM in R972. Preserve Privacy #186/Spatial #1964 C1 mismatch: Spatial has first-time owner-only read for missing consentRecords/{uid}_memory_storage; Privacy main generic read does not.

## Priority 3 — Current Privacy R27 and exact denial acceptance

Privacy #257 current head is **e2193434e22983cd52ae835e6e128748dfde1dc7**, base R20 #256 cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6. It is 12 commits ahead and changes 10 files, including a dedicated r27-scoped-consent-verification workflow.

R27 remains denial-only:
- life-movie.render is not registered in canonical purpose registry;
- evaluator returns UNKNOWN_PURPOSE;
- callable hardcodes allowed=false;
- no consent grant, reusable receipt or render capability is issued;
- scoped assembler is not imported/activated;
- SHA-256 is integrity binding, not signature, proof of owner intent or source rights.

Exact current key blobs and workflow are in R971 full checkpoint/report. Current workflow has six runs, all completed/failure. R27 job id 129141345930 has steps:null; raw log BlobNotFound 404. Exact-head root/functions npm ci, Vitest, typecheck/build and Java21 Auth/Firestore/Functions/Storage emulator still NOT ESTABLISHED.

Run exact e219343... on a clean connected runner without production credentials. Preserve raw TAP, logs, exact tools/dependencies/exit codes. Do not open positive authority as test repair.

## Priority 4 — Studio/Jobs contract + #391 ancestry

Studio candidate chain:
- #198 3ba9f4eda3d81c3813bcaa8f68cf892e204e02f2
- #199 17859bf26915f99ee08eb8673953b0057740279c
- #200 e74a20746f9ca109cd166f06521e47a3d615f89e
- #201 a6187abfd12ffc8f534ddf66246da91ed032e1dc

Master records report bounded native tests: R926 15/15, R927 33/33, R930 34/34, R931 35/35 and Studio #201 R936 full suite 56/56 plus frozen install/typecheck/build. These are candidate-scoped worker reports, not rerun in R971 and not integrated live Jobs acceptance.

Jobs #390 reports 15/15 actual pinned Zod producer-consumer candidate tests; Studio request correctly rejects because canonical consent is absent. This only applies to #390 candidate schema. Current Jobs main lacks source.generation, timeline.sourceStartMs, top-level consent, the test file and candidate consent gate.

Fresh compare #390→#391 gives diverged 1 ahead/2 behind at common ancestor a7a1ef61ac1f219567131abec0b7f5b3c2f81ad9; compare lists one modified test file. The PR metadata says base #390, but the graph differs. Resolve exact commit parent ancestry. Do not assume clean child or cherry-pick blindly. Preserve all source histories and hard-off.

## Priority 5 — Jobs #252 future-write fence and separate consent/revocation paths

#252 remains OPEN/P0. Need durable monotonic write epoch/reservation, exclusive/least-privilege private writer, 403 for every current/old/retired/alternate privileged writer after revoke, active upload/stream drain, exact generation deletion, final absence and durable no-late-write ACK. Storage Rules and point-in-time orphan inventory do not constrain every privileged Admin SDK writer.

Keep four tracks distinct:
A. Privacy R647 prepared/not-deployed dispatcher.
B. Jobs #371 three-case harness; exact consent-jobs-* module provenance unrecovered, do not fabricate.
C. Privacy R818/R836 Jobs→Privacy callable denial/review-only runner.
D. Privacy R27 scoped Life Movie callable, hard-deny.

Do not aggregate their tests or swap APIs.

## Priority 6 — current cross-model and product truth

Labs R960/R961 corrects the capability record:
- merged Communications five-provider sequential failover router exists, but staging says runtimeCertified=false/liveSmokeThisPass=false;
- it is not simultaneous Council debate or parallel critique;
- Orb is separate bounded OpenAI conversation;
- route context propagation exists but is not durable general memory;
- public social/video-comment platform adapter and AI-to-AI public comment loop are designed requirements, not verified integration;
- Jobs is governed execution, Labs #262 is engineering knowledge continuity, neither is autobiographical user memory.

Continue other 19 repository workers independently. Preserve LifeLogger/LifeOS/UrAi/RuAi history, all donor branches, source receipts, legal/rights constraints and product identity.

## Priority 7 — provider, protected CI, and production acceptance

No callable Firebase/GCP provider APIs were available in R971. No provider inventory, effective Rules/IAM, live project IDs, deployed revisions, bucket permissions, billing or backup state was verified. Use owner-controlled authenticated read-only provider inventory. Do not initiate/reuse browser Cloud Shell authorization.

Current GitHub runs on Privacy #186, Spatial #1964, Jobs #390/#391 and Privacy #257 have completed/failure conclusions, but sampled steps null and raw log BlobNotFound. No application test verdict is established. Need protected required checks, independent non-author reviewer, diagnosable exact-head logs and rollback evidence.

Complete same-SHA authenticated owner C6 → private render → protected Replay → revoke → provider suppression → physical purge → downstream ACK; then Windows/web/iOS/Android/XR, accessibility, localization, AAA visuals, legal/store/billing/backups and explicit Founder GO.

## Hard boundaries
**NO MERGE / NO DEPLOY / NO DISPATCH / NO C1 OR C6 ENABLEMENT / NO PRIVATE MEDIA / NO IAM OR RULES MUTATION / NO BILLING ACTION / NO PAID COMPUTE / NO PRODUCTION GO.**

Next Chalk must preserve exact source history and label every assertion by evidence grade. **ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**
