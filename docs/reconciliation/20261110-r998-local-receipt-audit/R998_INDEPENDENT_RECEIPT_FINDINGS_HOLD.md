# ONE URAI GENESIS — R998 independent local receipt audit (review-only)

Date: 2026-11-10 UTC. Parent: Jobs PR #398 exact head `ab0ab8a3d632d2a4d8a15dd8d6f1aabd902e6151`. **PRODUCTION HOLD / NO-GO**.

## Finding

The R997 one-shot launcher records `status=PASSED` when `pnpm urai-jobs:verify` returns exit 0. Its own 14 tests intentionally use a fake `pnpm` that returns exit 0; therefore this status proves *only a local command exit*, not real native integration, protected GitHub Actions, provider or model identity, authenticated Privacy→Studio→Jobs→Replay→revocation, or launch readiness.

The original documentation acknowledges that limitation, but any downstream aggregator **must fail closed** against `PASSED` being interpreted as certification.

## R998 local experiment

A standalone read-only Node 22 receipt auditor was authored and run locally outside this GitHub source tree. It verifies schema, evidence-class literal, exact source commit/tree provided by the caller, timestamps, duration, outcome/exit-code consistency, original metadata line, SHA-256 of the raw native log, and rejects symlink evidence files. A fake-`pnpm` zero exit is classified only as `LOCAL_COMMAND_EXIT_ZERO_UNVERIFIED`.

**18/18 local synthetic/adversarial Node tests PASS**, at one source snapshot. Source SHA-256: `dca01686a9687cb47b7879002a8b62325c839dc6c4b6ca327b53169ef05ad0ed`. Test SHA-256: `b793219e8e05588ade8f1ab739bc88f517912a6358e87e4ca99b3eb5cf04b76b`. TAP SHA-256: `73ad4e1bb0627bc0a165f2db76d918ae924709accbb63489326bd9b6f8d923d2`.

**Important custody limit:** the independently tested auditor source and tests are currently local artifacts, NOT committed in this review branch. Therefore this branch is a durable finding/handoff, not a claim of GitHub source-tested implementation. Reviewer must import the exact hashed files and re-run before admitting any new gate. No genuine Jobs native test was executed in R998.

## Remaining boundary

- No original R997 runtime source files changed; no production merge/deploy, IAM/Rules, user media or Runpod Pod mutations.
- Receipt hashes alone are *internally consistent*, not externally signed or independently attested. The report must set provider identity, external provenance, CI certification, authenticated lifecycle and release authorization to `false`.
- Current R954/R955 paid Pods still retry known clone failures; see operational Issue #397. Stop requires evidence custody; stopping destroys unmounted container-disk data.
- Required release proof remains on Jobs #252 Storage future-write fence and true positive signed consent→render→private Replay→revocation/deletion, protected CI, device and visual approval.

Sources: Jobs PRs #394/#395/#396/#398; Issue #397; Labs benchmark registry V10 #354 and mathematics R(4,6) #359, both separate from product release.

**Verdict: local evidence consistency review performed; GitHub source admission, full native acceptance, and production release remain HOLD.**

## R998 executable admission continuation — supersedes earlier "not committed" status

As of this later checkpoint, the previously external audited source is **now committed**. Preserve the original local experiment above as historical provenance; do not treat its earlier "NOT committed" statement as the present branch state.

- `scripts/r998-verify-r997-local-receipt.mjs` Git blob `f1e373a3312c424bb55d4f6855124507fce5a8fb`; SHA256 `dca01686a9687cb47b7879002a8b62325c839dc6c4b6ca327b53169ef05ad0ed`.
- `tests/r998-verify-r997-local-receipt.test.mjs` Git blob `0e980a6fa4a3c6d6b86e5a182dc549aff0e969d5`; SHA256 `704243d5ccb915b8abe7b56f9b493f0c1e5368dba6ea3ace24b754029baea5ba`. Relative import changed to `../scripts/...` for the repository layout.
- Exact local repository-layout test: `node --test tests/r998-verify-r997-local-receipt.test.mjs` **18/18 PASS**; resulting TAP SHA256 `1742242c2e8951e07bc0863f272b692d22a4b6ca14bf688d2c3d1de820b095bb`.
- `.github/workflows/urai-jobs-runtime-ci.yml` blob `344e1eb9ae3b56e5e55a552a85ecf709e7eeeee3` includes the test in both `validate` and `emulator-e2e` jobs, only once per job after Node setup.
- Connected GitHub readback matched the two tested local Git blob hashes. Review PR #399 updated to reflect executable source admission.
- Jobs protected GitHub Actions runs on the new exact head still report failure without trusted execution steps. **CI acceptance stays blocked.** This new code verifies internal consistency only and does not bridge the signed C6 issuer, physical GCS write fence, or authenticated lifecycle.
- Live R954 first logs contain a **17/17 passing subset and a different 11/14 failing longform suite** due `serverLifeMovieOwnerOrgId is not defined`; later repeat loops are clone destination failures. R955 `exit=128` still repeats. Documented separately in Issue #397. Pod container disk not durably exported; no destructive lifecycle operation.
- Release authority remains **PRODUCTION HOLD / NO-GO**.
