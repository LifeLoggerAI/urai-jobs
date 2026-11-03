# R416 Jobs security convergence ledger — HOLD

Date: 2026-11-03. Coordination only; **not a merged integration, test result, release candidate, or permission to render**.

## Immutable sources
- Base of this work: Jobs #236 `3497be156ab91d5753e13ca907b24b68f5a3e56a` (parent #235 `bef56c1d4fb12fcd559a74253d755e4178746032`).
- Independent security donor: Jobs #234 `4ffe596edf20d4bbe62c61ae4117a6d3acf016de`.
- Common ancestor: `3a406d1ed4a75d13400c21d9898d26d6003d1e30`.
- GitHub compare: from #236 to #234 **27 ahead / 13 behind**; reverse 13 ahead / 27 behind. Must not infer either source includes the other's repairs.
- Master coordination issue: https://github.com/LifeLoggerAI/urai-labs-llc/issues/247

## #234 donor-only candidate files (review all additions independently)
- functions/src/jobs/createJob.ts — creation and tenant admission
- functions/src/jobs/executeJob.ts — runtime cancellation/revocation fences
- functions/src/jobs/storytimeNarratorBridge.ts — private narrative boundary
- functions/src/privacy/consentRevocation.ts — event ordering
- functions/src/privacy/consentRevocationOrder.ts — newly added
- functions/src/privacy/ownerDeletionFence.ts — newly added
- scripts/fixtures/privacy-revocation-contract-65e7d7ec.ts — newly added fixture
- scripts/privacy-data-rights-bridge-fence-contract.mjs — newly added test
- scripts/privacy-data-rights-creation-fence-contract.mjs — newly added test
- scripts/privacy-data-rights-late-log-contract.mjs — newly added test
- scripts/privacy-storytime-consent-race-contract.mjs — newly added test
- scripts/test-consent-revocation-order.mjs — newly added test
- scripts/test-privacy-jobs-cross-repo.mjs — newly added test
- scripts/test-revocation-http-transaction.mjs — newly added test
- scripts/test-revocation-sequence-contract.mjs — newly added test

These are **review targets**, not automatic cherry-picks: verify their imports, dependencies, original full source and actual tests first.

## Cross-line overlapping files requiring deliberate three-way reconciliation
- functions/src/jobs/studioLifeMovieBridge.ts
- functions/src/jobs/studioLifeMovieLongformBridge.ts
- functions/src/privacy/dataRightsExecution.ts
- package.json
- scripts/consent-revocation-contract.mjs
- scripts/life-movies-longform-resume-transaction-contract.mjs
- scripts/privacy-data-rights-replay-contract.mjs

Review overlap against the common ancestor line by line. Preserve source-generation immutability, source rights, consent withdrawal, delete fencing, late-log cleanup, no cross-tenant access, deduplication and resume authority. Do not resolve conflicts in favor of green tests if a security check is lost.

## #236 branch-specific security surfaces to preserve
- functions/src/privacy/lifeMovieAdmissionPreflight.ts
- functions/src/privacy/lifeMovieBoundedResponse.ts — newly added bounded response parsing
- functions/src/privacy/lifeMovieConsentTransport.ts
- functions/src/privacy/lifeMovieJobsTokenProvider.ts
- scripts/life-movies-consent-response-bounds.test.mjs — newly added bounds tests
- scripts/life-movies-admission-preflight-contract.mjs
- scripts/life-movies-consent-transport-contract.mjs
- scripts/life-movies-creation-admission-contract.mjs
- scripts/life-movies-jobs-token-provider-contract.mjs

## Exact execution contract
1. First compare immutable #234 and #236 blobs, imports, and original maintained test commands; document each changed file with resolution (carry #234 / retain #236 / combined repair / explicit defer) and reason.
2. Add only non-conflicting changes on this review-only branch. Rerun original Jobs suites from **both** branches (including 61/61 private delivery, 57 transport, revocation and resume contract tests) and frozen workspace install/typecheck/build at resulting exact new SHA.
3. Reconcile Privacy #189 `3f94e0050c5994a369cdc531ff864d0a2eadbbad` and Studio #178 `8c62bc3a4bb3216a28c362d93b5f17bdedb12b03` as exact service-boundary inputs. Firebase emulator Auth/Firestore/Storage/Functions, authenticated dedicated Jobs identity, Studio→Jobs scope and Replay private delivery are mandatory after source reconciliation.
4. Record SHA, tree, log digests, runtime versions, test totals, failures and reviewer identity. Reject source-head drift and old-SHA proof.
5. Eligible independent nonauthor approval + legitimate protected-controller acceptance are **required** before merging or enabling any render. Keep production/public/provider routes hard off.

## R416 live checkpoint
- Coordination branch created from exact #236 head only, intentionally **no executable source code modified by this ledger**.
- GitHub Actions Jobs checks observed failing with no recorded steps; not evidence that application code ran.
- Local workspace GitHub DNS unavailable; RunPod logs previously timed out; do not burn paid compute without a reliable private evidence path.
- No branch merge, paid provider execution, customer media, production deployment, IAM/rules publication or release GO.

Release: **NO-GO / HOLD**.
