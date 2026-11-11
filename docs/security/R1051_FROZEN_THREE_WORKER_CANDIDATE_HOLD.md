# ONE URAI R1051 — converged review candidate freeze (HOLD)

## Immutable worker custody
Jobs #431 merge `30dbffdaee77684c904750e7099762ba551e504e` + Jobs #430 linear owner/job test candidate `b8abb70c84d4001404feef62abce7a41eda8d8e7` are literal parents of this commit. The former retains Jobs #428 tested history and Jobs #429 credential-hardening; the latter contributes the additional 3 R1045 owner/job native-emulator regression cases and R1050 source tripwire. Neither parent branch or donor PR is rewritten, merged to main, closed, or deleted.

## Chosen source tree
Base is Jobs #431 tree `76695bf145a53181b77fc26ad6dcccb1c655fa01`; replace ONLY `scripts/life-movies-write-reservations.review-emulator.mjs` and `scripts/r1042-canonical-revocation-veto-wiring.test.mjs` with exact immutable Jobs #430 blob contents, and preserve #430 R1050 provenance document plus this handoff. The `package.json` blob and the actual `functions/src/privacy/lifeMovieWriteReservationsReview.ts` model were confirmed byte-identical across parents and are unchanged. The production worker `workers/studio-worker/private-output-write-authority.js` stays unconditional hard-off.

## Distinct evidence, do not inflate
- Jobs #428 exact full native verify PASS; Privacy #271 ↔ Jobs #428 exact Firebase negative transport PASS; Jobs #425 exact 21/21 emulator PASS; Jobs #424 exact 17/17 emulator PASS.
- Jobs #429 R1047 pure Node22 synthetic secret guard 7/7 PASS; source exact Git blob matched locally.
- Jobs #430 source-only 23/23 invariant checks; new owner/job test cases were NOT independently executed on #430.
- This new two-parent R1051 source must be tested at its OWN immutable SHA: frozen install/typecheck/full native + Functions build + disposable emulators and Privacy negative test. Parent results are not acceptance for R1051.

## P0 blockers / release control
- Incident Labs #370: a Runpod API credential reportedly exposed in prior provider logs. Account-side revoke/rotate and restricted audit are NOT verified. No new credential-bearing Runpod execution until containment.
- Jobs #252: real GCS IAM sole-broker writer, legacy/alternate writer denied, durable before-first-byte admit, in-flight/resumable upload drain, exact-generation deletion ACK, authenticated positive consent→Studio→Jobs→Replay and protected independent CI still outstanding.
- Other 19-repo device/accessibility/AAA visuals, billing, staging rollback and founder approvals separate.
- Production HOLD. No IAM change, no protected CI bypass, no Studio writer activation, no production deploy, no user media.
