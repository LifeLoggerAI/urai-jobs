# ONE URAI GENESIS — R968 Consolidated cross-lineage reconciliation and release ledger

**Date:** 2026-11-09 UTC  
**Status:** **PRODUCTION HOLD / NO-GO**  
**Repository of record:** `LifeLoggerAI/urai-jobs`  
**Documentation branch:** `docs/genesis-jobs-firebase-forensics-20261109`  
**Forensic PR:** Jobs #379 (open, draft, unmerged at R968 refresh).  
**Scope:** consolidated source/review metadata, Privacy branch history, Jobs/Privacy revocation and callable test lineages, exact harness dependency mismatch, current source/runtime boundaries, release blockers and next actions. This report is a source-and-documentation reconciliation, not production certification.

---

## 0. Instruction to the next Chalk

Continue the original LifeLogger → LifeOS → UrAi ecosystem. Do not restart or replace surviving implementations. Preserve source ancestry and distinguish each acceptance lineage by exact commit, source tree, test files, dependencies and execution receipt.

**Most important correction:** there are several separate Privacy/Jobs integration pathways. They do not all implement the same protocol, and their test results cannot be transferred between them:

1. **Privacy R647 outbox dispatcher donor:** a prepared, not-deployed library named `consent-revocation-jobs-dispatcher.ts`.
2. **Jobs #371 three-case revocation/Storage emulator harness:** expects three Privacy modules named `consent-jobs-delivery.ts`, `consent-jobs-http.ts`, and `consent-jobs-dispatch.ts`. Their original source provenance has not been recovered.
3. **Privacy R818–R836 native Jobs→Privacy callable acceptance line:** uses a maintained runner and a different test named `life-movie-jobs-native-transport.emulator.mjs`; it tests actual Jobs compiled identity/transport code against the actual Privacy consent callable, including denial and review-only issuer conditions. It is not the R647 dispatcher and not the Jobs #371 revocation/Storage harness.

Never call these three “the same dispatcher,” and do not add their cases into one unqualified test total.

No merge, deploy, dispatch, IAM mutation, private media, paid compute or production GO is authorized in this round.

---

## 1. Current review graph — refreshed R968

Relevant Jobs PRs were re-read. Relevant Privacy PRs were re-read. All below remained open/draft/unmerged at the R968 read time.

### Jobs

| PR | Head SHA | Meaning |
|---|---|---|
| #379 | `bcb7c187a8c5f5d228721779d5479d6cebb224c6` before R968 writes | Forensic documentation PR |
| #371 | `df19633466eaebdda844569ed0d562245bd31dc6` | R923 two-parent convergence and Jobs revocation receiver/harness |
| #377 | `f8578ea281e818b01811aecc2fe4dfb8c3dc8203` | R900 operator withdrawal after data-rights admission |
| #388 | `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38` | R951 production-first worker bearer guards |
| #389 | `b865209cc352241602d8b9714672f3401aed7669` | R952 mandatory worker auth regression |
| #390 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | R932 actual Jobs Zod parser test for Studio producer envelope |
| #384 | `fd05a376f876f9b835929a2074c09f47638659e2` | R946 guarded source pin closure |
| #386 | `fd1c8d85acd5cc96ef9fcb300173e362b004eb54` | R949 rollback false-success hard-stop |
| #387 | `04592f8573c708954f95f87ddca1e168efde51f4` | R950 Narrator auth/entrypoint |

Jobs main last independently read in this chain: `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`. Re-fetch before any new source work.

### Privacy

| PR / round | Head SHA | Meaning |
|---|---|---|
| #192 / R506 | `7f5f4ad2f157a9d3eb4ed12b679d499fe5888bdc` | Four-emulator Privacy→Jobs Storage derivative bridge |
| #213 / R583 | `4a4656d6283aa7e627bf220b447436df82865f99` | Jobs264 dual-artifact/four-service bridge lineage |
| #214 / R647 | `cc0692053db3b1b8df8267d43856b1a3357de8a0` | Jobs272 source-lineage donor with prepared dispatcher library |
| #229 / R834 | `79e71fd6137947d2ed7c416a2596090572fef978` | Native Jobs source pin candidate |
| #230 | `846d2ffa469af5634374bd77fbdc2d41bca8e964` | Full workspace source/build gate candidate |
| #231 / R835 | `42aad96404c4f0de01a448031df80f7b5c06f7c0` | Strict native Jobs acceptance parent |
| #232 / R836 | `e1e2dee63c39590d343d727aa53618ac97a52691` | Two-line Privacy full-build/native-gate convergence |
| #253 / R17 | `90a4e581e8494f52d85eab3c576d02b926e7d0d9` | Canonical consent subject UID binding |
| #254 / R18 | `dbc193763dc112210c20b5b51189573a954873593` | Original granted identity replacement handling |
| #255 / R19 | `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a` | Prior grant receipt lineage |
| #256 / R20 | `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6` | Outbox replay collision and lineage classifier |

Privacy main last read in this chain: `1163d6f32a123ef9a6638e092a3eee5ec4a3b317`. Review SHAs do not establish deployed code.

---

## 2. Reconciliation of the three integration/acceptance tracks

### Track A — R647 prepared outbox dispatcher donor

Privacy #214 exact head: `cc0692053db3b1b8df8267d43856b1a3357de8a0`.

Exact donor blobs:
- `functions/src/consent-revocation-jobs-dispatcher.ts`: `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- `functions/src/consent-revocation-jobs-contract.ts`: `6cca2b9456319927cf22511c7d51c1f16ddf051c`
- `tests/consent-revocation-dispatcher-contract.test.mjs`: `def1048aa4838f7ff990d792a27d1fb94e7f6441`
- `tests/consent-revocation-jobs-contract.test.mjs`: `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`
- Donor publisher `functions/src/consent-revocation.ts`: `5b069b79d657b5c2006dd0ab45c8e60709ff0a89`

The code explicitly says **Prepared, NOT DEPLOYED** and that no timer/callable/scheduler/functions-entry export is installed. It exports `dispatchPendingJobsRevocations`.

Donor mechanics worth preserving after adaptation and tests:
- batch limit 20;
- 60-second UUID leases;
- maximum 12 attempts;
- bounded exponential retries from 30 seconds to one hour;
- stale lease owner prevention;
- transactionally claimed and finalized leases;
- immutable consent source/update-time revalidation around network send;
- pinned HTTPS Jobs destination and bearer;
- network call outside transaction;
- verified Jobs response before donor root outbox state becomes applied.

Do not cherry-pick as-is. R960 established:
1. R20 no longer writes the legacy `jobsDeliveryConsumerId/jobsDeliveryState/jobsDeliveryAttempts/jobsNextAttemptAt` queue fields used by R647.
2. R20 integrity hash includes prior-grant evidence; R647 computes the older digest.
3. R647 Jobs v2 mapping discards `priorGrantReceiptHash` and `priorGrantEvidenceState`.
4. R647 derives `revokedAt` from outbox `createdAt`, which is not source consent-transition time.

### Track B — Jobs #371 three-case Storage-revocation emulator harness

Jobs #371 source:
- `tests/emulator/privacy-jobs-storage-revocation.test.mjs`
- Blob `e9662a979a72a0e39a61fe896a79f8379658d963`
- Three top-level Node test cases.

It requires `URAI_PRIVACY_SOURCE_ROOT` with five Privacy modules:
1. `consent-revocation-transition.ts`
2. `consent-jobs-delivery.ts`
3. `consent-jobs-http.ts`
4. `consent-revocation.ts`
5. `consent-jobs-dispatch.ts`

It expects `deliverJobsConsentRevocation` from `consent-jobs-dispatch.ts`. The three test cases cover a synthetic revocation deleting a referenced object and ACKing, an unresolved in-flight Jobs attempt blocking ACK while retaining the unresolved marker, and a 110-job/30-plan synthetic latency fixture.

It uses real local Firestore and Storage emulator APIs for synthetic records and object deletion, plus a loopback HTTP server around Jobs `ingestConsentRevocation`. Firebase wrappers, actor/token and delivery callable are mocked. The fixture is directly inserted synthetic `life-movie.render` data, not a real registered-purpose positive consent grant.

**Exact provenance gap:** R967 inspected recursive Privacy trees for R506/#192, R583/#213, R647/#214, R818, R819, R823, R824, R825, R826, R834, R836 and R20/#256. None contained the three `consent-jobs-*` modules. GitHub path-specific history queries for each exact path returned empty arrays. A repository code search over the known 19 repository estate also returned no hits. This does not prove that an equivalent historical implementation never existed under another name, in a local archive, or outside the indexed repository estate.

Do not substitute R647's differently named module/API. Recover the original exact source or create a clearly labelled reviewed harness rewrite; never present a rewrite as recovered historical source.

The Jobs root `urai-jobs:verify` script does not enroll this three-case harness. It is manually invoked via the command documented in `docs/CONSENT_REVOCATION_REPLAY.md`, blob `31886c5ce46a39f2a0424aa377c157874a62ac84`:
```bash
URAI_PRIVACY_SOURCE_ROOT=/path/to/compatible/privacy-checkout firebase emulators:exec --project demo-urai-jobs-cleanup --only firestore,storage 'node --test tests/emulator/privacy-jobs-storage-revocation.test.mjs'
```
This is a reproduction command, not an executed test receipt.

### Track C — Privacy R818/R836 maintained Jobs→Privacy callable acceptance

Privacy #232 exact R836 head: `e1e2dee63c39590d343d727aa53618ac97a52691`.

Files:
- `scripts/run-r818-native-jobs-privacy-acceptance.sh`: blob `589fbbb8cb4903946b3adc1b2aa707038e61d3df`
- `tests/integration/life-movie-jobs-native-transport.emulator.mjs`: blob `cafd32784b4c95f72214938290637b819557f3bb`

This is not an outbox revocation dispatcher. It tests the **Jobs compiled identity/transport client calling the actual Privacy callable** `verifyLifeMovieRenderConsent` in a disposable Firebase Auth/Functions/Firestore/Storage emulator environment. The test first proves an unscoped C6 issuance is denied and no consent record is written, and has a separate synthetic review-only path with ephemeral test signing—not production issuer authority.

Runner safety/pinning:
- Privacy HEAD must equal caller-supplied exact `URAI_EXPECTED_PRIVACY_SHA`.
- Jobs disposable checkout under `/tmp` must equal Jobs #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`.
- Both trees must be clean.
- Requires Node 22 and pnpm 8.15.9 plus Java.
- Refuses inherited credentials/token/bucket overrides.
- Uses demo project `demo-urai-privacy-integration-test`.
- Executes frozen Privacy root/Functions installs, Privacy Functions typecheck/build, frozen Jobs install, Jobs owner/status test, full Jobs typecheck/build, then four Firebase emulators.
- The emulator transport redirects only known identity/Privacy URLs to local emulator addresses; all other targets are forbidden.
- Uses ephemeral local test keys; no production credentials.

R836 PR body says its new exact source required a full native run; the full four-emulator runner was **NOT RUN** on R836 because Functions worker Unix socket creation failed with EPERM and hosted CI had no executable-step certificate. Do not transfer parent #230/#231 historical passes to R836.

**Coverage boundary:** this track gives stronger real emulator evidence for Jobs→Privacy callable denial/review-only issuer than a mocked callable, but it is not Privacy outbox delivery, Jobs revocation ingestion, downstream consumer ACK, GCS late-write denial or physical purge.

---

## 3. Jobs derivative cleanup: source protections and missing guarantees

Jobs #371 `functions/src/privacy/lifeMovieDerivativeRevocation.ts`, blob `d441b4971d456f2e861b2640067cbde6a2dfff32`, includes:
- owner/tenant/project/bucket validation of output references;
- object generation pinning and `ifGenerationMatch` deletion;
- idempotent absent-object handling;
- inventory of canonical attempt prefixes;
- refusal to delete unknown/unattributed objects;
- persistent unresolved marker for RUNNING/LEASED attempts;
- bounded batches that settle before returning an error;
- explicit `privateOutputDeletionAcknowledged: false` and `storageWriteFenceVerified: false`.

A prefix listing is only a point-in-time observation. It does not fence future writes by a privileged stale worker. Unknown objects are not deleted. Unresolved in-flight attempts retain the marker across retries; this candidate has no automatic marker-clearing procedure. The replay doc also disclaims all historical/unrecorded object discovery, all object versions/soft-deletes, signed URL invalidation, backup erasure, arbitrary hosted latency and complete owner-wide deletion.

Three milestones must remain independent:
1. Jobs durable consent-block receipt.
2. Privacy canonical per-consumer application ACK.
3. Provider-level physical purge evidence: future writes denied, in-flight work drained, exact generations removed, final absence and downstream purge ACK.

No one milestone can certify the next.

---

## 4. Privacy R20 contract state and v3 proposal

Privacy R20 #256:
- publisher/ACK source `functions/src/consent-revocation.ts` blob `84f1e77d5c1cf55f80aaa0a559b6a3eac781386e`;
- transition helper blob `0ddee615f1284a58459aae48b915a574da7c9c9e`;
- Functions entry blob `59a6dcda725a322081f0609f5f01e81de801ee81`.

R20 immutable outbox includes owner, purpose, tier, policy, source receipt and prior-grant receipt/evidence. It exposes a separate trusted `acknowledgeConsentRevocation` callable. The callable validates token-bound consumerId and detailHash format, but the R964/R965 review found it does not independently recompute detailHash from a canonical Jobs receipt/action or recompute the complete immutable event digest at ACK time. Its duplicate ACK check includes actorUid, so stable service actor identity across retries/rollovers needs explicit semantics.

R963 proposed `consent.revoked.v3`, fixed canonical serialization, complete prior-grant lineage, source transition time with provenance distinct from outbox creation, immutable digest separate from mutable delivery metadata, Privacy per-consumer ACK as canonical application ACK, Jobs HTTP response as delivery evidence and outbox state as a projection. R964/R965 further require receiver-side event/action binding, stable workload identity and crash-safe identical-ACK recovery after a lost response.

This remains a **proposal only**. No v3 implementation or owner approval was established in R968.

---

## 5. Privacy issue #83 — current true runtime gate

Privacy issue [#83](https://github.com/LifeLoggerAI/urai-privacy/issues/83) remains **OPEN**. Its original July body is stale as a description of missing source; later October/November comments say the canonical consent decision service, versioned purpose registry, revocation transition/outbox/ACK and fail-closed owner/system authorization are implemented in source.

The current remaining gate is protected deployed runtime proof:
- canonical consent decision service deployed at the exact project/region used by consumers;
- signed owner grant/revoke and deny/expired/stale/cross-user tests;
- revocation reaches registered downstream consumers;
- downstream ACKs are verified;
- provider-call suppression is proven;
- actual deployed SHA and rollback/recovery are evidenced;
- effective Firestore/Storage rules are reconciled across Privacy/Spatial projects.

Do not close #83 on source presence or isolated synthetic test receipts.

---

## 6. Other release-critical lineage carried forward

### Data-rights operator withdrawal
Jobs #377 R900 reproduces that a data-rights operation admitted by a current operator can continue asynchronous work after operator downgrade/disable. Historical report: diagnostic 12/12 reproduced current behavior; strict counterfactual safety suite 12 PASS / 4 FAIL, exit 1 (expected-red policy diagnostic, not an accepted pass). Privacy/legal/security policy is required before code changes. Do not blindly abort owner-approved deletion; define centrally authorized continuation or monotonic revocation/cancellation and reconciliation.

### Worker authentication
Jobs #388/#389 are open review-only production-first bearer guard changes and mandatory regression enrollment. Source tests do not prove deployed middleware, Cloud Run image/revision, ingress or secret audience. Keep separate from consent revocation.

### Rollback
Jobs #386 R949 fails closed on a false-success rollback placeholder. Another rollback helper exists but exact restoration of previous healthy deployed revision has not been rehearsed.

### Studio private media
Studio consent authority and private-output write authority remain hard-off. Preserve; do not enable for demo or test convenience.

### Jobs R879 runner
58 source pins and 78 command segments enrolled do not equal completed acceptance. CI startup_failure/missing logs or zero steps are not app test failures or passes. Protected CI, branch rules and independent non-author reviewer remain outstanding.

### Other prior evidence
R5/R6/R7/R8/R9, R823 older 695-pass acceptance, Privacy #230/#231 predecessor passes, Spatial R672–R680, and all prior R1–R967 evidence remain scoped to their own commits/tests/environments. Never combine overlapping cases into one grand pass number or transfer a prior green result to a newer untested source head.

---

## 7. R968 actual work and environment

R968:
- refreshed Jobs PR #379/#371/#377/#388/#389/#390/#384/#386/#387 metadata;
- refreshed Privacy #192/#213/#214/#229/#230/#231/#232/#253–#256 metadata;
- re-confirmed relevant PRs remained open/draft/unmerged;
- rechecked Privacy issue #83 open status;
- scanned all 19 known LifeLoggerAI repositories for exact missing `consent-jobs-*` paths and `deliverJobsConsentRevocation`: no code-search hits;
- inspected exact R836 native runner and integration test, plus Jobs #371 harness and R647 library;
- retried `git ls-remote` directly in container.

Git result: exit 128, `Could not resolve host: github.com`.

No clone, checkout, locked install, Node tests, typecheck, emulator, endpoint, cloud inventory or provider test occurred. No application code changed. DNS is a tooling/network blocker, not an application test failure.

---

## 8. Consolidated acceptance matrix

| Gate | Source evidence | Executed at R968 | Release status |
|---|---|---|---|
| Privacy canonical consent source | Present in main/review history | No new runtime test | Source exists; protected runtime open |
| R647 dispatcher donor | Exact source and tests recovered | No | Prepared / NOT DEPLOYED |
| Jobs #371 revocation harness | Exact test source recovered | No; compatible Privacy source missing | Harness dependencies unresolved |
| R818/R836 Jobs→Privacy callable test | Exact test/runner source recovered | No R836 run | Denial/review-only path; R836 run pending |
| R20 outbox publisher/ACK | Exact source recovered | No | Source exists; no connected dispatcher proof |
| v3 canonical protocol | Design documents only | No | Proposed, unapproved, unimplemented |
| Jobs derivative cleanup | Generation-pinned source | No new test | Selected object cleanup only; write fence false |
| Real GCS late-write denial | No provider evidence | No | OPEN |
| Active upload/stream drain | Partial model/source markers | No provider test | OPEN |
| Physical purge/final absence | Partial generation cleanup | No final provider proof | OPEN |
| Worker auth | Review PRs and tests | No deployment proof | OPEN |
| Operator withdrawal policy | Reproduction / expected-red diagnostics | Not rerun | POLICY HOLD |
| Protected CI/independent review | Runner/source pins, CI failures | Not certified | OPEN |
| Deployed source/image/IAM | No authoritative readback | No | UNKNOWN |
| Full C6 authenticated lifecycle | Separate partial gates | No | OPEN |
| Devices/accessibility/visual | Historical partials | No R968 acceptance | OPEN |
| Founder GO | Not granted | No | NO-GO |

---

## 9. Exact next execution plan

### R969-A: Recover the Jobs #371 harness source provenance
1. Identify the original creator/commit context for the Jobs #371 harness and its `URAI_PRIVACY_SOURCE_ROOT` expected modules.
2. Search only grounded archives/workspaces or source bundles associated with the R506/R583/R818 line. Do not fabricate recovery.
3. If exact original modules cannot be recovered, prepare a review-only redesign of the harness against one chosen source architecture and mark it as rewritten/adapted, not historical original.
4. Keep R647 and R818/R836 acceptance paths separate.

### R969-B: Choose one integration contract
5. Review R963–R965 v3 proposal with Privacy, Jobs, legal and security owners.
6. Choose source event identity/hash, time provenance, prior lineage, legacy disposition and canonical ACK.
7. Define whether Jobs ACK means only consent block committed or includes a distinct derivative-invalidation result. Keep physical purge false.
8. Define stable workload identity and idempotent ACK recovery after both Jobs-commit and Privacy-ACK-commit timeouts.
9. Choose one dispatcher architecture; do not activate two independent delivery loops on the same outbox.

### R969-C: Execute actual test suites when checkout is available
10. On a Git-connected host, clean-checkout exact R647, Jobs #371 and Privacy R836 refs, verify commit/tree/blob hashes and lockfiles.
11. Run R647 10-case dispatcher and 16-case contract tests separately.
12. Run Jobs #371 three-case emulator harness only with its exact compatible Privacy source; otherwise report unavailable.
13. Run R836 maintained runner separately with exact pinned Privacy and Jobs SHAs, Node22/pnpm8.15.9/Java requirements. Do not carry prior parent receipts forward.
14. Capture raw TAP/stage logs, SHA256, exit codes, runtime versions, project IDs and exact source manifests.

### R969-D: Provider and production gates
15. Authorized read-only inventory of deployed Privacy/Jobs Functions, Cloud Run, Scheduler, Tasks, Pub/Sub, Eventarc, workload identity, image/source digests, ingress, secrets metadata and effective IAM.
16. Separate protected nonproduction GCS stale/alternate writer 403, active upload drain, exact generation purge and durable final absence ACK.
17. Complete protected CI/branch protection, non-author approval, rollback rehearsal, C6 end-to-end, device/accessibility/visual acceptance and external operations.
18. Present complete evidence to founder; do not infer GO.

---

## 10. Final classification

**Fully source-reconciled within the inspected lineages:** R647 donor, Jobs #371 harness dependency API, R818/R836 native callable acceptance, R20 outbox, Jobs R923 receiver/derivative cleanup, issue #83 runtime gate, and the connected review graph.

**Still not recovered:** exact original Privacy source for the three `consent-jobs-*` modules expected by the Jobs #371 test.

**Still not executed:** R647 donor tests, Jobs #371 harness, R836 runner on exact candidate, full builds, native current-head cross-service acceptance.

**Still unknown:** actual deployed dispatcher, deployed source/image, workload identities, secrets/audience, ingress, effective Storage IAM, stale-writer behavior and actual downstream purge.

**No source runtime changes. No merge. No deploy. No dispatch. No private media. No IAM change. No paid compute.**

# ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.
