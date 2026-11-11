# ONE URAI Genesis — R1056 NODE_OPTIONS preflight hardening (review-only/HOLD)

Base Jobs #437: `65c746bdc8f1c39db417ce7cf978e1e29b8aac16`. This preserves the R1053 no-loss multi-worker merge, and Privacy #274 remains pinned to the original reviewed source until any new exact pair is separately tested.

## Reproduced safety gap
Original helper Git blob `96055d34a3f846e25f3b96d47d889bb11b5b57c3` accepted inherited `NODE_OPTIONS=-r ...` and `--inspect-brk=...` (and benign options), despite checking some long-form flags. A Node preload can execute before an in-process guard. Inherited Node options must therefore be rejected in both the shell preflight (before launching Node or pnpm) and the helper.

## Patch
- `scripts/review-only/r1047-disposable-emulator-env.mjs`: fail closed on any non-whitespace inherited `NODE_OPTIONS`; only the option variable name is shown, never its value.
- Existing R1047 tests gain a regression for the short preload alias, inspect-break, and ordinary flags.
- `scripts/run-four-emulator-acceptance.sh`: before running Node or pnpm, fail if `NODE_OPTIONS` is set to a non-empty value.
- `scripts/review-only/r1056-node-options-launcher.test.mjs`: synthetic shell preflight regression, with no credentials or provider access.

## Exact-source local evidence
- Original helper and test Git hashes matched source at Jobs #437: `96055d34a3f846e25f3b96d47d889bb11b5b57c3`, `0195dcd9488bfd683101b501f40b5d78576ba1c8`.
- Original shell launcher Git hash matched `a0860c014eeddd4e73ac691d057d61a98012b42f`.
- Reproduction before patch with expanded R1047 regression: 7 PASS, 1 FAIL.
- After patch, Node.js v22.16.0 isolated harness: **9/9 PASS, 0 FAIL**; shell `bash -n` PASS.
- Final local log SHA256: `e31123fed3bcc8a3b93c9c2ce4242b00cdc8c29e6f9ee0c0c2e3e2cec44cbcd2`. Test source blob `9aaee4b16c30e44becf7e28552f98e99f1ee32d6`; helper blob `a0b72f7110790eacd00f3112266e7ce924527419`; launcher blob `277425086e6004354f56734d84b0c3e3a3e45fe6`; new test blob `8dc16348038b9e956cda04d97625539e37cbb1fd`.
- Full frozen install / Jobs native / Firebase four-emulator / cross-service positive Replay NOT run. Local git remote could not resolve github.com; source assembled using exact authenticated GitHub file reads.

## P0 gate status
Runpod incident Labs #370 still lacks affected-key revocation receipt. Full Runpod inventory: 409 pods (408 EXITED, one preexisting R950 RUNNING), left untouched. No new Pods created or key-bearing logs inspected. Real GCS exclusive-writer IAM, upload drain, physical deletion and post-revocation deny Jobs #252 are unverified. Privacy #274 exact-source acceptance, protected CI, independent review, device/accessibility/visual/rollback remain HOLD.

Do not merge this PR to main, enable private-media writes, or deploy Genesis based on these narrow regressions.