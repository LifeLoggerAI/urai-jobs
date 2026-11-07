# R877 — transactional tenant/org identity on Jobs admission and idempotency (HOLD)

**2026-11-07 UTC; review-only change on existing [PR #338](https://github.com/LifeLoggerAI/urai-jobs/pull/338), original source [#320](https://github.com/LifeLoggerAI/urai-jobs/pull/320) `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`. No user data, cloud IAM, positive consent, Storage upload, production deployment, source merge, or paid compute. Jobs #252 Storage P0 and Genesis release HOLD remain unchanged.**

## Concrete new source-only finding

- Original R876 patched `functions/src/jobs/createJob.ts` reads `tenantId` / `orgId` from a user profile before its idempotency-binding check/rate-limit and constructs the eventual job with those early values.
- Its final transaction verifies active role/permission and deletion status, but **does not compare current tenant/org against the values frozen earlier**, allowing potentially stale tenant metadata on a successfully created job if trusted server-side owner scope changes during admission.
- An idempotency binding identifies owner UID, job type, key and fingerprint; a previously bound job may refer to an old tenant/org. R876 checked current authority but not the tenant/org of the prior bound job. This is a **source-observed potential inconsistency**, NOT a demonstrated native exploit.

## Safe isolated code correction

1. New `sameCurrentJobOwnerScope(initialUser,currentUser)` compares normalized tenantId and orgId. **Both** the creation transaction and early idempotency-hit read transaction refuse a scope change (failed-precondition). Existing absent legacy scope is allowed only while both profiles still lack that scope; no automatic cross-tenant migration is inferred.
2. New `boundJobMatchesCurrentOwnerScope(job,currentUser,uid)` binds historical job ownerUID, tenant and org to current owner scope. Both preexisting binding paths now read the referenced job **in the same Firestore transaction** and fail closed on missing, unrelated, or cross-scope record. No job is created on an existing-key hit.
3. Both new functions live in existing `functions/src/jobs/currentJobCallerAuthority.ts`; `createJob.ts` imports and invokes them. Other worker routes, exports, media, IAM, provider and privacy data-rights handlers are unchanged. Authorization continues to check current server-owned role, disable/deletion fence and jobs:create permission within transaction.
4. The root `urai-jobs:verify` now appends `node --experimental-strip-types --test scripts/r877-owner-scope-guard.test.mjs` so the pure source regression is in the maintained verification chain. **The entire root verify has NOT run at this head.**

## Exact independently executed original-byte evidence

- New amended helper Git blob `cd60013bcd188dc59d97a48ac1cce02f7625508d` independently reconstituted byte-for-byte from original local source, `git hash-object` matched GitHub, `tsc --strict --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext` exit 0.
- New test `scripts/r877-owner-scope-guard.test.mjs` Git blob `4c4b6a4cbdb28d6d488c07aed4e53fceb80602f6` (2,025 bytes): **exact local test file and independent GitHub readback match**. Node v22.16.0 `node --experimental-strip-types --test` **8/8 PASS, exit 0**, complete TAP stdout SHA256 `871080aa47b287f0e9fb3777dfba2a0a6c53e24a0b438361cb552301c715e35e`. Cases: unchanged tenant+org, new tenant, new org, previously bound old-tenant and old-org records, foreign owner, legacy blank scope and invalid records.
- Re-ran earlier R875+R876 original locally available source suite **17/17 PASS**, exit 0, logged TAP SHA256 `9f5d8b93a176fafa36fe1d37a2a9640e369cfd5bdb783ce4cc74d42ad3a87c6c`. The new helper rehash matched exact GitHub; these earlier test scripts were from local isolated source snapshot, not a full new checkout.
- New `createJob.ts` file was reviewed and patch source saved to GitHub, but **the whole job admission implementation was NOT executed against the original real Zod/Firestore/Functions runtime**, and no frozen workspace package install, typecheck/build, or full native emulator test was possible. Do not count 8 pure helper tests as full idempotency transaction acceptance.

## Further acceptance and key regressions to run

Exact clean current PR #338 SHA (repin before execution); Node22/pnpm8.15.9/Java21, no production variables/credentials, isolated demo Firebase auth/firestore/functions:
- Valid active owner and operator with matching tenant/org, same-key retry and original job present; confirm returns `{deduplicated:true}` with **no new job**.
- Owner scope changes between wrapper, early binding lookup, transaction; moved tenant, moved org, legacy profile upgraded to tenant, old original job from different tenant; confirm failed-precondition and zero writes.
- Missing or corrupt original bound job; owner mismatch; same key with conflicting fingerprint; verify deterministic rejection.
- 2 concurrent same-key requests, transaction conflicts and no duplicate side effects. Confirm existing create rate-limit behavior and real Firebase transaction read semantics, including read-only results and query snapshots.
- Disabled/deleted/deletion-pending owner, role demotion or removed jobs:create before both new and idempotent transactions, and foreign scope.
- Full original `pnpm install --frozen-lockfile`, `pnpm urai-jobs:verify`, `pnpm typecheck`, `pnpm build`; exact source/test/log/exit digests, separate Firebase native and downstream integration.

**Review release status:** P1 additional safety correction isolated but unmerged, original runtime certification PENDING; [Jobs P0 #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) privileged post-revocation GCS write fence, consent positive C6, protected Replay and production authorization still HOLD.
