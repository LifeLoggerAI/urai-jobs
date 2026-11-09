# ONE URAI GENESIS — Jobs R947 peer-convergence, complete source-pin audit, next Chalk handoff

**Checkpoint:** November 9, 2026 UTC. **Production HOLD / NO-GO.** $0 new spending, no paid browser, no production IAM/Rules/Storage, no user jobs or media, no merge or release.

## Start with this update

Canonical historical full Jobs audit: [Jobs #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379) R944–R946 documents, then [R946 source and verification ledger](https://github.com/LifeLoggerAI/urai-jobs/blob/docs/genesis-jobs-firebase-forensics-20261109/docs/estate/JOBS_R946_LATEST_NEXT_CHALK_AND_EVIDENCE_RECONCILIATION_20261109.md).

- Current Jobs main from GitHub Branch API: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`, branch field `protected:false`; no live GCP deployment source, Rules or IAM confirmed.
- Parent source-integrated review: [Jobs #383](https://github.com/LifeLoggerAI/urai-jobs/pull/383) `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c`. This contains original Rules security protection from #381 and byte-exact long-form idempotency original test from #382, 77 unique commands enrolled, not executed.
- R946 donor #382 `abdc13016fd83fbb4a3d7589645c1310d2344be0`: original source-script with abbreviated source-matched Studio functions and synthetic Firestore ran 17/17 PASS in worker receipt; not native complete checkout/emulator.
- **New preferred runner source-pin review**: [Jobs #384](https://github.com/LifeLoggerAI/urai-jobs/pull/384), HEAD `fd05a376f876f9b835929a2074c09f47638659e2`, stacked directly on immutable #383.
- A separate parallel narrower runner repair [Jobs #385](https://github.com/LifeLoggerAI/urai-jobs/pull/385) was created from #383 after independent discovery of the same two pin defects and documented as R947. It has been **closed unmerged as superseded by #384**, keeping both exact commits/docs but avoiding dueling release candidates. No original worker branch overwritten.

## Previously missing source-closure defects, independently verified

Full recursive Git tree for #383 (`truncated=false`, **1,455 entries, 1,238 blobs**); all 55 literal R879 `check_blob` pins compared directly against original Git tree IDs: **53/55 matching, 2 mismatches**.

| Source file | Previously pinned stale hash | Actual Git blob at #383 and original R940 parent | Outcome |
| --- | --- | --- | --- |
| `scripts/life-movies-longform-resume-transaction-contract.mjs` | `ef439bbe7a6a697ab04f2ebfc53b7e98d5466dd1` | `75d5e73151a3dd7b4726fe10251ebd63332bd165` | Fail-closed acceptance would stop before native execution |
| `scripts/r417-original-donor-longform-resume-transaction-contract.mjs` | `19969a9aa34fc19c0ebc520d39f4a368a8402a24` | `800834dcfb3db0ff5fdda54ecc83203d7a1a71a3` | Same |

These two original tests have stable exact Git blobs across R940 (#378), R943 (#381), and R945 (#383). Do not replace correct application/test source to appease stale runner hashes.

The preferred #384 candidate changes the two expected hashes and adds:
- `scripts/r946-r879-source-pin-preflight.mjs`, Git blob **`73b69cb02c5708a2fa581dea965b5c3c55a449e2`**, a read-only local Git HEAD tree checker that denies mismatched/missing/duplicate/no-pin inputs.
- `scripts/r946-preflight.test.mjs`, Git blob **`918260ac8ab90aecb5170673f14aeda094a767cc`**, five original Node/Git synthetic fixture cases; **5/5 PASS is reported in PR #384's prior worker receipt**, not independently rerun in this specific R947 documentation worker.
- R879 requires those two additional exact source blobs and enrolls a `r946_source_pin_preflight_5` stage before expensive inherited suites.

**Independent current readback in R947** against #384 immutable HEAD `fd05a376f876f9b835929a2074c09f47638659e2`: full Git tree **1,458 paths**, `truncated=false`, 57 literal R879 pins inspected, **57/57 match actual Git tree and zero duplicate paths**. The runner retains `--run-exact-review-only`, `DISPOSABLE_FIREBASE_EMULATORS_ONLY`, source SHA/clean checkout guards, nested demo-project checks and historical GCS bypass-negative stage. **This is source/Git object proof only, not a completed R879 or production test.**

**Chronology:** PR #384 and #385 independently discovered exactly the same pin drift. #384 advances the verification contract further; #385 is closed as superseded and its original evidence retained. Do not sum 55/55 and 57/57 as independent Firebase tests.

## CI, source, provider and cross-system gaps still outstanding

- #383 exact head [GitHub Actions run 42577924422](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42577924422) failed, Callable emulator E2E skipped. Earlier reviewed 10 failing workflows, 13 failed check-runs / 1 skipped, sample job no recorded steps and logs 404. **Do not infer a specific compiler, billing or runner cause without detailed job steps.**
- #384's five synthetic Git test cases are not Firebase emulators; the **entire 77-command root**, typecheck/build, original 17-case on combined full source, original R879 4-emulator Auth/Firestore/Functions/Storage, protected CI and independent review still require current exact-head execution.
- All actual Firebase/GCP resources remain **UNKNOWN** at provider plane: project number, Functions/Cloud Run revisions, Firestore indexes, Storage buckets, service accounts/effective IAM, Rule sets and deployment SHA, topics/Scheduler/Tasks/Eventarc, monitoring, quotas and billing. Source configuration proves none of those are deployed.
- P0 [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) real post-revocation privileged GCS write denial for stale/alternate actors, in-flight upload drain, physical generation-pinned deletion and downstream durable ACK **OPEN**.
- P0 signed owner-issued C6 Privacy → Studio → Jobs private protected MP4/SRT → Spatial owner-only Replay → consent withdrawal/deletion/purge **NOT CERTIFIED**; no real customer media or costly API processing authorized.
- P1 [Jobs #376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) operator post-admission continuation legal/privacy policy remains; [Jobs #380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) protected Rules binding not native tested/merged; [#337](https://github.com/LifeLoggerAI/urai-jobs/issues/337) current owner/operator reviews; P2 [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345) quota concurrency/index.
- Master registry [Labs #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262) current source head observed `b8d9a91c309e66b8cdf0ba2fb6d2aaf9e228d7aa`; cross-repo review-only [Labs #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304). These are knowledge/navigation only, not production grants.

## Next Chalk exact safe command sequence

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git jobs-r947
cd jobs-r947
git fetch origin
git checkout --detach <EXACT_40_CHAR_SHA_OF_CURRENT_JOBS_PR_384>
test "$(git rev-parse HEAD)" = "<EXACT_40_CHAR_SHA_OF_CURRENT_JOBS_PR_384>"
test -z "$(git status --porcelain --untracked-files=all)"
node --version  # Node22
pnpm --version  # pnpm 8.15.9
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

Only a *clean complete source checkout* on an already approved, free, credential-free test host. If a guard or test fails, record exact raw log SHA256 and hold; do not disable guard, force a green count or run production. Actual client signed Auth/Firestore Rules denied server field add/edit/remove 403 with valid owner displayName 200, Admin deletion write path, 14-way createJob quota and negative/positive replay all require native evidence.

**Suggested continuation:** review #384 for formal source acceptance, then full root/native CI; separately actual provider IAM/authorization and protected device acceptance. **NO MERGE / NO DEPLOY / NO NEW CREDIT EXPENDITURE / PRODUCTION HOLD.**
