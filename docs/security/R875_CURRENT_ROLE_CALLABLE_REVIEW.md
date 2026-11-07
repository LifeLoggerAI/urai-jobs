# R875 — current live Jobs callable authority review / HOLD

**Source**: original Jobs #320 at `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`; separate review branch `review/chalk-r875-current-live-job-authority-20261107`. This is a focused runtime patch, **not** a review of/merge with concurrent #333–#336 Storage generation work. **DO NOT MERGE OR DEPLOY until native review, full frozen builds and owner/security acceptance**. Jobs #252 Storage P0 and Genesis production HOLD remain open.

## Original source and security reproduction

Original functions were fetched as exact original GitHub blobs, copied byte-for-byte into the disposable local runner, and independently hashed:

| Source | Original Git object | Exact bytes |
|---|---|---:|
| functions/src/jobs/getJob.ts | `d8e128200a04e90b067390b6d730a757a50aeb87` | 1,938 |
| functions/src/jobs/cancelJob.ts | `a83e53df077bb8fa40cf49a23aed987ca08d3f84` | 2,688 |
| functions/src/jobs/admin.ts | `df75d627ded1732e944ef5db982f1ec77cbd5d48` | 4,505 |
| functions/src/jobs/admin-v2.ts | `fe7b590ab41339975abfa7102335572dba69f09e` | 4,609 |

Actual original-source TypeScript functions were transpiled and executed with in-memory Firestore and mocked callable wrappers, using Node v22.16.0. A stale Firebase token with `token.role='operator'` against a currently `{role:'user',disabled:true}` profile read a foreign job **and logs**, cancelled a foreign RUNNING job, and allowed admin-v2 list/log/retry. Ordinary non-operator foreign access was denied. **Original source diagnostic suites 5/5 + 4/4 passed**; this means the security *failure* was reproduced, not that the original authority was safe. Combined TAP log SHA256 `30a23536cb5119eab68189b48fbc9ef92bb07855d7fbd192478dda89c8a7d2dc`. No actual Auth/Firestore/Functions emulators, real tokens or production IAM were involved. Tracking issue [#337](https://github.com/LifeLoggerAI/urai-jobs/issues/337).

## Narrow correction in this review branch

- Add dependency-free `checkedCurrentJobCaller` in functions/src/jobs/currentJobCallerAuthority.ts. Use the *server-owned current Firestore user document* and current role (admin/operator/user), reject absent/disabled/deleted/marked-for-deletion/deletion-pending or inactive accounts, never honor an old token role or `uraiJobsAdmin` as a live privilege grant.
- `getJob` fetches current user, job and job logs transactionally. It denies access unless the caller is the current owner or a current active admin/operator, before returning any job/log data.
- `cancelJob` and `retryJob`/V2 check the current profile inside the mutation transaction. Admin list/log V1 and V2 also read current user in the same read transaction as their queries.
- Cancellation and retry audit logs are now created **inside** the same Firestore transaction, instead of a separate postcommit `.add()` that might recreate a log after privacy deletion.
- Existing v1 callable names, exported function names, status values and job lifecycle remain unchanged. No storage/consent/movie output code altered.

## Exactly what was executed

Original-source 9/9 combined negative diagnostic test results on clean source copy: log SHA256 `30a23536cb5119eab68189b48fbc9ef92bb07855d7fbd192478dda89c8a7d2dc`. Corrected local source: targeted current-user decision 5/5, owner-get/cancel 5/5, admin-v1 5/5, admin-v2 5/5, and one consolidated maintained regression 8/8 all **PASS** under in-memory substitutes; consolidated local stdout SHA256 `9c1761ebf4daf8f5c3ca1a4be7ba5e114c2a2b9733feb8da277a69fcedb2b3bc`. Source helper `tsc --strict --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext` **exit 0**; all five changed TypeScript files syntactically transpiled with zero TypeScript syntax diagnostics. Local standalone test executed with Node22.16.0 and existing globally installed TypeScript. No source dependencies, full workspace install/typecheck/build or Firebase emulators executed at this code candidate.

**Subsequent exact-GitHub test verification**: fetched committed maintained test blob `34a74a99803d47775a5b760bda4e69003b5067ab`, independently reproduced its Git object hash using original local bytes (6,833 bytes) and ran `node --test scripts/r875-current-job-caller-authority.test.mjs` on Node v22.16.0: **8/8 PASS, exit 0**, TAP stdout SHA256 `1b8feeb865cd6aad2c02ec909580742af44c88d473407151163953c46626a79e`. This validates exact committed test content against locally patched callable sources, not an entire fresh checkout of all GitHub-published application files. **Full frozen-source build/native Firebase remain unexecuted.**

## Mandatory next gates

1. Fetch exact review SHA, confirm all 6 source files/blob SHAs, checkout clean and run `pnpm install --frozen-lockfile`, `node --test scripts/r875-current-job-caller-authority.test.mjs`, `pnpm urai-jobs:verify`, `pnpm typecheck`, `pnpm build`, verify `tsc -p functions/tsconfig.json --noEmit`. Record runner, source SHA, exit codes and full logs.
2. Run an **original native Firebase Auth+Firestore+Functions** integration regression: create two fake owners + admin; create/test valid ID tokens, stale token after role demotion, disable/deletion, cross-tenant access, owner job cancellation, admin logs, retries and post-delete no-log recreation. Confirm Firestore transaction query semantics, rollout compatibility and no unexpected legacy role shape. **Do not use production credentials or real customer data.**
3. Review whether some operator roles intentionally rely on different trusted authority; if so, reconcile that design through a documented verified server-side issuer, never silently re-enable stale custom claims.
4. Merge only after an independent reviewer approves, the latest Jobs #320 + Storage #333–#336 ancestry and native suites are reconciled, and retained Jobs P0 #252 protected-write HOLD remains enforced.

**No production changes, IAM grants, approved positive C6, private output, customer media, or paid compute. Production HOLD.**
