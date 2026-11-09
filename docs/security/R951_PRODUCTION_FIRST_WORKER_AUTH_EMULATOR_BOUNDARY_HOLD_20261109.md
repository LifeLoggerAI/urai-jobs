# ONE URAI GENESIS — R951 Worker bearer-auth production/emulator precedence reconciliation

**2026-11-09 UTC | REVIEW ONLY | PRODUCTION HOLD / NO-GO | Incremental cost $0.** No secrets, real customer jobs/media, paid tools, Firebase/GCP read/write, CI bypass, branch merge, production deployment or public endpoint use.

## Evidence and immutable parent
- Child of [Jobs #387](https://github.com/LifeLoggerAI/urai-jobs/pull/387) exact original HEAD `04592f8573c708954f95f87ddca1e168efde51f4`, which itself inherits [Jobs #386](https://github.com/LifeLoggerAI/urai-jobs/pull/386) rollback fail-closed and [#384](https://github.com/LifeLoggerAI/urai-jobs/pull/384) 57/57 R879 source pins.
- Legacy and current source evidence preserved in [Jobs forensic #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379) and [Labs cross-repo #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304).
- R951 new branch `review/chalk-r951-worker-emulator-auth-boundary-20261109`, no original peer modifications, no application behavior changed outside missing-secret bypass predicate in four worker authentication functions.

## Concrete original-source issue and bounded fix

The existing Asset, Studio, Private Source and legacy Spatial `requireWorkerAuth` each allowed a **missing** worker bearer secret whenever `FUNCTIONS_EMULATOR=true`, even if `URAI_ENV` was production or staging. Current canonical deploy source sets `URAI_ENV` and service tokens and production readiness may prevent actual dispatch, so **no live exploitation or production service state is established here**. However, authentication must fail closed regardless of other readiness conditions. This is defense in depth against an accidentally inherited emulator env flag, not a claim a deployment currently uses that flag.

| Original worker file | Original Git blob → review Git blob | Change |
| --- | --- | --- |
| `workers/studio-worker/index.js` | `1b0e1fbcc76b4e9fc2fbd58863a33723f4513973` → `d63056168b53ef29f55285724eff6fe2a6b60cb5` | Production/staging explicit exclusion before local/test/emulator bypass |
| `workers/asset-worker/index.js` | `c2c720701a5de07cb747e03159335eca48604fc0` → `b22962bdeea24d369caa6aa13d06eecb9b40f478` | Reuse existing `productionRuntime` to prohibit emulator bypass under production/staging |
| `workers/private-source-worker/src/index.ts` | `ec3f28af4bc0c42c46bc2da3350ecc999ec449ef` → `1fa8b8ef593b5dbecdd8f8d1e59afb4e8808ade3` | Guard local/test and emulator exception with `!productionRuntime()` |
| `workers/spatial-worker/index.js` | `1265e08e45be23d24986e90dc367888ff40346ae` → `47fea308eb126e4a2e5f8eebb23a74de45417d17` | Same production-first behavior, preserving legacy worker's hard-coded 501 rejection |

Existing bearer equality, non-empty-token 503, bad-token 401, real job validations, callback checks, protected Studio private-output hard-off and production worker environment declarations remain unchanged. Authorized local/test and nonproduction emulator behavior is preserved. Narrator already had strict no-token denial regardless of env and Captured Reality's exemption already depends on `!productionRuntime()`, so neither was altered.

**Regression gates:** original root-enrolled `scripts/check-secure-worker-deploy.mjs` updated from Git blob `cfbbf163c2800f58d8b2ccf41f9e31c0402351bb` to `52a2dfce62384ba0734946903944098e1411f17e`; four new source-string invariants stop future reinstatement of unconditional emulator permission. Added `scripts/r951-worker-emulator-auth-precedence.test.mjs`, Git blob `d27cc3880aa2ae0387f81bb660ca340d830e22dc`, which reads the actual checked-in auth predicate from each worker, tests six environments × two emulator settings × four workers (48 evaluated conditions), and rejects unexpected source expression changes.

## Actual execution versus missing test evidence

**Executed locally:** A separate isolated source-extracted expression matrix at `/mnt/data/jobs_r951_verify/source_expression_matrix.mjs` ran on Node22.16.0 and returned **48/48 PASS**, no exceptions: production, staging and prod always reject missing-token bypass even with emulator true; local/test still allow synthetic missing-token bypass. Raw one-line execution receipt SHA256 `065252d57407c696a545961d59df7bd7bc09bb04815d1759e656884289e6b963`. Each expression was independently compared against the exact original GitHub source and checker readback on the new review branch and matched **4/4**. **This is a source-extracted expression test, NOT full original Node test of all four worker files, HTTP ingress, Firebase emulator, package build, or real runtime service.**

**New original standalone test file added but its complete full-checkout execution remains NOT_RUN** in this checkpoint; it must be run against the complete checked-in source. Existing root `pnpm urai-jobs:verify` still has **77 unique commands** including the strengthened checker; we did not add an untested 78th root command or invalidate the 57 R879 source pins. Next reviewer must invoke the standalone R951 test separately and preserve its original TAP output before any promotion.

## Exact safe next worker commands

On independently approved **free, credential-free**, completely cloned immutable R951 SHA (refresh moving branch first), Node22, pnpm8.15.9, Java21 and no live credentials:

```sh
git checkout --detach <EXACT_REVIEWED_R951_FULL_SHA>
test "$(git rev-parse HEAD)" = "<EXACT_REVIEWED_R951_FULL_SHA>"
test -z "$(git status --porcelain --untracked-files=all)"
pnpm install --frozen-lockfile
node --test scripts/r951-worker-emulator-auth-precedence.test.mjs
node scripts/check-secure-worker-deploy.mjs
node --test scripts/narrator-worker-auth.test.mjs
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
export URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY
export URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)"
bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
```

First compare all R879 source pins against the same immutable Git tree, no production cloud identities. Further run synthetic actual HTTP middleware tests with `URAI_ENV=production` and `FUNCTIONS_EMULATOR=true` proving 503 without token, 401 wrong token, and with a valid dummy token only authorized route progression; repeat with staging and local/test. Capture exact raw logs, exit, ID tokens, approved emulator identity, no real job or media generation.

**Release P0 remains separate:** [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) actual privileged GCS stale/alternate writer 403 post-revocation, active-upload drain, exact-generation purge ACK; signed Privacy C6 → Studio → Jobs MP4/SRT → Spatial protected Replay → deletion; [#376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) data-rights continuation and [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) native Rules. Effective live Firebase/Cloud Run/GCS IAM, CI/reviewer, rollback and founder GO are unverified.

**No merge, deployment, costs, private data or launch authorization. ONE URAI GENESIS HOLD.**
