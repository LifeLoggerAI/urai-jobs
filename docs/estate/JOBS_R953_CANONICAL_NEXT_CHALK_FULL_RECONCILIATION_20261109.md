# ONE URAI GENESIS — JOBS R953 canonical full next-Chalk reconciliation

**Checkpoint:** November 9, 2026 UTC. **RELEASE VERDICT: PRODUCTION HOLD / NO-GO.**  
**Actions in R953:** authenticated GitHub source/CI readback; safe isolated local Node test and mutation control; **documentation only** in review branches. No credits, TinyFish, paid compute, live GCP/Firebase IAM/Rules, real customer jobs/media, deploy, merge, production mutation or release authorization.

## 0. Start here, evidence hierarchy and preserved work

**Latest required Jobs resume entry: this R953 document.** Keep the original [complete Jobs forensic PR #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379), [R944 source/cloud matrix](JOBS_R944_SOURCE_RUNTIME_CLOUD_RESOURCE_MATRIX_20261109.md), [R944 test ledger](JOBS_R944_TEST_HISTORY_CROSS_SERVICE_EVIDENCE_LEDGER_20261109.md), [R944 P0–P3 taskbook](JOBS_R944_P0_P3_TASKBOOK_AND_EXACT_VERIFICATION_20261109.md), [R944 START NEXT CHALK](JOBS_R944_START_NEXT_CHALK_20261109.md), and additive R945–R952 reviews. Genesis master source: [Labs registry #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262) at `docs/estate/00_START_HERE.md`; continuation [Labs #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304). These are review docs, **not merged governance or production source**.

Evidence grades:
- **S:** direct original Git blob/immutable Git tree/source readback.
- **L:** original test run locally with explicitly stated source fixture scope.
- **P:** historical worker report/PR/test receipt, not a current independent re-run.
- **F:** observed red/failure/explicit HOLD.
- **U:** unknown live cloud/provider state, not evidence of absence.

## 1. Exact Git authority / lineage, latest

| Item | Observed identity | State |
| --- | --- | --- |
| Jobs main branch | `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`; branch API `protected:false` | Source only; deployed source and effective rulesets unknown |
| Latest engineering child [#389](https://github.com/LifeLoggerAI/urai-jobs/pull/389) | `b865209cc352241602d8b9714672f3401aed7669` | Open draft, unmerged, review-only |
| Exact #389 code patch | `1ee17f10e300e81833ef12226b12466a64257b1e` | Package verify and R879 runner; later documentation-only commit |
| Parent [#388](https://github.com/LifeLoggerAI/urai-jobs/pull/388) | `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38` | Production-first bearer guard for 4 worker types |
| Earlier stacked reviews | [#387](https://github.com/LifeLoggerAI/urai-jobs/pull/387) Narrator Docker/auth source check → [#386](https://github.com/LifeLoggerAI/urai-jobs/pull/386) rollback fail-closed → [#384](https://github.com/LifeLoggerAI/urai-jobs/pull/384) R879 pin closure → [#383](https://github.com/LifeLoggerAI/urai-jobs/pull/383) Rules #381 + longform #382 test | Original branches preserved; not merged |
| Historic original | [#378](https://github.com/LifeLoggerAI/urai-jobs/pull/378) R940; [#371](https://github.com/LifeLoggerAI/urai-jobs/pull/371) two-parent owner/consent/quota, [#377](https://github.com/LifeLoggerAI/urai-jobs/pull/377) expected-red post-admission rights | Do not overwrite history |

Current #389 exact Git tree: **1,464 entries, non-truncated**, R879 **58/58 source hash pins match, no mismatches**, and root `urai-jobs:verify` has **78 unique command segments enrolled, not executed together**. Original immutable `package.json` blob `bd50af6bead1c62f36ada6c012123fe0c5d94da7` and R879 runner blob `8a42dcad4416d5896b4886d6c5bad079463d5324`; original R951 standalone auth test blob `d27cc3880aa2ae0387f81bb660ca340d830e22dc` required by both. **58 source pins ≠ 58 tests; 78 command segments ≠ 78 passes.**

## 2. New R953 independent original-test and mutation-control evidence (L)

R952 had *not* run the exact checked-in standalone R951 Node test; it only reran a 48-case source-expression excerpt matrix. R953 fetched original `scripts/r951-worker-emulator-auth-precedence.test.mjs` at #389 and copied it **byte-for-byte** into an isolated local fixture. Local `git hash-object` returned **`d27cc3880aa2ae0387f81bb660ca340d830e22dc`**, identical to GitHub. The four worker files in this local test were **small source-matched excerpts, NOT full original modules**, verified against original GitHub lines and hashes below.

Original current worker source blobs, from #389:
- Asset `workers/asset-worker/index.js` `b22962bdeea24d369caa6aa13d06eecb9b40f478`
- Studio `workers/studio-worker/index.js` `d63056168b53ef29f55285724eff6fe2a6b60cb5`
- Private Source `workers/private-source-worker/src/index.ts` `1fa8b8ef593b5dbecdd8f8d1e59afb4e8808ade3`
- legacy Spatial `workers/spatial-worker/index.js` `47fea308eb126e4a2e5f8eebb23a74de45417d17`

Actual Node **v22.16.0** `node --test scripts/r951-worker-emulator-auth-precedence.test.mjs` on original exact test + source-matched guard excerpts: **4/4 PASS, 0 fail, exit 0**; each test evaluates 6 environments × 2 emulator settings (48 conditions overall). Final raw TAP SHA256 **`8303246bea76d86a95fb5306823957d1fb1703cebacec3f419cffd3a2687d1a2`**, 1,136 bytes.

**Mutation sensitivity, no repository edits:** local-only change to the Asset excerpt restored the previously insecure condition without `!productionRuntime`. Running the *same exact original test* yielded **3 PASS / 1 expected FAIL, process exit 1**, with explicit assertion `Asset: original guard expression changed`. Mutation TAP SHA256 **`f5d3340a0e218716740a3bf9b68a83b3e2a8a8b8735d0cc475732c7e41e321`**, 2,270 bytes. Restoring the corrected Asset expression returned **4/4 PASS**.

**Boundary:** This verifies the genuine source-level regression test and its sensitivity *against excerpted worker source*. It does **not** execute complete worker modules, a full repository checkout, production HTTP 503/401, Docker images, Firebase emulators, authentic GCS IAM or private playback. Do not report it as current-head native or deployment security acceptance.

## 3. Source-to-deployment map and cloud inventory, with honest unknowns

| Area | Verified source identity / configuration (S) | Actual provider-side deployment |
| --- | --- | --- |
| Firebase project | `.firebaserc` alias `urai-jobs`, blob `b5e4aa9f41a4ba80f1524d34510c9ba8465bf801` | Project number/state/apps/billing UNKNOWN |
| Firebase functions | `firebase.json` blob `f001d5130f4b2583c0d5030c393586180e38172e`; Node22, source `functions`; main source declares 27 named Function exports (9 queue/execution, 9 user/admin, 9 service/bridges) | Generation/region/revision/runtime accounts/traffic UNKNOWN |
| Firestore | Client Rules current review blob `d30c3e8fbbfcbf25767501e351edcb18d6080c6d`, source 9 composite indexes in review vs 8 main; jobs, jobQueue, idempotency, outbox, consent, deletion and Studio planning source collections | Database/index state, deployed Ruleset/release, PITR/TTL UNKNOWN |
| Storage | Rules blob `eedbbe45545ecd09d8867c9d702cd00bb3b7d7be`; direct client writes denied, owner/admin reads limited by path, backend IAM bypasses rules | Buckets, public prevention, alternate privileged principals, effective object writer IAM/retention UNKNOWN |
| Cloud Run workers | Narrator canonical Docker `src/index.ts`, bearer; Asset and Captured Reality callback fencing; Studio consent/output hard-off; Private Source production bearer; legacy Spatial worker returns 501 | Actual worker existence, digest, revision, ingress, token/secret binding UNKNOWN |
| Hosting | source site `urai-jobs-563121397472`, SPA public `web/dist`; noindex policy | Effective Hosting release/domains/SSL UNKNOWN |
| Events/scheduling | Source: queue tick/retry/outbox ~1 min; reconcile ~5 min; Pub/Sub `job-execution`, terminal topic `job-terminal-events` defaults | Actual Scheduler, Pub/Sub, Eventarc, Cloud Tasks, triggers, retry status UNKNOWN |
| Security/operations | Canonical deploy WIF/secret/revision checks in source; one generic IAM bootstrap now hard-fails; actual rollback helper source can update Cloud Run traffic, old manual placeholder fixed to fail closed | IAM, WIF, live secret versions **metadata**, logs, quotas, billing, effective rollback and branch protections UNKNOWN |

**Caveat:** A Firebase Console URL and source configuration never establish that a live resource exists. No authenticated Firebase/GCP control-plane calls were made. Do not say “zero Functions,” “no buckets,” or “no IAM grants.”

## 4. Functional lifecycle completion / security classification

| Stage | Source recovery | Current integrated acceptance |
| --- | --- | --- |
| Authenticated create/admission, owner/org/consent/idempotency, atomic quota | Implemented/reviewed, several pending branches; current actor binding checks documented | Full same-head native approval **missing** |
| Queue leasing, execution, retries, stale lease cleanup, terminal outbox, cancellation | Original Functions code and earlier historical suites recovered | Current 78-root / four-emulator source head **not run** |
| Source-bound 12 active runtime job keys vs broader historical planning registry | Enumerated in R944 source matrix; includes Narrator, Asset, Studio, Communications, Private Source, Captured Reality, TinyFish web tasks | Registration ≠ working provider/runtime. TinyFish and paid execution **not authorized** |
| Studio short/longform, MP4/SRT and owner-only Replay | Rendering implementation exists; `lifeMovieConsentAuthorityAvailable() === false`, `privateOutputWriteAuthorityAvailable() === false` (intentional) | Authenticated consent-to-render-to-Replay **blocked / not certified** |
| Consent withdrawal, data-rights request, deletion receipts | Source state machine and secure Rules reviewed; historical E3 receipt supports parts | Actual GCS post-revoke late-writer deny, purge ACK, operator role withdrawal **unverified** |
| Worker HTTP ingress and callbacks | Bearer routes, callback token/lease checks reviewed; canonical script uses public Cloud Run ingress relying on app auth | Real image, request-level 503/401, ingress/IAM **unverified** |
| Rollback and release | Review #386 makes old false-success manual rollback fail explicitly; separate traffic rollback helper and provenance verifier exist | Proven restoration, guarded CI, independent approval **missing** |

## 5. Tests, failure taxonomy, and current CI

Earlier historical original receipts are in R944 ledger: Jobs #320 full older-source 695 TAP PASS; #381 static owner-field Rules 15/15; #382 original longform script 17/17 with source-matched helper excerpts and synthetic Firestore; #384 offline Git preflight 5/5; #386 rollback hard-stop 3/3; current R953 original standalone auth 4/4 on excerpts with mutation expected-red 3/4. **Different SHAs, test data and environments; not a unified 695+15+17+5+3+4 acceptance suite.**

Fresh GitHub exact #389 HEAD `b865209cc352241602d8b9714672f3401aed7669`: **10 completed Actions workflows concluded failure**. Check-runs endpoint: **13 failures and 1 Callable emulator E2E skipped**. Sample `Validate runtime` from run [42589887656](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42589887656) job `129068673620`: **zero recorded steps**; original job log returned **404 BlobNotFound**. No evidence to attribute failures to a TypeScript compile, source test assertion, GitHub billing or runner startup **without provider telemetry**. **Protected CI is not green.**

## 6. P0–P3 remaining tasks, required independent closure

- **P0 [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252):** actual privileged GCS stale/alternate writer **403 after revocation**, broker-exclusive IAM, in-flight upload drain, generation-pinned physical deletion and durable downstream purge ACK. Firestore/Storage client Rules cannot alone prove privileged IAM containment.
- **P0 cross-system:** signed positive owner C6 Privacy → Studio plan → Jobs protected MP4+SRT → Spatial owner-only private Replay → consent revocation / no cached access / physical downstream purge. Do not enable current Studio consent/private-output hard-offs before verified mechanism and approval.
- **P1 [#376](https://github.com/LifeLoggerAI/urai-jobs/issues/376):** post-admission role/tenant/org and data-rights durable worker continuation, earlier strict expected-red cases unresolved.
- **P1 [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380):** native Firebase Auth/Firestore signed client profile `dataRightsDeletionRequestId` add/change/remove denied; benign owner edit allowed; privileged deletion works.
- **P1 release:** run current exact 78 commands, build/typecheck, four real disposable Firebase emulators and protected eligible independent CI; verify actual source→deployed identity and rollback.
- **P2 [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345):** 14-concurrent createJob quota, effective 9th source index and deletion ledger races.
- **P3:** provider authenticated **read-only** inventory of Firebase app/DB/Functions/Run/Storage/Tasks/Scheduler/PubSub/Eventarc, IAM/quotas/billing/log metadata; no secrets or customer documents.

## 7. Exact next-worker commands (FREE approved, complete Git checkout only)

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git jobs-r953
cd jobs-r953
git fetch origin
git checkout --detach b865209cc352241602d8b9714672f3401aed7669
test "$(git rev-parse HEAD)" = "b865209cc352241602d8b9714672f3401aed7669"
test -z "$(git status --porcelain --untracked-files=all)"
node --version      # v22
pnpm --version      # 8.15.9
pnpm install --frozen-lockfile
node scripts/r946-r879-source-pin-preflight.mjs scripts/run-r879-unified-native-acceptance.sh
node --test scripts/r951-worker-emulator-auth-precedence.test.mjs
node scripts/check-secure-worker-deploy.mjs
pnpm urai-jobs:verify     # 78 distinct command segments must actually complete
pnpm typecheck
pnpm build
export URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY
export URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)"
bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
```

**Important original R879 guards:** full commit SHA, original historical ancestry, clean checkout, Node22, pnpm8.15.9, Java21, exact source hash pins, disposable `urai-staging-test` and nested `demo-urai-jobs`, no GCP credentials/buckets or paid provider token in environment; stop on first nonzero or mismatch. This may require an already-approved free test host with GitHub/network and exact lockfile dependencies. The local R953 container lacked github.com DNS and pnpm; **no complete checkout attempted successfully**. Never disable source guard or replace real authorization with a stub to manufacture green output.

## 8. Permanent handoff and required completion status

- This document: `docs/estate/JOBS_R953_CANONICAL_NEXT_CHALK_FULL_RECONCILIATION_20261109.md`.
- Machine-readable state: `docs/estate/JOBS_R953_MACHINE_CHECKPOINT_20261109.json`.
- Original R953 local exact test artifact SHA/log identities above; attached portable bundle can accompany next worker.
- Master cross-chat latest pointer in [Labs #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304). **All review branches and historical tests remain preserved**.

**Final classification:** source lineage, review security gates, local regression sensitivity and forensic documentation significantly reconciled. Live cloud inventory, current-head full native tests, real GCS IAM, cross-service private Replay/deletion and governance are not complete. **NO MERGE / NO DEPLOY / NO PAID CREDITS / NO PRIVATE MEDIA / NO PRODUCTION GO.**
