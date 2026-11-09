# NEXT CHALK — ONE URAI GENESIS R973 FULL-ESTATE EXECUTION DIRECTIVE

**Checkpoint:** R972 · November 9, 2026 · PRODUCTION HOLD / NO-GO  
**Central master:** Labs #262, branch docs/genesis-estate-registry-20261106  
**Jobs forensic:** Jobs #379, branch docs/genesis-jobs-firebase-forensics-20261109

## Read first

1. JOBS_R972_CURRENT_HEAD_PRIVACY_FIREBASE_REVOCATION_AND_ESTATE_RECONCILIATION_HOLD_20261109.md
2. JOBS_R972_FULL_CROSSWALK_MACHINE_CHECKPOINT_20261109.json
3. JOBS_R972_SOURCE_AUTHORITY_VERIFICATION_NEXT_CHALK_HOLD_20261109.md and JOBS_R972_MACHINE_CHECKPOINT_20261109.json (preserve this separate R972 source-authority worker record)
4. JOBS_R971 full crosswalk, Rules authority report/checkpoints, R970 report/checkpoints.
5. Labs #262 current 00_START_HERE, R939/R940 Privacy reports/manifests, R960 cumulative report/checkpoint, R955/R956/R957 and R961/R962.
6. Labs #284 Firebase R971 report/manifest.
7. Jobs R959–R964 dispatcher recovery, v3 event/ACK proposal and receiver review.
8. Jobs issues #252/#345/#376/#380; Jobs #371/#378/#379/#389/#390/#391; Privacy #214/#224/#232/#256/#257; Studio #198–#201; Spatial #1962/#1964/#2073; Admin/B2Bportal.

## First action: refresh

R972 fetched all 19 GitHub main refs; all matched R958/Round24. This is branch metadata only. Re-fetch before every source change.

Current Labs #262 head: aab1d7422d80c38605780ddf89ceebe891b66947, open/draft/unmerged. #331 and #332 are parallel 16-file consolidation drafts on older base 0e408330...; compare actual parents and patches to latest #262 before integrating. No automatic merge.

Current Jobs main: 2bcdbcf34da4a3fe58619286d6917e2d4fa624e1, tree 282bd75464cc23d9a6add6a1340c6ae7d3adfc9a. The old 9d29be1... is stale after add/revert history. Jobs #379 remains open/draft forensic docs with a stale base metadata SHA; do not confuse with main.

## 1. Privacy R27: restore visible exact-head acceptance

Current Privacy #257 head: a3f7119497fe1d9c6dc61e104a1da0a583d247f8. Workflow blob 10b45cbdc75356adba76afdd6fd14f562c4e358a pins Node 22.23.0, correcting earlier Node20/Functions22 mismatch.

R939 source receipt at 6fecb46e380a6400f2ec095ef615d9ef73319032:
- root/Functions installs, lint, root typecheck, 199/199 unit tests (R27 9/9), Functions typecheck/build, static Rules and root preflight PASS.
- Firebase emulator command exit 0 with 13 Rules and 3 integration assertions, but invalid canonical-consent fixture writes caused Functions trigger exceptions and ECONNRESET/socket-hang-up noise. Clean trigger lifecycle not established.
- raw logs were not archived (only hashes); final preflight worktree had one uncaptured entry.

Latest workflow run 42613095876/job 129146191449 is failure with steps:null and logs_url:null. Do not call it a code failure or test pass.

R973 must run exact current R27 head on clean, observable runner; require uploaded raw logs/artifact URL, six exit-code files and clean worktree. Run root/Functions installs, focused unit suite, typecheck/build, full root preflight, Java21 Auth/Firestore/Functions/Storage emulators. Investigate each invalid trigger fixture and connection reset; clean exact-head emulator rerun required. Test callable with synthetic verified Jobs token, invalid/inherited claims and revoked token, malformed/missing/active deletion state and valid-shaped fake receipt. Everything remains denial-only; no grant or render.

## 2. Labs master integration

Refresh #262 and #331/#332/#327–#330/#304. #331/#332 share the same 16 paths but separate commit histories. Determine smallest lossless documentation integration on the current #262 head; no broad overwrite. Link R972 report/checkpoint and keep R939/R940 visible. Preserve concurrent worker lanes.

## 3. Firebase Rules authority

Source selects urai-4dc1d/(default) from Spatial, Admin and B2Bportal using three different Rules files. Admin/B2B overlap at adminUsers and partnerAccounts with differing predicates.

Reviewed governed deploy paths:
- Admin WIF workflow/script can deploy hosting/functions/firestore/storage to urai-4dc1d.
- Spatial reviewed WIF path deploys functions/hosting only; not Firestore Rules.
- B2Bportal reviewed CI/evidence workflows do not publish production Rules; manual/delegated publishers remain unknown.

Privacy has no root .firebaserc in inspected refs; #186 guard targets functions:privacy only and does not deploy Rules. Supplied urai-privacy ID is not live provider proof.

Obtain owner-authorized read-only provider evidence: project number, default DB identity, deployed Ruleset ID/bytes/history, effective IAM and all human/WIF/manual publisher identities. Then decide single shared Rules publisher or approved project/database separation. No Rules, alias or IAM mutation.

## 4. Jobs #380 profile field protection

Issue #380 OPEN/P1. Main Rules blob 7dc63626c6e1a2e7b20ded280ea2dd070f16abc9; R940 inherited candidate blob cfa77a8fa5e69327ab352b31450c59a036d21e38. Both omit dataRightsDeletionRequestId from the protected self-update fields. Jobs #378's seven-file diff has no firestore.rules.

This is a source gap, not a demonstrated deployed exploit. Could cause fail-closed interference with legitimate deletion. Create separate reviewed Rules candidate protecting all server-owned fields; test owner set/change/remove, tenant/lifecycle/deletion/quota fields, cross-owner/anonymous/admin-client denial, legacy docs, permitted profile edit, trusted server/admin updates and successful deletion via authenticated Firebase Rules emulator.

## 5. Jobs #252 private Storage future-write fence

Issue #252 OPEN/P0. Require durable revocation epoch/admission reservation, exclusive least-privilege writer, stale/retired/alternate writer data-plane 403, active/resumable upload drain, generation-bound deletion, final physical absence and durable no-late-write ACK. Point-in-time inventory, Rules, in-process hard-off or Jobs consent ACK do not prove this. Do not open private output or Replay until adversarial nonproduction proof is complete.

## 6. Revocation and ACK paths

Keep distinct:
A. Jobs #371 harness expects older consent-jobs-* modules; exact provenance not recovered.
B. Privacy R647 #214 prepared/not-deployed dispatcher dispatchPendingJobsRevocations; 10+16 Node test declarations NOT RUN in earlier network-blocked pass; incompatible with R20.
C. Privacy R818/R836 #224/#232 denial/review-only Jobs-to-Privacy runner.
D. Privacy R27 #257 scoped verifier forced-deny.

R963 v3 is proposal only. R964 requires full immutable event digest verification, detailHash recomputation from Jobs receipt/action or approved attestation, prior-grant identity decision, source transition time provenance, stable service actor identity, crash-safe identical ACK retry and legacy disposition. Privacy/legal/security review before implementation. Jobs ACK means its local consent block only, never physical purge.

## 7. Studio→Jobs

Studio #198→#199→#200→#201 remain review-only. Reported bounded receipts: 15/15, 33/33, 34/34, 35/35, and Studio #201 R936 56/56 plus frozen install/typecheck/build. Not end-to-end acceptance.

Jobs #390 reported 15/15 candidate Zod producer/consumer tests; actual Studio request correctly rejected because canonical consent is missing. Current Jobs main lacks generation, timeline offset, top-level consent and candidate gate. #391 compare from #390 diverged 1 ahead/2 behind at merge base a7a1ef61ac1f219567131abec0b7f5b3c2f81ad9 despite declared base. Resolve exact parents, run parser against candidate and current main separately. No dummy receipt or fabricated grant.

## 8. Cross-model and broader release

Communications source contains five-provider sequential failover, feature-flag default-off, not parallel debate; no product caller was located in reviewed source and runtime is not certified. Orb is separate bounded OpenAI conversation; internal route context is not durable memory; public social comment adapter is unverified. Update provider readiness against current Communications main.

Continue 19 repo workers independently; preserve LifeLogger/LifeOS/UrAi/RuAi history. Device/XR/accessibility/localization/AAA visuals, legal/store/provider billing, backups, rollback and independent review remain.

## Hard boundaries

Classify every result by exact source/head and evidence grade. Workflow failure with no steps/logs is not a source test verdict. Do not move a green result across heads or lineages.

**NO MERGE / NO DEPLOY / NO DISPATCH / NO C1 OR C6 ENABLEMENT / NO PRIVATE MEDIA / NO IAM OR RULES MUTATION / NO BILLING ACTION / NO PAID COMPUTE / NO PRODUCTION GO.**

R973 starts with exact-head refresh, observable Privacy R27 rerun and Labs #331/#332 comparison against current #262. **ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**
