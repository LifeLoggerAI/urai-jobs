# ONE URAI Genesis — R1058 no-loss R1056/R1057 review convergence (HOLD)

## Donor custody
- First parent Jobs #438: `a0a22d5bf4e89dcf007232711d13568d5329086c`, tree `585a810bee03194c4f94667f7091d7cc8bfe1dba`; strict disposable Node-options/preload defense and no-loss R1053 worker ancestry.
- Second parent Jobs #439: `c35587c97c481185895a8547ee50e5394ee72875`; owner-wide purpose withdrawal/drain review-only model and 17 synthetic tests.
- Source tree preserves Jobs #438 byte-for-byte and adds only Jobs #439's three unique paths: `docs/security/R1057_OWNER_PURPOSE_REVIEW_ONLY_17_TESTS_HOLD.md` plus `scripts/review-only/r1057-owner-purpose-drain-model.{mjs,test.mjs}`.
- Donor PRs and branches are **not** merged into production, closed, rewritten or deleted. No tests are falsely inherited as verification of this combined head.

## Evidence scope
- GitHub compared both heads: `diverged`, one distinct #438 commit and three distinct #439 commits. Their changed path sets do not overlap.
- Jobs #438 original on-disk source hashes match exact GitHub blob hashes; local Node v22.16.0 narrow security regression re-run: 9/9 PASS, 0 FAIL, TAP SHA256 `64c6673abedf5c842c248f29525ac414b27c34c81d4c046517474ccc8fd652af`.
- Jobs #439 donor reports pure review model: 17/17 PASS on exact cited source; no claim of independent new full candidate verification from this merger. Its model explicitly forbids production authorization and physical deletion acknowledgement.
- All production workers, Functions runtime and private-media-write interlocks are unchanged relative to Jobs #438. No cloud IAM, Storage, or owner-state mutations.
- As of this verification, Runpod had 412 Pods: two RUNNING (original R950 plus separate R1055 credential-free test Pod), 410 EXITED; R1055 worker owned by another concurrent agent and intentionally left untouched. Provider-side exposed-key revocation receipt still unconfirmed; no new Pods or raw logs inspected.
- Privacy #274 is pinned to earlier Jobs #437. It does NOT certify this new merge; exact pair needs separate test pin.

## P0 launch HOLD
- Runpod exposed credential: Labs #370 revoke/rotation receipt + independent incident review not confirmed.
- Jobs #252 real exclusive GCS writer, revocation-epoch admission, active-upload drain, generation-specific deletion, and post-ACK late-write denial not proven.
- Exact Jobs/Privacy native frozen install/Functions build/four Firebase emulators; authenticated positive consent->render->protected Replay->revocation; protected GitHub CI and independent approval; device/accessibility/AAA+++ visuals/rollback remain outstanding.
- Keep `workers/studio-worker/private-output-write-authority.js` unconditional hard-off. No private-memory writes, prod merge or deploy.

**Release verdict: REVIEW-ONLY / HOLD.**