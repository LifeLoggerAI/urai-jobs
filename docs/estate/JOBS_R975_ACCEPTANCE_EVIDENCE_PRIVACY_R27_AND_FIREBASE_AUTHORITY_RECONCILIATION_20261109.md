# ONE URAI GENESIS — R975 Acceptance Evidence Reconciliation, Privacy R27 Runtime History and Firebase Publisher Precision

**Checkpoint:** R975 · November 9, 2026  
**Release:** **PRODUCTION HOLD / NO-GO**  
**Scope:** Refresh exact Jobs/Privacy/Labs review heads, Jobs #383 and Privacy #257 workflow/run records, artifact availability, exact R972 acceptance history and branch protection state. Documentation-only. No tests, builds, emulator commands, deployment, provider inventory, dispatch, IAM/Rules changes or private media.

## 0. Executive findings

R975 finds no new executable test receipts on the newest reviewed candidates. It does, however, recover two important historical acceptance facts and sharpen CI/Rules interpretation:

1. **Jobs #383 remains not executed on its exact head.** Current observed head remains `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c`. Its root `urai-jobs:verify` script has 77 command segments and includes the original longform idempotency suite. The guarded R879 runner checks for 17 passing test cases and pins the expected original blobs. This proves enrollment/source wiring, not execution.
2. **The real static Rules receipt is still R943, exact #381 blobs:** 15/15 Node tests passed. No new 15/15 run occurred in R975. The Auth/Firestore emulator test body remains unexecuted.
3. **The previous R972 complete-system report already recorded an earlier Privacy R27 run at a different exact source commit, `6fecb46e380a6400f2ec095ef615d9ef73319032`:** root and Functions installs, lint, root typecheck, 199/199 unit tests (including R27 9/9), Functions typecheck/build, static Rules and root preflight passed. The Java-backed emulator command exited 0, with 13 Rules and 3 integration assertions. But Functions logs also contained invalid canonical-record trigger exceptions and ECONNRESET/socket-hang-up noise; raw logs were not archived and the final root worktree had one uncaptured entry. This is meaningful historical exact-source acceptance evidence, not clean current-#257 release certification.
4. **Privacy #257 current head remains `fbdc590376376b758be968f174d71709f326c61f`.** It adds the own-claims helper to the generic cross-user consent endpoint. It preserves the R27 hard denial: `life-movie.render` remains unregistered, `allowed=false`, no grant or assembler. Six current exact-head workflow runs conclude failure. The sampled dedicated R27 job exposes runner ID 0, blank runner name, and empty step list. No uploaded diagnostic artifacts exist for sampled Jobs #383 and Privacy #257 runs. Therefore current workflow results do not establish app-level tests ran or failed.
5. **Firebase source/deploy authority is more nuanced than “three active publishers.”** Spatial, Admin and B2Bportal source-configure different Firestore Rules files for `urai-4dc1d/(default)`. However, the R972 review of governed paths found Admin has a manual, guarded workflow that can deploy Firestore Rules; the reviewed Spatial WIF path is Functions/Hosting only, and reviewed B2B workflows do not deploy Rules. Other manual/delegated publishers remain unknown. The risk is a shared-target source/configuration and policy-ownership conflict, plus an Admin Rules-capable path—not proof that three governed workflows publish Rules or that deployed Rules were overwritten.
6. Labs master #262 is moving; current observed head is `5b69d07b71a961c4d45e29a6cfbe9985cb453bd8`, 197 changed files, open/draft/unmerged. It remains a knowledge and continuity index, not production authority.
7. Jobs main remains `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`, branch metadata unprotected. Production remains HOLD.

## 1. Current refreshed exact heads

| Record | Head | State | Note |
|---|---|---|---|
| Jobs main | `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1` | Current | tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`; protected=false |
| Jobs #379 forensic docs | `58b0c9586de781a5ac26f3630ce4c0177948300a` | Open/draft | 93 changed files at read |
| Jobs #381 Rules repair | `a295fd834c1cc01710a36b04523b023de2283240` | Open/draft | 6 changed files |
| Jobs #382 idempotency donor | `abdc13016fd83fbb4a3d7589645c1310d2344be0` | Open/draft | 3 changed files |
| Jobs #383 combined candidate | `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c` | Open/draft | 4 changed files; based on #381 |
| Jobs #389 worker auth | `b865209cc352241602d8b9714672f3401aed7669` | Open/draft | 3 changed files |
| Jobs #390 Studio/Jobs Zod | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | Open/draft | 7 changed files |
| Jobs #391 regex test fix | `9f5759f072370fbd42a82560ff6c5d4f37169c6b` | Open/draft | 1 changed file; declared-base divergence remains |
| Privacy #257 | `fbdc590376376b758be968f174d71709f326c61f` | Open/draft | 10 changed files; R27 own-claims hardening |
| Labs #262 master index | `5b69d07b71a961c4d45e29a6cfbe9985cb453bd8` | Open/draft | 197 changed files |
| Labs #304 cross-chat relay | `45bae5769fdcf7748a624d74b142dce71d5cc3fe` | Open/draft | 23 changed files |

Jobs #379 and Labs #304 were refreshed after R974 documentation writes; refresh again before further update. All PRs remain review-only. No merge commit exists for these candidates.

## 2. Jobs #383 exact source acceptance — enrolled but not run

### 2.1 Source identity and required gates
- #381 head: `a295fd834c1cc01710a36b04523b023de2283240`.
- #381 Rules blob: `d30c3e8fbbfcbf25767501e351edcb18d6080c6d`.
- #381 static Node test blob: `45c9e80c0aca2b8288d2e6ddf0650873dc4bdb75`.
- #381 native Rules emulator test blob: `95f4b72b1d7260a191b0cdc77c5cf008b57011e0`.
- #382 donor longform test blob: `9af97cd9b2bd7e2a8e5e66d805c90791da60a52c`.
- #383 head: `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c`.
- #383 root `package.json` blob: `4804276332491e1e57a95a2a0cec7050df3a595c`; `urai-jobs:verify` has 77 command segments and includes `scripts/life-movies-idempotency-revocation-race-contract.mjs`.

### 2.2 What has actually passed
R943's exact Git-blob Node test receipt remains valid:
- Node v22.16.0, npm 10.9.2, Java 21.0.12.1, Git 2.47.3.
- Exact original Rules/static/native source blobs matched.
- Actual `node --test scripts/owner_authority_rules.static.test.mjs`: **15/15 PASS**, exit 0.
- TAP SHA256: `a68a5b4e7709387bcaa8aa1d856824817efa4b53104bea91d29525664e13da9e`.
- Native test file syntax passed, but its test body was NOT run.

This 15/15 is a real source test receipt, but only for the static Node test. It is not Firebase Rules engine acceptance.

### 2.3 What #383 enrolls but has not executed
- Original longform idempotency test expects **17/17**; covers missing persisted plan, wrong plan owner, wrong org, revoked/malformed consent, data-rights owner fence and read-only replay.
- Root verification: 77 command segments.
- R879: 58 source pins and exact original test pass marker `# pass 17`.
- Authenticated Firebase Rules test: client ID-token add/change/remove denial for protected owner fields, safe profile edit allowed, Admin readback unchanged.
- Typecheck/build and four emulator acceptance.

None of the 17-case original suite, 77 command segments, current #383 build/typecheck or native four-emulator suite was run on #383 in R975. Do not infer success from `package.json`, R879 shell content or test assertions.

### 2.4 Exact Actions evidence for #383
- Sampled run: `42577924383`, Firebase CLI Pin Guard.
- Job: `129029735536`, status completed, conclusion failure.
- Job metadata: `runner_id=0`, blank runner name, `steps=null`.
- A second sampled #383 Actions run `42577924384` is also workflow failure.
- Artifact query for run `42577924383` returned an empty artifact list.

This points to failure before a runner/step was recorded. It does not prove the source tests failed. Root cause remains unknown. Do not rerun until runner allocation is understood; no blind retries.

## 3. Privacy #257 current head and historical R27 acceptance reconciliation

### 3.1 Current source
Privacy #257 current head:
`fbdc590376376b758be968f174d71709f326c61f`.

The two-commit delta from `a3f711...` changes:
- `functions/src/consent-api.ts` blob `db8619c6d7fdf1309d5d89d7cfc8e77e346dbbf1`.
- `tests/unit/r27-life-movie-verifier-boundary.test.ts` blob `4ff5e6ca30a0152d22a05347f405b8c20ad2c8ed`.

Helper `functions/src/cross-user-authority.ts` blob: `443097baa409c289b4189f98e4c56c7ab70aaa31`.

It requires own properties for privileged claims and rejects inherited prototype values. The generic cross-user `evaluateCanonicalConsent` route uses this helper. The R27 test adds an assertion that the generic endpoint uses the own-claims guard and no longer contains the old local parser.

Life Movie remains denied: `life-movie.render` remains outside canonical purpose registry; verifier remains `allowed=false`; no grant, assembler or private output authority is created.

### 3.2 Current #257 workflow
Six exact-head workflows remain conclusion=failure:
- `42613806005` R27 scoped Life Movie denial boundary;
- `42613806033` Consent Export and Deletion Branch Validation;
- `42613806157` URAI Production Verify;
- `42613805990` Privacy package validation;
- `42613806255` Release Verification;
- `42613805941` URAI Privacy Release Verification.

For dedicated run `42613806005`:
- Job ID `129149557711`.
- status completed / conclusion failure.
- `runner_id=0`, blank runner name, steps null.
- Artifact query returned no artifacts.

This does not show that R27 Vitest, typecheck or Functions build ran. No raw step logs or artifact receipts were available.

### 3.3 Prior R939 exact-source test evidence — important, but different scope
R972's full-system report includes an R939 run on exact source commit:
- SHA `6fecb46e380a6400f2ec095ef615d9ef73319032`.
- Tree `c6bd5d94f2e71e7d267bdd2c6a49e4c98ccdccff`.
- Environment Ubuntu 24.04, Node 22.23.0, npm 10.9.8, Java 21.0.12.1.
- root and Functions installs, lint, root typecheck, **199/199 unit tests** including R27 9/9, Functions typecheck/build, static Rules, Java prerequisite and full root preflight all reported PASS.
- The Firebase emulator command exited 0 and reported Firestore/Storage Rules **13 assertions** plus Privacy integration smoke **3 assertions**.

Caveats that must remain attached:
- Functions emulator produced `publishConsentRevocation` exceptions for intentionally invalid canonical consent records and unhandled trigger termination.
- Synthetic fixture mutations caused ECONNRESET/socket hang-up noise.
- The report requires mapping invalid fixture writes to the trigger and a clean exact-head rerun with reviewed logs.
- Raw logs were not archived in the repository (hashes were noted only); the final root preflight had one uncaptured worktree entry.
- R939 did not test the later own-claims two-commit delta now in #257 head `fbdc590...`.
- R939 did not certify deployed Privacy identity, Rules, IAM, C1/C6 positive consent, private render or Replay.

Therefore classify R939 as **meaningful historical exact-source unit/build/preflight PASS plus emulator command exit 0 with unresolved trigger/runtime noise**, not clean current #257 acceptance.

## 4. Firebase shared Rules publisher precision

The source-level common target remains `urai-4dc1d/(default)`, with differing Rules files in Spatial, Admin and B2Bportal.

R972's fuller deployment audit refines the risk:
- **Admin:** current main has a manual guarded `workflow_dispatch` path and script that can target `hosting,functions,firestore,storage` for `urai-4dc1d`, with explicit confirmation, target/rollback inputs, main-branch source and production environment/WIF. It is Rules-capable in source.
- **Spatial:** reviewed governed WIF path is Functions/Hosting only, not Firestore Rules.
- **B2Bportal:** reviewed workflows do not publish Firestore Rules.
- Other manual/delegated principals and deploy paths remain unknown.
- Admin repair chain is unmerged; a scoped candidate currently fails closed because Functions codebase naming in `firebase.json` remains `default`, not expected `urai-admin-functions`.

This remains a source-level shared project target and possible policy-ownership collision. It is not proof that three governed workflows actively publish Rules or that an overwrite occurred. Actual project/database, deployed Rules release/etag, deploy principals and provider history remain unknown.

Privacy main still has no root `.firebaserc` in inspected source; Privacy #186 guarded deployment is Functions-only (`functions:privacy`) and does not deploy its changed Rules file.

## 5. Open release gates rechecked

- Jobs #252 — OPEN P0: true Storage write fence after revoke, stale/alternate writer 403, active/resumable upload drainage, exact-generation deletion and durable downstream physical purge ACK.
- Jobs #376 — OPEN P1: data-rights post-admission operator withdrawal and continuation authority.
- Jobs #380 — OPEN P1: source repair exists in #381/#383; authenticated native Rules test and owner-approved deployed Rules proof outstanding.
- Jobs #345 — OPEN P2: concurrent createJob quota admission and index parity.
- Privacy #83 — OPEN: protected deployed consent/revocation, registered downstream consumer ACK and provider-call suppression.
- Studio consent authority and private output write authority remain hard-off.
- Branch governance/required CI/independent review, actual deployed revision/identity/IAM, rollback, same-SHA private Replay/revocation and full device/accessibility/visual/legal/Founder GO remain unverified.

## 6. R975 work performed / not performed

### Performed
- Refreshed Jobs #379/#381/#382/#383/#389/#390/#391, Labs #262/#304, Privacy #257 and Jobs main.
- Refreshed Jobs #252/#345/#376/#380 and Privacy #83 issue states.
- Refreshed exact-head Jobs #383 and Privacy #257 workflow run lists.
- Queried raw job metadata for sampled #383 and #257 runs.
- Queried artifact lists for those runs; both returned no artifacts.
- Read Jobs #383 package.json and confirmed the root script has 77 command segments and includes the 17-case original test.
- Read the full R972 current-head reconciliation to recover R939 evidence and precise Firebase deployment-authority distinctions.
- Read the R943 actual static test execution receipt and R945 original 17-case enrollment report.

### Not performed
- no git clone/checkout;
- no new Node test execution;
- no 17-case longform execution;
- no 77-command root verify;
- no frozen install, typecheck or build;
- no Firebase emulator;
- no CI rerun;
- no Firebase/GCP provider inventory, effective Rules or IAM read;
- no GCS writer 403/upload drain/delete/purge;
- no merge, deploy, dispatch, Rules/IAM mutation, private media or paid compute.

## 7. R976 exact next-Chalk plan

1. Read R975 report, machine checkpoint and R976 start prompt; then read R972 full-system reconciliation, R971 master crosswalk and R974 Rules/own-claims report.
2. Refresh exact Jobs #381/#382/#383 and Privacy #257 heads, PR bases, PR ancestry, current main and all issue/Actions records before execution.
3. Obtain one approved, clean, network-capable, credential-free runner. Do not use the GitHub runs that report runner ID 0 as evidence of source failure.
4. Checkout exact immutable #383 SHA; validate tree, clean worktree, all R879 pins, package lockfiles and tool versions.
5. Run separate local source gates: static Rules 15, original idempotency 17, full 77-command root verification, typecheck and build. Stop on first nonzero; retain all raw logs, SHA-256, stdout/stderr, exit, environment and git status.
6. Run original authenticated Rules test and R879 four-emulator suite only with the guarded demo projects and no production credentials. Verify client ID-token mutation/add/remove returns 403, safe displayName update succeeds, Admin readback unchanged, and trusted server deletion update remains functional.
7. On exact Privacy #257 `fbdc590...`, run frozen root/Functions installs, R27 Vitest, root/Functions typechecks, Functions build, then separately run approved demo four-emulator denial path. Preserve own-claims source and Life Movie hard-deny. Diagnose or archive CI runner evidence; do not enable positive grants.
8. For R939 historical emulator noise, recreate each intentionally invalid fixture one at a time, identify its trigger/log association, capture full emulator logs and confirm process/socket stability. Keep this independent from current #257 delta.
9. Get owner-authorized read-only provider inventory for Firebase project number, `(default)` database, deployed Rules release/etag, deploy principals/history and effective IAM. Resolve one accountable Rules publisher.
10. Close #252 with nonproduction Storage evidence: stale/alternate writer 403, in-flight/resumable upload drain, exact-generation physical delete, final absence and durable downstream ACK.
11. Resolve #376, #345, actual deployed identity/rollback, protected CI/review, same-SHA owner consent→render→Replay→revoke→suppression→purge/ACK, devices/accessibility/visual/legal/operational and Founder GO.

## 8. Final disposition

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**

The accurate state is:
- Jobs #380 fix exists in review; real 15/15 static test receipt exists; native Rules emulator has not run.
- Jobs #383 includes 17-case test and 77-command acceptance enrollment; no exact-head execution receipt exists.
- Privacy #257 own-claims hardening exists; current R27 remains denial-only.
- R939 has prior 199/199 unit tests and emulator command exit 0, with unresolved trigger/socket noise and raw-log limitations.
- Current GitHub failure conclusions with runner ID 0 and no steps do not prove test assertions failed.
- Actual provider Rules/IAM and physical Storage revocation remain unverified.

No merge, deployment, positive Life Movie grant, private render, dispatch, private-media access, IAM/Rules change, CI bypass, paid compute or production GO.

---
*R975 is a source/metadata and historical-receipt reconciliation. No new application execution or provider operation occurred. Refresh all heads before action.*
