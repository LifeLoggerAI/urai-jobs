# One UrAi Genesis R885 — Jobs quota index / disposable project reconciliation

Date: 2026-11-07. Source parent: Jobs #357 `d9dee1859de39c37c02e544331f814a80cf953d0`. **Review-only; production HOLD.**

## Forensic source finding

R883/R884 `createJob.ts` blob `c52f09900bb76a1fa71445a7fceb39c177c2c568` uses `legacyCreateAdmissionTimes(uid)` **before** the atomic owner-ledger transaction, querying `jobs` with `ownerUid == uid` and `createdAt >= windowStart` without explicit descending ordering. The R884 source index file had only the existing `ownerUid ASC, createdAt DESC` index. This introduces a deployment/index-readiness dependency for first and later admission; a missing suitable index can deny otherwise authorized job creation. Index planner behavior and production index readiness remain **UNVERIFIED**.

Concurrent peer PR #356 had already identified the owner/time ascending index need and produced new `firestore.indexes.json` blob `7690ab3a4db2d7e83de5d6d13ebd7100cecde5bd`. That exact byte-for-byte blob is reused here (nine entries: preserved original eight, plus `ownerUid ASC, createdAt ASC`), **not independently reinvented**. #356's source regression, however, targets a different Jobs create transaction using `transaction.get(db.collection('jobs')...)`, which does **not** describe the R883 current implementation. Its whole branch or test was not merged. The current-source-tailored R885 regression `scripts/r885-firestore-quota-index-contract.test.mjs` asserts index selection in `firebase.json`, both index directions, the R883 pre-transaction legacy migration query, the real owner-ledger transaction and unique index declarations.

## Safe review changes

* Index file matches peer #356 Git blob `7690ab3a4db2d7e83de5d6d13ebd7100cecde5bd`.
* Root `package.json` now enrolls five R885 source-contract cases (Git blob `71e1387a6df3c9ed51c1f92b94e17dc2d4ed75c0`).
* Unified review runner Git blob `b4b99ec21f9593360266244244be7e84dce7804f` pins exact package/index/new-test blobs, requires the five-case source result, and explicitly sets `URAI_EMULATOR_PROJECT=demo-urai-jobs` in its nested Auth/Firestore/Functions/Storage Jobs stage. The outer negative Storage test remains on the intentionally isolated disposable `urai-staging-test` project. No authentication/production configuration or deploy changed.
* R884 original 14-concurrent-job expected 10/4 native test and atomic side effect assertions retained untouched.

## Verified vs unverified

Connector readback confirmed branch source, index count exactly nine, precisely one ascending and one descending owner/time index, correct pretransaction migration call, test entry, strict blob pin and nested disposable demo project selection. These are **source inspection assertions only**, not the five Node tests executing.

R884 head Jobs #357: nine CI workflow runs reported failure; sampled failed jobs had zero returned steps and log archive 404 BlobNotFound. Runtime emulator E2E skipped. Do NOT count as a build failure diagnosed from logs, or as a pass. Local environment has Node 22 and Java but lacks pnpm and cannot resolve github.com for a full checkout. No full native Firebase execution, pinned workspace install/typecheck/build, production index creation/readiness check, authenticated 14-way concurrent proof, effective GCS IAM 403, inflight writer drain, signed C6 owner consent, Studio protected rendering, or Replay owner-only full flow was executed in R885.

## Release gate

On a clean checked-out exact R885 commit, no production secrets, Node 22/pnpm 8.15.9/Java 21, run `node --test scripts/r885-firestore-quota-index-contract.test.mjs`, then `URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY URAI_JOBS_ACCEPTANCE_SHA=<reviewed-r885-commit> bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only`. Collect SHA256 of original logs. Verify Firestore query-planning/index readiness separately in controlled staging; emulator query success alone cannot prove a deployed production index. Treat actual 14-request contention failures as failures; do not weaken expected results. Never run paid production compute or deploy without separate authorization.

Jobs #345 quota, #337 operator, #252 storage-revocation remain unresolved. Peer PRs #355 (manual dispatch) and #356 (index) are independent and must be source-reconciled for convergence. **NO MERGE; NO DEPLOY; ONE URAI GENESIS PRODUCTION HOLD.**
