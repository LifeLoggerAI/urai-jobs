# R880 — Jobs atomic create quota: guarded correction, proof and HOLD

Source date 2026-11-07. Independently isolated review branch built from R879 Jobs draft #347 head `8f13f8692a865f4237a1bc43a8262d7542044cea`. Immutable parent contains original two-parent Storage+authorization source convergence #344. **No release, merge to main, production IAM, positive owner C6, private media or paid compute.**

## Confirmed pre-correction source issue (Jobs #345)
`functions/src/jobs/createJob.ts` previously used a Firestore `jobs.where(ownerUid==uid).where(createdAt>=now-60s).get()` rate-count query **outside** the job-creation write transaction. Distinct new-job requests could all read a pre-commit count of 0 and independently admit, notwithstanding the default 10/minute. Source proof of a possible TOCTOU race, not a prior native Firebase exploit certification. The R879 draft defines 14 parallel local emulator job creates but has not executed them.

## R880 review-only correction (not production)
- `functions/src/core/jobsReliability.ts`: add deterministic SHA-256 domain-separated per-UID `jobCreateRateLimitLockId()` and `jobCreateRateLimitAllowsCount()`. No UID is stored directly in the lock document.
- `functions/src/jobs/createJob.ts`: retain old fast count to reject obviously exceeded windows, but the authoritative count now happens **inside the original admission transaction**. Every newly created job of every type re-reads and writes the same server-only `jobCreateRateLimitLocks/{hashedUid}` document; then reads the latest per-owner 60-second Jobs query and throws `resource-exhausted` at the bound. All Firestore reads occur before writes. Idempotent existing-binding returns still happen before new quota consumption and preserve their server-owned current permission, owner and tenant checks. Failed Firestore `ABORTED` contention maps to retryable `resource-exhausted`, never returns false success.
- `firestore.rules`: explicitly deny all Firebase client read/write on new lock collection.
- `functions/src/privacy/dataRightsExecution.ts`: after bounded anonymization of Jobs-owned job records, delete the owner-derived lock before concluding Jobs-scope deletion; preserve central Privacy outstanding-domain acknowledgement and owner deletion fencing.
- `package.json`: enroll the original pure bounded/quota helper test and static source contract test alongside all existing Storage and R875/R876/R877 source tests in `urai-jobs:verify`. Inherited R879 native Auth/Firestore/Functions 9-group acceptance runner remains unchanged.

## Exact source receipts
- Original base candidate #347: `8f13f8692a865f4237a1bc43a8262d7542044cea`.
- R880 amended `jobsReliability.ts`: Git blob `c6b76553efd83f377b8ea8a5710f6f199a1ff9d9`, 3,047 bytes. Exact original remote content manually reconstructed into clean temporary container file and independently `git hash-object` matched.
- R880 pure regression `scripts/r880-job-create-atomic-quota.test.mjs`: Git blob `edad8920b8e8a255f326655df16cae012eb59eca`, 2,143 bytes. Exact original bytes independently rehashed. Node v22.16.0 `node --experimental-strip-types --test`: **6/6 PASS, exit 0**, full stdout `sha256:b2eda699c0cc630a14de229ac582a7bbe110c3620fd0fde8cdd5d1089146afb3`. Cases exercise 0..10 bound, negative/fractional/missing counts and invalid limits, permitted custom bound and pseudonymous canonical owner hashes.
- R880 static original-source contract `scripts/r880-create-quota-source-contract.test.mjs`: Git blob `2a754cf8bcb2b68ee3e1c49cc9537399c2b9a90b`, 3,545 bytes, reconstructed and rehashed. `node --check` **exit 0**; its full six test bodies **have not been executed** against the entire original source checkout. Connector-based independent source inspection confirmed six ordered contract properties for original changed `createJob`, Rules and deletion paths; this is not equivalent to running the maintained test module.
- `createJob.ts` blob `4c95849b3a1ecd52b1d0ab64021b2590543030a9`; `dataRightsExecution.ts` `99e2928d9a11502de60e0042456411c3c5d11513`; `firestore.rules` `5094283ee9eff1ba76dfa46de52336730266db2`; `package.json` `67d6c19ee3d6fe3222838f739e7396a561080cde`.
- Standalone TypeScript `tsc --strict` of exact helper cannot resolve `node:crypto` types in local environment because `@types/node` is unavailable; **NO FULL TYPESCRIPT PASS**. Full repo is not checked out locally, pnpm 8.15.9 absent and github.com/npm DNS failed. **No original full `pnpm install --frozen-lockfile`, `pnpm urai-jobs:verify`, `pnpm typecheck`, `pnpm build`, Firebase emulator or live GCS data-plane run occurred here**.

## Mandatory original-source acceptance
Run on an independently authorized disposable clean checkout of the precise NEW review PR head, never a moving branch; Node 22, pnpm 8.15.9, Java 21, ffmpeg/ffprobe, Firebase tools pinned 15.24.0, isolated demo credentials and no cloud production environment. Commands:

    git checkout --detach <exact-R880-PR-head-SHA>
    test -z "$(git status --porcelain --untracked-files=all)"
    pnpm install --frozen-lockfile
    pnpm urai-jobs:verify
    pnpm typecheck
    pnpm build
    URAI_ACCEPTANCE_SHA="$(git rev-parse HEAD)" bash scripts/run-r879-jobs-native-auth-acceptance.sh

Prove native Firestore transaction conflict semantics with 14+ simultaneous distinct keys and original 10/min count, prewarmed-to-9 same-owner bursts, two tenants, same-key retry, failures/retries, 60s window expiration, malformed/index-missing query, and no orphan queues/logs/bindings. Explicitly force pause after preflight / before transaction. Validate account deletion blocks new jobs and erases linkable quota records. Confirm every rejected request is an appropriate error, not an unauthorized job ID. The R879 load probe is not a deterministic barrier at the precise precommit race; add deterministic injected pause or separately prove Firestore serializable lock conflict before closing #345.

## Remaining blockers
**P1 #337** current-role/callable authentication and deletion native test still pending. **P2 #345** quota race has an isolated source candidate, not accepted native correction. **P0 #252** privileged Storage after-revocation future-write and active upload drain require real protected-staging data-plane 403 for every old/alternate writer and eventual private owner-positive rendering/Replay evidence; no emulator can replace IAM proof. Shared Genesis production **HOLD**. Neither Jobs engine nor other workers' source was rebuilt.
