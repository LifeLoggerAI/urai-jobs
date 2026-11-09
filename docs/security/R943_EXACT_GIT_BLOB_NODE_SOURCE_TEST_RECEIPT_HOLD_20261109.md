# ONE URAI GENESIS — R943 original Git-blob Node test execution receipt

**Date:** 2026-11-09 UTC. **Release:** NO-GO / PRODUCTION HOLD. **Spend:** $0.  
**Parent:** [Jobs R942 draft #381](https://github.com/LifeLoggerAI/urai-jobs/pull/381), review commit before R943 receipt `d01e59dbbd3e8a31372db77673b149018dc9575a`. **No production or other worker changes.**

## Outcome: first independently executed original R942 static suite

A clean isolated local directory was populated with the **exact full contents** returned by the connected GitHub source reader from PR #381, three original source files. Before execution, actual `git hash-object` values were independently computed on the local files, confirming byte-identical copies:

| File | Original Git blob from GitHub | Independently computed local blob |
| --- | --- | --- |
| `firestore.rules` | `d30c3e8fbbfcbf25767501e351edcb18d6080c6d` | **MATCH** `d30c3e8fbbfcbf25767501e351edcb18d6080c6d` |
| `scripts/owner_authority_rules.static.test.mjs` | `45c9e80c0aca2b8288d2e6ddf0650873dc4bdb75` | **MATCH** `45c9e80c0aca2b8288d2e6ddf0650873dc4bdb75` |
| `scripts/user_authority_rules.firebase-emulator.test.mjs` | `95f4b72b1d7260a191b0cdc77c5cf008b57011e0` | **MATCH** `95f4b72b1d7260a191b0cdc77c5cf008b57011e0` |

**Environment:** Node `v22.16.0` (actual executable), npm `10.9.2`, OpenJDK `21.0.12.1`, Git `2.47.3`; isolated directory `/mnt/data/r942_verify/`. No additional npm install, credentials, external browser, production data or GCP connection.

### Actual commands and execution

```sh
cd /mnt/data/r942_verify
git hash-object firestore.rules scripts/owner_authority_rules.static.test.mjs
git hash-object scripts/user_authority_rules.firebase-emulator.test.mjs
node --check scripts/user_authority_rules.firebase-emulator.test.mjs
node --test scripts/owner_authority_rules.static.test.mjs > r943_static_node_test.tap 2>&1
sha256sum r943_static_node_test.tap
```

- **Original source suite:** TAP v13, **15 tests, 15 PASS, 0 FAIL, 0 SKIP, 0 CANCELLED**, exit **0**. Includes the original 12 trusted owner authority fields, refusal of `changedKeys()` in place of `affectedKeys()`, and the self-update/write surface guard; `dataRightsDeletionRequestId` test explicitly PASS.
- **Exact original native test source syntax:** `node --check` **PASS** (exit 0), Git blob identity **MATCH**. **The body of that native test was NOT executed**; syntax acceptance cannot substitute for a Firebase Auth/Firestore emulator.
- **Original Node TAP log:** `r943_static_node_test.tap`, **3421 bytes**, SHA256 `a68a5b4e7709387bcaa8aa1d856824817efa4b53104bea91d29525664e13da9e`.
- Earlier R942 15/15 focused **static data comparisons** remain separately recorded and must not be double-counted as a 30-case original test suite.

### Incomplete verification — do not promote

`git ls-remote https://github.com/LifeLoggerAI/urai-jobs.git HEAD` failed with DNS error `Could not resolve host: github.com` (exit 128). This environment has no `pnpm`, no locally resolvable `firebase-admin/app`, and no locally resolvable `firebase-tools`; npm cache contains no Firebase tools archive. Thus **no full repository checkout**, frozen install, root 76-command `pnpm urai-jobs:verify`, build, real Firebase emulators, effective deployed Rules verification, actual GCS IAM/403 check or authenticated private Replay acceptance was performed here. GitHub Actions run [42575397700](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42575397700) failed with build job showing zero recorded steps; that status is not original source-test failure evidence.

### Required next work

1. Independently review [#381](https://github.com/LifeLoggerAI/urai-jobs/pull/381) and native test against immutable reviewed source; run `node --test scripts/user_authority_rules.firebase-emulator.test.mjs` **only under the original guarded `demo-urai-jobs` Auth/Firestore four-emulator workflow**, proving client ID-token REST 403 for binding update, delete, and legacy addition and 200 for allowed profile update, with unchanged Admin readback.
2. Preserve original R940 13/14 idempotency fixture blocker and full 76-command root verification on one immutable source. Independent test/code review, protected CI, source-to-deployment parity remain HOLD.
3. Cloud owner must verify effective Firestore Rules version, Storage IAM denial to old privileged writers after revocation, active-upload drain, exact-generation cleanup, signed consent → private Replay → deletion/purge acknowledgments, and billing/quotas separately. No production authorization from this document.
4. **Do not merge, deploy, spend, or weaken approval gates solely based on passing static Node tests.**

**Final R943 classification: EXACT-SOURCE ORIGINAL STATIC TEST PASS; NATIVE EMULATORS AND PRODUCTION UNVERIFIED; ONE URAI GENESIS HOLD.**
