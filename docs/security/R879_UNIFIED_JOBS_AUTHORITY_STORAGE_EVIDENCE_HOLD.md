# R879 — Unified Jobs authority + protected Storage review, evidence-grade HOLD

**Date:** 2026-11-07 UTC  
**Repository:** LifeLoggerAI/urai-jobs  
**Current source at time of review:** `87364093f3a1b2da4a9fb2a0b0a0092caed128fd`  
**Review PR:** #346, not main, no deployment or activation  
**Safety:** protected private media creation remains hard-off; P0 #252 and P1 #337 OPEN

## Exact two-parent source lineage

R879 functional convergence `99b0481f0512bd5f0206ea15ae1cdb8b192f34d1` has the original ordered parents:

1. Jobs operator/owner/tenant and admin parser convergence `f42a96b538b81f31d08eee9331171d353a640e3b` (#343).
2. Jobs review-only private Storage generation convergence `d51a66a4c7433c2b58fa7d789f82c4f38d8983ba` (#336).

GitHub comparisons against shared Jobs #320 base `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e` showed 15 authorization changed paths vs 19 Storage changed paths. The **sole overlapping path** was `package.json`. A complete `truncated=false` 1,405-entry Storage tree supplied exactly 18 reviewed original blob overlays on the authority tree. The root verification command was subsequently reconciled without removing either suite. Other worker PRs are unchanged.

## Verified local source-level acceptance

Four source suites were run **together** on exact original GitHub-matched local blobs, Node v22.16.0:

```sh
node --experimental-strip-types --test \
  scripts/r877-owner-scope-guard.test.mjs \
  scripts/r878-owner-scope-read-cancel.test.mjs \
  scripts/life-movie-generation-evidence-review.test.mjs \
  scripts/life-movie-generation-evidence-matrix.test.mjs
```

- **34/34 PASS**, zero failures, process exit 0.
- Full TAP stdout **SHA-256 `f6595e250ff1b4c1ab99ef19ac0cae304e0feba4252bf2d92a8ac1c877d2016e`**.
- Actual tested paths' Git blobs: owner helper `cd60013bcd188dc59d97a48ac1cce02f7625508d`; owner test `4c4b6a4cbdb28d6d488c07aed4e53fceb80602f6`; read/cancel/status test `1533fca349d9eab317b9c37c4f3f389c7ac896c5`; Storage helper `5e0e94736aa783d20e3b5158ac3204ce25e89972`; two Storage tests `a2b6d7118b0341f48c343724ae9408d7935c23b3`, `39d73f873714d4c35106b08b164f2036431cda50`.
- Reviewed getJob, cancelJob and getJobStatus code exact Git blobs `fd7d04c76907bbd819568336f2c237b8819d738a`, `3c126dd251a6ad241fb6a5a63b1294e5b8a4403c`, `a198db9694e7352f470c8dbd399dd4af01bd65a4`. All three + helper parsed with TypeScript 5.8.3 **0 parser errors**; helper standalone strict tsc exit 0.
- Retained original admin brace fixes `admin.ts` blob `67cb0e314a47d7ca075e9cb3c17b3b0d29cbe3e5`, `admin-v2.ts` blob `84104f5697314a3bccda87d538ad1c5e21a26070` and fail-closed TypeScript parser regression `dc06b34c56693d7ee8496740c158102e5ebce917`.

The 34 results demonstrate **standalone owner/scope logic and Storage generation decisions**, plus source-structure assertions. They are **NOT 34 authenticated Firebase emulator cases**, full Jobs build, private playback proof, production authentication, or actual GCS IAM denial.

## Unified native runner (prepared; NOT executed)

A new `scripts/run-r879-unified-native-acceptance.sh`, Git blob `d740ddd9de0c1bcd6c2fd12641dcf87d35747aa8`, was added from the prior review-only R876 runner. It requires a full clean original checkout with R879 two-parent ancestor, explicit disposable-emulator flag and exact SHA, Node 22 + pnpm 8.15.9, absence of inherited credentials/projects/buckets, and exact critical source Git blobs. Its specified test sequence includes the original R854 seven-stage negative native suite (frozen installation, verification, typecheck, build, emulators), both 17-test pure suites, and source-defined nine-case physical-generation Firebase broker suite. It refuses production authorization and prints a final HOLD.

**Caution:** At this checkpoint, local transfer of the GitHub runner into this environment failed, so its `bash -n`, actual fail-closed preflight, and native execution are **NOT verified at R879**. A reviewer must perform those before interpreting its output. A previous R876 related runner's successful preflight does not transfer certification to R879.

## Remaining mandatory release blockers

1. Independently compile the **entire unified source tree** with frozen `pnpm install`, `urai-jobs:verify`, Functions typecheck/build, and retained original tests.
2. Run native Auth+Firestore+Functions test for current role downgrade, user deletion/disable, cross-tenant jobs/log access, cancellation/retry, status and createJob transaction/idempotency races.
3. Execute the original nine-case Firestore+Storage physical generation broker and R854 seven native security stages at this exact review source.
4. Verify **actual storage data-plane denial** (403) for all retired/alternate privileged GCS writers, approved principal/bucket inventory and all inherited IAM. Storage emulator/Admin SDK tests are not evidence of effective GCS IAM.
5. Implement and prove exclusive production writer, pre-byte reservations, monotonic revocation fence, in-flight upload drain and final exact-generation deletion before acknowledgment.
6. Verify genuine owner-signed C6/source rights, revocation-safe Studio rendering, owner-only protected Replay and physical-device accessibility.
7. Independent security/release review, rollback rehearsal, authoritative founder GO.

**No main merge, production deploy, IAM change, credential minting, customer media, paid compute or release authorization occurred. One UrAi Genesis remains HOLD.**
