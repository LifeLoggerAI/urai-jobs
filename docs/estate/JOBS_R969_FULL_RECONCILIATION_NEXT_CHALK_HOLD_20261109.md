# ONE URAI GENESIS — R969 Full Reconciliation and Next-Chalk Handoff

**Checkpoint:** R969 · November 9, 2026  
**Disposition:** **PRODUCTION HOLD / NO-GO**  
**Repository of record:** `LifeLoggerAI/urai-jobs`  
**Documentation branch:** `docs/genesis-jobs-firebase-forensics-20261109`  
**Purpose:** Continue from the actual R968 consolidated ledger, reconcile current GitHub state, preserve the three distinct revocation integration lineages, refresh the open release gates, and give the next Chalk one actionable starting point.

## 0. Executive disposition

R969 is a read-only source/metadata reconciliation and documentation pass. No application source, test, workflow, branch protection, Ruleset, CI run, deployment, IAM, Firebase Rules, provider resource, real job, or private media was changed or exercised.

The key results:

1. The Jobs forensic branch already contains a detailed R968 consolidated ledger and the three-track revocation architecture reconciliation. R969 continues that real shared history; it does not recreate or replace earlier rounds.
2. Jobs main remains at `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`. The revert removes the single accidental 90-line R933 test file and restores the previous tracked tree. The revert commit is unsigned. Do not rewrite history.
3. Jobs main remains unprotected in GitHub API readback: `protected=false`, `protection.enabled=false`, required status checks enforcement `off`, no required contexts/checks; repository Rulesets including parents returned an empty array.
4. The engineering review candidate #389 remains open/draft/unmerged at `b865209cc352241602d8b9714672f3401aed7669`. Its 78 command segments are enrolled, not executed.
5. The same ten Actions runs associated with #389 remain failed; no new runs appeared. Prior raw job data showed runner ID 0, blank runner names/groups and zero steps. This is a pre-step runner allocation signature; exact GitHub-side cause remains unknown.
6. The three integration lineages remain distinct: R647 donor dispatcher, Jobs #371 three-case synthetic Storage harness, and Privacy R818/R836 native Jobs-to-Privacy callable acceptance. Their tests and receipts cannot be transferred between them.
7. The Jobs #371 harness expects three Privacy `consent-jobs-*` modules whose exact source provenance has not been recovered. R647 is not a compatible substitute.
8. Privacy #83 remains open. The canonical decision/revocation source implementation exists; the unresolved gate is protected deployed runtime, registered downstream ACKs, provider-call suppression and exact deployment/rollback evidence.
9. Jobs #252, #345, #376 and #380 remain open. Studio consent authority and private GCS output-write authority remain deliberately hard-off.

No tests, dependency installs, builds, typechecks, emulators, revocation dispatch, provider inventory or GCS acceptance were executed in R969.

## 1. Canonical read order

Read in this order before action:

1. This report: `JOBS_R969_FULL_RECONCILIATION_NEXT_CHALK_HOLD_20261109.md`.
2. `JOBS_R969_MACHINE_CHECKPOINT_20261109.json`.
3. `JOBS_R969_START_NEXT_CHALK_R970_20261109.md`.
4. `JOBS_R968_CONSOLIDATED_CROSS_LINEAGE_RECONCILIATION_AND_RELEASE_LEDGER_20261109.md`.
5. `JOBS_R968_PRIVACY_JOBS_THREE_LINEAGES_AND_RELEASE_GATES_HOLD_20261109.md`.
6. `JOBS_R968_MACHINE_CHECKPOINT_20261109.json`.
7. `JOBS_R968_START_NEXT_CHALK_R969_20261109.md`.
8. R967 historical Privacy harness provenance report, supplemental report and machine checkpoint.
9. R966 emulator harness/derivative cleanup report and checkpoint.
10. R965 ACK/purge boundary, R964 ACK receiver/event identity, R963 v3 event/ACK proposal, R962 donor readiness and R961 master handoff.
11. R960–R953 reports, R944 source/runtime/cloud resource matrix, evidence ledger, taskbook and original START NEXT CHALK.
12. Refresh all live refs/issue/CI status before any mutation.

Jobs forensic PR: [#379](https://github.com/LifeLoggerAI/urai-jobs/pull/379).  
Genesis cross-chat PR: [Labs #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304).  
Master estate registry: [Labs #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262).

## 2. Current GitHub state — R969 readback

### 2.1 Jobs main

- Current branch SHA: `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`.
- Tree SHA: `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`.
- Parent: `792d063b9d894bb9cb872e2c3c6dd71e37804f6a`.
- Commit message: revert accidental default-branch R933 test-file update; keep review changes isolated.
- Patch deletes only `scripts/studio-life-movie-actual-producer-zod-contract.test.mjs`, a 90-line file added by the parent R933 commit.
- Resulting tree matches the tree from earlier main `9d29be1...`.
- Commit signature verification: unverified/unsigned.

This restores the earlier tracked tree, but the add-then-delete commit history remains. Preserve it. Do not force-push or rewrite.

### 2.2 Branch governance

Fresh GitHub readback:
- `protected=false`.
- `protection.enabled=false`.
- required status check enforcement `off`.
- required contexts and check list empty.
- Rulesets endpoint with inherited rules requested returned `[]`.

This remains a hard governance blocker. An authorized repository administrator must establish the approved main policy and read it back. Minimum acceptance:
- PR required; direct pushes restricted.
- Exact required successful checks.
- Independent eligible approval.
- Conversation resolution and stale approval policy.
- No bypass that defeats policy.
- Actual API verification that enforcement is active.

No protection setting was changed in R969.

### 2.3 Engineering PR graph

| PR | Head SHA | State | Purpose |
|---|---|---|---|
| Jobs #371 | `df19633466eaebdda844569ed0d562245bd31dc6` | Open/draft | R923 Jobs revocation receiver and three-case harness |
| Jobs #377 | `f8578ea281e818b01811aecc2fe4dfb8c3dc8203` | Open/draft | R900 data-rights operator withdrawal after admission |
| Jobs #388 | `17b8f53ac1f4c75ac2abdd50b7add631e61196c38` | Open/draft | R951 production-first worker authentication |
| Jobs #389 | `b865209cc352241602d8b9714672f3401aed7669` | Open/draft | R952 mandatory authentication test enrollment |
| Jobs #390 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | Open/draft | R932 Studio→Jobs actual Zod parser contract |
| Privacy #214 | `cc0692053db3b1b8df8267d43856b1a3357de8a0` | Open/draft | R647 dispatcher donor |
| Privacy #229 | `79e71fd6137947d2ed7c416a2596090572fef978` | Open/draft | R834 source pin |
| Privacy #230 | `846d2ffa469af5634374bd77fbdc2d41bca8e964` | Open/draft | Source/build parent |
| Privacy #231 | `42aad96404c4f0de01a448031df80f7b5c06f7c0` | Open/draft | R835 native runner candidate |
| Privacy #232 | `e1e2dee63c39590d343d727aa53618ac97a52691` | Open/draft | R836 two-parent native acceptance |
| Privacy #253–#256 | R17–R20 exact heads in R968 checkpoint | Open/draft | Subject, prior-grant and outbox replay lineage |

The heads are observed snapshots. Re-fetch before action. None establishes deployed code.

### 2.4 Documentation PRs

At R969 start read:
- Jobs #379 is open/draft/unmerged on `docs/genesis-jobs-firebase-forensics-20261109`, head `83b730875ab4d7c72dc02842019f5285b1373dff`, 66 changed files.
- Genesis Labs #304 is open/draft/unmerged on `docs/genesis-jobs-r944-crosschat-handoff-20261109`, head `e79e58de6995377ffb618be541a5e95b59791676`, 18 changed files.

R969 documentation commits will advance those heads; read them back after writing.

## 3. Three distinct Privacy/Jobs integration lineages

Do not collapse these into one “revocation dispatcher.”

### Track A — Privacy R647 prepared dispatcher donor

Privacy #214 exact head `cc0692053db3b1b8df8267d43856b1a3357de8a0`.

Blobs:
- Dispatcher `consent-revocation-jobs-dispatcher.ts`: `4126167b4350ba8afe6b19d7b60dec1ca891189f`.
- Contract `consent-revocation-jobs-contract.ts`: `6cca2b9456319927cf22511c7d51c1f16ddf051c`.
- Dispatcher tests: `def1048aa4838f7ff990d792a27d1fb94e7f6441`.
- Contract/transport tests: `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`.

Export: `dispatchPendingJobsRevocations`. It is prepared donor code, explicitly NOT DEPLOYED and has no installed scheduler/timer/wrapper/export. Historical suites comprise 10 and 16 top-level Node tests using mocked/fake Firestore and transport; none was executed in R969.

Mechanics to preserve after approved adaptation:
- bounded batch limit 20;
- 60-second UUID leases;
- max 12 attempts;
- bounded exponential retry;
- stale lease-owner prevention;
- transactional claim/finalize;
- immutable consent source revalidation;
- pinned HTTPS Jobs destination and bearer;
- network outside Firestore transaction;
- verified Jobs response before outbox delivery projection is marked applied.

R647 is not compatible with R20 unchanged:
1. R20 no longer writes the legacy queue fields R647 reads.
2. R20 integrity digest includes prior-grant receipt/evidence.
3. R647 mapping discards prior-grant evidence.
4. R647 maps outbox `createdAt` to revocation time, losing source transition timestamp.

Never cherry-pick unchanged or run a second dispatch loop.

### Track B — Jobs #371 three-case Storage revocation harness

Exact Jobs #371 HEAD `df19633466eaebdda844569ed0d562245bd31dc6`.

Test path/blob:
- `tests/emulator/privacy-jobs-storage-revocation.test.mjs`
- `e9662a979a72a0e39a61fe896a79f8379658d963`

Requires `URAI_PRIVACY_SOURCE_ROOT` containing five modules:
1. `consent-revocation-transition.ts`
2. `consent-jobs-delivery.ts`
3. `consent-jobs-http.ts`
4. `consent-revocation.ts`
5. `consent-jobs-dispatch.ts`

Expected export: `deliverJobsConsentRevocation`.

Three cases:
- synthetic event performs known-reference derivative cleanup before Privacy per-consumer ACK;
- RUNNING/in-flight Jobs attempt prevents ACK, preserves unresolved marker and can retry after lease expiry;
- synthetic 110 Jobs / 30 plans with 85 ms modeled per-transaction delay.

It uses local Firestore and Storage emulator APIs, a loopback HTTP server around actual Jobs `ingestConsentRevocation`, mocked Firebase Functions wrappers and synthetic token/actor. The `life-movie.render` fixture is directly seeded and is NOT an authorized owner grant or registered-purpose proof. This harness is manually invoked and is not part of the Jobs #371 root verify command.

The original Privacy three-module provenance was not recovered in R967/R968. GitHub code searches for the exact filenames/export returned zero results; inspected historical Privacy trees/path history and branch paths did not find them. This absence is scoped to searched GitHub refs and does not prove no local archive, alternate repository, renamed implementation or external service exists.

Do not substitute R647. Either recover the exact historical source from a grounded archive/workspace, or create a clearly labelled review-only harness rewrite after owner approval. Do not call a rewrite “recovered.”

### Track C — Privacy R818/R836 native Jobs→Privacy callable acceptance

Privacy #232 R836:
- HEAD `e1e2dee63c39590d343d727aa53618ac97a52691`.
- Runner blob `589fbbb8cb4903946b3adc1b2aa707038e61d3df`.
- Native transport test blob `cafd32784b4c95f72214938290637b819557f3bb`.
- Exact pinned Jobs #320 source `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`.

This exercises the original compiled Jobs identity/transport client against the actual Privacy consent callable in demo Firebase Auth/Firestore/Functions/Storage emulators. It validates denial of unscoped generic C6 consent and a separately labelled review-only synthetic issuer path. It is not the R647 outbox dispatcher or the Jobs #371 Storage-revocation harness.

The runner enforces exact clean checkouts, Node 22, pnpm 8.15.9, Java, demo-only project, no production credentials/overrides, frozen installs, full source typecheck/build, original Jobs owner/status test, then four emulators. R836's full native run was NOT completed: Functions worker Unix socket creation returned EPERM; hosted CI had no executable-step certificate.

The Jobs #320 historical 695 TAP pass, typecheck and build belong to #320 exact SHA only. Do not transfer them to Jobs #371/#389. Any newer pair requires a reviewed source comparison and explicit repin.

## 4. Privacy issue #83 — accurate current classification

Privacy issue [#83](https://github.com/LifeLoggerAI/urai-privacy/issues/83) is OPEN.

The original July issue body is stale as a source-status description. Later comments say the canonical versioned consent purpose registry, fail-closed decision service, callable APIs, revocation transition/outbox and ACK source exist.

The unresolved release gates are:
- authoritative deployment receipt for the canonical consent function in the project/region used by clients;
- signed owner grant/revoke, deny, expiry, stale and cross-user behavior against actual Auth/Firestore emulator and protected staging;
- registered downstream consumer acknowledgements;
- provider-call suppression after deny/revoke;
- effective deployed Rules and single authority across Privacy/Spatial;
- exact deployed SHA, rollback and independent review.

Classification: **SOURCE IMPLEMENTATION PRESENT / PROTECTED DEPLOYED RUNTIME AND CROSS-SERVICE ACCEPTANCE NOT PROVEN.** Do not close #83 on source-only green.

## 5. Derivative cleanup and receipt boundaries

Jobs #371 `functions/src/privacy/lifeMovieDerivativeRevocation.ts` blob `d441b4971d456f2e861b2640067cbde6a2dfff32` has:
- tenant/project/approved-bucket path validation;
- generation-pinned delete via `ifGenerationMatch`;
- idempotent handling of already absent exact generations;
- refusal to delete unknown/unattributed objects;
- persistent unresolved RUNNING/LEASED markers;
- bounded cleanup batches and fail-closed errors.

It does NOT establish:
- future-write denial;
- stale/alternate privileged writer HTTP 403;
- in-flight/resumable upload drain;
- all object versions/soft-deleted items/backups/signed URLs;
- full historical erasure;
- live IAM or downstream physical purge.

Receiver flags remain `privateOutputDeletionAcknowledged=false` and `storageWriteFenceVerified=false`. Keep three separate receipts:
1. Jobs local consent-block/cleanup receipt.
2. Privacy per-consumer application ACK.
3. Provider-level physical purge evidence.

A Jobs ACK is not physical purge.

## 6. Current Actions and branch-governance status

Jobs #389 exact head `b865209...` still has the same ten recorded failed workflow runs:
`42589887660`, `42589887640`, `42589887621`, `42589887656`, `42589887624`, `42589887604`, `42589887690`, `42589887581`, `42589887663`, `42589887599`.

Prior raw job readback: 12 executed jobs, runner ID 0, blank runner names/groups, zero steps; one Callable emulator E2E job skipped. Five inspected workflows use `ubuntu-latest`, not self-hosted runners. R969 found no new run or passing CI certificate. Cause of runner allocation failure remains UNKNOWN. Do not attribute it to billing, plan, GitHub outage, concurrency or workflow YAML without direct evidence.

Main is unprotected and required checks are disabled. The existing R879 source pin and test-enrollment safeguards do not replace active branch rules.

## 7. Open Jobs issues — freshly rechecked R969

| Issue | Priority | State | Current meaning |
|---|---|---|---|
| [#252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) | P0 | Open | Storage-enforced post-revocation write fence and active-upload drain |
| [#376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) | P1 | Open | Data-rights executor post-admission revocation/continuation policy |
| [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) | P1 | Open | Server-owned deletion-request binding must not be owner-mutable |
| [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345) | P2 | Open | Concurrent createJob quota admission under original transactions |

Issue titles and updated timestamps were refreshed in this pass:
- #252 updated Nov 8, 2026.
- #345 updated Nov 8, 2026.
- #376 updated Nov 9, 2026.
- #380 updated Nov 9, 2026.

The issue bodies still describe unresolved security or correctness work. Their presence as open issues is not proof of absence in every source branch; review source and PR lineage before implementing.

## 8. R969 execution record

Executed:
- Refreshed Jobs forensic PR #379 and changed-file list.
- Refreshed Jobs main and Privacy main heads/trees.
- Refreshed Jobs PR #371/#377/#389 and Privacy PR #214/#256 metadata.
- Refreshed Privacy issue #83 and its six comments.
- Refreshed Jobs issue #252/#345/#376/#380 states and update timestamps.
- Refreshed workflow run list at exact Jobs #389 head.
- Read exact Jobs #371 emulator harness, Privacy R836 native runner/test, and replay boundary document.

Not executed:
- clone or checkout;
- dependency install;
- test suite;
- R647 Node tests;
- Jobs #371 emulator harness;
- R836 native runner;
- build/typecheck;
- hosted HTTP/auth runtime;
- revocation dispatch;
- live cloud resource/IAM inventory;
- GCS 403, upload drain or physical purge.

No application source, workflow, branch protection, Ruleset, cloud resource, IAM, Firebase Rules, job, private media or production environment was changed.

## 9. P0–P3 remaining release plan

### P0 — Real Storage revocation and private Replay
1. Establish durable server-owned revocation epoch/fence and writer admission lease.
2. Prove all stale/alternate/privileged identities receive GCS 403 for any future write after revoke.
3. Fence/drain in-flight and resumable uploads.
4. Pin object generations and prove exact-generation physical deletion.
5. Obtain durable downstream purge ACK from every registered consumer.
6. Prove owner-authorized consent → Privacy decision → Studio plan → Jobs render/private output → Spatial owner-only Replay, then revoke, block future writes/playback, delete and acknowledge purge.
7. Keep Studio consent and private output hard-offs until independent acceptance.

### P1 — Runtime, governance and rights
- Recover compatible Jobs #371 source or approve a clearly labelled rewritten harness.
- Run original R647 unit suites separately.
- Run R836 exact native runner on a capable approved disposable host with exact refs.
- Run Jobs #371 harness only with exact compatible source.
- Add real worker HTTP tests: missing/malformed/wrong/revoked/valid token under production/staging with emulator flag true.
- Resolve #376/#380 with native Rules/rights acceptance.
- Establish protected CI and main-branch governance through authorized admin.
- Rehearse rollback to exact previous healthy revision in governed non-production.

### P2 — Quota and indexes
- Resolve #345 through native concurrent limit-1 admission tests, retry/idempotency and tenant isolation.
- Verify installed Firestore composite-index parity.

### P3 — Live provider inventory
Authenticated read-only inventory:
- Firebase projects/apps/databases, deployed Rules, installed indexes, Functions revisions;
- Cloud Run services/revisions, image digests, traffic, ingress and workload identities;
- Storage buckets and effective/inherited IAM;
- Tasks, Scheduler, Pub/Sub, Eventarc, logs, quotas and billing;
- exact deployed source/build SHA, secret version and configuration parity.

Unknown is not absent. Source configuration is not deployment proof.

## 10. R970 exact execution order

1. Read this R969 report, the JSON checkpoint, and the copy/paste R970 start prompt.
2. Re-fetch current Jobs main, Rulesets, #379/#304, engineering PRs #371/#377/#388/#389/#390, Privacy #214/#230–#232/#253–#256, issue #83 and Jobs issues #252/#345/#376/#380.
3. Preserve Jobs main revert history. Do not rewrite or force-push.
4. Diagnose Actions runner allocation from complete GitHub-side details; no blind reruns. Use one controlled review-only run only once hosted runner availability is evidenced.
5. Recover the exact historical source of the three Jobs #371 Privacy modules, or submit a clearly-labelled review-only harness rewrite after owner approval. Do not call a rewrite recovered.
6. Choose and document which tests cover each boundary: R647 donor unit tests; Jobs #371 local Storage-revocation emulator; R836 native callable-denial/review-only C6. Keep all separate.
7. Use clean immutable checkouts, lockfiles, exact commit/tree/blob IDs, Node/TypeScript/Java/pnpm/Firebase versions, full logs, exit codes and SHA-256.
8. Independently prove protected deployed Privacy consent/revocation, downstream ACK and provider suppression.
9. Independently prove nonproduction GCS 403, upload drain, generation deletion and durable purge ACK.
10. Update Jobs #379 and Labs #304 with exact receipts and keep main/prod untouched until separate authorized governance and release decisions.

## 11. Prohibitions and release decision

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**

No merge of engineering review PRs, no deployment, no dispatch, no private-media access, no IAM/Rules change, no CI bypass, no paid compute, no real customer jobs, and no launch GO under this audit.

Studio consent authority and private GCS output-write authority remain hard-off. Founder GO and independent security review remain required.

---
*R969 is a metadata/source/documentation reconciliation. It contains no new test pass or runtime acceptance. Re-fetch exact source refs before any action.*
