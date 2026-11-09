# ONE URAI GENESIS — R972 full-system reconciliation: consent, Rules authority, Jobs source stacks, CI and release blockers

**Observed:** 2026-11-09 · America/Chicago  
**Disposition:** **PRODUCTION HOLD / NO-GO**  
**Repository of record:** `LifeLoggerAI/urai-jobs`  
**Documentation branch:** `docs/genesis-jobs-firebase-forensics-20261109`  
**Forensic PR:** Jobs #379 (open, draft, unmerged on last refresh).  
**Purpose:** Reconcile R970–R971 and the latest Jobs #381/#383/#391 and Privacy #257 candidates into one source-pinned release state. This pass is read-only except for documentation. No application source edit, Rules/IAM change, test execution, deployment, provider mutation, dispatch or private-media access occurred.

---

## 0. Executive disposition

R972 closes several *source-history ambiguities* but does not close production gates.

### New, verified R972 facts

1. **Jobs deletion-request Rules repair exists in review.** Jobs #381 adds `dataRightsDeletionRequestId` to the protected self-update `affectedKeys()` list, and #383 inherits that exact Rules blob while adding the original 17-case long-form idempotency test enrollment. The original static Node Rules suite was independently executed on the exact #381 blobs and passed **15/15** (R943 receipt). The authenticated Rules emulator test body remains unexecuted. Main still contains the old unprotected Rules blob; issue #380 remains OPEN.
2. **Jobs #391 corrected the Studio producer contract test regex, not application code.** The test establishes that the actual Studio builder/dispatch envelope lacks required canonical consent, the real Jobs Zod schema rejects it, and a shape-only dummy receipt cannot lift the hard-off gate. The test has not executed, is not enrolled in root `urai-jobs:verify` or R879, and #391 is **1 commit ahead / 2 behind** its declared #390 base. It must be reconciled onto current #390 and release-enrolled before it can count as a gate.
3. **Privacy #257 adds a denial-only Life Movie verification callable on top of R20.** It preserves R16–R20 source, keeps `life-movie.render` unregistered, hard-forces `allowed:false`, creates an audit-only denial event and writes no consent grant/receipt capability. It is a useful fail-closed callable candidate, not C6 activation. Its tests/build workflow has failed at workflow level but no executable steps/logs were exposed; no pass is established.
4. **The shared Firebase Rules publisher concern is now substantiated at source level.** Spatial, Admin and B2Bportal main each target `urai-4dc1d/(default)` but use three different Firestore Rules files. Admin main contains a workflow and script that can publish `hosting,functions,firestore,storage` to that same project. This is a **source-configured ability to overwrite shared policy**, not proof the workflow ran or live Rules were overwritten. Admin's repair PR chain is unmerged; its latest scoped candidate intentionally fails closed because `firebase.json` still sets the Functions codebase to `default` rather than the required `urai-admin-functions`.
5. **Privacy Rules deployment is a separate unresolved authority.** Privacy main has no root `.firebaserc`; its `firebase.json` defines Firestore and Storage Rules plus Functions codebase `privacy`. The inspected guarded Privacy deployment wrapper is Functions-only and does not publish Rules. Live project binding and deployed Rules remain unknown.
6. **CI metadata remains non-diagnostic.** Jobs #391 and Privacy #257 Actions runs end in failure, but selected job-step endpoints return null/empty step lists. No raw transcript was retrieved. These are workflow failure conclusions, not evidence that the app-level tests failed. The donor R647 tests and full native integration suites were not run.
7. **Effective governance remains uncertified.** Branch metadata returns `protected:false` for Jobs, Privacy, Spatial, Admin and Labs main. Repository rulesets visibility is incomplete; direct branch protection APIs return 403 to the integration. Authorized administrator verification is required.

### Release decision

No GO. Keep C1/C6/Studio private media disabled where already hard-off. No merge, deploy, Rules/IAM mutation, private-media processing, dispatch, billing action or paid compute.

---

## 1. Current exact main refs and project source configuration

Fresh branch reads in R972 returned:

| Repository | Current main | Branch API protected |
|---|---|---|
| `urai-jobs` | `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1` | false |
| `urai-privacy` | `1163d6f32a123ef9a6638e092a3eee5ec4a3b317` | false |
| `urai-spatial` | `da94837c2457b0a7590e26a7a644cd728de8afb8` | false |
| `urai-admin` | `1cde00e69238f6a32237af2d1914a1b77339d5bc` | false |
| `B2Bportal` | `4aea8574970d28a293f921a34156c4cc5a971213` | false |
| `urai-labs-llc` | `2359d7e33df837dd4c4279ce444cfc8750c05c8b` | false |

R970's 19-repository manifest remains the latest broad main census; R972 refreshed these six security/policy-relevant mains, not all 19. Do not claim a new 19/19 recensus.

### 1.1 Spatial main

- `.firebaserc` blob `0d4fc68d65f23254829cc0502621a6ffe2215788` maps aliases `spatial` and `urai-spatial` to `urai-4dc1d`.
- `firebase.json` blob `2466dd32ddb52c672f9d6700cf1470c451c55b7c` selects Firestore Rules `firebase/firestore.rules`, Storage Rules `firebase/storage.rules`, Functions source `apps/functions`, codebase `urai-spatial-functions`.
- Firestore Rules blob `26330636a18a3675da049aa4bdadb34c82293882`.

### 1.2 Admin main

- `.firebaserc` blob `48b58a1e42c3554ead35cba801e980f0afdeaf2f` maps aliases `default` and `admin` to `urai-4dc1d`.
- `firebase.json` blob `9cdb6bfa298c46376fbdd1b1604df5b530ccd39b` selects `firestore.rules`, `firestore.indexes.json`, Functions source `functions` with codebase `default`, Hosting source `apps/urai-admin`.
- Firestore Rules blob `1b9926316d2c5f5911bbbd52b000967f5e935030`.

**Critical Admin deploy source:** current main `.github/workflows/deploy.yml` blob `582d9322353d60b6061ac3ce603630810b41a8bd` and `scripts/deploy-production.sh` blob `17abe4b59f45ea253660d3b65965d8db5ee4bddc` both contain `firebase deploy --only hosting,functions,firestore,storage -P urai-4dc1d`. The workflow is manual `workflow_dispatch`, requires the explicit “DEPLOY URAI ADMIN” confirmation, exact target and rollback SHAs, runs from main and uses a `production` environment/WIF. Source code demonstrates **potential capability** to publish Admin's distinct Rules to the shared project if the workflow is authorized/run. It does not prove a workflow ran, provider IAM allowed it, or deployed Rules changed.

### 1.3 B2Bportal main

- `.firebaserc` blob `ea4ae23452b00fea090b411114cfd164200205fd` maps `default` to `urai-4dc1d` and a Hosting target.
- `firebase.json` blob `f93da458dc32acd6b4217a24f0d2db902deb086a` selects Firestore Rules `firestore.rules`, Storage Rules `storage.rules`, Functions source `functions` with codebase omitted (Firebase default), and Hosting target `urai-b2bportal-production`.
- Firestore Rules blob `b17ec9f4ef896870722905a279ac0d8206fcf24a`; Storage Rules blob `9f33d22cbd713ab00fe6cb1126d90d40eb0655f7` (deny-all for client SDK access).

### 1.4 Privacy main

- Root `.firebaserc`: **not present** at exact main ref.
- `firebase.json` blob `04a0a54c96abde147a61ab800d924a8c56130109` defines Firestore Rules `firestore.rules`, Storage Rules `storage.rules`, Functions codebase `privacy` on Node 22 and emulator configuration.
- Firestore Rules blob `7c0051eb6d148791198127e625c99973abdc49c1`.
- Privacy #186's guarded deploy wrapper is explicitly `functions:privacy` only; it does not deploy Privacy Firestore/Storage Rules.
- The 23-ID founder-supplied project registry includes `urai-privacy` but does not prove a live project, project number, database or deployment target.

### 1.5 Source-level policy authority conclusion

Spatial/Admin/B2Bportal all map to the same source-configured `urai-4dc1d/(default)` database but each provides a materially different Ruleset. The Admin main deploy path includes both Firestore and Storage. Spatial's current governed WIF workflow was previously source-inspected as Functions+Hosting only; B2B's current production verification path says `deployment:false`. None of this proves which source is deployed today.

The source risk is real and concrete: a broad Admin deployment could replace the shared project's Rules with Admin's policy. The safe response is not to blindly change project aliases. An authorized owner must read live Firebase project number, database, installed Rules release IDs/hashes, deployment principals and effective IAM, then assign one canonical Rules publisher or formally separate projects/databases. No Rules mutation is authorized here.

### 1.6 Labs prior authority audit preserved

- Labs #261 R841 head `2980ca804fe04c37256a00af6e291a79a05004e4` is a source-only detector for the shared Rules publisher collision; its 8 intended tests remain NOT RUN on that PR head.
- Labs #284 R909 head `9bb62bc57886e830111c4537a8512e240dd0dc9` retains 23 founder-supplied project IDs, 19-repository main manifest and deployment authority findings. Its R910 report states Admin main's broad deploy path and records existing Admin repair chain #100–#113.
- Existing Admin #100/#101/#102/#111–#113 repairs are review-only. At #113 candidate the deploy is scoped to Admin Hosting+Functions, but that candidate's `firebase.json` still declares codebase `default`, while its guard requires `urai-admin-functions`; it intentionally fails closed and is not merged/deployed. Preserve the chain; do not recreate or bypass the guard.

---

## 2. Jobs Firestore deletion-request binding: issue #380 → PR #381 → PR #383

### 2.1 Main defect (issue #380 remains OPEN)

Jobs main `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1` Rules blob:
`7dc63626c6e1a2e7b20ded280ea2dd070f16abc9`.

The main `users/{uid}` self-update helper preserves only role/org/permissions/disabled/uid equality and does not protect tenant, account/deletion lifecycle, central Privacy deletion-pending, quota or request-ID binding fields. Source-only predicate assessment shows `dataRightsDeletionRequestId` can be altered by the client self-update path when the other fields remain unchanged. Issue #380 explicitly classifies this as **source-confirmed, not a deployed exploit**. Effective deployed Rules are unknown.

### 2.2 R940 donor #378 is not the Rules fix

Jobs #378:
- head `5881a650230c55245c87a001c58f3ebc6835196b`;
- base `review/chalk-r924-original-studio-transaction-fixture-repair-20261108`;
- its Rules blob `cfa77a8fa5e69327ab352b31450c59a036d21e38` added a protected field list but still omitted `dataRightsDeletionRequestId`.
- #378 changed-file diff does not include a Rules repair.

### 2.3 Corrected Rules candidate #381

Jobs #381:
- head `a295fd834c1cc01710a36b04523b023de2283240`;
- base `review/chalk-r934-consent-smoke-original-authority-review-20261109`;
- 6 commits ahead / 0 behind the base relative to R972 compare;
- exact Rules blob `d30c3e8fbbfcbf25767501e351edcb18d6080c6d`;
- static test blob `45c9e80c0aca2b8288d2e6ddf0650873dc4bdb75`;
- native Auth/Firestore emulator test blob `95f4b72b1d7260a191b0cdc77c5cf008b57011e0`;
- R879 native runner `scripts/run-r879-jobs-native-auth-acceptance.sh` blob `67ae8515bd206456c8d181ff52ef173e67f65cc2`.

The corrected Rules explicitly includes `dataRightsDeletionRequestId` in the self-update protected `affectedKeys()` list. This prevents add/change/remove by a direct signed-in owner client while preserving the Admin/server path.

**Executed test receipt:** R943 documentation records exact original Git blob identity matches and actual `node --test scripts/owner_authority_rules.static.test.mjs`: **15/15 PASS, 0 failed, exit 0**, Node 22.16.0; raw TAP SHA256 `a68a5b4e7709387bcaa8aa1d856824817efa4b53104bea91d29525664e13da9e`. This is a real static Node source suite, not native Firestore emulator acceptance.

The native test file is authored to create Firebase Auth users, use real Firebase ID tokens via Firestore REST PATCH against the local emulator, verify owner add/change/remove and legacy add denials, and read back with Admin SDK. The R879 wrapper pins it and calls it inside `firebase emulators:exec`, but that native body has NOT run on #381/#383 source.

### 2.4 Combined #383 candidate

Jobs #383:
- head `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c`;
- base #381 head `a295fd834c1cc01710a36b04523b023de2283240`;
- 4 commits ahead / 0 behind base at R972 compare;
- preserves #381 Rules blob `d30c3e8f...`, static test `45c9e80...`, native test `95f4b72...`;
- carries the exact #382 long-form idempotency donor script blob `9af97cd9b2bd7e2a8e5e66d805c90791da60a52c`;
- root `urai-jobs:verify` contains 77 unique command segments (not executed);
- guarded R879 runner requires the 17-case original test output marker and 58 source pins.

**No 77-command root run, original 17-case complete run, four Firebase emulators, current-head build/typecheck, protected CI or provider Rules verification was completed on #383.** The issue #380 remains open until authenticated emulator tests and owner-approved deployed Rules proof are complete. This is not a reason to merge #381/#383 yet.

---

## 3. Jobs Studio producer test correction #391: regex repaired, acceptance still missing

Jobs #391:
- head `9f5759f072370fbd42a82560ff6c5d4f37169c6b`;
- declared base #390 current head `e8ba07fc26f154169f2e065d9aa65e77014635d2`;
- compare between #390 base/head and #391: **1 ahead / 2 behind**, merge base `a7a1ef61ac1f219567131abec0b7f5b3c2f81ad9`; one file changed.
- corrected test blob `74e94da0a118a043ab76af611474f3f73d329cea`.

The correction fixes over-escaped JavaScript regex literals in `scripts/studio-life-movie-actual-producer-zod-contract.test.mjs`. The test itself is intended to use the actual Studio R931 builder fixture and actual Jobs Zod schema. Source-level assertions expect:
- current Studio dispatch request lacks `consent`;
- actual Jobs strict Zod parser rejects it only on the missing consent property;
- a shape-only dummy client receipt may pass the Zod shape but does not enable the actual consent authority;
- `lifeMovieConsentAuthorityAvailable() === false` and `deferLifeMovieJob()` remains true;
- substituted purpose is rejected.

**Critical R972 release-enrollment finding:** the exact #391 root `package.json` blob `bd50af6bead1c62f36ada6c012123fe0c5d94da7` does not contain the Studio producer test path; the exact R879 unified runner blob `8a42dcad4416d5896b4886d6c5bad079463d5324` does not contain it either. Therefore correcting its regex is not enough: the test is not currently enrolled in the permanent root/reviewer acceptance command. The PR body says the test has not executed. The branch is also two commits behind/diverged from its declared base. Next worker must reconcile #391 onto the exact current #390 head, add the corrected original test to root and R879 with exact blob pin, and execute it on a clean checkout before claiming a pass. No runtime changes are in #391.

---

## 4. Privacy R27 / PR #257: scoped Life Movie verifier is denial-only

Privacy #257:
- head `a3f7119497fe1d9c6dc61e104a1da0a583d247f8`;
- base Privacy R20 #256 `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`;
- compare: 13 commits ahead / 0 behind, 10 changed files.
- unchanged R20 revocation transition blob `0ddee615f1284a58459aae48b915a574da7c9c9e` and publisher/ACK blob `84f1e77d5c1cf55f80aaa0a559b6a3eac781386e`.

Key #257 blobs:
- `functions/src/consent-api.ts`: `d54a7636f7e6421577eb17a6316f1a4bc9fde8e7`;
- `functions/src/consent-decision.ts`: `3cb3232d0334691c820575e8626c34e25d0c987e`;
- `functions/src/functions-entry.ts`: `f81171feb058be606be19134928c4baf9830f664`;
- `functions/src/life-movie-deletion-fence.ts`: `e08751e59846b06e366d93d1d8bdac7afeaf3b6e`;
- `functions/src/life-movie-jobs-identity.ts`: `78f3cfe4b22fd39500ce3d94de55c9c5f46c7970`;
- `functions/src/life-movie-render-authorization.ts`: `978e0fd7805527713699010541394cd026fd2900`;
- `functions/src/life-movie-scoped-receipt.ts`: `a41f4cf9c2efb525115ec31359d936c8b2f66f6e`;
- `tests/unit/r27-life-movie-verifier-boundary.test.ts`: `5376f6359229645907e4b2668a0e28516785b8f6`;
- focused validation workflow `.github/workflows/r27-scoped-consent-verification.yml`: `10b45cbdc75356adba76afdd6fd14f562c4e358a`.

R27 preserves R16–R20 own-property purpose validation, stored UID binding, original grant invalidation, prior grant receipt lineage and outbox replay collision handling. The added `verifyLifeMovieRenderConsent`:
- requires dedicated Jobs own-claims identity and re-verifies the bearer using `checkRevoked=true`;
- validates strict subject/tenant/receipt/render scope;
- reads current consent and deletion tombstone;
- writes an audit-only `dataAccessEvents` denial;
- explicitly sets `const allowed = false` even when a synthetic record looks valid;
- returns `receiptHash:null`, `expiresAt:null`, and `renderScope:null`;
- does not write `consentRecords`, mint a grant, create a receipt capability or enable a render.

`life-movie.render` remains outside the canonical nine-purpose registry pending Privacy/legal approval and a real protected scoped-grant issuer. This is correctly denial-only, not C6 enablement.

### R27 workflow and CI limit

The R27 workflow intends:
- clean exact SHA checkout;
- root `npm ci`;
- focused Vitest `tests/unit/r27-life-movie-verifier-boundary.test.ts`;
- root typecheck;
- Functions `npm ci`, Functions typecheck and build;
- upload of logs/exit-code artifact.

It does **not** run Firebase Auth/Firestore/Functions/Storage emulators or positive grant/render acceptance. GitHub run #2 ID `42613095876` concluded failure; job ID `129146191449`; the job-step endpoint returned an empty array. No diagnostic artifact/log was recovered in this audit. Therefore no R27 Vitest/typecheck/build pass or failure cause is established.

Privacy issue #83 remains OPEN for protected deployed consent decision/revocation runtime, downstream registered consumer ACK and provider-call suppression.

---

## 5. Reconcile R647, Jobs #371, R818/R836 and v3 — still separate

Do not change R968/R969 architecture conclusions:

A. **R647 dispatcher donor:** Privacy #214, prepared NOT DEPLOYED, exports `dispatchPendingJobsRevocations`. R20 incompatibilities remain: queue field mismatch, changed integrity hash, dropped prior grant lineage and incorrect `createdAt → revokedAt`.

B. **Jobs #371 revocation/Storage harness:** expects original Privacy `consent-jobs-delivery.ts`, `consent-jobs-http.ts` and `consent-jobs-dispatch.ts`; exact source provenance not recovered in inspected historical trees/path history. Its three synthetic emulator cases remain not executed.

C. **R818/R836 callable-denial acceptance:** Jobs compiled identity/transport to actual Privacy consent callable in demo emulators; denial/review-only issuer path, not outbox revocation dispatcher. R836 full exact-head runner remains unexecuted due prior EPERM source report and missing CI step receipt.

D. **Privacy R27:** additive denial-only verifier on R20, not a revocation dispatcher or grant issuer.

R963–R965 v3 event/ACK remains proposal-only. Approval needed for prior lineage, event identity/digest, source timestamp provenance, receiver-validated Jobs receipt/action, stable service identity, legacy disposition and crash-safe ACK recovery.

---

## 6. P0 Storage fence and physical deletion — still unresolved

Jobs issue #252 remains OPEN, P0:
- current historical worker uses direct GCS `createWriteStream()`; process-local `pendingUnfencedOutputWrite` and `writtenObjects` do not create a durable global upload reservation;
- source checks before/after writes and point-in-time prefix listing do not deny a stale or alternate privileged writer from completing a future/late write;
- derivative cleanup is generation-pinned and refuses unknown objects, but cannot certify future write denial or full historical erasure;
- no approved provider-level readback/test proves actual post-revocation 403 for stale/alternate writer identities, in-flight upload drain, exact-generation deletion and durable final purge ACK.

Required engineering is a durable monotonic revocation epoch/write reservation or equivalent storage-enforced broker, denial of new reservations before cleanup, drain/reconcile all prior admitted uploads and final exact-generation absence. Keep physical purge distinct from Jobs receipt and Privacy ACK.

---

## 7. CI, branch governance and execution

### Current selected workflow evidence
- Jobs #391 run query returned 9 workflow runs, all completed/failure; sample Defined Gitlink Guard job ID `129095052789`, steps empty.
- Privacy #257 run query returned 6 workflow runs, all completed/failure; focused R27 boundary job ID `129146191449`, steps empty.
- Jobs #381 and #383 also have failure conclusions in sampled Actions query; no usable step transcript/log was recovered in this pass.
- Prior R969 sampled Jobs/Privacy workflows similarly returned empty step arrays and BlobNotFound logs.

No application test failure or pass is inferred from run conclusions alone.

### Branch governance
GitHub branch metadata returned `protected:false` for Jobs, Privacy, Spatial, Admin and Labs main. Prior repo rulesets endpoints returned empty arrays; direct branch-protection endpoints were 403 and org ruleset access unavailable. Effective required checks, independent reviewers, inherited policies, bypass permissions and GitHub production environment reviewers remain NOT CERTIFIED. Authorized admin must inspect settings directly.

### Network/tooling
GitHub-connected source reads worked through the connector, but local container `git ls-remote` continues to fail with exit 128: `Could not resolve host: github.com`. No clean full checkout, frozen install, R647 donor test, Jobs #371 harness, R836 runner, #383 full root verification, #391 producer test, #257 Vitest/build or current-head native emulators were executed in R972.

---

## 8. R972 consolidated acceptance matrix

| Gate | Latest source evidence | Exact executed evidence | Status |
|---|---|---|---|
| Shared Rules publisher authority | Spatial/Admin/B2B all source-target same project, different rules; Admin main broad deploy | No live Firebase Rules/IAM readback | **P0 HOLD** |
| Privacy Rules target/publisher | no root .firebaserc; Functions-only guard | No deployed Rules readback | **HOLD** |
| Jobs user deletion request field | #381/#383 corrected Rules blob | Static Node 15/15 PASS at R943; native Firestore/Auth not run | **Review fix; native acceptance pending** |
| Studio producer consent contract | #391 test corrected regex; actual builder missing consent; hard-off preserved | Test not run, not root/R879 enrolled, branch 2 behind | **HOLD** |
| Privacy R27 scoped verifier | hard-forced denial; purpose unregistered; no grant writes | No Vitest/typecheck/build receipt; R27 Actions steps empty | **Denial-only review candidate** |
| Privacy R20 outbox / R647 dispatcher | source and donor recovered | No dispatcher integration/dispatch | **HOLD** |
| Jobs #371 revocation emulator harness | source test exists; compatible Privacy modules unrecovered | NOT RUN | **HOLD** |
| Privacy R836 callable runner | exact runner/test source | NOT RUN at exact R836 | **HOLD** |
| Real GCS post-revocation fence | source cleanup models and issue #252 | no live provider 403/drain/purge ACK | **P0 HOLD** |
| Worker auth | #388/#389 review candidates | no live middleware/image/IAM proof | **HOLD** |
| Rollback | #386 hard-stops fake success | no live restoration rehearsal | **HOLD** |
| Operator post-admission withdrawal | #377 diagnostic | policy decision unresolved | **POLICY HOLD** |
| Protected CI / independent review | failure metadata, empty steps | not certified | **HOLD** |
| Deployed source/images/identity/IAM | source references only | no provider inventory | **UNKNOWN** |
| Full C6 → protected Replay → revocation/purge | partial source and denial-only gate | no positive authorized lifecycle | **NOT CERTIFIED** |
| Device/accessibility/visual/legal/ops | historical partial work only | no current complete acceptance | **OPEN** |
| Founder GO | not provided | none | **NO-GO** |

---

## 9. R973 exact work plan

1. **Firebase authority:** authorized owner starts read-only provider inventory for `urai-4dc1d`: verify project number, default database, deployed Firestore/Storage Rules release IDs/hashes, functions/codebases, Cloud Run/workload IAM, deploy principals and GitHub WIF identity. Do not mutate.
2. **Rules ownership decision:** establish one accountable Rules publisher for the shared database or formally separate databases/projects. Review Admin broad current-main path and existing Admin #100/#101/#102/#111–#113 repair chain. Do not merge the candidate until codebase guard and provider identity are reconciled.
3. **Privacy target:** owner-approved project mapping and separate Rules publishing process. Preserve #186 Functions-only boundary until explicit Rules authority exists.
4. **Jobs #380:** preserve #381 exact Rules fix and #383 inheritance; run original static 15-test and native ID-token Firestore Rules emulator test on exact #383/current stack, prove service/Admin deletion path and legitimate deletion continues. Close issue only after native/owner review, not source alone.
5. **Jobs #391:** reconcile its branch onto exact current #390 head; enroll corrected original Studio producer Zod test in root `urai-jobs:verify` and R879 exact blob guard; run on clean checkout. Confirm expected rejection of missing consent and hard-off remains.
6. **Privacy #257:** execute R27 Vitest/typecheck/Functions build with artifact logs on exact head; keep denial-only. Privacy/legal decision on purpose registry and scoped issuer remains required before any future positive C6 path. Run actual protected emulator denial/review acceptance separately.
7. **Cross-service lineages:** recover exact Jobs #371 Privacy modules or create transparently labelled adapted harness; do not substitute R647. Run R647 10+16 donor suites, Jobs #371 three-case emulator and R836 native callable runner separately.
8. **Canonical event/ACK:** Privacy/legal/security approve v3 event identity, time provenance, prior-grant lineage, ACK receipt/action binding, stable workload identity, legacy disposition and crash-safe identical-ACK recovery before implementation.
9. **Storage P0 #252:** design monotonic write fence and durable reservations; prove stale/alternate writer denial (403) and active upload drain at protected nonproduction; verify exact object generations and durable downstream purge ACK. No customer media.
10. **Release governance:** authorized admin proves branch protection, org rulesets, required checks, independent non-author review and bypass settings. Recover actual Actions logs or run clean protected workflows.
11. **Other gates:** close operator-withdrawal policy, worker auth/deploy identity, rollback rehearsal, Studio private media hard-off, authenticated C6 lifecycle, full devices/accessibility/AAA visual, legal/store/billing/backups, historical continuity and explicit founder GO.

---

## 10. Final R972 disposition

**Fully source-reconciled in this pass:** current Jobs/Privacy/Spatial/Admin/B2B config and Rules blobs; source-capable Admin broad publisher path; Jobs #380 → #381 → #383 Rules correction lineage and static 15/15 receipt; Jobs #391 test correction, stale branch topology and missing release enrollment; Privacy #257 denial-only scope, hard false behavior and workflow; prior R647/#371/R836 tracks; shared project and CI/governance limitations.

**Still unknown:** live project/database, deployed Rules versions, live deploy history, effective IAM, service identity and actual provider state; exact original modules for Jobs #371 harness; current full build/test/emulator acceptance.

**NOT RUN in R972:** clean Git clone/install, current 77-command Jobs suite, original 17-case idempotency, Jobs native Rules/Auth emulators, #391 producer test, R27 Vitest/typecheck/build, R647 donor tests, Jobs #371 revocation emulator, R836 runner, provider inventory, Storage 403/drain/purge and production lifecycle.

**No source/runtime code changed. No merge. No deploy. No dispatch. No private media. No Rules/IAM mutation. No paid compute.**

# ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.
