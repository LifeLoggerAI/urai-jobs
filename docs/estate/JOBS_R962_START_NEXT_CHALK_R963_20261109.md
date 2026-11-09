# NEXT CHALK — ONE URAI GENESIS R963 CONTINUATION COMMAND

Continue the existing LifeLogger → LifeOS → UrAi Genesis effort. Do not restart the project or rebuild surviving implementations.

## Read first

Repository: LifeLoggerAI/urai-jobs  
Forensic documentation PR #379: https://github.com/LifeLoggerAI/urai-jobs/pull/379  
Documentation branch: `docs/genesis-jobs-firebase-forensics-20261109`

Read:
1. `docs/estate/JOBS_R962_R647_DONOR_EXECUTION_READINESS_HOLD_20261109.md`
2. `docs/estate/JOBS_R962_MACHINE_CHECKPOINT_20261109.json`
3. `docs/estate/JOBS_R961_DEFINITIVE_NEXT_CHALK_MASTER_HANDOFF_20261109.md`
4. `docs/estate/JOBS_R961_START_NEXT_CHALK_R962_20261109.md`
5. R960 → R953 reports, then R944 source/runtime/cloud matrix, test-history ledger, P0–P3 taskbook and START NEXT CHALK.

## Exact R962 facts

Privacy R647 #214 head: `cc0692053db3b1b8df8267d43856b1a3357de8a0`. Six donor source blobs were read back from this exact GitHub revision and matched.

Donor file identities:
- Dispatcher: `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- Contract: `6cca2b9456319927cf22511c7d51c1f16ddf051c`
- Dispatcher test: `def1048aa4838f7ff990d792a27d1fb94e7f6441`
- Jobs contract test: `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`
- Donor publisher: `5b069b79d657b5c2006dd0ab45c8e60709ff0a89`
- Functions package manifest: `e7c9036117ce7b4f3a59c10f80617a6165afb288`
- Root package manifest: `115d4ff9cbd646e6313e2de0590359a02f71e68f`

Donor tests:
- Dispatcher state test file contains 10 top-level Node test declarations. Uses TypeScript transpileModule, Node VM, fake Timestamp/FieldValue, fake Firestore transaction/query and mocked contract/network.
- Contract/transport test file contains 16 top-level Node test declarations plus parameterized negatives. Uses transpileModule, VM, synthetic publisher event/ACK and mocked HTTP request.
- Focused commands from the Privacy root:
  `node --test tests/consent-revocation-dispatcher-contract.test.mjs`
  `node --test tests/consent-revocation-jobs-contract.test.mjs`
  Or package scripts `npm run test:revocation:dispatcher` and `npm run test:revocation:jobs:contract`.
- Functions package `npm test` only runs typecheck; it does NOT run these donor tests.
- R962 did NOT run the tests, typecheck or emulators. A read-only `git ls-remote` attempt failed because this environment could not resolve github.com. This was a network/DNS access blocker, not a test failure.

## Immediate R963 task

1. Determine whether the runtime has GitHub connectivity and a valid complete checkout. Do not fabricate clone results or source files.
2. If connectivity is available, create a clean detached checkout at exact R647 head; verify commit, tree and each donor Git blob before running anything.
3. Use the repository's locked install procedure. Do not modify dependency ranges/lockfiles.
4. Run the two original Node test commands separately. Preserve raw TAP, exit codes, Node/TypeScript versions, commit/tree and log SHA256. Then run Functions typecheck separately.
5. If network or checkout is unavailable, do not report passes. Capture the exact blocker and continue source/design work only.
6. Keep R647 donor unchanged.

## Canonical protocol design remains the critical integration task

Do not cherry-pick R647 unchanged into Privacy R20. R960 established four incompatibilities:
- Current R20 publisher does not write the queue metadata the old dispatcher query requires.
- R20 integrityHash includes prior-grant receipt/evidence; R647 recalculates the older digest and rejects R20 event payloads.
- R647 Jobs v2 mapping drops `priorGrantReceiptHash` and `priorGrantEvidenceState`.
- R647 maps outbox `createdAt` to Jobs `revokedAt`, conflating delivery/outbox time with source consent transition time.

Also resolve root `jobsDeliveryState/jobsDeliveryAckHash`, Privacy `acknowledgeConsentRevocation` subcollection ACK, and Jobs local event receipt. Choose one canonical ACK authority or define reconciled projections. An ACK can only mean the exact consumer action; it never means physical GCS purge.

New event version must bind owner, purpose, tier, policy, current receipt, prior grant receipt/evidence state, immutable event and source transition timestamp/provenance. Keep outbox createdAt/delivery times separate. Define legacy/missing-lineage disposition without inventing evidence.

## Separate outstanding gates

- Jobs #377 post-admission data-rights operator withdrawal requires Privacy/legal/security policy.
- Jobs #388/#389 worker authentication changes remain review-only; source tests do not prove live worker behavior.
- Rollback correction exists, but exact previous healthy revision restoration is not rehearsed.
- Studio consent and private output-write authority remain hard-off.
- R879 58 source pins and 78 command segments are not a completed suite.
- Protected CI, independent reviewer, deployed source/image, service identities, ingress/secrets and effective IAM remain outstanding.
- Real nonproduction Storage late-write 403, upload drain, exact-generation deletion and durable purge ACK are separate mandatory gates.
- Full authenticated C6 lifecycle, physical-device/accessibility/visual acceptance and founder GO are still required.

## Operating rules

Classify every result as immutable source, executed local test, prior report, failure/HOLD or unknown. Preserve original donor history. Do not combine overlapping test counts. Emulator success is not effective privileged GCS IAM. Jobs ACK is not physical deletion. Stop on source mismatch, missing lineage, ambiguous lease, forged ACK or post-revocation write success.

**NO CHERRY-PICK UNCHANGED / NO MERGE / NO DEPLOY / NO DISPATCH / NO PRIVATE MEDIA / NO IAM CHANGE / NO PAID COMPUTE. PRODUCTION HOLD / NO-GO.**

Resume at R963 with actual donor test execution when a clean, connected checkout is available; otherwise document the blocker and advance the canonical contract design without changing runtime code.
