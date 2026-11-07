# R878 — Jobs authorization + Storage review source convergence (HOLD)

Date: 2026-11-07 UTC. This is a **review-only merge of peer-owned Git objects**, not approval to enable protected media rendering, grant IAM, deploy workers, or merge to main.

## Exact immutable source lineage
- Parent 1, original Storage-generation and negative-denial review: [Jobs PR #336](https://github.com/LifeLoggerAI/urai-jobs/pull/336), exact SHA `d51a66a4c7433c2b58fa7d789f82c4f38d8983ba`, Git tree `fb64f3e888a20521553287f4839990e086d1154c`.
- Parent 2, original authorization, account lifecycle and job-owner-scope review: [Jobs PR #338](https://github.com/LifeLoggerAI/urai-jobs/pull/338), exact SHA `2f333b6161334cb4585beaf551f969259f5c8d17`, Git tree `e7d2a0ad9d3d7bd6105ce98bff5f6c5993ca73c0`.
- Original executable common investigation baseline: Jobs [#320](https://github.com/LifeLoggerAI/urai-jobs/pull/320) `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`.
- Independent manual two-parent merge commit `5e8806dc623533ddc75bc9f51ff000421995d875`, Git tree `13592786e5eab9a426e0071644c410b69060adc6`, with **ordered parents exactly #336, #338**. Neither parent branch modified.
- GitHub recursively enumerated and compared both complete source trees (no truncation). Relative to #320, #338 changes 14 blob paths and #336 changes 19; exactly **one common modified path: root `package.json`**. All 13 additional #338 file blobs were copied without altering a single original Git SHA onto the #336 tree. All 18 other Storage branch changes retained byte-identical to their original Git SHAs. No deletions.
- Root `package.json` metadata, other script values and the complete original verification command prefix were identical. Only its verification command suffix differed. The reviewed combined `urai-jobs:verify` command appends **both**:
  - `node --experimental-strip-types --test scripts/life-movie-generation-evidence-review.test.mjs scripts/life-movie-generation-evidence-matrix.test.mjs`
  - `node --test scripts/r875-current-job-caller-authority.test.mjs scripts/r876-current-getJobStatus-lifecycle.test.mjs && node --experimental-strip-types --test scripts/r877-owner-scope-guard.test.mjs`.
  The merged `package.json` Git blob is `2d80e1588b2840fb5e78f33cbe5e016172ce3392`. This resolves the only path conflict without deleting any worker's tests.
- Post-merge GitHub recursive tree: `truncated=false`, **1,412 total entries, 1,196 tracked file blobs**. Eight independently checked files matched exact expected Git blob identities:
  - `functions/src/jobs/createJob.ts`: `03433ab35ce0374cae58dac572985c75c3abf3b3`
  - `functions/src/jobs/currentJobCallerAuthority.ts`: `cd60013bcd188dc59d97a48ac1cce02f7625508d`
  - `functions/src/privacy/lifeMovieGenerationEvidenceReview.ts`: `5e0e94736aa783d20e3b5158ac3204ce25e89972`
  - `scripts/life-movie-generation-evidence-matrix.test.mjs`: `39d73f873714d4c35106b08b164f2036431cda50`
  - `scripts/r875-current-job-caller-authority.test.mjs`: `34a74a99803d47775a5b760bda4e69003b5067ab`
  - `scripts/r876-current-getJobStatus-lifecycle.test.mjs`: `6e36a31f9ba17dbf10ba90c79ecd4571b163319f`
  - `scripts/r877-owner-scope-guard.test.mjs`: `4c4b6a4cbdb28d6d488c07aed4e53fceb80602f6`
  - `package.json`: `2d80e1588b2840fb5e78f33cbe5e016172ce3392`.

## Fresh independent R878 execution and its limits
From the local source audit snapshot at `/mnt/data/urai_jobs_audit`, Node **v22.16.0**:
- `node --test scripts/r875-current-job-caller-authority.test.mjs scripts/r876-current-getJobStatus-lifecycle.test.mjs`: **17/17 PASS**, exit 0, complete stdout SHA256 `a7b768c6d1e021af39ca70659401ad55478186b14d2f85db1239d16d3a27a27f`.
- `node --experimental-strip-types --test scripts/r877-owner-scope-guard.test.mjs`: **8/8 PASS**, exit 0, complete stdout SHA256 `aa1ae4c57c2f2bbedf6c493ae7029ce2401b706fbb0969dabac0c981e64f073e`.
- `tsc --strict --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext functions/src/jobs/currentJobCallerAuthority.ts`: **PASS**, exit 0. Its 3,122-byte local file's original Git blob SHA matched exactly `cd60013bcd188dc59d97a48ac1cce02f7625508d`.
- The local R875 and R877 maintained test bytes matched expected Git blobs, but local R876 scripted fixture is **4,378 bytes** versus GitHub original **4,470 bytes**; therefore the 17/17 local result is not byte-identical across both test files at the merger head. **Never transfer this PASS to the entire exact merged commit as an original GitHub-byte native certification**.
- The **Storage-generation 17/17 pure tests** are earlier peer #335's independent original-byte result at its own source; they were **not rerun by R878**.
- No complete original source checkout, pnpm8.15.9, frozen install, full verify/typecheck/build, native Firebase Auth/Firestore/Functions/Storage emulator, real staged IAM writer denial, or actual private media acceptance ran here. Native clone failed because github.com DNS is unavailable, and local pnpm is absent. GitHub hosted failures with zero source steps are not test verdicts.

## Additional source risks requiring tests, not immediate blind rewrites
- `createJob.ts` enforces creation rate limit with a **separate Firestore query before** the job creation transaction. Parallel new requests may observe the same precommit count. Confirm the actual bound rate-limit contract and abuse requirements in a native concurrency suite before changing quotas/transaction structure.
- R877 validates tenant/org on current owner admission and referenced idempotency jobs. Its new helper pure tests pass, but **the full original `createJob` body has not been executed at the amended SHA** with real Firebase transaction read/transaction conflict/permission semantics.
- Do not silently modify the shared `withAuthenticatedRole` function in `core/auth.ts`; data-rights request execution and retrieval use that helper and need safe pathways even when owner deletion is pending.
- Review returned job payload/log sanitization and current vs historical role/tenant policy across Gen1/Gen2, retained worker routes and old deployments.

## Mandatory next acceptance
On a reviewed, disposable, clean checkout of the **exact** new convergence PR SHA, with Node22/pnpm8.15.9/Java21, isolated emulator/demo project and **no live cloud, Runpod or billing credentials**:

```bash
test -z "$(git status --porcelain --untracked-files=all)"
node --test scripts/r875-current-job-caller-authority.test.mjs scripts/r876-current-getJobStatus-lifecycle.test.mjs
node --experimental-strip-types --test scripts/r877-owner-scope-guard.test.mjs
node --experimental-strip-types --test scripts/life-movie-generation-evidence-review.test.mjs scripts/life-movie-generation-evidence-matrix.test.mjs
pnpm install --frozen-lockfile
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
# Then original source-pinned Jobs four-emulator, R854 negative physical bypass,
# new nine-case review-only Firestore/Storage generation, and Auth/Firestore/
# Functions callable owner/status/createJob idempotency/tenant concurrency suites.
```

Negative suites passing means prohibited effects were detected, **not** that a real privileged GCS writer has been denied. [Jobs P0 issue #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) remains OPEN until all historically capable old/alternate service identities receive actual Storage data-plane 403, in-flight writers are drained, revocation ACK cannot race a future upload, and independent signed owner C6/private Replay acceptance is proven. IAM, protected rendering and production GO remain **HARD-OFF**. Independent review required before merging the convergence into any runtime release branch.
