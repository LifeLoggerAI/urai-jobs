# R882: unified native Jobs authority acceptance — REVIEW ONLY / GENESIS HOLD

2026-11-07 UTC. This branch is a new additive child of Jobs R881 PR #348 exact source `38c9066b9646df4ac48fe8169ef44c97714431b3`, itself a child of the parser-corrected, Storage+authority convergence PR #346 `d931226fb71a6503cb4df7f9aa48c96ef3bdc941`. No existing peer branch, production Functions, IAM, or deployed system is changed.

## What was reconciled
- Retains all original executable Jobs, Storage-generation review, six admin v1/v2 parser repairs, current-user role/owner/tenant denial and the source-level R881 callable test from #348.
- Carries forward peer PR #347's **original** isolated four-emulator runner file verbatim (Git blob `67bc0b80ccebac3ac0e397a7e791dfc8f000404e`).
- Carries forward PR #347's current `r879-jobs-current-authority.firebase-emulator.test.mjs` 13,574-byte test donor Git blob `f7d8a7ba6ff0e99570b7e6c3b2e731ecafe9cdef` with three narrowly scoped improvements: (1) stale operator token after role-only demotion, **while server account remains enabled**, must fail all admin paths; (2) disabled former operator is tested in a distinct case; (3) after tenant/org transfer the same owner must be denied old job getJob, getJobStatus, cancelJob as well as old idempotency replay.
- Preserves the peer's intentional P2 issue #345 concurrent quota negative test. It may correctly **FAIL** against current quota source, which remains a separately OPEN issue. Never suppress its failure, change quota, or interpret failed native source as acceptance.

## Required evidence before PASS
On a capable authorized isolated host, independently pin the current R882 head SHA, clean full checkout, Node 22, pnpm 8.15.9, Java 21, ffmpeg/ffprobe, pinned Firebase Tools, empty production credentials and disposable `demo-urai-jobs` project. Verify the new source blob and run `node --check scripts/r879-jobs-current-authority.firebase-emulator.test.mjs`, `bash -n scripts/run-r879-jobs-native-auth-acceptance.sh`. Then execute frozen install, full root verify and typecheck/build, original R879 native Storage negative runner plus original 4-emulator acceptance and this Auth/Functions native test with actual locally minted Auth ID tokens. Pin receipts to complete exact source + versions + exit codes + TAP SHA256; no pass is claimed without raw complete native results.

The imported native runner does **not** certify production GCS IAM or a consent revocation future-write fence; the original R879 Storage negative runner intentionally observes unsafe bypass. Even a green emulator run is not release GO.

## Current outcome
Actual new branch commit and GitHub file readback will be checked separately. **No native Firebase, complete frozen workspace build, protected-media render, production IAM identity 403, signed positive C6, active-upload drain or owner-only Replay has been executed here.** CI failures on peer branches cannot be interpreted as successful CI; GitHub log retrieval was unavailable (404 BlobNotFound). Local runtime lacks pnpm, complete repository checkout and GitHub/npm DNS. Jobs P0 #252, P1 #337 and P2 #345 remain open. No paid Runpod, production Firebase, Vercel, real media, or permission changes.

**ONE URAI GENESIS: REVIEW ONLY / PRODUCTION HOLD.**
