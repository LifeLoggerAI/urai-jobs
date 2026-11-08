# ONE URAI GENESIS — R887 Jobs disposable emulator identity handoff (HOLD)

Date: 2026-11-07. Exact parent: R885 Jobs PR #361, `cd46650d87846b7f142a2c814c6b7eec20a7a8ff`. Draft review, no merge/deployment.

## Source-verified defect and treatment

The R885 unified runner first defines outer negative-Storage project `urai-staging-test`, exports that value in `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, and `URAI_EMULATOR_PROJECT`, then launches the nested four-emulator Jobs runner whose project is `demo-urai-jobs`. R885 explicitly overrides these three for the nested stage, but **does not clear inherited `FIREBASE_PROJECT_ID` or `CLOUDSDK_CORE_PROJECT`**. If either was set to the outer disposable project, the inner runner correctly rejects the mismatch. R887 clears exactly these two variables at the nested `env` invocation while retaining independent demo overrides; outer controls continue refusing non-staging inherited project values. This is an acceptance launcher preflight reliability fix, not proof that native Firebase has run.

Peer Jobs PR #360 (R884) independently hardens the inner runner against implicit Functions dotenv/secret files and symlinks. R887 reuses exact Git blob `67ae8515bd206456c8d181ff52ef173e67f65cc2` from that reviewed branch for `scripts/run-r879-jobs-native-auth-acceptance.sh` and original ten-fixture source test blob `edbb4fc44f026d1d972021020ca4198d0561c79b`; does not import PR #360's older quota-lock source or its unrelated package configuration.

R887 adds four-case source-contract `scripts/r887-disposable-project-handoff.test.mjs` Git blob `5d6aa48ab8111280f983f05821209c60b9a92299`, validates original outer staging choice, new nested override/unset, two inner pre/post-build secret checks, peer fixture enrollment, and strict blob pins. Root package blob `73e051933c274ab12b49e8aaf4e8bd2b3800361e` enrolls both peer R884 and R887 source tests. Unified runner blob `cfd70516fa453683cb5d06e062151f196b1a80b1` pins both exact scripts, package and tests; logs ten peer source cases and four handoff source cases with explicit failure exits.

## Evidence standard

GitHub connector readback inspected exact five changed files and eleven structured source invariants, all true. **These are source inspections, not eleven executed Node tests.** The exact 10/10 R884 fixture execution is an earlier peer's separately attached receipt on PR #360; it cannot be counted as execution on R887 until reproduced at R887's exact full commit. R887's four new Node cases have NOT yet executed. GitHub Actions on parent R885 #361: ten workflows marked failure, sampled jobs returned zero steps and GitHub job log archives 404 BlobNotFound; callable E2E skipped. This does not diagnose a specific code test failure nor attest a pass.

Local runner has Node 22 but no pnpm and cannot resolve github.com for a complete checkout. No fresh full `pnpm install --frozen-lockfile`, full typecheck/build, Firebase Auth/Firestore/Functions/Storage emulator acceptance, real 14-request quota contention, GCS IAM/privileged 403, in-flight writer drain, signed C6 consent, private Studio movie or Replay proof, or physical-device acceptance performed.

## Next pinned acceptance

From a clean exact R887 detached Git checkout with Node 22, pnpm 8.15.9, Java 21, no cloud/provider credentials, and no billable services:

```sh
node --test scripts/r884-emulator-env-isolation.test.mjs
node --test scripts/r887-disposable-project-handoff.test.mjs
pnpm install --frozen-lockfile
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)" bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
```

Preserve raw logs, exact source SHA, tool versions, failure exit codes and log hashes. Separately reconcile PR #359 R886 owner execution authorization and PR #355 current manual operator authorization against THIS source; do not silently graft or replace the atomic R883 quota changes.

**Production HOLD**: protected privileged Storage post-revocation future-write 403 and in-flight drain (Jobs #252), owner callable authorization (#337), deterministic quota acceptance (#345), deployed index readiness, signed C6, complete Privacy/Jobs/Studio/Replay runtime and owner-authorized production cutover. No real customer data, production IAM, paid compute, or release changed.
