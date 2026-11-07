# R871 — Reconcile two independent Jobs security review lines (HOLD)

**Review-only two-parent source reconciliation; NOT production release authorization.**

## Why this merge exists

Two independent Chalk workers advanced from R866 `1065851a11af2e3b2bf362fc1ac880944a2bf4e4`, on separate, non-overlapping files:

- R869–R870, Jobs PR #330 at `3cf60f1a60d6957781c3fd8df538ee4b3318f25d`, implements actual Firebase Storage emulator metadata generation readback and safe historical-generation replay in the *review-only* physical-generation ledger. This work changes `functions/src/privacy/lifeMovieWriteReservationsReview.ts`, `scripts/life-movies-review-only-physical-broker.firebase-emulator.mjs`, and `docs/security/R869_PHYSICAL_GENERATION_READBACK_REVIEW.md`. The original reviewer explicitly reported **source-defined 8 cases, not eight native passes** at R870.
- R867, Jobs PR #329 at `3b27aa5bb715224aeedb59e6e10915f29ec07e94`, hardens the *review-only* staging GCS retired-writer denial probe. It updates `scripts/review-only/staging-gcs-write-denial-probe.mjs`, `scripts/staging-gcs-write-denial-probe.test.mjs`, and `docs/security/R865_STAGING_GCS_LEGACY_WRITER_DENIAL_REVIEW.md`. Ambiguous post-request response means potential object; pre-fsynced sentinel and cleanup review survive, only definite 403 allows probing another principal.

GitHub compare `R866...R870` and `R866...R867` showed **no overlapping paths**. R871 carries the exact R870 tree and overlays precisely the three exact Git blob entries from R867. It is committed with **two parents** (R870 first, R867 second) so both workers' commit history is preserved. Neither original PR or branch is edited.

## Exact reconciled files and verification

R867 source blobs copied unchanged:

- `scripts/review-only/staging-gcs-write-denial-probe.mjs`: `911915b1335a27f5f8c48e4e6830ccb48ab917cf`
- `scripts/staging-gcs-write-denial-probe.test.mjs`: `ad6e9df897e5c2bd04971a614d7e3f6a1402c65f`
- `docs/security/R865_STAGING_GCS_LEGACY_WRITER_DENIAL_REVIEW.md`: `7aad0122883f58d2af94fa36f8a4029610f179d6`

**Independent current local replay** on Node 22.16.0 of exact Git blob bytes: `node --check` PASS and `node --test scripts/staging-gcs-write-denial-probe.test.mjs` **19/19 PASS**, output SHA256 `f9d02e01733ba43911f06ebe6cc7ba32c55b3fd7164ffea78a2ae89113279978`.

**Not completed at R871:** full frozen pnpm install, full Jobs tests/typecheck/build, and native R870 8-case Firestore+Storage emulator acceptance. The R857 6/6 physical-generation emulator and R854 7/7 negative-security receipts are original older-SHA evidence and must NOT be transferred to the new merge commit. No live GCS denial, production identity impersonation, owner-signed C6, active upload drain, protected private Replay or device acceptance was performed.

## Next exact-source native verification

On an authorized capable runner, check out R871's **exact final merge SHA**, verify clean worktree and parent tree history, run frozen pnpm 8.15.9/Node22/Java21 installation, the complete existing original Jobs verification/typecheck/build, the original `scripts/run-r854-private-storage-p0-negative-native.sh`, and the original R870 physical-generation Firestore+Storage suite with `URAI_EMULATOR_PROJECT=urai-staging-test`, plus the R867 offline 19-case probe tests. Run only against disposable emulator projects with no production credentials; require original business assertion counts, exit codes and SHA256 stage hashes.

**Truth boundary:** R871 only reconciles tested and source-reviewed review lanes. A privileged Admin client can still write after revocation, and no future-write IAM fence or revocation-safe production broker has been certified. Retired identity GCS data-plane 403 and alternate credential inventory remain unverified. Preserve the direct writer hard-OFF and all production HOLD gates. **Jobs #252 P0 OPEN; One UrAi Genesis PRODUCTION HOLD.**
