# ONE URAI GENESIS — R975 Full Acceptance Evidence and Release-Hold Report

**Checkpoint:** R975 · November 9, 2026  
**Disposition:** **PRODUCTION HOLD / NO-GO**  
**Scope:** Current review heads, Jobs #383 acceptance enrollment, Privacy #257 own-claims hardening, earlier R939 exact-source evidence, CI runner metadata and Firebase Rules publisher precision. Read-only source/metadata audit plus documentation; no application tests, builds, emulator, deploy, provider operation, IAM/Rules change, dispatch, private media or paid compute.

## 0. Executive findings and corrections

1. Jobs #381 contains the source repair for #380. Rules blob `d30c3e8fbbfcbf25767501e351edcb18d6080c6d` protects `dataRightsDeletionRequestId` in the owner self-update `affectedKeys()` denylist. This source repair exists in open review; it is not merged or deployed.
2. R943 actually ran the original exact-source static Node Rules suite: **15/15 PASS**, on Git-blob-matched source. TAP SHA-256 `a68a5b4e7709387bcaa8aa1d856824817efa4b53104bea91d29525664e13da9e`. The corresponding native authenticated Firestore emulator test was syntax-checked but its test body did not run.
3. Jobs #383 inherits #381 Rules/static/native test blobs, and carries the exact original #382 longform idempotency test. Its `package.json` enrolls 77 root command segments; R879 requires the 17-case test to print `# pass 17`. But #383's 17-case test, 77-command root suite, build, typecheck and guarded four-emulator acceptance have **not** executed on that exact head.
4. Privacy #257 advanced to `fbdc590376376b758be968f174d71709f326c61f`. The two-commit delta changes `consent-api.ts` and the R27 unit test. A new `cross-user-authority.ts` helper uses own-property checks and the generic cross-user consent endpoint now routes through it. This is a source-level hardening; runtime acceptance is not proven.
5. Life Movie remains deliberately hard-denied on #257: `life-movie.render` remains unregistered, verifier returns `allowed=false`, no consent grant/capability or assembler activation.
6. Historical Privacy R939 evidence must not be lost: exact earlier commit `6fecb46e380a6400f2ec095ef615d9ef73319032` reported **199/199 unit tests PASS** (including R27 9/9), installs/lint/typechecks/Functions build/static Rules/root preflight PASS. Its emulator command exited 0 with 13 Rules assertions and 3 integration assertions. However Functions logs had invalid-canonical-record `publishConsentRevocation` trigger exceptions/unhandled termination and ECONNRESET/socket hang-up noise; raw logs were not archived and one final worktree entry was uncaptured. It is historical exact-source evidence, not clean acceptance of current #257 own-claims delta or deployed runtime.
7. Sampled current Jobs #383 and Privacy #257 Actions jobs report runner ID 0, blank runner name, and `steps=null`/empty. Sampled runs have no artifacts. Workflow conclusions are failure, but no source test execution is evidenced. Root cause remains unknown.
8. Shared Firebase Rules source config maps Spatial, Admin and B2Bportal to `urai-4dc1d/(default)` using different Rules files. R972's fuller deployment audit says Admin has a reviewed manual guarded path that can deploy Firestore Rules; reviewed Spatial WIF path deploys Functions/Hosting only and reviewed B2B workflows do not publish Rules. Other manual/delegated publishers remain unknown. This is a source-level ownership/collision risk, not proof of multiple active governed publishers or live overwrite.
9. Jobs main remains `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`; branch metadata says protection disabled and required checks off. Preserve add/revert history.
10. Jobs #252/#345/#376/#380 and Privacy #83 remain open. Production remains HOLD.

## 1. Exact heads and source identities

| Record | Exact head | State |
|---|---|---|
| Jobs main | `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1` | Current, unprotected per API |
| Jobs #381 Rules | `a295fd834c1cc01710a36b04523b023de2283240` | Open/draft |
| Jobs #382 donor | `abdc13016fd83fbb4a3d7589645c1310d2344be0` | Open/draft |
| Jobs #383 combined | `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c` | Open/draft |
| Jobs #379 docs | `58b0c9586de781a5ac26f3630ce4c0177948300a` before R975 docs writes | Open/draft |
| Jobs #389 | `b865209cc352241602d8b9714672f3401aed7669` | Open/draft |
| Jobs #390 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | Open/draft |
| Jobs #391 | `9f5759f072370fbd42a82560ff6c5d4f37169c6b` | Open/draft |
| Privacy #257 | `fbdc590376376b758be968f174d71709f326c61f` | Open/draft |
| Labs #262 | `5b69d07b71a961c4d45e29a6cfbe9985cb453bd8` | Open/draft |
| Labs #304 | `45bae5769fdcf7748a624d74b142dce71d5cc3fe` before R975 docs writes | Open/draft |

### Jobs #381/#383 exact files

#381:
- Rules: `d30c3e8fbbfcbf25767501e351edcb18d6080c6d`.
- static test: `45c9e80c0aca2b8288d2e6ddf0650873dc4bdb75`.
- native emulator test: `95f4b72b1d7260a191b0cdc77c5cf008b57011e0`.

#382 donor / #383 exact test:
- `scripts/life-movies-idempotency-revocation-race-contract.mjs`: `9af97cd9b2bd7e2a8e5e66d805c90791da60a52c`.

#383 package:
- `package.json`: `4804276332491e1e57a95a2a0cec7050df3a595c`.
- 77 command segments in `urai-jobs:verify`.
- R879 has exact blob guard and a `# pass 17` required marker.

### R943 real static receipt
- Environment Node v22.16.0, npm 10.9.2, Java 21.0.12.1, Git 2.47.3.
- GitHub-returned full file bytes were copied into an isolated directory and local `git hash-object` matched the source blobs.
- Actual `node --test scripts/owner_authority_rules.static.test.mjs`: **15/15 PASS**, exit 0.
- TAP SHA-256: `a68a5b4e7709387bcaa8aa1d856824817efa4b53104bea91d29525664e13da9e`.
- Native test syntax check passed, but native body was NOT run.
- This receipt does not mean #383 root, native, emulator or deployed Rules acceptance passed.

### #383 unexecuted
Not run at #383 exact SHA:
- original 17-case longform test;
- all 77 root verification command segments;
- frozen dependency installation;
- full build/typecheck;
- guarded R879 four-emulator runner;
- authenticated owner Firestore Rules test.
Issue #380 remains open pending native/deployed Rules evidence and independent review.

## 2. Privacy #257 own-claims hardening

Current PR #257 head `fbdc590376376b758be968f174d71709f326c61f`; base R20 #256 `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`.

Two-commit delta from `a3f711...`, two paths:
- `functions/src/consent-api.ts`: `db8619c6d7fdf1309d5d89d7cfc8e77e346dbbf1`.
- `tests/unit/r27-life-movie-verifier-boundary.test.ts`: `4ff5e6ca30a0152d22a05347f405b8c20ad2c8ed`.
- helper `functions/src/cross-user-authority.ts`: `443097baa409c289b4189f98e4c56c7ab70aaa31`.
- R27 workflow blob `10b45cbdc75356adba76afdd6fd14f562c4e358a`.

The helper uses `Object.prototype.hasOwnProperty.call` for administrator/system/role/consumer claims, rejecting inherited or malformed values. Generic `evaluateCanonicalConsent` now calls the own-claims helper instead of the old local parser. The R27 test asserts that route.

Life Movie stays hard-denied:
- purpose `life-movie.render` not registered in canonical registry;
- scoped verifier always returns `allowed=false`;
- no grant, reusable receipt capability, assembler activation, private render or Replay authorization.

### Current #257 workflow evidence
Six workflows at exact head conclude failure:
`42613806005`, `42613806033`, `42613806157`, `42613805990`, `42613806255`, `42613805941`.

Dedicated run `42613806005`, job `129149557711`:
- completed/failure;
- runner ID 0;
- blank runner name;
- steps null/empty;
- artifacts list empty.

This does not show Vitest/typecheck/build ran and failed. Exact-head app test result remains UNKNOWN / NOT ESTABLISHED.

## 3. Historical R939 Privacy evidence and caveats

Exact tested source commit `6fecb46e380a6400f2ec095ef615d9ef73319032`; tree `c6bd5d94f2e71e7d267bdd2c6a49e4c98ccdccff`.

Environment Ubuntu 24.04, Node 22.23.0, npm 10.9.8, Java 21.0.12.1.

Reported PASS:
- root and Functions installs;
- lint;
- root typecheck;
- 199/199 unit tests across 20 files, including R27 9/9;
- Functions typecheck/build;
- static Rules;
- Java prerequisite;
- root preflight exit 0.

Emulator command exit 0:
- Firestore/Storage Rules 13 assertions;
- Privacy integration 3 assertions.

Caveats:
- Functions emulator logs showed `publishConsentRevocation` exceptions for intentionally invalid canonical consent fixtures and unhandled trigger termination.
- Synthetic mutations caused ECONNRESET/socket hang-up noise.
- Need isolate each intentionally invalid fixture and map to trigger/log effects.
- Raw logs were not archived (only hashes reported).
- Root preflight ended with one uncaptured worktree entry.
- Tested source predates current #257 own-claims two-commit delta.
- No deployment, provider IAM, actual consumer ACK, positive C6, private rendering or Replay proof.

Classify as historical exact-source tests/build/preflight PASS plus emulator command exit 0 with unresolved trigger/socket caveats, not clean current #257 acceptance.

## 4. CI runner evidence

Jobs #383 sampled run `42577924383`, job `129029735536`:
- failure conclusion;
- runner ID 0;
- empty/unknown steps;
- no workflow artifacts.

Privacy #257 sampled run `42613806005`, job `129149557711`:
- failure conclusion;
- runner ID 0;
- empty/unknown steps;
- no workflow artifacts.

Root cause is UNKNOWN. Do not call app tests red or green without command logs and exit codes. Do not rerun blindly.

## 5. Firebase shared Rules authority — refine prior language

Spatial, Admin and B2Bportal source configs target `urai-4dc1d/(default)` with different Rules files. R972 reviewed the actual deploy workflows:
- Admin has a guarded manual workflow that can publish Firestore Rules to this project.
- Reviewed Spatial WIF path is Functions/Hosting only.
- Reviewed B2Bportal workflows do not publish Firestore Rules.
- Other manual/delegated principals remain unknown.
- Privacy root .firebaserc was not found; Privacy #186 guarded deployment is `functions:privacy` only, not Rules publishing.

This is a confirmed shared-target source configuration and Rules ownership conflict with an Admin Rules-capable deployment path; it is NOT evidence that all three reviewed workflows publish Rules or that a live overwrite occurred. Effective provider Rules release, database identity, deploy principal history and IAM remain UNKNOWN.

## 6. Open issues and release gates

- Jobs #252 OPEN P0 — real GCS future-write fence, stale/alternate privileged writer 403, active/resumable upload drainage, exact-generation physical deletion and durable downstream purge ACK.
- Jobs #376 OPEN P1 — post-admission operator withdrawal/continuation authority.
- Jobs #380 OPEN P1 — #381/#383 source repair present; native authenticated Rules and deployed Rules evidence remain.
- Jobs #345 OPEN P2 — concurrent quota admission and index parity.
- Privacy #83 OPEN — protected deployed consent/revocation, downstream consumer ACK and provider-call suppression.
- Studio consent authority/private output write hard-offs remain.
- Branch protection, protected CI, independent approval, deployed source/image/identity/ingress/secrets/IAM, rollback, owner-only Replay, device/accessibility/visual/legal/operational and Founder GO remain unverified.

## 7. R975 actions taken / not taken

Performed:
- refreshed Jobs #379/#381/#382/#383/#389/#390/#391, Labs #262/#304, Privacy #257 and Jobs main metadata;
- refreshed Jobs #252/#345/#376/#380 and Privacy #83 issue states;
- fetched exact #383/Privacy #257 workflow run lists;
- fetched raw job details and artifact lists for sampled runs;
- checked #383 package script and 77 command enrollment;
- read R943 static execution receipt, R945 enrollment report and R972 full-system report.

Not performed:
- no clean checkout, install or application tests;
- no 17-case or 77-command run;
- no build/typecheck;
- no emulator;
- no CI rerun;
- no Firebase/GCP inventory or effective Rules/IAM;
- no GCS late-write 403/upload drain/purge;
- no merge/deploy/dispatch/Rules mutation/private media/paid compute.

## 8. R976 exact next-worker sequence

1. Read this report, R975 machine checkpoint and R976 start prompt; then read R974, R972 full system, R971 full estate crosswalk and R970 stack.
2. Refresh exact heads/bases for Jobs #381/#382/#383/#379/#389/#390/#391 and Privacy #257; refresh all issues and workflow jobs/artifacts.
3. Use an approved clean network-capable credential-free runner; checkout exact immutable #383 SHA and verify tree, clean worktree, pins and versions.
4. Run static 15, longform 17, all 77 root commands, typecheck and build; retain stdout/stderr, TAP, exit codes and SHA-256.
5. Run guarded R879 Auth/Firestore/Functions/Storage emulator path. Confirm ID-token client add/change/remove of protected fields denied, safe profile update succeeds, Admin readback unchanged, trusted deletion writer remains functional.
6. Execute exact #257 frozen installs, R27 unit tests, typechecks/build and demo denial-path integration. Preserve own-claims and Life Movie hard-deny.
7. Investigate historical R939 invalid-record trigger exceptions/socket noise independently.
8. Resolve GitHub runner allocation; no blind reruns, no weakening checks.
9. Obtain owner-authorized read-only provider inventory, resolve one Rules publisher, verify Privacy project/region and deployed Rules.
10. Prove #252 actual nonproduction GCS stale/alternate writer 403, upload drain, exact-generation delete, final absence and durable downstream ACK.
11. Resolve #376/#345, deployed identity/rollback, protected CI, independent review and same-SHA consent→private Replay→revoke→suppression→purge/ACK.
12. Complete device/accessibility/AAA visual, legal/operational and founder GO separately.

## 9. Final decision

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**

No merge, deploy, Rules/IAM change, CI bypass, positive Life Movie grant, private render, revocation dispatch, private media, paid compute or Production GO.

Unknown is not absent. Workflow failure without runner steps is not application test failure. Static source pass is not native Rules acceptance. Source configuration is not deployed state. Jobs ACK is not physical purge.

---
*R975 is a source/metadata and historical receipt reconciliation only. No new application or provider operation occurred. Refresh every head before action.*
