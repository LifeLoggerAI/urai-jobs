# R882 — exact original admin TypeScript parse + Jobs quota index contract

**2026-11-07 UTC, source-review only; production HOLD.** New isolated child of Jobs [#354](https://github.com/LifeLoggerAI/urai-jobs/pull/354), original pinned base `150898f5f1da1d508fd84cf66ddad57941dc852f`. No production or peer branch mutation. Jobs authorization P1 #337, concurrent quota P2 #345, physical Storage future-write P0 #252 remain separately open.

## First actually executed original-byte admin parser

- Fetched original Jobs #354 `functions/src/jobs/admin.ts` Git blob `67cb0e314a47d7ca075e9cb3c17b3b0d29cbe3e5` (4,987 bytes), `functions/src/jobs/admin-v2.ts` `84104f5697314a3bccda87d538ad1c5e21a26070` (5,091 bytes), and parser `scripts/r881-admin-callable-parser.test.mjs` `ba8aa35132c701a50ef47cef142d12c120ebd8bd` (2,211 bytes).
- Reconstituted all three GitHub byte sequences into a disposable local runner and independently matched `git hash-object` with **all three Git blob IDs**. Parser was executed unchanged under **Node v22.16.0** with available **TypeScript v5.8.3** made resolvable from disposable Functions node_modules; no network or cloud credentials.
- Actual command `node --test scripts/r881-admin-callable-parser.test.mjs` **exit 0, 2/2 PASS** (each test asserts all three callables in the file have exactly one exported AST definition with a real arrow-function block and zero TypeScript parser diagnostics). Original TAP stdout SHA-256 `4ba20910d0614f77036b5727d24253b9227df1faf31abf4f9a840ec1ca70ea4c`.
- This certifies exactly the admin v1/v2 files' parser and AST shape on TypeScript 5.8.3, **not** full compile/link/runtime, Firebase SDK compatibility, TypeScript 5.7.2 pinned install, or complete Functions build.

## Additional Jobs owner/time query index finding and correction

- Jobs #351 introduced an additional owner-scoped 60-second count query **inside** the Firestore admission transaction to serialize concurrent job creation. It filters `jobs.ownerUid == uid` and `jobs.createdAt >= windowStart` with limit, without an explicit descending order.
- Original `firestore.indexes.json` Git blob `61c1bcb10a7ab570cb219d772daae27017ad8f4c` contains only the `ownerUid ASC, createdAt DESC` composite for this owner/time pair. A fresh matching **`ownerUid ASC, createdAt ASC`** composite is now added, preserving all eight original index definitions. This is a required index candidate to validate in actual Firebase index planner/deployment, not proof the production effective index has been created.
- New `firestore.indexes.json` original Git blob `7690ab3a4db2d7e83de5d6d13ebd7100cecde5bd`, 2,816 bytes; nine definitions. The runtime `createJob.ts` remains byte-identical `4c95849b3a1ecd52b1d0ab64021b2590543030a9`.
- New `scripts/r882-firestore-jobs-admission-index.test.mjs` Git blob `1d24e43d5405be0bd9f076ad019f6fb8c805b0e5`, 2,246 bytes, defines four source-contract tests for exactly one ascending owner/time index, preservation of the descending index, matching original Jobs query, and unique/valid index entries. Root `urai-jobs:verify` appends this check without dropping original checks.
- Independently fetched all four current GitHub file bodies and ran seven read-only connector-side source contract assertions: **7/7 source assertions PASS** (ascending=1, descending=1, owner filter/range present, current transaction query present, no duplicate declarations, regression enrolled, four test cases defined). This is not a `node --test` execution of R882, a real emulator query-planning test, or deployment.

## Remaining acceptance and non-claims

1. At exact clean reviewed current PR SHA on a runner with full pinned checkout and Node22/pnpm8.15.9/Java21 and Firebase 15.24.0: `pnpm install --frozen-lockfile`, `node --test scripts/r881-admin-callable-parser.test.mjs scripts/r882-firestore-jobs-admission-index.test.mjs`, `pnpm urai-jobs:verify`, `pnpm typecheck`, `pnpm build`; retain logs with SHA256, exit code and commit/lock hashes. Source's pinned TypeScript toolchain may differ from local 5.8.3.
2. Run isolated original `URAI_ACCEPTANCE_SHA="$(git rev-parse HEAD)" bash scripts/run-r879-jobs-native-auth-acceptance.sh` and test the exact Firestore inequality filter with required composite indexes in a production-equivalent staging index plan, no real credentials or user media. Confirm the corrected admin v1/v2 native endpoints, owner auth, revocation, tenant move, idempotency, 14 concurrent quota admissions and protected data-rights cleanup.
3. Keep production IAM/delivery **HOLD**; no actual old/alternate GCS privileged writer HTTP403, in-flight upload drain, positive signed owner C6, authenticated Replay protected film, physical-device experience or complete Jobs→Privacy→Studio→Replay pipeline was run here. No paid compute, deploy, IAM grants or private data operations.

**Verdict:** Exact Git blob original-source admin TypeScript parser **2/2 PASS**, new Firestore index source contract **7/7 review assertions PASS**, new native/full-build/index-deploy gates still OPEN. Jobs engine preserved and no production release authorization.
