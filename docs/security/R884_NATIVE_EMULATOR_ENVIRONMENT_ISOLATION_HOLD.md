# R884 — Firebase native emulator configuration isolation (review-only, HOLD)

Date: 2026-11-07 UTC. Parent [Jobs draft #358](https://github.com/LifeLoggerAI/urai-jobs/pull/358) at source-pinned `c77715b948bb4926f78a0a3fcb82dac638f39a35`. No processing, privacy, consent, provider or production source modified.

## Reproduced source security gap

Original native runner `scripts/run-r879-jobs-native-auth-acceptance.sh` (Git blob `67bc0b80ccebac3ac0e397a7e791dfc8f000404e`) prohibited an existing `functions/.env.demo-urai-jobs` but **did not reject** other Functions config and secret files. The Firebase Functions emulator can load `functions/.env`, `functions/.env.<project>`, `functions/.env.local` and `functions/.secret.local`; Gen1 runtime config may use `.runtimeconfig.json`. Original local ignored files could override demo-only assumptions or expose provider credentials in a synthetic test. This is a **safety risk in acceptance execution**, not evidence any production credential actually leaked.

Authority: official Firebase docs:
- https://firebase.google.com/docs/emulator-suite/connect_functions
- https://firebase.google.com/docs/functions/config-env

## R884 exact source change

- The original runner now defines `assert_no_functions_local_configuration` as a canonical POSIX `find functions -maxdepth 1 ...` inspection for `.env`, any `.env.*`, `.secret.local` and `.runtimeconfig.json` except tracked documentation-only `.env.example`. It denies normal files **and symlinks**.
- Calls the guard **before** dependency installation and **again after build, before** the runner writes its generated minimal emulator `.env.demo-urai-jobs`. Original clean SHA, frozen install, demo project, credential, and Firebase emulator restrictions retained. No new Cloud permissions or billable infrastructure.
- New `scripts/r884-emulator-env-isolation.test.mjs` uses the actual original shell function text extracted from the runner and creates disposable temporary fixtures for a clean directory, allowed `.env.example`, six denied local files and a denied symlink, and verifies both pre/post-build checks remain enrolled. Root `urai-jobs:verify` appends this test; no previous source or native suite removed.
- Engine/runtime `createJob`, data rights and Storage source are byte-identical to #358. No production IAM, live emulator, media, signed C6, owner data or paid compute used.

## Execution and limits

- Locally executed the **same one-line POSIX find predicate** on a disposable `functions/` fixture using Bash, creating and removing the six forbidden config variants, documentation file, symlink and clean directory. **10/10 fail-closed shell fixtures PASS**. This is an actual local predicate execution, **not** the original full runner and **not** Firebase native acceptance.
- The new GitHub-published Node fixture source is enrolled in root verification but has **not yet been independently executed from its exact Git blob** in a complete checkout. Original full `pnpm install --frozen-lockfile`, `pnpm urai-jobs:verify`, `pnpm typecheck`, `pnpm build`, Firebase emulator and GCS privileged write-denial remain unrun here: no pnpm, complete repo or github.com DNS.
- Official Firebase documentation also notes that emulators can attempt production Secret Manager access when configured with ambient credentials; this review does not claim that rejecting config files alone proves provider/IAM isolation. Existing environment/token clean-room checks remain mandatory.

## Acceptance

On independently reviewed exact R884 SHA, detached clean checkout, no real cloud credentials and a local demo project:

```bash
node --test scripts/r884-emulator-env-isolation.test.mjs
pnpm install --frozen-lockfile
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
URAI_ACCEPTANCE_SHA="$(git rev-parse HEAD)" bash scripts/run-r879-jobs-native-auth-acceptance.sh
```

Prove with the *actual* runner that it refuses each forbidden Functions config file and a symlink **before** install/launch, refuses new files created during build, permits its own generated demo-only file after both checks, and never contacts real provider/Secret Manager endpoints. Record exact source, exit codes and full logs, separately from eventual native owner/token/quota test results.

**Genesis production HOLD**: P0 Jobs #252 privileged post-revocation GCS writer denial and active upload drain, P1 #337 real Firebase authorization, P2 #345 deterministic quota race, signed positive C6, protected private film and Replay remain unverified.
