# R876 — Jobs legacy status + job creation authority reconciliation (review only)

**2026-11-07 UTC. Unmerged additive R876 changes on existing [Jobs #338](https://github.com/LifeLoggerAI/urai-jobs/pull/338), [issue #337](https://github.com/LifeLoggerAI/urai-jobs/issues/337). Base original Jobs #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`. Preserve separate concurrent Storage generation branches #333–#336 and do not deploy. Jobs #252 privileged GCS late-write P0 and Genesis production HOLD unchanged.**

## Original-source new negative finding

- Exact original `functions/src/jobs/getJobStatus.ts`: 1,641 UTF-8 bytes, Git blob `f6c3d0479ab152ade6bd6fd965614722be1889a7`, read from Jobs #320 and independently reconstructed/rehash-matched locally. Original `functions/src/core/auth.ts`: 1,648 bytes Git blob `434ffe34830d9e4db745ac51c18ff1615cf9d533`; role wrapper retrieves the current Firestore user but checks only `role`, not `disabled`, `deleted`, `markedForDeletion`, `dataRightsDeletionPendingCentralPrivacy` or `accountStatus`.
- Fresh local Node v22.16.0 original TypeScript transpile + controlled in-memory Firestore/Functions stubs ran six original source cases **6/6 PASS, exit 0**, log SHA256 `650e7cc7550045147e9f37cca224299a162e8988411026815260e57c8190ffe0`. The green cases intentionally **demonstrate unsafe status reads** by a disabled owner, deletion-pending owner and disabled operator of a foreign job. Ordinary foreign caller and missing auth correctly denied. This is a SOURCE-LEVEL NEGATIVE security proof, NOT live exploitation or Firebase native test.
- Do NOT globally disable the shared `withAuthenticatedRole` wrapper without specifically reconciling `submitDataRightsRequest`, `getDataRightsRequest`, `listDataRightsRequests` and `processDataRightsRequest`, which reuse that wrapper and may need to serve valid owner privacy workflows even after deletion has begun.

## Review-only surgical fixes in #338 (not main)

- `functions/src/jobs/getJobStatus.ts` changes only the existing v1 exported callable handler and uses `checkedCurrentJobCaller` (from R875) against current user and the requested job within one Firestore read transaction. Retains the v1 deployment identity and response type. Original `getJobStatus` still gets the wrapper's initial role guard, but **re-reads live user during transaction**, denying disabled/deleted/deletion-pending/non-active owner, and downgrade between wrapper and status read.
- `functions/src/jobs/createJob.ts` now checks `checkedCurrentJobCaller(context.auth,user)` on initial admission, then checks the current owner role + `hasJobCreatePermission` and deletion status on the creation transaction. The preexisting optional `jobIdempotencyBindings` shortcut still performs a fast read, but a hit must now recheck owner+permission+binding **inside a read-only transaction before returning a job ID**. No new job type, provider grant, Storage path, public output, IAM or consent issuer enabled.
- Root `package.json` `urai-jobs:verify` appends maintained `node --test scripts/r875-current-job-caller-authority.test.mjs scripts/r876-current-getJobStatus-lifecycle.test.mjs`. This *enrolls* tests but does not claim that root `pnpm urai-jobs:verify` was executed in this local environment.

## Evidence and honest limitations

- Local R876 patched `getJobStatus` with the original shared wrapper/helper against mocked transaction context **9/9 PASS, exit 0**, log SHA256 `c020d4a6f0b86f40cea0bf39a6e340589e4c399260dd6ff94969a6d12b570968`; an equivalent import-name-adjusted maintained script ran **9/9 PASS, exit 0**, SHA256 `e88aac4a3c86fce273f7559f060caff056ff163cb2b1791ad2edbc6816b97516`. Cases: good owner, disabled owner, deleting owner, disabled foreign operator, role downgrade before transaction, account deleted before transaction, active operator with low token role, ordinary foreign access denial, anonymous denial.
- Local patched `getJobStatus.ts` original bytes 2,340; Git blob independently verified `aeeeb175b23cb09e8694c1d8b400b228bf667096`, identical GitHub readback. TypeScript transpile syntax diagnostics zero. Existing R875 source-backed 8/8 local PASS rerun, log SHA256 `86b8873afaa1d7aac8ddb16ffaecf9847df76d77aca6a87f827b75661824417f`.
- The uploaded maintained R876 test file is **4,470 bytes**, Git object `6e36a31f9ba17dbf10ba90c79ecd4571b163319f`; it was authored with the same nine scenarios as the locally executed import-adjusted test but its **exact published Git bytes have not been rerun as a clean checkout**, so the local 9/9 receipt is NOT a GitHub-byte-identical execution claim.
- `createJob.ts` reviewed new Git blob `c325ba5200d81f8090a8d9898be942ec2c759bcb` (17,284 bytes). Changes were source-inspected but **not** exercised under original complete Zod, Firebase Auth, Functions, Firestore and queue/idempotency native runtime. Important acceptance: old claim role, profile demotion, disabled/deleted/deletion-pending owner, conflicting idempotency key, same-key retry, owner change between binding read and transaction, profile change between wrapper and creation transaction, two simultaneous requests, tenant isolation. No full workspace TypeScript check at this exact commit.
- Missing in container: full clone (github.com DNS failure), pnpm frozen dependency cache and Firebase CLI emulators. No full `pnpm install --frozen-lockfile`, `pnpm urai-jobs:verify`, `pnpm typecheck`, `pnpm build`, original source Firebase Auth+Firestore+Functions native tests or production authorization was executed. No paid Runpod, real owner media, cloud credentials, IAM, deploy, merge or C6 grants.

## Exact next acceptance / release boundary

On a clean isolated checkout of PR #338's newly rechecked exact SHA (never a moving branch), with Node22/pnpm8.15.9/Java21 and credential-free disposable project:

```bash
test -z "$(git status --porcelain --untracked-files=all)"
node --test scripts/r875-current-job-caller-authority.test.mjs scripts/r876-current-getJobStatus-lifecycle.test.mjs
pnpm install --frozen-lockfile
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
# Then source-backed ORIGINAL Firebase Auth+Firestore+Functions emulator tests for the same exact HEAD.
```

Independent reviewer must scrutinize Firestore transaction query and log-write behavior, profile authority/lifecycle semantics, legacy account fields, idempotency transaction correctness, owner-readable payload sanitation, and compatibility with Privacy data-rights flows. Merge only after complete original source builds/native emulator acceptance, with no loss of separate #333–#336 Storage evidence. **R876 does not address Jobs #252 P0 Storage write denial, live protected Replay or launch. Genesis release HOLD.**
