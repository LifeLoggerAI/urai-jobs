# ONE URAI GENESIS — R974 Jobs Rules Repair, Privacy R27 Own-Claims Hardening and CI Execution Reconciliation

**Checkpoint:** R974 · November 9, 2026  
**Disposition:** **PRODUCTION HOLD / NO-GO**  
**Scope:** Fresh PR/source/workflow inspection after R973, with specific correction of stale #380 and Privacy #257 status. Review-only documentation. No tests, builds, emulators, provider inventory, deploy, Rules/IAM mutation, dispatch, real jobs, private media or paid compute.

## 0. Executive finding — correct the previous handoff

R974 finds two important changes that R973/R974-start notes did not contain:

1. **The Jobs #380 Rules fix already exists in review PR #381, with a follow-on candidate #383.** #381 adds `dataRightsDeletionRequestId` to the protected `affectedKeys()` set. Exact Rules blob: `d30c3e8fbbfcbf25767501e351edcb18d6080c6d`. #383 inherits that exact blob. The original 15-case static Node Rules suite was genuinely executed on exact source blobs and passed 15/15 (R943 receipt). Therefore the correct status is: **source repair candidate exists; static source suite passed; native authenticated Rules emulator, full R879, deployed Rules and independent approval remain unverified.** Issue #380 remains open.
2. **Privacy #257 advanced again** from `a3f7119497fe1d9c6dc61e104a1da0a583d247f8` to `fbdc590376376b758be968f174d71709f326c61f`. The new two-commit delta changes `consent-api.ts` and its R27 unit test so the generic cross-user consent endpoint uses a dedicated own-claims helper instead of a locally permissive claim parser. It retains denial-only Life Movie behavior: purpose unregistered, `allowed=false`, no grant/assembler. Six workflows remain failed at workflow level, but raw job data confirms runner ID 0, blank runner name and empty steps for the dedicated R27 run—no test commands are evidenced.
3. For Jobs #381 and #383, raw run/job readback similarly shows runner ID 0 and empty step arrays in sampled jobs. Workflow conclusions are failed, but test execution is not evidenced. Do not describe these as test assertions failing.
4. The previous R973 statement that Jobs #380's source repair remains missing is superseded by #381/#383. Main still has the older Rules blob; the fix is not merged/deployed. Do not deploy it just because static tests passed.
5. R647, Jobs #371, Privacy R818/R836 and Privacy R27 remain separate acceptance lines. None is certified by the Jobs static Rules test.

## 1. Fresh current source/PR identities

### Jobs main
- SHA `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`.
- Tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`.
- Branch metadata: `protected=false`, required status enforcement off.
- This is the add-then-revert history that restores the previous tree. It is unsigned; preserve history, do not rewrite.

### Jobs review PRs
| PR | Head SHA | Base | State | Role |
|---|---|---|---|---|
| #378 | `5881a650230c55245c87a001c58f3ebc6835196b` | R924 fixture branch | Open/draft | R940 source/test donor; no Rules fix introduced in its seven-file diff |
| #381 | `a295fd834c1cc01710a36b04523b023de2283240` | #378/R934 review head | Open/draft | R942 deletion request Rules fix and source-bound static/native tests |
| #382 | `abdc13016fd83fbb4a3d7589645c1310d2344be0` | #378/R934 review head | Open/draft | Original longform idempotency fixture donor |
| #383 | `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c` | #381 head | Open/draft | R945 serial convergence: inherits #381 Rules/test and copies exact #382 idempotency test |
| #389 | `b865209cc352241602d8b9714672f3401aed7669` | R951 branch | Open/draft | Auth test enrollment; not executed |
| #390 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | R952 branch | Open/draft | Studio→Jobs parser candidate |
| #391 | `9f5759f072370fbd42a82560ff6c5d4f37169c6b` | #390 branch | Open/draft | Regex-only producer-contract test correction; ancestry still divergent |

### Privacy and Genesis
- Privacy #257 exact current head: `fbdc590376376b758be968f174d71709f326c61f`, open/draft/unmerged, base R20 #256 `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`.
- The compare from previous #257 head `a3f711...` reports 2 commits ahead / 0 behind with two changed paths.
- Labs master #262 and Labs continuity #304 are separate documentation branches; refresh their heads after R974 writes.
- Jobs forensic #379 is open/draft; refresh after writes.

## 2. Jobs #381 — exact server-owned request ID Rules correction

### 2.1 Source fix exists
PR #381 exact head: `a295fd834c1cc01710a36b04523b023de2283240`, six paths:
1. `docs/security/R942_DELETION_REQUEST_ID_RULES_FIX_REVIEW_HOLD_20261109.md`
2. `docs/security/R943_EXACT_GIT_BLOB_NODE_SOURCE_TEST_RECEIPT_HOLD_20261109.md`
3. `firestore.rules`
4. `scripts/owner_authority_rules.static.test.mjs`
5. `scripts/run-r879-unified-native-acceptance.sh`
6. `scripts/user_authority_rules.firebase-emulator.test.mjs`

Exact original blobs at #381:
- `firestore.rules`: `d30c3e8fbbfcbf25767501e351edcb18d6080c6d`.
- static test: `45c9e80c0aca2b8288d2e6ddf0650873dc4bdb75`.
- native emulator test: `95f4b72b1d7260a191b0cdc77c5cf008b57011e0`.

The Rules change adds `dataRightsDeletionRequestId` to the same user self-update `affectedKeys().hasAny([...])` server-owned field denial list, retaining `affectedKeys()` rather than weakening to `changedKeys()`. It preserves the existing equality guards and ordinary safe owner display-name edits.

The native test is authored to:
- create synthetic Auth users under disposable emulator;
- authenticate as owner through Firebase ID token;
- attempt to mutate and remove the persisted request ID;
- attempt to add the ID to legacy records;
- require denied client REST mutations (403);
- check Admin SDK readback unchanged;
- preserve normal allowed owner profile updates;
- distinguish trusted backend writes from client writes.

The native test body was syntax-checked but not executed.

### 2.2 R943 actual static test receipt
R943 document blob: `3192e4b393ea3c5d79ae755c088d883f37bc4794`.

A clean isolated local directory received the exact full GitHub-returned bytes for the three original files; local `git hash-object` matched the GitHub blob IDs above.

Environment:
- Node v22.16.0
- npm 10.9.2
- OpenJDK 21.0.12.1
- Git 2.47.3
- isolated directory `/mnt/data/r942_verify/`
- no npm install, cloud or production credentials.

Actual command:
```sh
node --check scripts/user_authority_rules.firebase-emulator.test.mjs
node --test scripts/owner_authority_rules.static.test.mjs
```

Actual result:
- Original static suite: **15/15 PASS**, 0 fail/skip/cancel, exit 0.
- Native test source syntax: PASS, but body NOT RUN.
- TAP log `r943_static_node_test.tap`: 3421 bytes; SHA-256 `a68a5b4e7709387bcaa8aa1d856824817efa4b53104bea91d29525664e13da9e`.

This is a real source-pinned static Node test execution. It is not Firestore Rules engine evaluation, Firebase emulator, provider Rules deployment or independent release approval. It applies to the exact #381 static test source.

### 2.3 #381 CI is not evidence of test failure
Nine sampled PR workflows at #381 had completed/failure conclusions. A sampled job record for run `42575938020` returned:
- runner_id `0`;
- blank runner_name;
- empty steps;
- workflow conclusion failure.

This is consistent with failure before a runner/step executed. It does not show the Rules test assertions failed. Do not infer plan/billing/outage cause without evidence.

## 3. Jobs #382/#383 — longform idempotency repair and enrollment

### 3.1 #382 is the original donor
Jobs #382 head: `abdc13016fd83fbb4a3d7589645c1310d2344be0`, open/draft/unmerged. It supplies the exact original test blob used by #383:
- `scripts/life-movies-idempotency-revocation-race-contract.mjs`
- blob `9af97cd9b2bd7e2a8e5e66d805c90791da60a52c`.

The test now includes:
- `plan-missing` → `longform_plan_not_found`;
- `plan-wrong-owner` → `longform_plan_boundary_mismatch`;
- `plan-wrong-org` → `life_movie_owner_org_authority_unavailable`;
- read of bound persisted `plans/{planId}` for longform idempotent replay;
- successful idempotent replay must be read-only (zero writes);
- revoked, malformed, owner pending/malformed/missing and synthetic Firestore error branches remain no-write.

### 3.2 #383 exact convergence
PR #383 exact head `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c`, base #381 exact head `a295fd834c1cc01710a36b04523b023de2283240`, four changed files:
- R945 convergence documentation;
- `package.json`;
- `scripts/life-movies-idempotency-revocation-race-contract.mjs`;
- `scripts/run-r879-unified-native-acceptance.sh`.

It preserves #381's Rules/static/native blobs and includes the exact #382 test Git blob. The source review records 77 unique command strings enrolled in `urai-jobs:verify` (76 prior + one), and the guarded R879 runner requires the test output marker `# pass 17` plus 58 source pins.

**None of the following has run on #383 exact head:** 17-case original test, 77-command root suite, frozen install, typecheck, build, four Firebase emulators, live Rules readback, GCS acceptance or protected CI. The old R940 positive idempotency fixture remains unresolved until the actual 17-case run passes. Do not mark fixed from source/test enrollment.

### 3.3 #383 CI is also non-diagnostic
Ten sampled #383 workflows conclude failure. A sampled job record for run `42577924383` returned runner_id 0, blank runner name and empty steps. No application command is evidenced.

## 4. Privacy #257 — new own-claims hardening at fbdc590

### 4.1 Exact two-commit delta
Previous head `a3f7119497fe1d9c6dc61e104a1da0a583d247f8`; current `fbdc590376376b758be968f174d71709f326c61f`; compare: 2 ahead / 0 behind, two modified paths:
- `functions/src/consent-api.ts`
- `tests/unit/r27-life-movie-verifier-boundary.test.ts`

Current blobs:
- `consent-api.ts`: `db8619c6d7fdf1309d5d89d7cfc8e77e346dbbf1`.
- `cross-user-authority.ts`: `443097baa409c289b4189f98e4c56c7ab70aaa31`.
- R27 boundary test: `4ff5e6ca30a0152d22a05347f405b8c20ad2c8ed`.
- workflow remains `10b45cbdc75356adba76afdd6fd14f562c4e358a`.
- decision registry remains `3cb3232d0334691c820575e8626c34e25d0c987e`.

### 4.2 Security change
The new `cross-user-authority.ts` helper uses `Object.prototype.hasOwnProperty.call` for admin, role, system and consumerId claims. It rejects inherited prototype claims and malformed/non-object tokens.

The generic `evaluateCanonicalConsent` path now calls `crossUserAuthorityOwnClaims(request.auth?.token)` instead of the prior local function that read ordinary properties and could accept inherited values. The R27 test adds a source-bound assertion that the generic cross-user endpoint routes through the own-claims guard and the old local function is absent.

This is a real source-level hardening change, not only R27 presentation logic. Still requires actual compiled Firebase callable/Auth emulator execution and protected deployment.

### 4.3 Life Movie remains denial-only
The new two-commit delta does not change the reserved purpose policy or the R27 denial-only decision:
- `life-movie.render` remains unregistered in canonical purpose registry;
- dedicated verifier continues to hard-return `allowed=false`;
- no grant, scoped receipt capability, assembler activation, rendering or Replay authority is created.

Keep the hard-off. Do not register purpose or enable positive grant without approved privacy/legal policy, trusted issuer, verified rights/subject/source provenance, protected CI, deployment and same-SHA end-to-end acceptance.

### 4.4 Current #257 workflows
At exact head `fbdc590...`, six workflow runs all concluded failure:
- `42613806005`
- `42613806033`
- `42613806157`
- `42613805990`
- `42613806255`
- `42613805941`

The dedicated R27 job for run `42613806005` / check `129149557711` returned runner ID 0, blank runner name, empty step array and no logs URL. This is not evidence Vitest/typecheck/build ran or failed. Exact-head run remains **not established**.

## 5. Current evidence and main release state

### Source candidate vs main
- Jobs main remains unchanged and does not contain #381 Rules fix or #383 longform enrollment.
- Privacy main remains at prior canonical source; #257 remains open/draft/unmerged.
- None of #381/#382/#383/#257 is merged or deployed.
- Jobs issue #380 remains OPEN pending native authenticated Rules tests and owner-approved deployed Rules evidence. Source repair being present in review does not close the issue.

### Other release blockers
- Jobs #252 OPEN P0: real GCS post-revocation future-write denial for stale/alternate privileged identities, in-flight/resumable upload drain, exact-generation deletion and durable physical purge acknowledgement.
- Jobs #376 OPEN P1: post-admission operator-withdrawal/continuation authority policy.
- Jobs #345 OPEN P2: concurrent quota admission and index parity.
- Privacy #83 OPEN: protected deployed consent/revocation runtime, consumer ACK, provider-call suppression and deployment provenance.
- Shared Firebase Rules publisher authority for `urai-4dc1d/(default)` remains unresolved at provider level.
- Protected branch CI, independent eligible approval, deployed identity/revision/IAM, actual rollback remain unverified.
- R647/#371/R818-R836/R27 tests remain separate lines of evidence.
- Studio private consent and output-write authority remain hard-off.
- Full same-SHA positive owner consent → render → private Replay → revoke → provider suppression → physical purge → downstream ACK is not certified.
- Device/accessibility/visual, legal/operational and Founder GO gates remain outstanding.

## 6. R974 execution ledger

Performed:
- Refreshed Jobs #379, #381, #382, #383, #378, #389/#390/#391, Labs #262/#304, Privacy #257 and main branch metadata.
- Inspected exact #381 Rules/static/native source blobs and #383 exact inherited Rules and test blobs.
- Read the exact R943 static Node execution receipt and R945 17-case test enrollment/CI limitations.
- Inspected #381/#383 Actions workflow metadata and raw selected job JSON: runner ID 0, blank name, empty steps.
- Compared Privacy #257 prior and current heads; inspected exact diff and current source for consent API, own-claims helper, registry and test.
- Queried all six current #257 workflow runs and raw dedicated job data.

Not performed:
- no local Node execution in R974;
- no 17-case #383 test run;
- no 77-command root verify;
- no frozen dependency install, build or typecheck;
- no native Firebase Auth/Firestore/Functions/Storage emulators;
- no CI rerun;
- no provider inventory/effective Rules/IAM;
- no deployment, merge, dispatch or Rules/IAM mutation;
- no GCS writer 403, upload drain, deletion or purge ACK;
- no private media or paid compute.

## 7. R975 exact next-Chalk plan

1. Read R974 report, machine checkpoint and R975 start prompt; also read R972 full-system reconciliation, R971 full-estate crosswalk and R970 stack/Rules report.
2. Refresh Jobs main and PR #378/#381/#382/#383/#379/#389/#390/#391, Privacy #257, Labs #262/#304, all issue states and exact workflow runs.
3. Review #381 Rules diff and #383 cumulative ancestry against the full current Jobs owner-field matrix. Do not deploy or merge.
4. On an approved clean, credential-free, network-capable runner, checkout immutable #383 full SHA; verify clean tree and every pinned blob. Execute original static 15-test suite, original 17-case idempotency suite, all 77 root command segments, typecheck/build and guarded R879 four-emulator workflow. Stop on first failure or SHA mismatch. Capture logs, versions, exits and SHA256.
5. Execute the authenticated native Rules test under the R879 disposable Auth/Firestore/Functions/Storage emulator path; prove denied client ID-token add/change/remove and allowed normal profile update, with Admin readback unchanged. Do not infer from static 15/15.
6. Investigate remaining longform fixture and ensure #383's test passes before stating R940 13/14 is repaired.
7. On current Privacy #257 `fbdc590...`, run root and Functions frozen install, R27 Vitest, typecheck, build and approved demo Auth/Firestore/Functions/Storage negative acceptance. Diagnose workflow runner allocation separately; preserve all denial-only guards.
8. Reconcile R27 own-claims hardening with Privacy R16–R20/R27 and #183 historic verifier; exact deployed source still unknown.
9. Keep R647, Jobs #371, R818/R836, R27 separate and preserve current review-stack ancestry.
10. Obtain authorized read-only provider inventory and resolve shared Rules publisher. No Rules deploy until source ownership, project/database identity and rollback are explicit.
11. Prove Jobs #252 actual nonproduction GCS late/alternate 403, upload drain, exact-generation delete, final absence and durable downstream purge ACK.
12. Resolve #376/#345, protected CI/independent review, deployed identity/rollback, same-SHA consent-to-Replay-to-purge, product/device/accessibility/visual/legal and Founder GO.

## 8. Final disposition

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**

Do not merge #381/#383/#257, deploy Rules/Functions, register Life Movie purpose, issue positive C6 or Life Movie grants, enable private output, dispatch revocation, access private media, change IAM/Rules, bypass CI, spend paid compute or declare Production GO.

The correct near-term truth is:
- Jobs #380 source repair is present in review and original static 15/15 actually passed;
- native Rules emulator and 17-case idempotency remain not run;
- Privacy #257 adds own-claims hardening but remains hard-deny;
- workflow failures show pre-runner empty-step evidence, not app test outcomes.

---
*R974 is a source/PR/workflow evidence reconciliation; test receipts are scoped to original exact blobs. Refresh all refs before execution. Production HOLD.*
