# ONE URAI GENESIS — R969 Current Lineage, Life Movie Security, and C1 Rules Reconciliation

**Observed:** 2026-11-09  
**Disposition:** **PRODUCTION HOLD / NO-GO**  
**Repository:** `LifeLoggerAI/urai-jobs`  
**Documentation branch:** `docs/genesis-jobs-firebase-forensics-20261109`  
**Parent forensic PR:** Jobs #379 (open, draft, unmerged; current readback head at intake `f8af5ce6fb616b6ec9bc715a6e690318e6ee5c31`).  
**Purpose:** additive continuation after R968. Refresh and reconcile the exact Privacy #183/#224 life-movie lineage and the Privacy/Spatial shared-profile/C1 Rules lineage. Documentation only.

## 0. Executive determination

R969 adds a source-level reconciliation of two security seams that must remain connected but distinct:

1. **Life Movie render authority:** Privacy #183/R307 contains a fail-closed, movie-scoped verifier and receipt-integrity implementation. The general consent API explicitly rejects purpose-wide Life Movie grants and decisions. This is source implementation, not proof of a positive scoped issuer or deployed authorization.
2. **Jobs→Privacy denial boundary:** Privacy #224/R818 contains a real-emulator test harness for the original compiled Jobs identity/transport calling the actual Privacy callable. It is deliberately denial-only. It must not be described as a positive C6 issuance, successful render, or production service-identity test.
3. **C1 / shared owner profile authority:** Privacy #186 and Spatial #1964 are separate draft fixes to divergent Firestore rulesets. Their current heads differ from older SHAs cited by the November 3 issue comments. Current source readback shows a genuine contract difference: the Spatial candidate adds an owner-only read of the first-time `{uid}_memory_storage` C1 record, including a successful missing-document read; Privacy main's generic `consentRecords` rule does not express that same path. The two full Rulesets must not be copied wholesale into one shared project.

The Jobs #371 revocation/storage harness remains a **third** independent integration lineage, distinct from R647 and R818/R836. Its three required `consent-jobs-*` modules remain unrecovered in the inspected historical source paths. No substitute has been invented.

**No application source was changed. No tests, builds, emulators, CI, cloud inventory, IAM, Rules deployment, media processing, dispatch, billing action, merge, or deployment was performed in R969.** This is a GitHub source/metadata and documentation reconciliation only.

## 1. Exact review-state refresh

All listed PRs remained open, draft, and unmerged at the metadata readback used for this checkpoint unless otherwise stated.

### 1.1 Jobs source / integration queue

| PR | Current head SHA | Base / role | Current status |
|---|---|---|---|
| #371 | `df19633466eaebdda844569ed0d562245bd31dc6` | R923 two-parent Jobs convergence | Draft donor; #371 three-case harness |
| #377 | `f8578ea281e818b01811aecc2fe4dfb8c3dc8203` | R900 operator-withdrawal test | Draft; policy gap remains |
| #384 | `fd05a376f876f9b835929a2074c09f47638659e2` | R946 guarded source-pin closure | Draft |
| #386 | `fd1c8d85acd5cc96ef9fcb300173e362b004eb54` | Child of #384 | Draft; rollback false-success hard-stop |
| #387 | `04592f8573c708954f95f87ddca1e168efde51f4` | Child of #386 | Draft; Narrator entrypoint/auth boundary |
| #388 | `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38` | Child of #387 | Draft; production-first worker auth |
| #389 | `b865209cc352241602d8b9714672f3401aed7669` | Child of #388 | Draft; auth regression enrollment |
| #390 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | Child of #389 | Draft; Studio producer envelope against Jobs Zod |
| #391 | `9f5759f072370fbd42a82560ff6c5d4f37169c6b` | Child of #390 | Draft; test-only regex correction |
| #379 | `f8af5ce6fb616b6ec9bc715a6e690318e6ee5c31` | Jobs main-based forensic documentation branch | Draft handoff/control record |

The base of #379 metadata still references the older Jobs main SHA `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`. The current Jobs main readback in Round 24/R967 is `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`. The difference is the explicit revert of one 90-line R933 test-file addition; current tree equals the previous baseline tree. Do not use the old base SHA as current source authority.

#252 remains the P0 issue for Storage future-write denial, alternate/stale privileged writer rejection, in-flight upload drain, generation-pinned deletion and durable downstream purge acknowledgement.

### 1.2 Privacy lineage

| PR | Current head SHA | Meaning / limit |
|---|---|---|
| #183 | `389aa638f99a6394b46be335ee0465168a7a1a4c` | R307 movie-scope fail-closed verifier/receipt source donor |
| #192 | `7f5f4ad2f157a9d3eb4ed12b679d499fe5888bdc` | R506 Privacy→Jobs Storage derivative bridge |
| #213 | `4a4656d6283aa7e627bf220b447436df82865f99` | R583 dual-artifact/four-service bridge |
| #214 | `cc0692053db3b1b8df8267d43856b1a3357de8a0` | R647 prepared outbox dispatcher donor; not deployed |
| #224 | `f9e7786854f7ec70cab9a6e22d2c90ad95b834ed` | R818 denial-only native Jobs→Privacy callable test/runner |
| #229 | `79e71fd6137947d2ed7c416a2596090572fef978` | R834 source pin candidate |
| #230 | `846d2ffa469af5634374bd77fbdc2d41bca8e964` | Full workspace/native gate candidate |
| #231 | `42aad96404c4f0de01a448031df80f7b5c06f7c0` | R835 full-source/native gate parent |
| #232 | `e1e2dee63c39590d343d727aa53618ac97a52691` | R836 convergence; exact-head four-emulator run not accepted |
| #253 | `90a4e581e8494f52d85eab3c576d02b926e7d0d9` | R17 subject UID binding |
| #254 | `dbc193763dc112210c20b5b680e8eb08fdf8396c` | R18 original-grant identity replacement |
| #255 | `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a` | R19 prior-grant receipt lineage |
| #256 | `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6` | R20 replay collision / legacy incomplete outbox fail-closed |

The three tracks from R968 remain independent:

- **R647 (#214):** prepared dispatcher `dispatchPendingJobsRevocations`; not deployed. It is not the API expected by Jobs #371 and has R20 compatibility differences.
- **Jobs #371:** test expects `deliverJobsConsentRevocation` from three unlocated Privacy `consent-jobs-*` modules. Exact provenance was not recovered in inspected source/tree/path-history scope.
- **R818/R836 (#224/#232):** Jobs identity/transport to Privacy callable denial/review-only acceptance, not a revocation outbox dispatcher or the Jobs #371 Storage cleanup harness.

Do not combine their test counts or imply one track certifies another.

## 2. Privacy #183 — actual current source contract

Current PR #183 is `389aa638f99a6394b46be335ee0465168a7a1a4c`, open/draft/unmerged.

### 2.1 Exact source blobs inspected

| File | Blob SHA-1 |
|---|---|
| `functions/src/life-movie-render-authorization.ts` | `a75e4f2297c331baa52b044f2842820adbdc7fc8` |
| `functions/src/life-movie-scoped-receipt.ts` | `a41f4cf9c2efb525115ec31359d936c8b2f66f6e` |
| `functions/src/consent-api.ts` | `43da4d49ccbee7cbe145d0729d921e10d859ba63` |

### 2.2 What the current code enforces

The pure Life Movie authorization policy checks all of the following before returning `allowed`:

- current evaluated consent decision allows the purpose;
- stored record UID equals the requested subject UID;
- the supplied decision receipt ID is a valid SHA-256 hex string and equals the stored receipt hash;
- requested movie/project, render-plan digest and immutable selected-source-set digest exactly match the stored render scope;
- the stored receipt hash actually binds the canonical scope and other receipt fields;
- purpose-specific policy version matches;
- deletion-fence evidence was explicitly checked and is exactly inactive (`false`), not missing/unknown.

The dedicated verifier also has a trusted Jobs system-caller check in the current source. The general `setCanonicalConsent` route rejects `life-movie.render` grants; the general purpose-wide evaluator rejects `life-movie.render` decisions. Only the dedicated scoped verifier is intended to evaluate the movie operation.

The receipt helper hashes a canonical ordered payload covering UID, tenant, purpose, tier, status, policy, expiry, surface, jurisdiction, notice version/hash, evidence hash, render scope and update time. It rejects inherited/missing scope fields and requires exact scope keys/values.

**Critical semantic limit:** this SHA-256 receipt is an integrity binding, not a cryptographic signature, proof of human choice, or authorization by itself. The source comments explicitly reserve writing the record to a protected reviewed server-side issuer. The pure policy function itself cannot issue consent, start rendering or mint access links.

### 2.3 What is still absent / not certified

- No accepted positive movie-scoped C6 issuer flow has been proven in deployed, protected runtime.
- User-visible selection/review must be bound to immutable media generations/source rights and the exact render plan before the canonical server-side grant is written.
- Jobs/Studio must independently recompute and verify the source-set digest and media rights; the Privacy receipt alone cannot prove source rights.
- Actual Jobs workload identity, deployed Privacy project/region/function SHA, Firestore transactional reads, effective rules/IAM and provider-call suppression are unverified.
- No positive render, private GCS write, protected Replay or physical deletion test was run in this R969 pass.

Earlier #183 body includes R307 unit/emulator receipts at earlier exact source SHAs. Those are useful historical evidence but are **not automatically receipts for current #183 head**. Record them with their own source pins; do not transfer their green status to the current head.

## 3. Privacy #224 / R818 — denial-only transport boundary

Current #224 head is `f9e7786854f7ec70cab9a6e22d2c90ad95b834ed`, open/draft/unmerged.

Changed paths:
- `scripts/run-r818-native-jobs-privacy-acceptance.sh`
- `tests/integration/life-movie-jobs-native-transport.emulator.mjs`

Test blob SHA-1: `51c5279295f07fde06c7f89b1472c5f147fdf8f0`.

### 3.1 What the harness attempts

- Requires exact clean Privacy source and disposable Jobs checkout pinned to Jobs SHA `14c7c0482833a915ed6b33da7836b536d4585f18`.
- Uses only a demo Firebase project and local Auth, Firestore, Functions and Storage emulators.
- Imports original compiled Jobs `createAuthenticatedJobsPrivacyConsentClient`; redirects only known Identity Toolkit and Privacy callable URLs to local emulator endpoints and denies other outbound targets.
- Proves that the real Privacy callable rejects a generic/unscoped `life-movie.render` grant and creates no consent receipt.
- Stage one requires the original Jobs transport to reject the unsigned Auth-emulator ID token before calling Privacy.
- Stage two explicitly re-signs only locally verified emulator claims using a one-use ephemeral test RSA key, solely to reach the real local Privacy callable and verify a denial/no-grant outcome. This is a synthetic negative-test adapter, not a Google or production service identity.
- Asserts no canonical C6 consent record, no render Jobs and no render queue entries are created.

### 3.2 What it does not prove

This is **denial-only** acceptance. It does not prove a positive C6 issuer, production workload identity, real project IAM, protected deployment, media render, private Storage upload, Replay, revocation, provider suppression or purge.

R818 #224 must also not inherit a pass from R836 #232: R836 is a distinct later source head and its body says the four-emulator runner was not executed on that exact head because Functions worker socket creation returned EPERM; hosted CI had no executable-step certificate. No R818 or R836 test was executed by this R969 pass.

## 4. Privacy/Spatial C1 Rules reconciliation — fresh exact heads

### 4.1 Current main and draft refs

| Lane | Exact ref | Firestore Rules blob |
|---|---|---|
| Privacy main | `1163d6f32a123ef9a6638e092a3eee5ec4a3b317` | `firestore.rules` `7c0051eb6d148791198127e625c99973abdc49c1` |
| Privacy #186 current head | `2d0c7b621b63ac63ae83e44f5c40ac2ca5344cdc` | `firestore.rules` `295e5d27623cceddec8245759ff28128b17be28c` |
| Spatial main | `da94837c2457b0a7590e26a7a644cd728de8afb8` | `firebase/firestore.rules` `26330636a18a3675da049aa4bdadb34c82293882` |
| Spatial #1964 current head | `e3347d0e1ee57eaabafcfd50e2b033f7476aecf8` | `firebase/firestore.rules` `8b015a8bbe123bb7857bff5d98ba5a153067c41c` |

Current PR metadata:
- Privacy #186 is an open draft based directly on Privacy main.
- Spatial #1962 is an open draft C1 consent bridge at `da2ee1ff6eed5b5cf0c8f3b762214fdb57c07c11`.
- Spatial #1964 is an open draft stacked on Spatial #1962; its latest metadata head is `e3347d0e...`, base `da2ee1ff...`.

Older November 3 issue #83 comments cite previous PR head SHAs (`ef637164...` for Privacy #186 and `fb37db5...` for Spatial #1964). Those are historical comment pins, not the current PR metadata heads. Do not use them as current. Refresh metadata before any new action.

### 4.2 Exact source differences

**Privacy main**:
- Tombstone check is permissive for a present document when `active != true`; this can treat absent/malformed/non-boolean active state as inactive.
- Profile create/update blocks a shorter set of privileged fields (role/admin/isAdmin/legalHold/markedForDeletion/deletionMarkedAt).
- Main profile identity check enforces `uid` but does not impose the same embedded `userId` and `ownerId` checks as the draft.
- Privacy main generic `consentRecords/{id}` read requires owner match via `resource.data.uid` or admin. It does not explicitly add the Spatial candidate's first-time missing-document C1 `get` rule.

**Privacy #186 current head**:
- Changes the deletion fence so a present tombstone counts as inactive only when server explicitly set `active == false` and none of five deletion-planning lease fields remain. Missing tombstone still allows the non-deletion case.
- Adds profile create/update validation for optional embedded `userId` and `ownerId`, checking stored identity and replacement identity.
- Expands server-owned profile fields to ten: `role`, `admin`, `isAdmin`, `legalHold`, `markedForDeletion`, `deletionMarkedAt`, `entitlementTier`, `founderOverride`, `deleted`, `accountStatus`.
- Adds exact-source static validation and Firestore emulator regression source for privileged fields, identity spoofing and malformed/unresolved tombstones.
- Changes the `test:rules:emulated` command to set `URAI_RELEASE_VERIFY=1`; adds a deploy-boundary checker, a preflight stage and replaces the package `deploy` command with the guarded Firebase functions-only deploy wrapper.

**Spatial main**:
- Uses a different Firestore schema and collections, plus its own owner/admin helpers.
- User profile writes have a smaller protected-field set and use `changedKeys()` checks for some update fields, which does not cover additions/removals as robustly as `affectedKeys()`.
- The main user-profile rule does not use the stricter root Privacy deletion tombstone fence.

**Spatial #1964 current head**:
- Adds Privacy's strict root deletion tombstone check to owner profile create/update.
- Requires old and new embedded identity fields (`uid`, `userId`, `ownerId`) to remain tied to the authenticated owner.
- Blocks the ten-field union on create and on update's `affectedKeys()`.
- Adds a specific owner-only read for `consentRecords/{uid}_memory_storage`: a missing first-time document can be read as absent; if present, stored UID, purpose `memory.storage`, tier C1 and policy version `1.0.0` must match. List and all client writes remain denied.
- Adds source tests for first-time/malformed C1 state, cross-owner denial, deletion tombstone/lease, spoofed identity and privileged-field regressions.

### 4.3 Why the two Rules PRs cannot be deployed wholesale

These are not identical Rulesets and they do not govern identical data surfaces. Privacy and Spatial main use different collections, helpers, default-deny boundaries and service ownership. The draft branches also have separate base/source ancestry. A whole-file deployment from either repo could replace another service's rules and discard protections unique to the other.

A further source contract must be consciously reconciled: Spatial first-private-memory requires server readback of the canonical C1 `consentRecords/{uid}_memory_storage` receipt, including the no-document-yet state. Privacy main's current generic consent-record rule does not express that first-time read path. Privacy #186 expands shared profile authority but its visible rule patch does not add Spatial's C1-specific missing-document read rule. The intended project topology and authoritative combined Ruleset must be established before the two service contracts are considered integrated.

**Provider reality remains unknown:** these source reads do not establish that Privacy and Spatial share a Firebase project, that either Rules file is deployed, or which Ruleset currently governs any live project. No current Firebase project, Rules deployment, effective IAM or Rules emulator check was performed here.

### 4.4 Deployment boundary in Privacy #186

Privacy #186's new `scripts/guarded-firebase-deploy.mjs` is deliberately functions-only:
- requires explicit project ID; rejects caller-supplied scope flags;
- confirms `firebase.json` has the named `privacy` Functions codebase;
- targets only `functions:privacy`;
- requires explicit approved project and exact approved HEAD SHA plus a clean checkout before real deploy;
- offers a dry-run with no provider call.

This is a procedural safeguard in a review-only branch, not independent reviewer approval, live IAM, provider deployment evidence, or proof of combined Rules authority. It must not be treated as a release authorization.

## 5. Privacy issue #83 — disposition stays open

Privacy issue #83, “RUNTIME GATE: deploy and prove consent decision + revocation enforcement”, was re-read and remains OPEN with privacy/release-blocker labels.

Its original July body is stale as a source-implementation description. October comments and current main identify canonical C1–C8 consent purposes, fail-closed decision logic, revocation transition/outbox/ACK source and owner/system principal controls. November 3 comments identify the missing source-to-runtime C1 dependency and the divergent Privacy/Spatial Rulesets.

Remaining acceptance remains:
- exact protected project/region deployment and deployed source SHA for canonical `setCanonicalConsent` / decision/revocation services;
- real signed-in owner C1 grant/readback/revoke/expiry, denied/stale/cross-user tests;
- verified downstream consumer registry, dispatch, ACK and provider-call suppression;
- source and runtime Rules authority reconciliation for first-time C1 read and shared owner-profile fields;
- effective Firebase Rules/IAM and workload identities;
- rollback/recovery, independent non-author review and legal/privacy approval.

Do not close #83 on code presence or unit/synthetic test receipts.

## 6. Cross-service gates carried forward

1. **Jobs #252 P0 Storage fence:** stale/alternate writer 403 after revoke, in-flight upload/stream drain, generation-bound delete, durable final purge ACK and future write denial.
2. **Canonical revocation protocol:** select one dispatcher/receiver architecture only after exact ancestry/API/queue/lease/timestamp/digest/ACK comparison. R647 cannot be dropped onto R20 unchanged; #371 harness source dependencies are unrecovered; R818 tests a different callable path.
3. **Privacy R20 replay integrity:** conflicting or legacy-incomplete event replay is fail-closed in source; exact full Functions tests, emulator, live trigger and controlled legacy-event disposition remain unrun/unapproved.
4. **Studio→Jobs producer contract:** #390/#391 remains review-only; #391 is test-regex correction, not a positive consumer/producer pass. Actual Jobs Zod dependency/full package suite and clean exact-head run required.
5. **Studio private-media hard-offs:** consent authority and private-output write authority remain false; preserve until approved C6, source-rights and Jobs/Storage gates pass.
6. **Jobs data-rights continuation:** #377 R900 operator downgrade/disable can leave an admitted asynchronous operation continuing; privacy/legal/security policy required.
7. **Jobs worker auth/rollback:** #386–#389 review-only; no deployed middleware, Cloud Run revision, ingress, secrets or healthy-revision restoration proof.
8. **Protected CI/governance:** Jobs main unprotected and required checks off in R967; hosted runs with zero steps/startup_failure or log 404 are inconclusive. Need required checks, eligible independent reviewer and full exact-head logs.
9. **Live provider inventory:** project IDs/config are source references only; Firebase/GCP databases, buckets, versions, IAM, Cloud Run revisions/images, Functions, tasks, triggers, secrets and effective rules not read in this pass.
10. **C6→Replay→revoke→purge:** same exact source SHA, authenticated owner grant, trusted Jobs workload, source rights, private render, owner-only Replay, revocation, provider suppression, physical purge and downstream acknowledgements still not certified.
11. **Device and product acceptance:** Windows/web/iOS/Android/XR, keyboard/touch, blind/haptic, captions, reduced motion, language and AAA visual acceptance remain separate gates.
12. **Historical data continuity:** prior code/history archaeology is not user-data migration or completeness certification.
13. **Legal/operations:** Apple/Google store, billing, backups, domain/email/provider, independent review, rollback and explicit Founder GO remain separate operational gates.

## 7. Execution evidence for R969

| Operation | R969 result |
|---|---|
| Refresh exact Jobs/Privacy/Studio/Spatial PR metadata | Completed via GitHub readback |
| Read Privacy #183 verifier, receipt and consent API source at exact head | Completed; three exact blob SHAs recorded |
| Read Privacy #224 R818 test and runner source | Test source read and pinned; runner source read; R818 semantics classified |
| Read Privacy #186 and Spatial #1964 changed-file lists and Firestore Rules | Completed; current exact heads/blob SHAs recorded |
| Read Privacy issue #83 and comments | Completed; issue remains open |
| Clean Git clone / exact local worktree | NOT RUN; earlier R967/R968 host attempt returned DNS error `Could not resolve host: github.com` |
| Unit tests / typecheck / build | NOT RUN |
| R818/R836, R647 or Jobs #371 tests | NOT RUN |
| Firebase emulators | NOT RUN |
| GitHub Actions exact-head acceptance | NOT RUN in R969 |
| Firebase/GCP provider inventory / deployed SHA / effective IAM and Rules | NOT RUN |
| Real GCS stale/alternate writer 403 / in-flight drain / physical purge | NOT RUN |
| C6 grant, render, protected Replay, dispatch or private media access | NOT RUN |
| Merge / deploy / IAM/Rules / billing / paid compute | NOT PERFORMED |

The DNS limitation is an access blocker, not an application test failure. Source pins and prior reports are retained as historical scoped evidence only.

## 8. Immediate R970 execution order

1. Re-fetch current Jobs #379, Jobs main, Privacy main, Spatial main and every cited review head before action. Preserve the current R969 docs branch; do not rely on the PR base SHA if it predates main.
2. Obtain a connected, clean Git host. Verify exact commit/tree/blob IDs and lockfiles before any test. If connectivity remains unavailable, record NOT RUN and do not infer a result.
3. Inspect Privacy #186 current full diff and Spatial #1964 current full diff plus the intended Firebase project topology. Establish whether Privacy and Spatial share a project/database, which service owns each Rules deployment target, and whether a reviewed combined Ruleset exists.
4. Create an explicit field/collection/action matrix for C1 consent record readback, profile UID/userId/ownerId, ten protected server-owned fields, deletion tombstone and planning lease semantics, admin/founder claims, and both service's private collections. Resolve any intentional policy differences with owners; do not deploy a whole service Ruleset over the other.
5. Execute each exact source track independently: R647 dispatcher/contract tests; Jobs #371 harness only if its exact compatible Privacy modules are recovered; Privacy R818 #224 against its exact Jobs pin; and R836 #232 using its own exact runner and required build/emulator gates. Capture source refs, trees, tool versions, commands, raw logs and exits. Do not combine results.
6. Resolve the missing #371 `consent-jobs-*` provenance from an identified archive/workspace or repository. If absent, propose a newly authored harness rewrite under a distinct name and review; never call it historical recovery.
7. Reconcile R20 event immutable digest/prior grant lineage with the selected dispatcher/Jobs receipt, ACK transport identity, retry and crash-safe idempotency. Owner/security/legal decision required before any protocol replacement.
8. Run full Jobs producer/consumer Zod check for #390/#391 on a clean exact head; ensure the correction is not duplicated or mis-merged.
9. Re-establish protected CI and independent reviewer; execute full native disposable Firebase suites on one source manifest.
10. With explicit owner authorization, inspect real provider state read-only. Only after independent review and a staging plan may controlled disposable staging test stale/alternate privileged Storage writer rejection, upload drain, generation-pinned delete, final absence and durable downstream ACK.
11. Complete the same-source authenticated C6 grant→private render→protected Replay→revoke→physical purge lifecycle; complete device/accessibility/product/legal/operations gates.
12. Keep production HOLD until independent certification and explicit Founder GO.

## 9. Hard boundaries

- Do not merge any draft PR or rebase/overwrite historical evidence.
- Do not deploy Privacy or Spatial Rulesets until project mapping and combined authority are verified.
- Do not enable C6 issuance, dispatch, rendering, private-output writing, provider calls or publication.
- Do not process real private media or customer records.
- Do not change IAM, Rules, buckets, traffic, billing, secrets, domains or provider resources.
- Do not run paid compute unless explicitly authorized for a specific accepted verification step.
- Do not report source pins, enrolled commands, synthetic tests or earlier-head receipts as current exact-head production acceptance.

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.** The existing implementations and history are preserved. The remaining milestone is exact-source integration, authenticated same-SHA lifecycle acceptance, provider verification, protected governance, independent review and explicit release approval.
