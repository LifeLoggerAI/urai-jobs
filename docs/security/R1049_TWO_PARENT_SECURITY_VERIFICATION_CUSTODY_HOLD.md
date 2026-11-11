# ONE URAI Genesis — R1049 two-parent convergence, security HOLD

## Goal and immutable parent custody

This is an actual Git merge-parent convergence, not a squash or a replacement for the parallel workers.

- First parent: Jobs #429 / R1047 credential-hardened branch, exact commit `0116a91658603c07f0635a2904d7a6c985bcd046`, tree `90f21c9135f1733ca3c1889da17ac9f43186ed4e`.
- Second parent: Jobs #428 / R1047-R1048 sibling integration, exact commit `ded67b8eed6320dfc42d0f1705996d2fa62b07f9`, tree `cbaf7ee39e78bc593048bad58387262a3ebf423a`.
- #429 inherits two-parent Jobs #426 (heads #424 + patched #425) and original #420 lineage. #428 inherits the independent Jobs #424 / #425 donor chain and was tested in a different Runpod CPU worker.
- Do not delete or close #424, #425, #426, #427, #428, #429 or their historical ancestors until an independent reviewer compares unique tests, confirms durable evidence and approves custody.
- This merge retains the complete #429 source tree plus this manifest. It does not replace any production code or enable private Storage writes.

## Source overlap and unique contributions

Direct immutable GitHub blob comparisons of parent sources establish:
- `functions/src/privacy/lifeMovieWriteReservationsReview.ts` is **byte-identical** in #428 and #429, blob `31127ac4c8b4cbe61cde18b4a8d2710d481aff77`. It remains an emulator-only transactional reference model, not a production Storage upload broker.
- #428 has a separate canonical pre-byte unresolved-attempt assertion: project review fence remains OPEN, `activeOrUnproven===1`, no revocation ACK or production authorization.
- #429 includes equivalent and stronger assertions in a distinct R1046 synthetic case, plus owner/tenant/purpose mutation checks after simulated reservation; no in-flight objects may be silently declared drained.
- #429 adds R1046 synthetic-token non-echo tests and R1047 general-purpose credential-name/unknown-alias rejection before Firebase Admin import; both are enrolled in full Jobs verify. #428 lacks those tests and should not replace them.
- All source files in the review-only simulator are non-authorizing. Original `workers/studio-worker/private-output-write-authority.js` remains unconditional `false` (blob `ea6b25f3949ec2c17f65a9da68fa9cf937e86e76`).

## Exact-source verification inheritance — separate, never conflated

- #428 exact `ded67b8eed6320dfc42d0f1705996d2fa62b07f9`: independent Runpod `v7fiz904869ml9`, targeted 4/4 PASS, frozen install, TypeScript PASS, full Jobs native PASS and Functions build PASS. Separate exact Privacy #271 ↔ Jobs #428 four-emulator negative-request rejection PASS, no C6 grant / render, Runpod `ly1g6c4pymf8xe`; see the source-pinned PR discussions.
- #425 patched exact `acef589f48018511965cba77531e70964e6dc9ac`: full native and 21/21 disposable emulator PASS. #424 independent exact `e3fb4ef5caca9bad7eeb14a77efa1692dd79e38f`: full native and 17/17 disposable emulator PASS.
- #429 R1047 helper and test blobs `96055d34a3f846e25f3b96d47d889bb11b5b57c3` and `0195dcd9488bfd683101b501f40b5d78576ba1c8` were independently byte-verified with `git hash-object` and rerun on a clean local Node 22.16 container: **7/7 PASS**. This is narrow, pure no-network regression evidence, NOT complete Jobs or Firebase acceptance.
- R1049 new merge commit requires its OWN immutable Git SHA, full frozen-install, native suite, disposable emulator and cross-service verification. Parent receipts do NOT convert R1049 into green automatically. A source/doc-only review is not a replacement for protected CI.
- The separate Privacy #271 source is pinned to #428. Its results **cannot** be attributed to R1049 unless exact-source compatibility is independently established.

## Security incident and operations gate

- P0 incident https://github.com/LifeLoggerAI/urai-labs-llc/issues/370: separate worker reported an inherited Runpod API key echoed in provider test logs. Affected old Pods were stopped and unsafe assertion was patched, but confirmed **revocation/rotation and audit review are missing**. Never reprint or retrieve the key. A stopped Pod does not invalidate a credential. Credentials must be revoked at Runpod key management through approved account controls, log access investigated, and a sanitized restricted proof retained.
- No new credential-bearing Runpod Pod launched for R1049 pending incident remediation. Only local pure tests and GitHub readback are appropriate until a clean test runner is available. Historical R950 worker remains preserved.

## Global release P0 — all remain HOLD

1. Jobs #252: provider-enforced exclusive GCS IAM writer identity, old/alternate writer HTTP403, durable pre-byte admission, no stale/GCS-finalize bypass, in-flight/resumable stream draining and post-revocation no-rewrite proof.
2. Exact-GCS-generation inventory, removal and provider-backed deletion acknowledgement after verified absence, including historical orphan objects.
3. Authenticated positive consent → Privacy → Studio → Jobs protected output → authorized private Replay → withdrawal → downstream purging/ACK.
4. Protected CI restored with independent security approval; rollback readiness; device/accessibility/AAA visual/founder acceptance; billing and distribution prerequisites.

**Production HOLD.** No merge to protected main, IAM modification, private media write activation, live customer storage, app deployment or release GO from this handoff.
