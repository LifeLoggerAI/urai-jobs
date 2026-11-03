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

## R417 executable reconciliation checkpoint — 2026-11-03

> This newer checkpoint supersedes the earlier "documentation only" branch state. **DRAFT / NO-GO / HOLD.** It is source convergence, not native full-build or emulator certification.

- Reviewed #234 and #236 from exact common ancestor `3a406d1ed4a75d13400c21d9898d26d6003d1e30`. Verified 15 #234-only file blobs, including creation/worker revocation, Storytime owner fence, late-log/deletion tests, ordering and cross-repository harness, were unmodified on the #236 side since the common ancestor. Imported those exact blobs to review branch at `96c186cf83f5af24819f6761f66629e974e58804`.
- Three-way disjoint-hunk combine of short-form Studio bridge and root `package.json`: `346ea1835c56ef81ab6dec9f942554df0c752667`. Manifest parsed as valid JSON; full dependency install and build not executed.
- Combined longform bridge preserving all three identical overlapping resume guards plus #234 owner-fence transactions: `1d6197bfd64e13fc39544fdfaea09ab7fc532d1c`. Verified source placement of owner reads + guards before writes for short, longform create/assemble/resume, and Storytime: **5/5 targeted source checks PASS**; not a live Firestore emulator assertion.
- Combined #234 atomic data-rights deletion with #236 conservative MAX_LOGS_PER_DELETE_BATCH=496 and receipt bound: `caac382fd5cc5b6e15ac642d730a374d3280c5b5`. Source contains actual transaction latest-job/queue/log rereads and bounds. This requires original runtime/harness and emulator proof.
- #234 transaction-aware privacy-data-rights replay contract rebased with the new 496 cap, expected denial at 497 with and without queue, retained redaction and retention authority tests: `19be069b31e62837c17a1456bf4b0decae08a987`. No full test suite pass asserted.
- Preserved both longform resume test lineages: #236 original test stays in place, exact #234 original blob `21144caba9f78dbfbd5c66826c33e381c0931454` copied to `scripts/r417-original-donor-longform-resume-transaction-contract.mjs`, and both wired into `life-movies:consent-gate:verify` at `6b1e27d60cc1604feb6a9abc5c620accc394e831`. The #236 `scripts/consent-revocation-contract.mjs` is retained because its source-order/receipt checks are stronger than #234's isolated transaction-anchor assertion; separately retained donor sequence contract remains in verification.
- **Actual original-source local execution:** recovered exact blob `33c71b71a7a505d17f8b5b51189573a954873593` and test blob `f4be894bf55ae9bd62616d5f325530d9263e4fe9` with `git hash-object` match, ran Node 22 `--experimental-strip-types --test`: **15/15 PASS**. Recovered original `test-revocation-sequence-contract.mjs` blob `0eeacdba1da7ff8e4b5820ebefb9039be1d2fd1b` and ran `node --test`: **4/4 PASS**. These are narrow original-file tests, no frozen complete checkout/build nor Firebase identity/emulator.
- **Status/next:** branch final commit must be re-read before release testing; run frozen workspace install, complete `npm test`, Functions typecheck/build, both donor+current longform tests, privacy-data-rights replay and bridge tests; then real isolated Firebase Auth/Firestore/Storage/Functions and authenticated Privacy #189 → Studio #178 → Jobs → Replay. No current end-to-end PASS. Independent reviewer permission still unresolved. Protect user data and leave production render hard-off.

