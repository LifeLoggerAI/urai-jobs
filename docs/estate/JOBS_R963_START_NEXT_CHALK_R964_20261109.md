# NEXT CHALK — ONE URAI GENESIS R964 CONTINUATION COMMAND

Continue the existing LifeLogger → LifeOS → UrAi Genesis engineering and integration. Preserve all original work and review branches. Do not restart or rebuild known implementations.

## Read first

Repository: LifeLoggerAI/urai-jobs  
Forensic documentation PR #379: https://github.com/LifeLoggerAI/urai-jobs/pull/379  
Documentation branch: `docs/genesis-jobs-firebase-forensics-20261109`

Read in this order:
1. `docs/estate/JOBS_R963_CANONICAL_REVOCATION_EVENT_ACK_DESIGN_PROPOSAL_20261109.md`
2. `docs/estate/JOBS_R963_MACHINE_CHECKPOINT_20261109.json`
3. `docs/estate/JOBS_R962_R647_DONOR_EXECUTION_READINESS_HOLD_20261109.md`
4. `docs/estate/JOBS_R961_DEFINITIVE_NEXT_CHALK_MASTER_HANDOFF_20261109.md`
5. R960, R959, R958, R957, R956, R955, R954 and R953.
6. R944 source/runtime/cloud matrix, test-history ledger, P0–P3 taskbook, START NEXT CHALK and machine checkpoint.
7. Privacy R17–R20 (#253–#256), historic Privacy R647 #214.
8. Jobs #371, #377, #388–#390 and forensic #379.

## R963 latest result

A complete **design proposal** has been committed for review:
- Proposed event schema: `consent.revoked.v3`.
- Immutable consent facts separated from mutable delivery/lease/retry metadata.
- Source transition timestamp has explicit provenance; never substitute outbox createdAt.
- Current receipt and prior granted receipt/evidence are both preserved.
- Proposed canonical consumer ACK: Privacy per-consumer ACK subdocument; Jobs HTTP ACK remains authenticated transport evidence; outbox state remains delivery projection.
- Jobs ACK means only that Jobs committed the precise consent-block action. It never certifies GCS write denial, upload drain, physical deletion or downstream purge.

This is **not approved policy and not implemented source**. Get Privacy/legal/security owner review before coding or changing event semantics.

## Exact immutable refs

- Jobs main: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`
- Jobs R923 #371: `df19633466eaebdda844569ed0d562245bd31dc6`
- Jobs R900 #377: `f8578ea281e818b01811aecc2fe4dfb8c3dc8203`
- Jobs R951 #388: `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`
- Jobs R952 #389: `b865209cc352241602d8b9714672f3401aed7669`
- Jobs R932 #390 was refreshed during R962; refetch current head before relying on earlier pin.
- Privacy R17 #253: `90a4e581e8494f52d85eab3c576d02b926e7d0d9`
- Privacy R18 #254: `dbc193763dc112210c20b5b680e8eb08fdf8396c`
- Privacy R19 #255: `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a`
- Privacy R20 #256: `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`
- Privacy R647 #214 donor: `cc0692053db3b1b8df8267d43856b1a3357de8a0`

Review branches are draft/unmerged unless a fresh PR readback proves otherwise. None of these refs proves deployment.

## Immediate R964 action: get genuine donor test execution

R962 source pins:
- Dispatcher: `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- Contract: `6cca2b9456319927cf22511c7d51c1f16ddf051c`
- Dispatcher test: `def1048aa4838f7ff990d792a27d1fb94e7f6441`
- Jobs contract test: `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`
- Donor publisher: `5b069b79d657b5c2006dd0ab45c8e60709ff0a89`
- Functions package: `e7c9036117ce7b4f3a59c10f80617a6165afb288`
- Root package: `115d4ff9cbd646e6313e2de0590359a02f71e68f`

Test source has 10 dispatcher state tests and 16 contract/transport tests. They use Node test, TypeScript transpileModule, VM, fake Firestore and mocked transport. They are not Firebase emulator tests.

R962 did NOT run them because `git ls-remote` failed with DNS “Could not resolve host: github.com”; no checkout/install was obtained. Do not claim passes.

At a host with GitHub connectivity:
1. Clean detached checkout exact Privacy R647 head.
2. Verify commit, tree and donor blobs before execution.
3. Use exact locked install and package lock. Do not change dependency versions.
4. Run separately:
   `node --test tests/consent-revocation-jobs-contract.test.mjs`
   `node --test tests/consent-revocation-dispatcher-contract.test.mjs`
5. Run Functions typecheck separately.
6. Capture Node/TS versions, commit/tree, lock hash, raw TAP, exit codes and SHA256 logs.
7. Do not patch donor source to force success. Preserve original donor.

## Canonical protocol implementation sequence — only after review

1. Approve exact v3 event, identity digest and serialization with Privacy/legal/security.
2. Decide whether eventId includes prior grant evidence and how missing/invalid evidence is represented.
3. Specify authoritative source transition time; if unavailable, explicit unknown state and quarantine/disposition.
4. Define legacy v1 outbox disposition without invented prior grants or timestamps.
5. Choose canonical ACK authority; resolve existing root jobsDeliveryState/jobsDeliveryAckHash, Privacy acknowledgements/{consumerId}, last-ACK summary and Jobs local receipt.
6. Implement in separate review-only Privacy and Jobs branches while preserving R647 donor history and R20 replay collision safeguards.
7. Keep R647 bounded scan, UUID lease, stale-worker, retry/backoff, immutable revalidation and pinned destination mechanics where tests still prove them under v3.
8. Add a system-only scheduler/task wrapper only after least-privilege identity, secret binding, endpoint and deployment provenance are reviewed. Never expose a client-callable dispatch surface.
9. Run same-SHA native Firebase Auth/Firestore/Functions/Storage emulators for producer→outbox→dispatcher→Jobs→canonical ACK.
10. Test duplicate, conflict, missing lineage, invalid time, stale lease, timeout after Jobs commit, timeout after Privacy ACK commit, regrant during transit, wrong token consumer, forged ACK and retry exhaustion.

## Other unresolved release gates

- Jobs #377 post-admission operator withdrawal requires Privacy/legal/security policy; no blanket abort change.
- Worker auth #388/#389 remains review-only; source tests do not prove deployed middleware.
- Rollback hard-stop exists, but exact restoration of prior healthy revision is not rehearsed.
- Studio private render consent and output write authority remain hard-off.
- R879's 58 source pins and 78 command segments are not a completed suite.
- Protected CI, independent eligible reviewer, deployed source/image, service identity, secrets metadata, ingress and effective IAM remain outstanding.
- Real nonproduction GCS stale/alternate writer 403 after revocation; active upload drain; exact-generation purge and durable ACK are separate gates.
- Full authenticated C6 lifecycle, devices/accessibility/visual acceptance, external launch operations and founder GO remain outstanding.

## Working discipline

Classify every claim as immutable source, executed local test, predecessor report, failure/HOLD or unknown. Do not combine overlapping test counts. Emulator success is not privileged live GCS IAM. Jobs ACK is not physical deletion. Stop on source mismatch, missing lineage, ambiguous lease, forged ACK or any post-revocation write success.

No cherry-pick unchanged. No merge. No deployment. No dispatch. No private-media processing. No IAM mutation. No paid compute. No production GO.

Resume at R964: refresh live PR heads, verify documentation artifacts, then pursue real donor test execution if the host permits it. Otherwise record the blocker and continue design review only.
