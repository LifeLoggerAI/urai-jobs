# ONE URAI GENESIS — R961 Definitive Next-Chalk Master Handoff

Checkpoint: November 9, 2026 UTC. Release verdict: **PRODUCTION HOLD / NO-GO**.

Repository: LifeLoggerAI/urai-jobs.
Documentation branch: docs/genesis-jobs-firebase-forensics-20261109.
Latest observed forensic PR #379 head: a1e3915a0151ab9f7480d6a02536356e8b29cdc9 (open, draft, unmerged).

## 0. Instruction to the next Chalk

Continue the existing LifeLogger → LifeOS → UrAi Genesis integration. Do not restart, rebuild known components from scratch, flatten review histories, or treat the presence of source as acceptance.

The governing rule is: preserve source ancestry, reconcile the correct security contract, and prove every gate against one immutable source set. Source inspection, historical reports, static assertions, local fixtures, and emulators do not establish live production safety.

No merge, deployment, revocation dispatch, private rendering, private-media processing, IAM mutation, cloud-resource creation, or paid compute is authorized. Production remains HOLD until independent acceptance and explicit founder GO.

Read this handoff first, then:
1. JOBS_R960_R647_TO_R20_DISPATCHER_COMPATIBILITY_HOLD_20261109.md
2. JOBS_R959_HISTORICAL_PRIVACY_DISPATCHER_RECOVERY_HOLD_20261109.md
3. JOBS_R958_DEPLOYMENT_MANIFEST_DISPATCHER_VERIFICATION_HOLD_20261109.md
4. JOBS_R957_ESTATE_REVOCATION_DISPATCHER_DISCOVERY_HOLD_20261109.md
5. JOBS_R956_PRIVACY_JOBS_REVOCATION_PROTOCOL_GAP_HOLD_20261109.md
6. JOBS_R955_CROSS_SERVICE_REVOCATION_CONTINUATION_HOLD_20261109.md
7. JOBS_R954_FULL_SOURCE_RECONCILIATION_NEXT_CHALK_HOLD_20261109.md
8. JOBS_R953_CANONICAL_NEXT_CHALK_FULL_RECONCILIATION_20261109.md
9. R944 source/runtime/cloud matrix, test-history ledger, P0–P3 taskbook, START NEXT CHALK and machine checkpoint; then R945–R952 additive reports.

Evidence grades: S = immutable source readback; L = local executed test with stated scope; P = predecessor report or historical receipt, not re-run in R961; F = observed failure/HOLD; U = unknown provider/deployment state. Unknown does not mean absent or safe.

## 1. Current immutable review graph

| Item | SHA | State |
|---|---|---|
| Jobs main | 9d29be1bcd3a45a4b9a743df9c9706c00811f38b | Read back; deployed source not established |
| Jobs forensic #379 | a1e3915a0151ab9f7480d6a02536356e8b29cdc9 | Open draft documentation PR |
| Jobs #371 R923 | df19633466eaebdda844569ed0d562245bd31dc6 | Open draft two-parent convergence |
| Jobs #377 R900 | f8578ea281e818b01811aecc2fe4dfb8c3dc8203 | Open draft operator-withdrawal reproduction |
| Jobs #388 R951 | 17b8f53ac1f4c75ac2abdd50a3bd631e61196c38 | Open draft production-first worker auth |
| Jobs #389 R952 | b865209cc352241602d8b9714672f3401aed7669 | Open draft mandatory regression enrollment |
| Jobs #390 R932 | a7a1ef61ac1f219567131abec0b7f5b3c2f81ad9 | Open draft Studio-to-Jobs Zod parser test |
| Jobs #386 R949 | fd1c8d85acd5cc96ef9fcb300173e362b004eb54 | Open draft rollback false-success hard-stop |
| Jobs #387 R950 | 04592f8573c708954f95f87ddca1e168efde51f4 | Open draft Narrator entrypoint/auth checker |
| Jobs #384 R946 | fd05a376f876f9b835929a2074c09f47638659e2 | Open draft R879 pin closure |
| Privacy #253 R17 | 90a4e581e8494f52d85eab3c576d02b926e7d0d9 | Open draft stored subject UID binding |
| Privacy #254 R18 | dbc193763dc112210c20b5b680e8eb08fdf8396c | Open draft original grant revocation on identity replacement |
| Privacy #255 R19 | a4d7e4ffb76fa2dbbf7348e2b66faa991761509a | Open draft prior grant receipt lineage |
| Privacy #256 R20 | cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6 | Open draft outbox replay collision classifier |
| Privacy #213 R583 | 4a4656d6283aa7e627bf220b447436df82865f99 | Open draft four-service bridge predecessor |
| Privacy #214 R647 | cc0692053db3b1b8df8267d43856b1a3357de8a0 | Open draft historical dispatcher donor |

All above review PRs were open/draft at R961 refresh. Review heads are not main and are not proof of deployed code.

## 2. Definitive Privacy → Jobs revocation finding

Privacy and Jobs have substantive revocation implementations, but the currently inspected source does not establish a complete deployed event chain.

Privacy R20 publisher:
- writes immutable event documents into consentRevocationOutbox;
- records owner, purpose, consent tier, policy version, source receipt hash, prior grant receipt hash, prior grant evidence state and integrity hash;
- exports a separate trusted acknowledgeConsentRevocation callable;
- does not itself invoke Jobs HTTP or export a dispatcher in the R20 source.

Jobs R923 receiver:
- exposes authenticated HTTPS ingestConsentRevocation;
- accepts strict legacy v1 decision-receipt and v2 source-receipt variants;
- v2 binds ownerUid, sourceReceiptHash, correlationId, revokedAt, purpose and policy version;
- does not accept or persist priorGrantReceiptHash or priorGrantEvidenceState;
- writes a Jobs-local consent block and receipt;
- explicitly returns privateOutputDeletionAcknowledged=false and storageWriteFenceVerified=false. Keep these fail-closed values.

## 3. Historical R647 dispatcher recovered — not deployed

Privacy R647 #214 at cc0692053db3b1b8df8267d43856b1a3357de8a0 contains a real prepared dispatcher library.

Exact donor source pins:
- consent-revocation-jobs-dispatcher.ts: 4126167b4350ba8afe6b19d7b60dec1ca891189f
- consent-revocation-jobs-contract.ts: 6cca2b9456319927cf22511c7d51c1f16ddf051c
- dispatcher contract test: def1048aa4838f7ff990d792a27d1fb94e7f6441
- Jobs contract test: fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa
- donor publisher consent-revocation.ts: 5b069b79d657b5c2006dd0ab45c8e60709ff0a89
- functions-entry.ts: f81171feb058be606be19134928c4baf9830f664

The dispatcher source explicitly labels itself PREPARED, NOT DEPLOYED. It says no timer, callable, scheduler or Functions entrypoint export is installed. It requires a reviewed system-only wrapper, Secret Manager authority and runtime IAM verification.

Reusable mechanics:
- bounded batch up to 20;
- UUID per-event leases;
- 60-second lease;
- up to 12 attempts;
- bounded exponential retry, 30 seconds to one hour;
- invalid/ambiguous events and exhausted attempts quarantined to needs-review;
- canonical consent identity and Firestore updateTime checked before send and rechecked before finalization;
- pinned HTTPS Jobs host/path and dedicated bearer;
- network send outside transaction;
- only verified Jobs ACK identity/hash permits root outbox state applied.

These are donor semantics, not deployed behavior or an already accepted integration.

## 4. R960 proves four compatibility defects

R647 cannot be cherry-picked into R20 unchanged:

A. Missing queue metadata. The old dispatcher query requires jobsDeliveryConsumerId=urai-jobs, jobsDeliveryState pending/retry/leased and jobsNextAttemptAt due. R647 publisher sets jobsDeliveryAttempts too. R20 publisher does not set those four delivery fields. The old dispatcher will not discover new R20 records.

B. Integrity hash changed. R647 mapper expects SHA256 over eventId, recordId, uid and purpose. R20 includes priorGrantReceiptHash and priorGrantEvidenceState in the integrity digest. Old mapper rejects R20 event hashes.

C. Prior grant evidence dropped. R647 v2 projection, event type and ACK do not include priorGrantReceiptHash or priorGrantEvidenceState. Jobs cannot prove which original granted receipt was superseded.

D. Timestamp provenance conflated. R647 maps outbox createdAt to Jobs revokedAt. R20 does not preserve a separate immutable source transition timestamp. Outbox creation time is not source revocation time.

R960 document blob: dd0a63100f2f493a6ed86b22a2224249a34ca169.

Therefore: preserve the R647 dispatcher as donor mechanics; draft a new versioned contract and upgrade publisher, mapper, receiver, local receipt, ACK and migration together. Do not restore old queue fields blindly.

## 5. ACK semantics

There are multiple records which must not drift:
1. Jobs local consent-block receipt.
2. Privacy outbox root delivery state and ACK hash used by R647 donor.
3. Privacy acknowledgements/{consumerId} written by R20 trusted ACK callable.
4. Privacy last-ACK summary fields.

Choose one canonical consumer ACK authority, or explicitly define a reconciled projection. An ACK may mean only that Jobs applied its defined consent block. It does not certify physical deletion, GCS writer denial or complete downstream purge.

## 6. New event contract proposal — design, not implemented

A new version must use a new explicit schema version. Bind:
- immutable eventId and consentRecordId;
- canonical owner UID, purpose, tier and policy version;
- current/source receipt hash;
- prior granted receipt hash and explicit prior evidence state;
- source transition timestamp and provenance, or explicit unknown state;
- outbox createdAt and delivery timestamps separately;
- immutable source-transition digest and integrity hash over every immutable field;
- correlation ID, tenant/service scope and source identity;
- mapper/contract version.

No silent legacy backfill. Missing/legacy lineage is quarantined or dispositioned by explicit Privacy/legal/security policy. Do not invent timestamps or prior grant evidence.

## 7. Estate-wide dispatcher search and manifest result

R957 searched the 19 known LifeLoggerAI repositories for the outbox, ACK callable, v2 event, token and dispatcher terms. No separate external dispatcher was identified in those results. This is not proof of absence.

R958 inspected Privacy and Jobs Firebase manifests and Functions entrypoints:
- Privacy Node 22 codebase privacy.
- Jobs Node 22 codebase default.
- Privacy exports producer and trusted ACK callable, but no dispatcher.
- Jobs exports the HTTP receiver, but no Privacy outbox poller.
- No scheduled/task outbox dispatcher declaration in the inspected manifests.

R959 corrected the prior overstatement: historical dispatcher source exists, but it is not exported/activated in R647 and does not exist in current R20 tree. External Cloud Scheduler, Cloud Tasks, Pub/Sub, Eventarc, Cloud Run or other deployed resources remain UNKNOWN.

Accurate phrasing: no active dispatcher is visible in inspected current source entrypoints/manifests; a historical prepared donor exists; external/deployed infrastructure remains unknown.

## 8. Operator withdrawal / data-rights continuation policy

Jobs #377 R900 reproduced that an admitted data-rights export/delete can continue after the initiating operator is downgraded/disabled. Reported diagnostic suite: 12/12 reproducing current behavior; strict counterfactual safety suite 12 PASS / 4 FAIL, exit 1. Expected-red policy diagnostic, not accepted test.

Jobs issue #376 remains open for Privacy/legal decision. Do not introduce blanket abort behavior. Approved owner deletion may need durable centrally authorized service continuation, even after operator removal. Or policy may require cancellation with monotonic revocation fence and partial-side-effect reconciliation.

Define before source changes:
- authority to continue an approved request;
- owner, request UUID, purpose, tenant, scope, service identity, consent lineage, revocation epoch, expiry and retry bounds;
- checks before every irreversible effect and before terminal ACK;
- partial failure/retry/reconciliation;
- owner-only export delivery;
- deletion finality only after real storage and downstream receipts.

## 9. Worker authentication, rollback and CI — separate release gates

R951 #388 production-first bearer guard changes four worker types. R952 #389 enrolls original test in mandatory verification. R953 prior report: exact original test bytes with source-matched excerpts 4/4 PASS; mutation 3 PASS/1 expected fail; restored 4/4. Exact original test blob d27cc3880aa2ae0387f81bb660ca340d830e22dc. R954 predecessor reports complete-source adapted harness 4/4 and mutation detection; retrieve exact receipts and per-file blob hashes before quoting. Neither proves deployed worker behavior.

R950 #387 protects Narrator canonical Docker entrypoint and execution route; deployed image unknown.

R949 #386 changes a manual rollback false-success placeholder to fail closed. Another Cloud Run traffic rollback helper exists but has not been rehearsed to prove exact healthy revision restoration.

Studio lifeMovieConsentAuthorityAvailable and privateOutputWriteAuthorityAvailable remain hard-off. Do not enable merely for demo/readiness.

R879: 58 source pins matching; 78 unique command segments enrolled, not completed acceptance. Source pins and command definitions are not tests. GitHub Actions has had startup_failure/missing logs and zero-step samples. Current protected CI and eligible nonauthor reviewer remain outstanding. Earlier branch API returned protected=false; refresh effective rulesets rather than bypass.

R932 #390 tests the real Jobs Zod schema against a synthetic Studio #201 envelope. It deliberately uses non-authorizing receipt and asserts consent gate remains false and render is deferred. This is separate from revocation delivery.

## 10. Full system release gates

- Protected CI runs on exact immutable heads; independent nonauthor approval; no bypass.
- Same-SHA source reconciliation across Privacy, Jobs, Studio, Spatial and downstream consumers.
- Full clean install, build, typecheck, native tests and disposable Auth/Firestore/Functions/Storage emulator.
- Canonical revocation event producer → outbox → dispatcher → Jobs receiver/block/receipt → Privacy ACK.
- Approved operator-withdrawal continuation policy.
- Real nonproduction effective GCS privileged writer denial after revocation; stale/alternate principal 403.
- Active uploads/streams drained or unable to finalize.
- Exact GCS object generations reconciled/deleted; durable final absence and downstream purge ACK.
- Authenticated C6 lifecycle: owner authority → Privacy → Studio plan → Jobs render → protected output → Replay → revocation → denial → purge → ACK.
- Actual Cloud Run/Firebase revisions, images, identities, ingress, secrets metadata, IAM and rollback provenance.
- Physical Windows/web/iOS/Android/XR acceptance; accessibility, reduced motion, captions, haptics and language support.
- AAA+++ launch visual acceptance and founder signoff.
- Apple/Google/billing/backups and other external operational gates.
- Explicit founder GO only after independent approval.

## 11. R961 actions and evidence boundary

R961 refreshed GitHub metadata for Jobs #379, #371, #377, #388, #389, #390, #386, #387, #384 and Privacy #214/#255/#256. Confirmed Jobs main SHA remains 9d29be1bcd3a45a4b9a743df9c9706c00811f38b; current forensic PR #379 observed at a1e3915a0151ab9f7480d6a02536356e8b29cdc9; all relevant reviews remain open/draft/unmerged.

R961 read R953–R960 handoff documents and preserved dispatcher recovery/compatibility facts. R961 did not run tests, clone full repositories, start emulators, invoke dispatcher, inspect provider resources, change source code or deploy.

## 12. Exact next steps

Phase A — donor:
1. Re-read R647 exact source blobs and recompute Git blob identity.
2. Inspect entire dispatcher, contract, tests, publisher and package scripts.
3. Execute donor tests only in an isolated checkout/toolchain; preserve exact log, exit, Node version, source SHA/tree. Otherwise explicitly mark NOT RUN.
4. Classify mocked network/Firestore fixtures accurately.

Phase B — contract:
5. Draft new shared versioned event type across Privacy and Jobs.
6. Specify event ID, integrity digest, prior grant lineage, current receipt, source timestamp provenance, outbox creation time and correlation.
7. Specify missing/legacy lineage disposition.
8. Choose a single ACK authority and semantics.

Phase C — review-only source:
9. Upgrade Privacy publisher and dispatcher mapper.
10. Add queue metadata only under the validated new contract.
11. Upgrade Jobs receiver, local receipt and ACK hash to persist all security lineage.
12. Reconcile root delivery ACK with Privacy ACK callable.
13. Design system-only wrapper, service identity, secret access, exact endpoint, IAM, retries/DLQ and protected deployment. Do not activate.

Phase D — native:
14. Same-SHA clean checkouts for Privacy and Jobs.
15. Locked install/build/typecheck and adapted donor tests.
16. Disposable Firebase Auth/Firestore/Functions/Storage emulator producer→dispatcher→Jobs→ACK flow.
17. Cover duplicate, conflict, stale lease, timeout after receiver commit, changed consent in transit, corrupt/legacy events, missing prior lineage, wrong consumer, ACK conflict, ordering and retries.
18. Full Jobs guarded suite and complete logs.

Phase E — provider/release:
19. Authorized read-only inventory of Cloud Run, Firebase Functions, Scheduler, Tasks, Pub/Sub, Eventarc, service identities, source/image digests, secrets metadata and effective IAM.
20. Separately approved nonproduction stale/alternate Storage writer 403, upload drain, exact generation purge and durable ACK.
21. Rollback rehearsal; devices/accessibility/visual signoff; independent approval.
22. Present complete evidence to founder. No GO implied by any earlier test pass.

Stop and quarantine on source mismatch, missing lineage, ambiguous lease, forged ACK, late write success, unknown service identity or any conflict. Never silently repair immutable records.

## 13. Final disposition

Recovered: historical dispatcher source and lease/retry/ACK mechanics; R20 lineage fields; exact R960 incompatibilities; operator-withdrawal policy issue; worker authentication and rollback review lineage; prior full Genesis evidence and remaining release gates.

Not completed: canonical new protocol, source integration, dispatcher activation, full native cross-service acceptance, live cloud inventory, real GCS late-write denial, upload drain, purge ACK, complete C6 lifecycle, protected CI, independent approval and founder GO.

**NO CHERRY-PICK / NO MERGE / NO DEPLOY / NO DISPATCH / NO PRIVATE MEDIA / NO IAM CHANGE / NO PAID COMPUTE. ONE URAI GENESIS — PRODUCTION HOLD.**
