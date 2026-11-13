# R1238 — Studio merged commit / Jobs merged review contract, HOLD

As of 2026-11-13. Review-only. The exact former Studio #202 PR head `501ac5c325f906cdeb32b0638dd15f5622ea1304` has been merged into Studio review tree `97a7aaf2a87697e25cbf98373259025402564d3e`. The Jobs #502 review merge commit is `7c71cb42136e9af394f11adb0a39bd12fa07d496`.

The existing `scripts/review-only/r1098-studio-jobs-exact-contract.test.cjs` is **historical** and must remain unchanged (Git blob `ef279c884bae1f00915ce9d7148d1fd93efa5cee`). It hard-pins the old Studio PR head; running it with merged Studio would reject source SHA before exercising tests.

This branch adds a separate `scripts/review-only/r1238-studio-merged-jobs-contract.test.cjs` that preserves the original contract assertions and source blob guards but pins the Studio merged review commit `97a7aaf2a87697e25cbf98373259025402564d3e`. The verified Studio bridge blob remains `9427263442d93c916516a76ae7b953585792be1a`. The verified Jobs consumer `functions/src/jobs/studioLifeMovieContract.ts` blob is `5f944e906de7243d7415ac479cf92356b09c84c9`. The new harness intentionally accepts `URAI_EXPECTED_JOBS_SHA` as the checkout's exact SHA, so it can run against the **new test-only Jobs descendant** after verifying its parent is `7c71cb42136e9af394f11adb0a39bd12fa07d496`. The original 12-case historical result is **not** being transferred to the new commit.

## Original execution to perform
On a disposable, credential-scrubbed runner with Node 22 and pnpm 8.15.9:
1. Checkout this branch's exact PR head, confirm its parent is merged Jobs `7c71cb42136e9af394f11adb0a39bd12fa07d496`, and confirm all source Git blob hashes.
2. Checkout Studio at exactly `97a7aaf2a87697e25cbf98373259025402564d3e` separately, with clean worktree.
3. Run `pnpm install --frozen-lockfile` for Jobs and retain original output and exit.
4. Run `URAI_STUDIO_ROOT=/absolute/studio/path URAI_EXPECTED_JOBS_SHA=$(git rev-parse HEAD) node --test scripts/review-only/r1238-studio-merged-jobs-contract.test.cjs` from Jobs checkout; retain TAP, process exit, SHA256, and source SHA before calling PASS.
5. Independently review all 12 intended scenarios and no unauthorized provider/storage/release authority.

## Limits and open gates
This is offline producer/consumer contract only; it is NOT a positive signed owner consent, rendering, live IAM writer/deletion, physical generation deletion, protected GitHub CI, third-party signoff or device acceptance. Jobs dependency audit previously exited 1 (0 critical, 15 high, 30 moderate, 8 low). Privacy #313 separately needs merged-head four-emulator original test. **Production HOLD_NO_GO; 11 release gates BLOCKED; private-memory writes DISABLED.**
