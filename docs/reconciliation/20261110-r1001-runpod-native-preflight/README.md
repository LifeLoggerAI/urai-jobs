# ONE URAI Genesis — R1001 Runpod native preflight and permission repair

**Review only. Production HOLD / NO-GO. No native Jobs success claimed.**

## Authentic Runpod result
R1001 pod `uj7uq1vmy4ryxh` ran pinned R1000 commit `e779339d826a2e1ce74f5cd8b71bae46216cda60`, with Git source tree `edc95448d5e1131a9d99b58fa08c944c9e80ede1`. It ran Node v22.23.4 and prepared pnpm 8.15.9 but did not call `corepack enable`; observed `pnpm: command not found`. At launcher preflight it failed: `r996-safe-pinned-git-checkout.sh: Permission denied`, `R997_DENIED: Source attestation refused`, wrapper exit 2. Console log SHA-256 `db368af2f955403843fd868c4960ab3d835aae2646b09c6858f1a104469ca31c`. No dependency install, native verification, or cross-service integration occurred.

R1001 pod was stopped by connector after collecting bounded emitted logs, then independently confirmed EXITED. Stopping wipes ephemeral container storage. Container /tmp not independently archived, so treat log lines as limited evidence only. It cost listed $0.08/hour while running; no exact charge asserted.

## Remediation and local verification
Child of R1000 Jobs PR #401; branch `review/chalk-r1001-runpod-native-preflight-permissions-20261110`.
Patch invokes the R996 source verifier via `bash` rather than expecting an executable Git file mode. Regression removes execute permission from the helper and verifies the actual local launcher still invokes it. Local suite **19/19 PASS in four consecutive runs**, with controlled fake pnpm and local Git fixture. All four test log SHA-256: `650c2b7b578aceb61eabc50a3d5f173d2cd770b6f64a7a521d6c8288208b2c1d`.
Runner SHA-256 `12b8e3206d3831da1dca2c1dbe109326d63958711588179636e166c117c2d42c`; test SHA-256 `8865ba50b8a719b99f4f28e06a0a9f812f5f31973450b411212fdb15b3ec3ccc`.
Separate operational correction required in any next Runpod bootstrap: `corepack enable` **before** `corepack prepare pnpm@8.15.9 --activate`; this bootstrap correction was identified, **not retested on Runpod** in this round.

## Live custody and billing
R954 and R955 previously emitted repeated clone destination errors; after R1001 stop, fresh Runpod inventory unexpectedly reported both old Pods EXITED. No stop commands were issued for R954/R955 by this continuation; no evidence of who stopped them. R950 `bvandlyauxhevl` remained RUNNING at listed $0.08/hour. Old pod containers had no persistent mounts; complete /tmp evidence was not exported. Account-wide billing earlier returned $9.439849980482904 for its 23 returned hourly buckets, including endpoints and storage; not benchmark-only.
Do not present previous R954/R955 log hashes as archived log content.

## Next approved execution
Obtain independent review, restore protected GitHub Actions, execute genuine pinned Node22/pnpm8 frozen install in isolated bounded environment with `corepack enable`, preserve artifact contents externally before stopping, verify real native Jobs suite and authenticated Privacy->Studio->Jobs->protected Replay->revocation/deletion. No automatic production release or merge. HOLD / NO-GO.
