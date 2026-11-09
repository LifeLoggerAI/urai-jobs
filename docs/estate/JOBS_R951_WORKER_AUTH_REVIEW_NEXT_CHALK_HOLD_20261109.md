# ONE URAI GENESIS — JOBS R951 current review, exact source and next-Chalk handoff

**November 9, 2026 UTC | PRODUCTION HOLD / NO-GO | $0 spend | no production deployment, Firebase IAM changes, media/jobs, paid tools or merges.**

## Read-first chain

1. [Jobs #388](https://github.com/LifeLoggerAI/urai-jobs/pull/388), review-only child HEAD `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`; [R951 detailed security evidence](https://github.com/LifeLoggerAI/urai-jobs/blob/review/chalk-r951-worker-emulator-auth-boundary-20261109/docs/security/R951_PRODUCTION_FIRST_WORKER_AUTH_EMULATOR_BOUNDARY_HOLD_20261109.md).
2. [Jobs R950 worker HTTP matrix](https://github.com/LifeLoggerAI/urai-jobs/blob/docs/genesis-jobs-firebase-forensics-20261109/docs/estate/JOBS_R950_WORKER_HTTP_ENTRYPOINTS_NEXT_CHALK_20261109.md), [Jobs #387](https://github.com/LifeLoggerAI/urai-jobs/pull/387) Narrator source regression, [Jobs #386](https://github.com/LifeLoggerAI/urai-jobs/pull/386) fail-closed legacy rollback.
3. [Jobs #384](https://github.com/LifeLoggerAI/urai-jobs/pull/384) verified pin closure, original R944–R949 full forensic source [Jobs #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379); Genesis master register [Labs #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262) and [cross-chat #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304).

## R951 exact new source correction

**Observed risk:** Missing-worker-token bypass logic in Asset, Studio, Private Source and legacy Spatial treated `FUNCTIONS_EMULATOR=true` as permission to proceed even with `URAI_ENV=prod/production/staging`. The broader canonical deployment and readiness may have blocked actual processing; **NO live exposed endpoint, deployed revision or exploitation verified**. The correction makes production/staging override the test emulator flag, preserving local/test synthetic bypass and keeping all other HTTP, lease, callback, GCS and consent logic unchanged.

| Changed file | Exact R951 Git blob | Purpose |
| --- | --- | --- |
| `workers/studio-worker/index.js` | `d63056168b53ef29f55285724eff6fe2a6b60cb5` | `!productionRuntime` gates local/emulator bypass |
| `workers/asset-worker/index.js` | `b22962bdeea24d369caa6aa13d06eecb9b40f478` | Same production-first conditional with existing `productionRuntime` |
| `workers/private-source-worker/src/index.ts` | `1fa8b8ef593b5dbecdd8f8d1e59afb4e8808ade3` | `!productionRuntime()` before local/test/emulator bypass |
| `workers/spatial-worker/index.js` | `47fea308eb126e4a2e5f8eebb23a74de45417d17` | Same exclusion for explicitly disabled legacy Spatial worker |
| `scripts/check-secure-worker-deploy.mjs` | `52a2dfce62384ba0734946903944098e1411f17e` | Adds four source invariants inside existing root verification |
| `scripts/r951-worker-emulator-auth-precedence.test.mjs` | `d27cc3880aa2ae0387f81bb660ca340d830e22dc` | Standalone original-code-reading test for four workers × six environments × two emulator settings |

**Independent source readback:** all four repaired worker Git blobs match the expected production-first expressions, which also match the new test source and root-enrolled security contract (4/4). R951 immutable head's nontruncated Git tree **1,463 entries**, all R879 **57/57 pins match** (zero mismatches), and `pnpm urai-jobs:verify` still enumerates **77 unique commands**. The R951 standalone Node test was intentionally not enrolled as an unexecuted 78th command; it must be executed explicitly and logged before review.

## Exact execution evidence versus still missing

**Actually executed only an isolated source-excerpt truth table:** Node v22.16.0 ran four exact original source-derived predicate expressions over six runtime environments and two emulator settings (**48/48 PASS**). Locally preserved original log `/mnt/data/jobs_r951_verify/R951_source_expression_matrix.log`, SHA256 `065252d57407c696a545961d59df7bd7bc09bb04815d1759e656884289e6b963`. GitHub permanent [raw receipt](https://github.com/LifeLoggerAI/urai-jobs/blob/docs/genesis-jobs-firebase-forensics-20261109/docs/estate/receipts/R951_source_extracted_worker_auth_expression_matrix.log). **This does not execute the complete original worker modules, standalone new Node test, HTTP endpoints, Firebase emulators, or authenticated IAM tests.**

**NOT RUN / UNVERIFIED:** original new standalone 4-test source test against complete Jobs checkout, full strengthened security contract, full 77-command root, Node build/typecheck, native four Firebase emulators, Docker images, real HTTP auth statuses, GitHub protected CI, live Firebase/GCP resources, provider-level consent and Storage data-plane IAM. Network DNS prevented obtaining a complete Git clone in the local worker environment. Historical receipts remain tied to their earlier exact SHAs and test scopes; do not inherit or sum them.

## Next-Chalk exact commands and gates

On an independently approved **free, credential-free** host with full Git source and frozen lockfiles, Node22/pnpm8.15.9/Java21:

```sh
git checkout --detach 17b8f53ac1f4c75ac2abdd50a3bd631e61196c38
test "$(git rev-parse HEAD)" = "17b8f53ac1f4c75ac2abdd50a3bd631e61196c38"
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

Then run **synthetic HTTP auth negative** tests with `URAI_ENV=production/staging` and `FUNCTIONS_EMULATOR=true`: 503 when no secret, 401 wrong bearer, only known dummy token allows benign guarded handler continuation; compare local/test synthetic behavior and no secret leak. Test the live approved Cloud Run image/revision/IAM only with existing authorized read-only provider credentials, no paid access or exposed customer records. Record original TAP/stdout SHA256 and exact SHA.

**Independent release P0 remains unchanged:** [Jobs issue #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) real privileged GCS writer 403 after revocation, upload drain, exact-generation purge ACK; positive owner-signed Privacy C6→Studio→Jobs protected MP4/SRT→Spatial owner-only Replay→deletion; [#376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) data-rights durable continuation, [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) native Rules, production protected CI/independent approval and founder release GO. No production source deployed or actual Firebase project resource census verified.

**Preserve all peer branches, no paid credits, no main/IAM/Rules mutations, no private media, no release approval. ONE URAI GENESIS PRODUCTION HOLD.**
