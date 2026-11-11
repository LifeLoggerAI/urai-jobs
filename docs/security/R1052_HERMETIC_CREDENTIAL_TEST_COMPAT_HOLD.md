# R1052 exact-source credential regression compatibility — REVIEW / HOLD

Base: Jobs #432 immutable three-parent source `38fe74bf1b05d6df3c8bb14b45dbacab453e98bd`, which preserves Jobs #431, #430 and #427 histories; all donor branches and source remain untouched.

## Reproduced contract mismatch
Original `scripts/r1046-credential-non-echo-guard.test.mjs` expected `<KEY> must be absent` from the later R1046 inline guard. But the source entrypoint now calls R1047 `assertDisposableEmulatorEnvironment(process.env)` before the legacy guard and before Firebase Admin imports. The R1047 helper throws a value-free `R1047_DISPOSABLE_EMULATOR_ENV_DENIED:CREDENTIAL_PRESENT:<KEY>` instead, so the original R1046 test assertion fails despite correct stronger denial. This is a deterministic test-expectation mismatch, not evidence of a secret disclosure.

This child changes **only the R1046 regression** to require the more stringent R1047 denial reason for the same four synthetic canary variables, and confirms the preflight is before the older guard. It retains the no-credential-value-in-stdout/stderr invariant and remains review-only.

## Evidence
Standalone Node 22 isolated local run of exact committed R1047 helper + test sources (Git blob IDs `96055d34a3f846e25f3b96d47d889bb11b5b57c3` and `0195dcd9488bfd683101b501f40b5d78576ba1c8`) passed 7/7 tests. Source-level reproducer with a synthetic RUNPOD_API_KEY confirmed: legacy expectation false; R1047 denial true; sensitive value not included in exception. The new complete Jobs head has **NOT** passed frozen install/full Jobs verify or native Firebase emulator. Do not reuse these narrow results as exact-head integration certification.

## P0 HOLD
Labs #370 reported prior Runpod API key exposure; actual provider revoke/rotate and access audit remain unverified. New credential-bearing Runpod tests withheld. Jobs #252 real cloud-enforced exclusive GCS writer/IAM denial, in-flight upload drain, generation-specific deletion ACK, positive authorized Replay, protected independent CI/review, device/visual/rollback signoff remain unmet. Studio private output hard-off unchanged. No real credentials read, no production IAM, user media, deploy, merge to main or release approval.
