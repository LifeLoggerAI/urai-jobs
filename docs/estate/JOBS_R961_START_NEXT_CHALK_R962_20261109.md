# NEXT CHALK — ONE URAI GENESIS R962 CONTINUATION COMMAND

Chalk, continue the existing LifeLogger → LifeOS → UrAi Genesis engineering and integration work. Do not restart the project or rebuild surviving implementations.

## Read first

Repository: LifeLoggerAI/urai-jobs. Open forensic documentation PR #379:
https://github.com/LifeLoggerAI/urai-jobs/pull/379

Documentation branch:
`docs/genesis-jobs-firebase-forensics-20261109`

Read these in order:
1. `docs/estate/JOBS_R961_DEFINITIVE_NEXT_CHALK_MASTER_HANDOFF_20261109.md`
2. `docs/estate/JOBS_R961_MACHINE_CHECKPOINT_20261109.json`
3. `docs/estate/JOBS_R960_R647_TO_R20_DISPATCHER_COMPATIBILITY_HOLD_20261109.md`
4. `docs/estate/JOBS_R959_HISTORICAL_PRIVACY_DISPATCHER_RECOVERY_HOLD_20261109.md`
5. R958, R957, R956, R955, R954 and R953 reports.
6. R944 source/runtime/cloud matrix, test-history ledger, P0–P3 taskbook, START NEXT CHALK and machine checkpoint.
7. Privacy PRs #253–#256 and historical Privacy PR #214 (R647 dispatcher donor).
8. Jobs PRs #371, #377 and #386–#390 as applicable.

## Current exact source refs

- Jobs main: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`
- Jobs R923 #371 receiver: `df19633466eaebdda844569ed0d562245bd31dc6`
- Jobs R900 #377 operator-withdrawal reproduction: `f8578ea281e818b01811aecc2fe4dfb8c3dc8203`
- Jobs R951 #388: `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38`
- Jobs R952 #389: `b865209cc352241602d8b9714672f3401aed7669`
- Jobs R932 #390: `a7a1ef61ac1f219567131abec0b7f5b3c2f81ad9`
- Privacy R17 #253: `90a4e581e8494f52d85eab3c576d02b926e7d0d9`
- Privacy R18 #254: `dbc193763dc112210c20b5b680e8eb08fdf8396c`
- Privacy R19 #255: `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a`
- Privacy R20 #256: `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`
- Privacy R647 #214 donor: `cc0692053db3b1b8df8267d43856b1a3357de8a0`

All review PRs remain draft/unmerged unless freshly verified otherwise. Do not treat these SHAs as deployed revisions.

## Immediate priority: R647 → R20 canonical revocation protocol

A real historical dispatcher library exists in Privacy R647, but it is explicitly NOT DEPLOYED and is not exported/activated.

Exact donor blobs:
- Dispatcher: `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- Contract: `6cca2b9456319927cf22511c7d51c1f16ddf051c`
- Dispatcher test: `def1048aa4838f7ff990d792a27d1fb94e7f6441`
- Jobs contract test: `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`
- Donor publisher: `5b069b79d657b5c2006dd0ab45c8e60709ff0a89`

Preserve its bounded batch, per-event lease, retry/backoff, immutable source/consent checks, pinned HTTPS transport and ACK verification as donor mechanics. Do NOT cherry-pick or deploy unchanged.

R960 proves four incompatibilities with current R20:
1. Required delivery queue fields are absent in R20 publisher events.
2. R20 integrity hash now includes prior-grant evidence; old R647 mapper recalculates old hash and rejects the event.
3. R647 Jobs v2 projection discards `priorGrantReceiptHash` and `priorGrantEvidenceState`.
4. R647 derives Jobs `revokedAt` from outbox `createdAt`, conflating source transition time with outbox creation time.

There are also two ACK stores: R647 root outbox delivery ACK/hash and Privacy R20 trusted `acknowledgeConsentRevocation` subcollection ACK. Jobs has its own local receipt. Define one canonical ACK authority or explicitly reconciled projections. ACK means only the exact consumer action, never physical Storage purge.

### Execute next

1. Fetch exact R647 donor files and both tests; independently verify Git blob identities and inspect entire code, not excerpts.
2. Find the precise package scripts/toolchain. Run original donor contract tests only in a real isolated checkout; if local checkout/dependencies are unavailable, record NOT RUN rather than simulate a pass.
3. Draft a new versioned event envelope. Bind event ID, consent record ID, owner, purpose, tier, policy, current receipt hash, prior-grant receipt hash/evidence state, source transition timestamp plus provenance, outbox creation timestamp separately, immutable integrity digest, correlation and contract version.
4. Define explicit disposition of legacy/missing-lineage events. Never backfill invented grant evidence or timestamps.
5. Decide canonical consumer ACK semantics and root/subcollection storage.
6. Prepare separate review-only Privacy and Jobs patches preserving history. Do not activate a scheduler/task wrapper until identities, secret binding, endpoint, IAM and retry/DLQ rules are reviewed.
7. Run same-SHA native Firebase Auth/Firestore/Functions/Storage emulator flow: publisher → outbox → dispatcher → Jobs receiver/block/receipt → canonical ACK. Include duplicate, conflict, stale lease, timeout after receiver commit, consent change during network transit, corrupt event, missing prior lineage, wrong consumer, ACK conflict, ordering and retry.
8. Separately prove real protected nonproduction GCS stale/alternate writer 403 after revocation, active upload/stream drain, exact-generation deletion and durable purge ACK.

## Separate unresolved gates

- Jobs #377 post-admission operator withdrawal needs signed Privacy/legal/security policy; do not make blanket abort changes.
- Worker auth: R951/R952 review changes remain unmerged; source tests do not prove deployed worker middleware/Cloud Run state.
- Rollback: #386 hard-stops false-success placeholder; actual restoration has not been rehearsed.
- Studio private media consent and output write authority remain hard-off; do not turn them on for a demo.
- Jobs R879 enrollment: 58 source pins, 78 command segments; neither equals an executed suite.
- Protected CI, branch rules, eligible independent reviewer, exact deployed source/image, secrets metadata, ingress and effective IAM remain outstanding.
- Full authenticated C6 flow, devices/accessibility/visual acceptance and external launch operations remain separate gates.

## Working discipline

Classify every statement as immutable source, executed local test, prior report, failure/HOLD or unknown. Preserve logs, exit codes, runtime versions, source SHA/tree and hashes. Do not combine overlapping historical test counts. Never present Firebase emulator results as proof of privileged live GCS IAM. Never present Jobs ACK as proof of physical deletion.

No merge. No deployment. No dispatcher invocation. No private-media processing. No IAM mutation. No paid compute. No production GO.

**Production stays HOLD / NO-GO until every release gate is independently evidenced and the founder explicitly authorizes GO.**

Now resume with R962: inspect exact R647 donor source and test prerequisites, then report what can actually be executed safely.
