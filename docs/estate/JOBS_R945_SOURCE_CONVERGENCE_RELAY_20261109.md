# ONE URAI GENESIS — R945 follow-up to R944 Jobs forensic audit

**Status:** Production HOLD / NO-GO. **Date:** 2026-11-09 UTC. **Cost:** $0.  
**This is a continuation of the existing permanent R944 8-file handoff in [Jobs #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379), not an overwrite or a release signoff.**

## What changed since R944

A previously missing integration of **two sibling review fixes** has now been performed on an isolated source branch, [Jobs draft PR #383](https://github.com/LifeLoggerAI/urai-jobs/pull/383), current observed HEAD `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c`. It is stacked on [#381](https://github.com/LifeLoggerAI/urai-jobs/pull/381) source commit `a295fd834c1cc01710a36b04523b023de2283240`, whose Rules and native tests protect `dataRightsDeletionRequestId` against client profile updates. It preserves **exact original Git blob** `9af97cd9b2bd7e2a8e5e66d805c90791da60a52c` for the longform idempotency test from parallel donor [#382](https://github.com/LifeLoggerAI/urai-jobs/pull/382), source commit `d87cc22b798b6894861a344125f57747e016c1ba`. Neither donor branch or production main changed.

Two verification enrollments were added to #383: the root `package.json` now requires the original longform test as the **77th unique command**, Git blob `4804276332491e1e57a95a2a0cec7050df3a595c`; the existing R879 original guarded four-emulator runner, blob `29a3d2877ff97e7707eaf5a33f7d3f2c39aa416b`, now source-pins that test and the updated package and fails unless the original script reports `# pass 17`. Full runner and test actual execution still pending.

## Verification fact and open uncertainty

At the reviewed #383 source, the following exact Git blobs were directly read back: Rules `d30c3e8fbbfcbf25767501e351edcb18d6080c6d`; static Rules test `45c9e80c0aca2b8288d2e6ddf0650873dc4bdb75`; native Auth/Firestore client Rules test `95f4b72b1d7260a191b0cdc77c5cf008b57011e0`; longform test `9af97cd9b2bd7e2a8e5e66d805c90791da60a52c`; root `package.json` `4804276332491e1e57a95a2a0cec7050df3a595c`; R879 guard `29a3d2877ff97e7707eaf5a33f7d3f2c39aa416b`. The checked R879 source-pin entries match each actually inspected file. No application/worker production source changed from the #381 parent.

**Original Node static suite executed again** against three exact byte-verified Git blobs on Node 22.16.0: 15/15 PASS, 0 FAIL, exit 0; original `node --check` native source syntax PASS; `R945_original_static_node.tap` SHA256 `00fb4ae0bf5b39442ab165549e1422f3ee5e7c95b48772763710b4a3893f6877`. This is the **same original 15-case static suite**, not a new full acceptance family.

The original #382 full **17-case test was NOT EXECUTED**, and the 77-command root, native Auth/Firestore/Storage/Functions, full build/typecheck, CI, deployed parity and physical GCS denial still have not passed on #383. No live Firebase/GCP control-plane inventory was obtained; all real resources in R944 remain UNKNOWN rather than absent.

## Immediate pickup for next Chalk

1. Begin at [R944 START NEXT CHALK](https://github.com/LifeLoggerAI/urai-jobs/blob/docs/genesis-jobs-firebase-forensics-20261109/docs/estate/JOBS_R944_START_NEXT_CHALK_20261109.md), then read [R945 detailed source handoff](https://github.com/LifeLoggerAI/urai-jobs/blob/review/chalk-r945-r942-sibling-test-convergence-20261109/docs/security/R945_JOBS_SIBLING_CONVERGENCE_ORIGINAL_TEST_ENROLLMENT_HOLD_20261109.md) and [#383](https://github.com/LifeLoggerAI/urai-jobs/pull/383). Re-fetch moving heads before further work.
2. On **approved credential-free free test host**, clone full immutable #383 source and run actual 17-case original Node idempotency test, complete 77 root commands, typecheck/build, then four-emulator R879 including real Auth+Firestore 403/200 and strict source pins. Capture logs/exit SHA256. No production project IDs or secrets.
3. Examine parent relationship between #383, #381, #382 and original #378, preserve all original security guards and ensure no subsequent peer source changes conflict. Review/merge only via protected CI and independent eligible reviewer.
4. P0 [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) real privileged GCS future-write denial/in-flight drain and independent positive C6→Studio→Jobs→protected Replay→revoke→physical purge ACK still missing. P1 [Jobs #376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) post-admission authorization policy still unresolved. Do not treat any static Node green as their closure.
5. Obtain read-only Firebase/GCP project resources and exact deployed Rules/IAM/worker revisions using already authorized access at zero additional cost. Source alias `urai-jobs` does not imply a live resource list.

**Source reconciliation advanced, original full acceptance blocked/not run. NO MERGE / NO DEPLOY / NO PAID TOOLS / NO PRIVATE MEDIA / PRODUCTION HOLD.**
