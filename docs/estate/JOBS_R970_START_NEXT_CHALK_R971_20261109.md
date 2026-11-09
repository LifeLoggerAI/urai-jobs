# NEXT CHALK — ONE URAI GENESIS R972 CONTINUATION

**R971 is now the latest supplemental audit. Read these first:**
1. [R971 Firebase Rules authority and Jobs owner-field reconciliation](JOBS_R971_FIREBASE_RULES_AUTHORITY_AND_OWNER_FIELD_RECONCILIATION_HOLD_20261109.md)
2. [R971 machine checkpoint](JOBS_R971_MACHINE_CHECKPOINT_20261109.json)
3. [R970 19-repository Firebase Rules and CI audit](JOBS_R970_19_REPO_FIREBASE_RULES_AND_CI_RECONCILIATION_HOLD_20261109.md)
4. [R970 machine checkpoint](JOBS_R970_MACHINE_CHECKPOINT_20261109.json)
5. The R969 full-stack branch/CI governance audit, current-lineage/Life Movie/C1 Rules audit, and full reconciliation.
6. The R968 consolidated lineage ledger and R967 provenance handoff.

## R971 critical correction and new facts

- Spatial, Admin and B2Bportal source configs all target `urai-4dc1d/(default)` with different Firestore Rules files. This is a **potential source-level publisher collision**, not proof of live overwrite or breach. Labs #261 is a source-only detector; its eight tests were not executed in this pass.
- Privacy root `.firebaserc` was not found at checked main; Privacy #186 guarded deploy wrapper is explicitly `functions:privacy` only. It does not publish the changed Privacy Rules. Project mapping and live deployed Rules remain unknown.
- Jobs #380 remains open. Main Rules and the exact R940 inherited Rules file both omit protection of `dataRightsDeletionRequestId`.
- Critical distinction: Jobs #378's seven-file PR diff contains test scripts and documentation, **not** `firestore.rules`. The Rules file at #378 head is identical to its base blob and inherited from its base; #378 itself is not a Rules repair.
- Jobs #252/#376/#380/#345 and Privacy #83 remain open.
- Sampled Privacy #186, Spatial #1964 and Jobs #390/#391 workflow runs conclude failure, but steps/logs are null or BlobNotFound; do not call the app tests failed or passed.
- Main Jobs remains `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, branch protection disabled per branch metadata. Provider/effective Rules/IAM remain unknown.

## R972 execution priorities

1. Obtain owner-authorized read-only provider inventory for `urai-4dc1d`, database identities, deployed Rules release, deployment principals and project ownership.
2. Decide one accountable Rules publisher for the shared default DB or establish approved separate database/project boundaries.
3. Confirm Privacy project/region and preserve #186's Functions-only deployment boundary until a separate Rules process is approved.
4. Create a distinct review-only Jobs #380 Rules fix including `dataRightsDeletionRequestId`; test every protected field's add/change/remove through authenticated Firebase Rules emulators.
5. Run Labs #261 source detector/tests on its exact head; retain source-only evidence classification.
6. Obtain executable protected-CI logs or controlled runner evidence; no blind reruns.
7. Preserve R647, Jobs #371 and R818/R836 as separate acceptance tracks.
8. Complete P0 GCS post-revocation 403, upload drain, exact-generation delete and downstream purge ACK; then private Replay and full release gates.

**No merge, deploy, Rules/IAM mutation, CI bypass, C6 enablement, private media, paid compute or production GO.**

---

# NEXT CHALK — ONE URAI GENESIS R971 CONTINUATION

**Checkpoint:** R970 · November 9, 2026 · **Release: PRODUCTION HOLD / NO-GO**  
**Jobs forensic PR:** https://github.com/LifeLoggerAI/urai-jobs/pull/379  
**Documentation branch:** docs/genesis-jobs-firebase-forensics-20261109

## Read first
1. docs/estate/JOBS_R970_19_REPO_FIREBASE_RULES_AND_CI_RECONCILIATION_HOLD_20261109.md
2. docs/estate/JOBS_R970_MACHINE_CHECKPOINT_20261109.json
3. docs/estate/JOBS_R969_CURRENT_LINEAGE_SECURITY_AND_C1_RULES_RECONCILIATION_HOLD_20261109.md
4. docs/estate/JOBS_R969_MACHINE_CHECKPOINT_20261109.json
5. docs/estate/JOBS_R969_START_NEXT_CHALK_R970_20261109.md
6. Labs R841 federated Rules authority report/snapshot in PR #261.
7. Labs R909 23-project source inventory, R913 project matrix, R919 historical provider evidence and R915/R920 owner-authorized Cloud Shell/provider handoffs.
8. Jobs R968 cross-lineage ledger/checkpoint and R967 harness source-provenance report.
9. Privacy #183/#186/#214/#224/#232/#253-#256; Spatial #1962/#1964; Admin main and existing Admin repair chain; B2Bportal main; Jobs #252/#371/#390/#391; Studio #198-#201.

## Starting source truth

All 19 LifeLoggerAI repository main refs were freshly fetched in R970 and match Round 24 exactly. Current Jobs main is 2bcdbcf34da4a3fe58619286d6917e2d4fa624e1, tree 282bd75464cc23d9a6add6a1340c6ae7d3adfc9a. Do not use old Jobs main 9d29be1 as current.

Refresh every main ref and candidate head before action; do not assume this checkpoint remains current.

## Priority 1 — Shared Firestore Rules publisher collision

R970 source readback:
- Spatial .firebaserc and firebase.json select urai-4dc1d; Rules file firebase/firestore.rules.
- Admin .firebaserc and firebase.json select urai-4dc1d; Rules file firestore.rules.
- B2Bportal .firebaserc and firebase.json select urai-4dc1d; Rules file firestore.rules.
- Each defines a different Rules source for database (default).

This corroborates existing Labs R841 #261 source-only finding. This is credible potential overwrite/service-breakage risk, NOT live deployed-policy proof or evidence of breach.

R971 must:
1. Refresh Labs #261, #284 and exact current Spatial/Admin/B2B main heads.
2. Retrieve the complete R841 source snapshot and exact source files for all current Rules candidates.
3. Create an owner/service responsibility matrix: collections, reads/writes, owner/tenant/admin roles, server-owned fields, deletion/consent fences, and deploy source.
4. Establish whether the projects/databases are really shared via authorized read-only Firebase/GCP provider inventory. Source aliases alone do not prove live target or deployed database.
5. Identify actual Rules publishing principals, Functions codebase collisions, deployment workflows, IAM and current deployed Ruleset IDs/source hashes.
6. Only after owner authorization, draft a policy-authority decision: one accountable shared Rules owner, or deliberately separated databases/projects. Do not deploy or merge anything in R971.

## Priority 2 — Privacy project and deploy authority

Privacy main and #186 have no root .firebaserc. Privacy firebase.json defines:
- Firestore Rules path firestore.rules
- Storage Rules path storage.rules
- Functions source functions, codebase privacy, Node22.

The 23-ID registry includes founder-supplied urai-privacy but this is not proof of current project existence or the intended deploy target.

Privacy #186 adds guarded-firebase-deploy.mjs; it requires explicit project/commit/clean checkout, rejects injected flags, and deploys only functions:privacy. It intentionally excludes Firestore/Storage Rules. Its changed firestore.rules is therefore NOT deployed by that wrapper.

R971 must obtain an explicit owner-approved Privacy project mapping from a current authenticated read-only provider inventory, then define a separate reviewed Rules publication authority. Keep the existing Functions-only guard unchanged unless its owner approves a separate change. Never guess a target from the seed ID.

## Priority 3 — C1 shared consent / profile contract

Preserve source pins from R970:
- Privacy main Rules blob 7c0051eb6d148791198127e625c99973abdc49c1.
- Privacy #186 Rules blob 295e5d27623cceddec8245759ff28128b17be28c.
- Spatial main Rules blob 26330636a18a3675da049aa4bdadb34c82293882.
- Spatial #1964 Rules blob 8b015a8bbe123bb7857bff5d98ba5a153067c41c.

Spatial #1964 adds owner-only first-time get for consentRecords/{uid}_memory_storage: missing record can be read as missing; existing record must match UID, memory.storage, C1, policy 1.0.0. Privacy main generic read requires existing resource UID/admin; Privacy #186 does not add the same missing-record read path.

Build a collection/action/field matrix covering:
- first-time C1 get / existing C1 read / cross-user read / list / all client writes;
- uid, userId, ownerId old and new identity;
- ten protected profile fields: role, admin, isAdmin, legalHold, markedForDeletion, deletionMarkedAt, entitlementTier, founderOverride, deleted, accountStatus;
- missing, malformed, active and explicitly inactive tombstones;
- five deletion planning lease fields and admin/founder exceptions;
- service-owned/private collections and default-deny rules.

Spatial #1964 is 1,489 commits ahead of Spatial main. It is 13 commits ahead of #1962 and changes six files (Rules, C1 expiry client, tests, workflow). Do not merge it wholesale or retarget it to main. Consider extracting only bounded reviewed patches to a clean branch with explicit parent and tests, but do not create a source patch until topology/authority is agreed.

## Priority 4 — Native tests and CI evidence

R970 sampled exact workflow runs:
- Privacy #186: eight workflow failures; selected job steps null; raw logs BlobNotFound 404.
- Spatial #1964: twelve workflow failures; selected emulator job steps null; raw logs BlobNotFound 404.
- Jobs #390/#391: nine workflow failures each; #391 Callable emulator E2E skipped; sampled runtime steps null/log BlobNotFound.

These are workflow-level failure conclusions, not a proven source/test assertion failure. Do not call these test passes or test failures without step logs.

Once a clean Git-connected runner is available:
1. Verify exact commits, trees, file blob hashes, lockfiles and tool versions.
2. Run Privacy #186's exact original rule emulator tests; run Spatial #1964's exact tests independently on the exact head.
3. Run cross-service C1 test matrix using one immutable source manifest in disposable emulator only.
4. Run #390/#391 Studio producer envelope through the real pinned Jobs Zod safeParse and full package build/typecheck.
5. Capture exact commands, environment, source hashes, versions, raw TAP/logs and exits.
6. Restore protected CI, required checks and an eligible independent non-author reviewer. No bypass.

## Priority 5 — Preserve Jobs/Privacy Life Movie paths separately

- R647: prepared, not-deployed outbox dispatcher; API dispatchPendingJobsRevocations.
- Jobs #371: expects three historical Privacy consent-jobs modules not recovered in inspected source refs/path history; do not invent provenance.
- R818/R836: Jobs identity/transport to actual Privacy callable denial/review-only path; not a revocation dispatcher.
- Privacy #183: movie-scoped verifier and receipt integrity source; positive trusted C6 issuer/deployed runtime absent.
- Privacy R20/v3 event ACK remains unresolved: prior grant lineage, immutable digest, source transition timestamp, receiver/action binding, service identity, crash-safe retry.
- Jobs #252 remains P0 for future write denial, stale/alternate writer 403, upload drain, exact generation deletion and durable purge ACK.

## Priority 6 — Owner-controlled read-only provider evidence

No callable Firebase/GCP/IAM/Storage provider APIs were present in R970. Do not use stale browser authorization or initiate Cloud Shell on the user's behalf. Follow the existing R915/R919 owner-controlled procedure:
- user reviews and starts authenticated Cloud Shell;
- read-only list the project inventory under the correct owner principal;
- confirm project number, database identities, Rulesets/releases and IAM;
- inspect runtime identities/revisions/ingress and object storage policy metadata;
- record only redacted source/resource IDs, timestamps and immutable hashes;
- no secrets, user records or media.

Prior R919 staging evidence is dated historical documentation, not current provider state. Do not infer its old Editor IAM finding applies to current project identity today.

## Other independent release gates
Jobs #252 P0 GCS fence; operator withdrawal policy #377; worker auth #388/#389; truthful rollback #386; Studio private consent/output hard-offs; protected CI and effective branch governance; deployed source/IAM; C6→private Replay→revocation/physical purge; Windows/web/iOS/Android/XR accessibility and visual acceptance; legal/store/billing/backups; historical user-data continuity; independent certification and explicit Founder GO.

## Evidence discipline
Every finding must be labelled as source config, branch/commit, source blob, static check, source-excerpt test, full local native test, Firebase emulator, provider readback, protected staging or production certification. Keep exact source, tool version, command, raw output, environment and exit. No inherited green status, no cross-track test aggregation, no command-enrollment claims as execution.

## Hard boundaries
**NO MERGE / NO DEPLOY / NO DISPATCH / NO C1 OR C6 ENABLEMENT / NO PRIVATE MEDIA / NO IAM OR RULES MUTATION / NO BILLING ACTION / NO PAID COMPUTE / NO PRODUCTION GO.**

Preserve all original LifeLogger → LifeOS → UrAi → RuAi implementations, histories and review stacks. Integrate only after proof. **ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**


---

## R972 additive reconciliation — read this before acting

Master cross-lineage report:
JOBS_R972_FULL_SYSTEM_RECONCILIATION_RULES_CONSENT_JOBS_PRIVACY_HOLD_20261109.md

Updated machine checkpoint:
JOBS_R972_MACHINE_CHECKPOINT_20261109.json (includes supplemental_cross_lineage_reconciliation).

New R972 findings to preserve:

1. Jobs #381/#383 contain the review-only dataRightsDeletionRequestId Rules repair. Exact Rules blob d30c3e8fbbfcbf25767501e351edcb18d6080c6d; static suite passed 15/15 on exact blobs (R943 TAP SHA256 a68a5b4e7709387bcaa8aa1d856824817efa4b53104bea91d29525664e13da9e). This is NOT native Firebase Rules emulator acceptance. Issue #380 remains open.
2. Jobs #391 corrects overescaped regexes in the Studio producer Zod test. Test blob 74e94da0a118a043ab76af611474f3f73d329cea. It is one commit ahead and two behind its declared #390 base (merge base a7a1ef61ac1f219567131abec0b9d4f2); test not executed and not enrolled in root urai-jobs:verify or R879. Reconcile onto exact current #390 head and enroll exact blob before claiming release acceptance.
3. Privacy #257 R27 adds a Jobs-only Life Movie verifier on R20. It requires dedicated own-claims Jobs identity and revoked-token recheck, reads consent/tombstone, writes audit denial only, hard-forces allowed=false, returns no receipt, writes no grant, and leaves life-movie.render unregistered. It is NOT C6 enablement. Focused workflow run ID 42613095876, job 129146191449; steps empty and no test/build pass certified.
4. Admin main workflow and deploy script source contain: firebase deploy --only hosting,functions,firestore,storage -P urai-4dc1d. This corroborates a source-level ability to publish Admin Rules into the source-configured shared project, not proof it ran or changed deployed rules. Existing Admin #100–#113 repair chain is unmerged; #113 intentionally fails closed because its codebase guard requires urai-admin-functions while its firebase.json still says default.
5. Current Jobs #381/#383 and Privacy #257 workflow conclusions fail, but sample job steps are empty. No application assertion cause may be claimed.
6. The original R647, Jobs #371 revocation harness and Privacy R818/R836 callable runner remain separate tests/architectures. Do not combine receipts.

R972 full report classifies source-vs-provider evidence, test-vs-enrollment and all independent release gates. R973 must begin with owner-authorized read-only provider inventory of urai-4dc1d/(default), one Rules publishing authority decision, native Rules acceptance for #381/#383, #391 test reconciliation/enrollment/execution, Privacy #257 diagnostic artifacts/denial tests, and P0 GCS post-revocation 403/upload drain/generation-purge ACK. No Rules/IAM mutation in discovery.

All unchanged safety boundaries remain: no merge, deploy, dispatch, C1/C6 enablement, private media, Rules/IAM mutation, billing action, paid compute or Production GO.
