# ONE URAI GENESIS — R948 Jobs full source verification inventory and original offline preflight

**Checkpoint:** November 9, 2026, America/Chicago. **Status:** **PRODUCTION HOLD / NO-GO**. **Cost authorization used:** $0. No live Firebase/GCP calls, customer data, real Jobs, secrets, paid tools, deploys, IAM/Rules changes or branch merges.

## 0. Required handoff navigation

1. Current Jobs [forensic draft #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379): earlier R944–R947 forensic files, source/cloud matrix, P0–P3 tasks, independent evidence classifications, machine checkpoints.
2. Previous [R947 peer reconciliation](https://github.com/LifeLoggerAI/urai-jobs/blob/docs/genesis-jobs-firebase-forensics-20261109/docs/estate/JOBS_R947_CURRENT_EVIDENCE_AND_PEER_DEDUP_HANDOFF_20261109.md): earlier #383 53/55 source pins, preferred repair #384 57/57 and narrow duplicate #385 closed unmerged.
3. **Preferred Jobs R879 current source candidate** [draft #384](https://github.com/LifeLoggerAI/urai-jobs/pull/384), exact inspected HEAD `fd05a376f876f9b835929a2074c09f47638659e2`. Its parent [#383](https://github.com/LifeLoggerAI/urai-jobs/pull/383) `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c` consolidates original Rules #381 and longform fixture #382. Review head is **not** main/deployed authority.
4. [Genesis master draft #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262) and [cross-chat handoff #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304). Exact current refs must be refreshed before further edits.

## 1. Exact source identity, runner guards and history (direct GitHub observations)

| Check | Observed result | Limitation |
| --- | --- | --- |
| Jobs main | `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`, GitHub branch API `protected:false` | Effective GH rulesets/deployed source not certified |
| R948 preferred head | `fd05a376f876f9b835929a2074c09f47638659e2`, open/unmerged/draft #384 | No merged release |
| Full recursive original Git tree | **1,458 entries**, non-truncated | Tree metadata, not all content bytes |
| R879 source pins | **57 expected / 57 exact tree blob matches / 0 duplicates** | Git-object integrity only, not runtime or IAM |
| R879 runner Git blob | `145641d4de868945deadb577540571783bf74eab` | Not a run receipt |
| R946 fail-fast helper Git blob | `73b69cb02c5708a2fa581dea965b5c3c55a449e2` | Source implementation only |
| R946 original five-case Node test Git blob | `918260ac8ab90aecb5170673f14aeda094a767cc` | Independent native Node fixture test below |
| R879 historical required ancestor | `99b0481f0512bd5f0206ea15ae1cdb8b192f34d1` | Git compare API returned ancestor and candidate ahead by 187 commits; required `git merge-base` not locally rerun on full checkout |
| R879 explicit invocation | `--run-exact-review-only` mandatory | Omitting flag fails before tests by design |
| Environment guards | Node22, pnpm8.15.9, exact 40-hex SHA, clean Git tree, no production secret/bucket selectors, disposable `urai-staging-test` + nested `demo-urai-jobs` emulators | Correct source guards, not execution |

Previous source head #383 had **53/55** pin matches; the corrected #384 has **57/57** because two stale resume-test hashes were repaired and two new original offline preflight sources were pinned. This is a source-contract improvement, **not proof Firebase security works**. #385 narrower duplicate was closed unmerged with evidence preserved.

## 2. New independent execution — original offline R946 tests (not previous worker claims)

R948 fetched **both exact original GitHub file contents** from #384, materialized only them into an isolated directory under `/mnt/data/jobs_r948_verify/scripts`, and ran `git hash-object` locally:

- Original helper: Git blob `73b69cb02c5708a2fa581dea965b5c3c55a449e2` — **byte-identical match**.
- Original five-case test: Git blob `918260ac8ab90aecb5170673f14aeda094a767cc` — **byte-identical match**.
- Node **v22.16.0**, Git **v2.47.3**. Actual command:

```sh
cd /mnt/data/jobs_r948_verify
git hash-object scripts/r946-r879-source-pin-preflight.mjs scripts/r946-preflight.test.mjs
node --test scripts/r946-preflight.test.mjs > R948_r946_original_source_preflight.tap 2>&1
sha256sum R948_r946_original_source_preflight.tap
```

**Actual independently executed result:** TAP v13, **5/5 PASS**, **0 FAIL, 0 SKIP**, command exit **0**. Original 5 tests verify matching immutable HEAD pin accepted; stale pin denied; absent path denied; duplicate pin denied; zero pins denied. Test fixture itself creates short-lived local synthetic Git repositories; no Firebase or app runtime used. The test result does **not** mean the R879 preflight was executed on a fully cloned Jobs repository.

**Raw unedited TAP receipt:** `docs/estate/receipts/R948_original_r946_source_preflight_node22.tap`, **840 bytes**, SHA-256 `d68d60202b792411d70c7cc33e93d463d0305a4ad554df60ebaeb8b3f9b897fa`. It was created on this documentation branch, not placed in executable #384 source.

## 3. Expanded R948 root verification inventory (original source, not tests run)

At exact #384 source, `package.json` original Git blob `4804276332491e1e57a95a2a0cec7050df3a595c` defines `urai-jobs:verify` with **77 unique top-level command segments** separated by ` && `. Breakdown by command prefix: **34 ordinary Node script commands; 28 Node test commands; 9 Node TypeScript strip-types test commands; 6 npm script aliases**.

- All **89 directly referenced** `scripts/*` / `tests/*` source paths in the 77 top-level commands were found in the non-truncated Git tree; no missing paths.
- All **6 npm aliases are defined** in the inspected package manifest.
- Expanding their first-level script definitions yielded **24 nested path references**, no missing paths. Combined direct + nested references cover **111 unique paths** (not 111 tests). This is file-existence/schema inspection, **not Node execution**, not verification of recursive imports, linked package installation, runtime environment, or multi-stage shell status.
- The original 17-case long-form idempotency script is a required top-level command and also appears under a nested consent-gate alias. It is not evidence of two independent 17-case certifications.
- The new five-case R946 preflight is enforced separately inside the guarded R879 runner, **not** in the 77-command `urai-jobs:verify` root alias. The runner includes an exact Git pin for it and a required original test stage. Next worker must run both separately.

## 4. Fresh exact-head GitHub CI inspection (no false source-failure attribution)

For exact #384 head `fd05a376f876f9b835929a2074c09f47638659e2`, GitHub Actions API returned **9 completed workflows, 9 conclusions failure**, all created November 9 around 07:29 UTC. The sampled [Runtime CI run 42579668481](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42579668481) records `Validate runtime` failed and `Callable emulator E2E` skipped. The job-step API for failed job `129035175046` returned **zero steps**; the log endpoint returned HTTP 404 with `BlobNotFound`. This does NOT establish a compiler/TypeScript/test assertion failure, nor prove a particular GitHub billing/root-cause. **No protected CI PASS, independent review signoff or current-head runtime certification.**

## 5. Historical evidence and actual cloud unknowns remain unchanged

Earlier worker receipts: [#320](https://github.com/LifeLoggerAI/urai-jobs/pull/320) 695 TAP tests PASS on an older source; [#382](https://github.com/LifeLoggerAI/urai-jobs/pull/382) controlled original 17/17 with source-excerpt synthetic Firestore; [#381](https://github.com/LifeLoggerAI/urai-jobs/pull/381) actual original owner-field static Node 15/15; [#384](https://github.com/LifeLoggerAI/urai-jobs/pull/384) prior 5/5 local Git fixtures now independently rerun by R948. None of these is a current #384 full workspace/native Firebase/provider execution.

**Provider control plane not available here:** real `urai-jobs` project ID/number, apps, Functions v1/v2, Cloud Run revisions/service accounts, Firestore databases/index states/Rules releases, GCS buckets/effective IAM, Cloud Scheduler/Tasks/PubSub/Eventarc, App Check/Auth provider config, costs, logs, quotas, billing, deployments and rollback **UNKNOWN**. Do not equate zero verified live resources with confirmed resource absence.

**Release P0:** [#252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) actual privileged GCS Storage writer `403` after consent withdrawal, alternate stale principal and in-flight upload drain, exact-generation deletion and durable downstream purge acknowledgment; signed C6 Privacy→Studio→Jobs MP4/SRT→Spatial owner-only protected Replay→revocation/deletion still **NOT CERTIFIED**. **P1:** [#376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) data-rights post-admission service authority policy, [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) unmerged client deletion binding Rules and native ID-token tests, [#337](https://github.com/LifeLoggerAI/urai-jobs/issues/337) current role/owner authority. **P2:** [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345) concurrent quota/index.

## 6. Exact next Chalk commands, safe original source and no-credit conditions

On an already approved **free, fully credential-free** runner with complete source/lockfile, working GitHub access, Node22, pnpm8.15.9, Java21 and locally installed approved Firebase tooling:

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git jobs-r948
cd jobs-r948
git checkout --detach fd05a376f876f9b835929a2074c09f47638659e2
test "$(git rev-parse HEAD)" = "fd05a376f876f9b835929a2074c09f47638659e2"
test -z "$(git status --porcelain --untracked-files=all)"
node --version
pnpm --version
node scripts/r946-r879-source-pin-preflight.mjs scripts/run-r879-unified-native-acceptance.sh
node --test scripts/r946-preflight.test.mjs
pnpm install --frozen-lockfile
node --test scripts/owner_authority_rules.static.test.mjs
node --test scripts/life-movies-idempotency-revocation-race-contract.mjs
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
export URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY
export URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)"
bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
```

Review original environment guards BEFORE invoking emulator commands. Stop at the first nonzero status, source mismatch, inherited credential, unknown billing/provider use, or non-disposable project. Record raw log SHA256, exact SHA and package versions. **Do not disable any guard, create real user jobs, run paid external services or deploy.**

The next trust-level upgrade is **same-SHA complete frozen 77-command root + Node build/typecheck + authentic disposable Auth/Firestore/Functions/Storage emulators**. The higher final release gates separately demand real GCS IAM/authorization and positive private Replay-to-purge, protected CI/reviewer, rollback and founder GO.

**NO MERGE / NO DEPLOY / NO NEW CREDITS / NO PRIVATE MEDIA / PRODUCTION HOLD.**
