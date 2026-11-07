# R881 — admin callable TypeScript parser blocker

2026-11-07, review-only. Parent: Jobs R880 draft #351 at `6a69aaae48e8a9ece46374d7a063be2556efe1cf`. No changes to its quota logic, Firebase Rules, Privacy, or production release gates.

## Exact reproducible source defect
Original authorization-review `functions/src/jobs/admin.ts` Git blob `6874101a2724f614bd6c3beaf86d02a8538cbfb5` declares **all three** v1 exports with `async (data, context) =>` followed by declarations, without an opening `{`. `functions/src/jobs/admin-v2.ts` original Git blob `c267afe0aee6733e1a8a79dcddb4d23abce0014b` has the same error in all three v2 exports. These are definite TypeScript syntax defects and prevent building the current PR #351 and its parent. Prior synthetic test-mock suites do not prove original source parses.

## Surgical review correction
- Inserted exactly six opening curly braces, preserving the original bodies and their existing closing `});` delimiters.
- New `admin.ts` blob `67cb0e314a47d7ca075e9cb3c17b3b0d29cbe3e5` (4,987 source bytes). New `admin-v2.ts` blob `84104f5697314a3bccda87d538ad1c5e21a26070` (5,091 source bytes). Both read back through connected GitHub; all six exported callables retain original names and v1/v2 generation.
- Added `scripts/r881-admin-callable-parser.test.mjs`, using the actual Typescript parser resolved from the Functions workspace, asserting zero `parseDiagnostics` errors and exactly one correctly blocked exported arrow callable for each of `listJobs`, `listJobLogs`, `retryJob`, and the v2 counterparts. Enrolled in the existing root `urai-jobs:verify` after all previous R875–R880 checks; no other verification commands removed.

## Evidence limits and acceptance
The original wrong declarations and amended right declarations were independently inspected from exact GitHub blob source. Local machine has Node22.16.0 and global TypeScript, but not a full repository checkout, pnpm or native Firebase tools. **This is a source-level syntax correction; the new parser test and full original TypeScript/build/native acceptance have not yet been executed from exact PR SHA.** Do not count earlier local mocked acceptance as certification of invalid prior source.

Next acceptance on a clean original GitHub checkout of this PR exact HEAD: `node --test scripts/r881-admin-callable-parser.test.mjs`; `pnpm install --frozen-lockfile`; `pnpm urai-jobs:verify`; `pnpm typecheck`; `pnpm build`; `URAI_ACCEPTANCE_SHA=$(git rev-parse HEAD) bash scripts/run-r879-jobs-native-auth-acceptance.sh` in disposable emulators; owner/foreign/disabled/deleting/token-demotion and 14+ concurrency cases. Record Git revision, versions, exit statuses and logs. Reconcile any actual TS semantic errors (e.g. Firestore transaction query typing) separately rather than claiming this parse repair fixes the entire compilation.

Jobs P1 #337 native auth, P2 #345 quota acceptance and P0 #252 privileged real GCS post-revocation writer denial/active-upload drain are OPEN. Signed positive owner consent, protected private rendering/Replay and One UrAi Genesis **production HOLD** unchanged. No deployment, IAM, customer media, or paid compute touched.
