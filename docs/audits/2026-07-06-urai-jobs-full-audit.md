# URAI Jobs Full Repository Audit

**Repository:** `LifeLoggerAI/urai-jobs`  
**Canonical branch audited:** `main`  
**Audited base SHA:** `f364c5b8497203d886108e22d262bb9460604ec4`  
**Audit branch:** `audit/production-correctness-20260706`  
**Audit PR:** `#63`  
**Audit date:** 2026-07-06  
**Classification:** **Partially complete**

## 1. Executive truth summary

`urai-jobs` is a real but internally inconsistent asynchronous job runtime built around Firebase Functions, Firestore, Pub/Sub, Cloud Run workers, Firebase Auth, Firebase Hosting, and GCS. It is not an empty scaffold. The repository contains functioning queue creation, transactional leasing, scheduled dispatch, callable administration, security rules, a provider-backed narrator TTS worker, an asynchronous Asset Factory dispatcher, an operator UI, deployment scripts, and historical production evidence.

It is **not production complete**. The audited `main` branch had correctness defects that could cause duplicate execution, false success, cancellation overwrite, stuck RUNNING jobs, and an advertised callable that was not actually a Firebase trigger. Production deployment scripts conflict, several workers are explicit placeholders, the career worker is scaffold-only, many documented job families have no implementation, authentication sources disagree, retries and dead-letter handling are split across competing implementations, and no exact current production SHA or rollback SHA can be established.

The public Career V1-V5 pages are currently mounted inside the same Vite application as the internal runtime, despite repository boundary documents requiring the public career product to be a separated module or companion surface. The pages primarily use seed data and scaffold workers; they are product prototypes, not verified marketplace capabilities.

## 2. Canonical repository facts

| Item | Established state |
|---|---|
| Repository | `LifeLoggerAI/urai-jobs` |
| Visibility | Public |
| Default branch | `main` |
| Audited base SHA | `f364c5b8497203d886108e22d262bb9460604ec4` |
| Current production SHA | **Unable to establish**; historical proof does not bind deployment to current `main` |
| Rollback SHA | **Unable to establish** |
| Runtime root | Repository root monorepo |
| Package manager | pnpm `8.15.9`, with npm invoked inside workspace scripts |
| Node runtime | Node 22 for Functions and CI |
| Build | `pnpm build` |
| Typecheck | `pnpm typecheck` |
| Test | `pnpm test`; mostly invariant/smoke/build checks, with behavioral execution-guard smoke added by PR #63 |
| Development | `pnpm dev` for Vite web |
| Firebase project alias | `.firebaserc` default: `urai-jobs` |
| Hosting site | `urai-jobs-563121397472` |
| Historical hosting evidence | `https://urai-jobs.web.app`; `https://urai-jobs-563121397472.web.app` |
| Intended custom domains | `uraijobs.com`, `www.uraijobs.com`; current attachment not proven |
| Compute | Firebase Functions plus Cloud Run workers |
| Queue/event transport | Firestore `jobQueue` plus Pub/Sub topic `job-execution` |
| Persistence | Firestore `jobs`, `jobQueue`, nested job logs, plus inconsistent top-level `logs`/`jobResults` use |
| Artifacts | GCS plus GitHub Actions/commit references for Asset Factory |
| Authentication | Firebase Auth; Firestore user-role lookup in some v1 callables; custom claims in v2 callables |
| Monitoring | Structured Cloud Logging in narrator; ad hoc logs elsewhere; no verified complete dashboard/SLO/alert deployment |
| Branch protection | Unable to establish through available repository operations |
| Releases/tags | No authoritative release/tag state established |
| CODEOWNERS | Missing |
| Dependabot | Missing |

## 3. Actual product purpose

The repository's canonical role is the **internal URAI background execution fabric**:

- accept authorized job requests;
- persist jobs and queue entries;
- lease work atomically;
- dispatch work to subsystem workers;
- track status, logs, results, retries, cancellation, and dead-letter state;
- expose operator/admin controls;
- produce deployment and release evidence.

The Google Drive architecture specification places `urai-jobs` in the URAI control/operations layer alongside `urai-admin`, `urai-studio`, and `urai-staging`. `urai-spatial` remains the canonical public app and `asset-factory` remains the canonical asset pipeline.

The approved PDR permits a future autonomous career product, but explicitly requires its candidate/employer/marketplace/passport surfaces to be separated from the operator runtime and to have independent security, privacy, data, and release gates.

## 4. Architecture and data-flow map

```text
Authorized client/operator
  -> Firebase callable createJob
      -> Firestore jobs/{jobId}
      -> Firestore jobQueue/{jobId}

Cloud Scheduler
  -> processQueueTick
      -> transactional PENDING -> LEASED
      -> Pub/Sub job-execution { jobId, leaseToken }

Pub/Sub
  -> executeJob
      -> transactional LEASED -> RUNNING
      -> select worker URL by job family
      -> authenticated HTTP invocation
          -> narrator-worker: Google Cloud TTS -> GCS
          -> asset-worker: GitHub repository_dispatch -> Asset Factory -> callback
          -> spatial-worker: placeholder, disabled by PR #63
          -> studio-worker: placeholder, disabled by PR #63
          -> career-worker: scaffold, disabled in nonlocal runtime by PR #63
          -> content/storytime/analytics/communications: URL settings exist, implementations absent
      -> synchronous result -> SUCCESS
      -> asynchronous HTTP 202 -> remain RUNNING pending callback
      -> error -> FAILED

Scheduled recovery
  -> retryExpiredLeases
  -> systemReconcile
      -> expired lease recovery
      -> stale RUNNING recovery
      -> retry or DEAD

Terminal Firestore trigger
  -> cleanupTerminalJobs deletes queue entry
  -> onJobTerminalEvent writes an operational log

Operator web
  -> list/get/retry/cancel/process-now callables
```

### Trust boundaries

1. Browser to Firebase callable boundary.
2. Callable authorization to Firestore user/claim state.
3. Scheduler/Pub/Sub to execution function.
4. Execution function to Cloud Run worker HTTP endpoints.
5. Asset worker to GitHub API and Asset Factory workflow.
6. Worker/provider to GCS artifact storage.
7. Public career pages to internal job runtime.

### Failure boundaries

- callable/Firestore transaction failure;
- queue lease and Pub/Sub publication split-brain;
- duplicate Pub/Sub delivery;
- worker timeout or non-2xx response;
- asynchronous callback loss/replay;
- stale RUNNING recovery;
- provider/GitHub/GCS outage;
- schema mismatch between job, queue, worker, and result implementations;
- missing secrets or Cloud Run invocation configuration.

## 5. Feature inventory

### Implemented and evidenced in code

- Firebase callable job creation with validation, ownership, payload cap, and rate limit.
- Firestore job and queue persistence.
- Scheduled queue leasing and Pub/Sub publication.
- Manual operator queue processing.
- Job lookup, listing, retry, cancellation, and log listing callables.
- Default-deny Firestore and Storage rules.
- Operator/admin Vite UI.
- Narrator TTS worker using Google Cloud Text-to-Speech and GCS.
- Asset worker GitHub dispatch and callback path.
- Worker health endpoints.
- Historical Firebase deployment and authenticated smoke documentation.

### Implemented but incomplete or unverified

- stale lease and stale heartbeat recovery;
- dead-letter behavior;
- cancellation of RUNNING work;
- retry policy and backoff;
- production Cloud Run authentication;
- deployment evidence stamping;
- worker metrics and alerts;
- custom domains;
- artifact ownership/read paths;
- current live production parity.

### Placeholder, mock, demo, or scaffold

- spatial worker;
- studio worker;
- generic managed worker, which echoes payloads and emits synthetic success;
- career worker outputs;
- Career Mirror/Marketplace/Automation/Decision/Passport pages backed by seed data;
- local inline worker fallback outputs.

### Documented but not implemented

- privacy export and deletion jobs;
- marketing demo/share-card jobs;
- analytics enrichment worker;
- communications worker;
- content worker;
- storytime worker;
- administrative review worker;
- dependency/DAG workflows;
- fan-out/fan-in;
- recurring user jobs;
- provider budget enforcement;
- tenant quotas;
- complete backup/restore/disaster recovery.

## 6. Job-type and workflow inventory

### Accepted by audited `createJob`

- `narrator.tts`
- `asset.*` / `asset-*`
- `spatial.*` / `spatial-*`
- `studio.*` / `studio-*`
- `career.*`
- `content.*` / `content-*`
- `storytime.*`
- `analytics.*`
- `communications.*`
- `admin.*`
- `deployment.*`
- `proof.*`

### Actually handled

- `narrator.tts`: real Google TTS implementation.
- asset worker: `asset.generate`, `asset.validate`, `asset.package`, `asset.publish`, `asset.forge.v1` through GitHub dispatch.
- career worker: profile, fit, document, packet, follow-up, interview, offer, spatial portal, and passport types, but all scaffold-only.
- spatial/studio: no real work.

### Contract mismatches

- `privacy.*` and `marketing.*` are documented but rejected by `createJob`.
- `assetFactory.asset.generate` is documented but does not match the accepted `asset[.-]` pattern.
- documented retry counts are not represented by per-job durable retry policies.
- `deployment.*`, `proof.*`, and `admin.*` are accepted but have no worker mapping.
- content/storytime/analytics/communications URL settings exist but no deployed worker implementation is present.

## 7. Integration inventory

| System | Actual state |
|---|---|
| `asset-factory` | Real GitHub repository-dispatch integration; callback/schema/heartbeat convergence incomplete |
| `urai-spatial` | Contracts documented; worker placeholder; Asset Factory callback may link a spatial commit |
| `urai-studio` | Contracts documented; worker placeholder |
| `urai-analytics` | Job contract and env key only; no worker verified |
| `urai-privacy` | Contracts only; creation currently rejected |
| `urai-content` | Env key and accepted family; no worker verified |
| `urai-communications` | Contract/env key; no worker verified |
| `urai-storytime` | Contract/env key; no worker verified |
| `urai-admin` | Operator/admin UI exists locally in this repo; cross-repo contract not verified |
| `urai-marketing` | Contracts only; creation currently rejected |

## 8. Test and CI results

### Audited main

No current check suite could be associated with audited `main` SHA through the available commit-status operation. Historical documents claim successful builds, emulators, deployment, and production smoke on earlier code, but they do not establish current-SHA production readiness.

### Audit PR #63

Initial PR head `61e69773c32aee01d5dbcffbc5d11afc0b14b3f4` produced:

- Career Surfaces CI: PASS.
- CI: FAIL at `pnpm typecheck`.
- Runtime CI: FAIL.
- Typecheck Diagnostics: FAIL.
- System Audit: FAIL.
- Production Verify: FAIL.

The exact TypeScript failure was:

```text
src/jobs/executeJob.ts: Type 'DONE' is not assignable to JobStatus
```

Root cause: `JobQueueEntry.status` incorrectly reused `JobStatus`, even though queue records legitimately use `DONE`. Commit `09c4e7e461180319712efd2d02acaefa4fb0121c` introduced a separate `JobQueueStatus` contract. New checks are required before merge.

### Testing gaps

- No coverage measurement.
- No complete behavioral unit suite for job transitions.
- Emulator E2E exists but current pass is not yet established.
- No contract tests against real workers.
- No cancellation race test.
- No duplicate Pub/Sub delivery test beyond the new pure guard smoke.
- No async callback replay test.
- No load, soak, chaos, backup-restore, or disaster-recovery test.
- Web has no component, accessibility, or end-to-end test suite.

## 9. Security and privacy findings

- Firestore and Storage rules are default deny and are among the strongest existing controls.
- Worker deployment is inconsistent. The general deploy script uses `--allow-unauthenticated` and does not inject required worker tokens/provider secrets. A separate asset workflow does inject Secret Manager values, creating conflicting deployment authorities.
- Spatial/studio endpoints accepted public requests and emitted synthetic success when a valid lease token was supplied. PR #63 makes them authenticated and fail closed.
- Career worker lacked authentication and emitted synthetic success in production. PR #63 makes it authenticated and refuses scaffold success outside local/test.
- Generic managed worker bypasses auth when its token is absent and echoes full payloads into results/logs.
- Asset callback uses a static bearer secret but has no callback nonce, replay ledger, or terminal/lease guard.
- Authorization source differs by callable: Firestore user role/permissions in v1 code and custom claims in v2 code.
- Payload and result logging can expose private content. Career/generic workers explicitly echo payloads.
- No verified App Check posture for public callables.
- No verified dependency vulnerability report, SBOM, provenance attestation, container scan, or signed release artifact.
- GitHub Actions use mutable action tags and several workflows omit explicit `permissions`.
- No CODEOWNERS or automated dependency-update configuration is present.
- Privacy export/delete is documented but not implemented.
- No proven retention, deletion, backup, or restore policy exists for jobs, logs, results, idempotency records, or artifacts.

## 10. Reliability and production-readiness findings

- Duplicate Pub/Sub delivery could re-execute or fail a valid job; repaired in PR #63.
- A late worker response could overwrite `CANCELLED`; repaired in PR #63.
- HTTP 202 from the async asset worker was treated as immediate SUCCESS; repaired in PR #63.
- `lease.heartbeatAt` was queried by reconciliation but not initialized by the main execution path; repaired in PR #63.
- No periodic heartbeat is emitted for long asynchronous jobs.
- `retryExpiredLeases` and `systemReconcile` duplicate recovery with different retry/dead-letter models.
- Synchronous execution failures go directly to FAILED; automatic transient retry/backoff is not integrated into the execution path.
- Cancellation changes Firestore state but does not signal or abort a running worker/provider operation.
- Queue publication occurs after lease transaction. A publish failure leaves a leased job until recovery.
- Cleanup deletes queue records, while other paths preserve `DONE`; operational history semantics are inconsistent.
- Current production SHA, rollback SHA, deployed worker revisions, and environment values are not recorded in one authoritative receipt.
- Historical production proof used a locally connected worker and observed legacy status `COMPLETED`, not the canonical `SUCCESS` model.

## 11. Performance and scalability findings

- Scheduled leasing is capped at 10 jobs per minute, approximately 0.17 jobs/second before manual processing.
- Priority is indexed/documented but not used by the current leasing query.
- No tenant, organization, provider, or job-type concurrency limit exists in the dispatcher.
- Narrator has an in-process concurrency governor, but the Functions dispatcher and other workers do not share a distributed limit.
- No cost ceiling, token/character quota, provider budget, or per-tenant spend guard is enforced.
- Admin listing has limited pagination/sorting support and can become inefficient.
- Rate limiting is Firestore-query based and nontransactional across concurrent callers.
- No performance, load, queue-growth, or large-payload benchmark is recorded.

## 12. Documentation findings

- `README.md` and `MARKETPLACE_BOUNDARY.md` correctly define the runtime boundary.
- The PDR correctly requires a separated public career module.
- The current Vite app violates that separation by mounting public career V1-V5 routes in the operator runtime.
- `URAI_JOBS_CURRENT_STATUS.md` is stale and describes workers/functions as uninspected.
- `PRODUCTION_VALIDATION_2026_05_10.md` is historical and does not record the deployed SHA or rollback SHA.
- `URAI_JOBS_CORE_STATUS.md` calls the runtime production-ready while explicitly describing workers as stubs.
- Multiple docs use legacy status names such as `COMPLETED`.
- Deployment workflows and runbooks do not establish one canonical deploy authority.

## 13. Complete gap register

| ID | Sev | Finding | State / evidence | Impact | Recommended fix | Blocks production | Autonomous now |
|---|---|---|---|---|---|---|---|
| UJ-001 | P1 | `getJobStatus` was not a Firebase trigger | Plain async export in TS; stale JS had different behavior | Advertised callable absent/unreliable | Wrap with authenticated v1 callable | Yes | Fixed PR #63 |
| UJ-002 | P1 | Duplicate/stale execution unsafe | No status/token guard before RUNNING | Duplicate work, false FAILED, provider cost | Transactional start/finalize guards | Yes | Fixed PR #63 |
| UJ-003 | P1 | Cancellation overwrite race | Worker success unconditionally set SUCCESS | Cancelled work could complete and publish | Re-read status/lease before finalize | Yes | Fixed PR #63 |
| UJ-004 | P1 | Async 202 falsely finalized | Asset worker returns 202; dispatcher marked SUCCESS | False release/artifact proof | Keep RUNNING until callback | Yes | Fixed PR #63 |
| UJ-005 | P1 | Stale RUNNING recovery had no heartbeat field | Reconciler queried `lease.heartbeatAt`; dispatcher did not write it | Permanently stuck jobs | Initialize/update canonical heartbeat | Yes | Partially fixed |
| UJ-006 | P1 | Idempotency key accepted but ignored | Schema accepted key; no lookup/write | Duplicate jobs and cost | Transactional owner/type/key record | Yes | Fixed PR #63 |
| UJ-007 | P1 | Queue and job status schemas conflated | Queue writes DONE but shared type rejected it | CI failure and schema drift | Separate `JobQueueStatus` | Yes | Fixed PR #63 |
| UJ-008 | P1 | Cloud Run deploy auth/secrets broken | General deploy uses unauthenticated services and injects only env/bucket | Worker rejection or public placeholder endpoints | One canonical IAM/Secret Manager deploy | Yes | No |
| UJ-009 | P1 | Spatial and Studio workers are placeholders | Source comments and synthetic SUCCESS | False capability claims | Implement real contracts or fail closed | Yes for those families | Fail-closed fixed |
| UJ-010 | P1 | Career worker is scaffold-only | `status: stubbed`, synthetic GCS paths | False product/runtime success | Implement storage/provider logic in separated module | Yes for career launch | Fail-closed fixed |
| UJ-011 | P1 | Generic worker emits synthetic success and payload echo | `workers/src/index.ts` | Data leakage and false proof | Remove from production path or implement real adapter | Yes if deployed | No |
| UJ-012 | P1 | Job-family routing incomplete | Many accepted/documented families lack workers | Jobs fail or route incorrectly | Explicit registry and startup validation | Yes for advertised families | Partially fixed |
| UJ-013 | P1 | Three incompatible data models | `types/`, package shared types, functions local shared types | Runtime/schema drift | Canonical versioned contracts package | Yes | No |
| UJ-014 | P1 | Auth source drift | Firestore roles vs custom claims | Inconsistent access/revocation | One authorization service and tests | Yes | No |
| UJ-015 | P1 | Retry/dead-letter behavior inconsistent | Two schedulers, differing fields/statuses | Unpredictable recovery | One retry engine with policy/backoff/jitter | Yes | No |
| UJ-016 | P1 | No real RUNNING cancellation | Firestore state only | Provider cost and user trust | Cancellation token/abort callback and worker polling | Yes for autonomous work | No |
| UJ-017 | P1 | Current deploy/rollback authority unknown | Historical proof lacks exact deployed SHA | Cannot certify or safely roll back | Machine-readable release receipt | Yes | No, requires cloud access |
| UJ-018 | P1 | No current staging lifecycle proof | 2026-06-30 proof says BLOCKED | Failure paths unverified | Deploy exact SHA and capture lifecycle evidence | Yes | No, requires staging authority |
| UJ-019 | P1 | CI duplicated and contradictory | Numerous overlapping workflows; unlocked installs | Slow/noisy checks and conflicting gates | Consolidate required checks, frozen lockfile | Yes | Partially |
| UJ-020 | P2 | Mutable Actions and missing governance | Action tags; no CODEOWNERS/Dependabot | Supply-chain/review risk | Pin SHAs, explicit permissions, ownership | No alone | Yes, separate PR |
| UJ-021 | P2 | Tracked build/audit artifacts and adjacent JS/TS | 49 MB repo, `_audit`, compiled JS | Source ambiguity and bloat | Prove unused, remove in staged cleanup | No | Separate PR |
| UJ-022 | P1 | Behavioral test coverage insufficient | Mostly substring/invariant checks | Regressions pass CI | Unit, emulator, worker contract, race tests | Yes | Partially |
| UJ-023 | P2 | Queue throughput and priority incomplete | 10 jobs/min; priority unused | Backlog growth | Configurable batches, priority, metrics, load tests | No for low volume | No |
| UJ-024 | P2 | No distributed quotas/cost controls | Only create rate limit | Provider abuse/cost spike | Tenant/provider budgets and concurrency | Yes before broad launch | No |
| UJ-025 | P2 | Admin APIs lack mature pagination | Limit-only queries | Operational degradation | Cursor pagination, filtering, ordering | No | Yes |
| UJ-026 | P2 | No workflows/DAG/fan-out/fan-in | No implementation found | Cannot orchestrate complex pipelines | Versioned workflow engine after core hardening | No | No |
| UJ-027 | P1 | Privacy jobs and data-rights workflows absent | Docs only; create rejects privacy family | Cannot satisfy runtime data rights | Implement audited export/delete workers | Yes before personal-data launch | No |
| UJ-028 | P1 | Sensitive payload/result logging | Payload echo and broad result metadata | Privacy exposure | Structured redaction and log schema | Yes | Partially fixed in dispatcher |
| UJ-029 | P1 | Asset callback lacks replay/state guard | Static secret only | Replayed/late callback mutation | Signed nonce, run ID, lease/terminal checks | Yes for asset production | No |
| UJ-030 | P2 | Asset schema mismatch | Worker reads `payloadInline`; create writes `payload` | Configuration silently ignored | Shared input/output schema and contract tests | No | Yes |
| UJ-031 | P1 | Artifact access path mismatch | Narrator writes arbitrary GCS prefix; rules expect owner/job paths | Owners may not read outputs safely | Canonical artifact path and signed access | Yes | No |
| UJ-032 | P2 | Public career scope mixed into runtime | App mounts Career V1-V5 seed routes | Security/product boundary erosion | Separate app/module and Firebase data plane | No for runtime, yes for career | No |
| UJ-033 | P2 | Backup/restore/DR unproven | No verified runbook/test evidence | Data-loss recovery unknown | Scheduled exports, restore drill, RPO/RTO | Yes for production maturity | External |
| UJ-034 | P3 | Documentation contradicts implementation | Multiple stale status/proof docs | Misleading launch decisions | Supersede docs with canonical status | No | Audit doc completed |

## 14. Production blockers

1. CI must pass on the exact PR head.
2. Canonical contracts must replace the three incompatible type/schema families.
3. One production deploy workflow must be selected and secured with IAM/Secret Manager.
4. Narrator and asset workers need exact staging lifecycle proof.
5. Placeholder/scaffold workers must remain disabled until real implementations and contract tests exist.
6. Retry, dead-letter, heartbeat, and cancellation behavior must be unified.
7. Current deployed SHA, worker revisions, configuration fingerprint, and rollback SHA must be captured.
8. Staging and production smoke must cover create, lease, run, success, failure, retry, cancel, dead-letter, callback, and artifact access.
9. Privacy retention/export/delete and logging redaction must be completed before processing broad personal life/career data.

## 15. Quick wins completed in PR #63

- Restored `getJobStatus` callable.
- Added state guards for duplicate/stale Pub/Sub messages.
- Preserved cancellation and newer leases during finalize/failure.
- Corrected asynchronous 202 behavior.
- Initialized lease heartbeats.
- Honored configured Pub/Sub topic.
- Added explicit worker mappings for documented URL settings.
- Enforced idempotency keys transactionally.
- Added behavioral guard smoke tests and functions test command.
- Disabled false-success behavior in placeholder spatial/studio workers and nonlocal career scaffold.
- Separated job and queue status contracts.

## 16. Audit branch commits

- `c86d237a3ff8079f0d6ce748a5722a6f3f4a63e1` restore `getJobStatus` callable.
- `01c4804da41ccb7ca7f1cd3a66cd28ab70da5999` add execution guards.
- `087e86993edae7d86d4f5e45eeb01f648a0f39a3` harden execution and async dispatch.
- `8687f97acafe68d3986629d6342d1b6b90aaace4` initialize scheduled lease heartbeat/topic.
- `b9c2ebdbbadc86d0550f688d6b10ef5e8c343046` align manual queue processing.
- `66edef689545c31ed32ffa82159598055f4dc24b` add execution-guard smoke.
- `ac43eff6f6c01fcc6104593d8810c8e80cb50692` add functions test command.
- `648a291c057e7a4ad9bc4864f68263ba8f850fae` execute behavioral smoke in root CI.
- `5fc20633f750ec583e716e6f37b9e347fd70541b` enforce idempotency keys.
- `6921b042b2094687843d709277a884afcef17c9e` fail closed in spatial placeholder.
- `53062d5e9c70aa183bf07db641c0d4ca769b3182` fail closed in studio placeholder.
- `61e69773c32aee01d5dbcffbc5d11afc0b14b3f4` secure/fail-close career scaffold.
- `09c4e7e461180319712efd2d02acaefa4fb0121c` separate queue and job status types.

## 17. Dependency-ordered roadmap

### Foundation

| Item | Objective and deliverables | Prerequisites | Definition of done | Tests/evidence | Size | Risk |
|---|---|---|---|---|---|---|
| F1 Canonical contracts | One versioned job/queue/log/result/artifact/auth package; remove local duplicates | PR #63 | All runtime packages compile against one schema | typecheck, schema fixtures, migration compatibility | L | High |
| F2 CI consolidation | One required PR workflow plus focused diagnostics; frozen lockfile; explicit permissions | F1 | Required checks are deterministic and nonduplicated | clean CI on exact SHA | M | Medium |
| F3 Repo hygiene | Remove proven generated JS/tsbuildinfo/audit snapshots; document source-of-truth | F2 | No source/build ambiguity; reduced repo size | clean clone/build/search | M | Medium |
| F4 Governance | CODEOWNERS, Dependabot/Renovate, contribution/release rules | F2 | Review and dependency policy enforced | settings screenshot/API evidence | S | Low |
| F5 Auth unification | One role/permission resolver for all callables | F1 | Claims/document behavior identical and tested | emulator auth matrix | M | High |

### Production completion

| Item | Objective and deliverables | Prerequisites | Definition of done | Tests/evidence | Size | Risk |
|---|---|---|---|---|---|---|
| P1 Retry engine | One policy-driven retry/dead-letter/recovery path with backoff+jitter | F1 | deterministic attempts and DEAD transition | emulator clock/failure tests | L | High |
| P2 Cancellation | cancel request propagation, worker abort/poll, callback rejection | F1 | RUNNING cancellation stops or safely discards work | race and provider mock tests | L | High |
| P3 Heartbeats/leases | periodic heartbeat, lease extension, deploy draining | P1 | no orphaned RUNNING job under crash/redeploy | chaos test | L | High |
| P4 Secure deploy | canonical OIDC/IAM worker invocation, Secret Manager, no conflicting workflow | F2 | workers private or strongly authenticated; secrets injected safely | unauthorized/authorized probes | L | High |
| P5 Artifact model | canonical paths, metadata, checksums, owner access, retention | F1, P4 | owner/operator can retrieve artifact; unauthorized denied | rules emulator + GCS proof | M | High |
| P6 Observability | correlation IDs, metrics, queue depth, failures, cost, alerts, dashboards, SLOs | P1-P5 | documented SLO and firing alert tests | dashboard/alert evidence | L | Medium |
| P7 DR/retention | backups, TTL, restore and rollback runbooks | P5 | restore drill meets defined RPO/RTO | dated drill receipt | M | High |
| P8 Release certification | exact SHA/revisions/config/rollback receipt and full staging smoke | all above | exact build promoted with evidence | machine-readable receipt | M | High |

### Core capability expansion

| Item | Objective | Definition of done | Size |
|---|---|---|---|
| C1 Worker registry | Typed job-family to worker/route/schema/cost/retry registry | startup rejects missing production mappings | M |
| C2 Admin operations | cursor pagination, filters, timeline, safe retry/cancel/DLQ replay | operator E2E tests | M |
| C3 Delayed/recurring jobs | durable schedule definitions and misfire rules | emulator schedule tests | L |
| C4 Workflow/DAG | dependencies, fan-out/fan-in, compensation, versioning | deterministic workflow integration tests | XL |
| C5 Tenant quotas | concurrency, rate, payload, cost and provider ceilings | abuse/load tests | L |

### Ecosystem integration

| Sequence | Deliverable | Owner boundary |
|---|---|---|
| E1 | Narrator TTS production contract and artifact proof | `urai-jobs` runtime + narrator worker |
| E2 | Asset Factory callback v2 with signed run identity, heartbeat, receipt, and cost | `urai-jobs` + `asset-factory` |
| E3 | Spatial snapshot/replay worker contract | `urai-spatial` owns scene/render logic; jobs owns orchestration |
| E4 | Studio rendering contract | `urai-studio` owns studio work; jobs owns queueing |
| E5 | Privacy export/delete | `urai-privacy` owns policy/deletion semantics; jobs owns durable execution |
| E6 | Analytics/content/storytime/communications adapters | subsystem owns business logic; jobs owns durable execution |
| E7 | Career product separation | companion app/module owns candidate/employer data; runtime accepts approved jobs only |

### Scale and hardening

- configurable queue batch and scheduler frequency;
- priority and fairness scheduling;
- provider/tenant distributed concurrency;
- load shedding and queue-age SLOs;
- regional strategy and documented cross-region limits;
- large-artifact out-of-band payloads;
- cost attribution and hard budgets;
- container scanning, SBOM, provenance, signed images;
- canary rollout and deployment-safe draining.

### Advanced roadmap

Only after production completion:

- personal-agent workflow rules with explicit consent and kill switches;
- on-device job execution and secure result synchronization;
- AR/VR/XR render and spatial-index pipelines;
- replay-film rendering pipelines;
- private life-map enrichment jobs;
- bounded autonomous career workflows in the separated career product;
- intelligent routing based on latency, privacy, cost, and device capability.

## 18. Critical path

```text
Canonical contracts
  -> deterministic CI
  -> unified auth
  -> retry/cancel/heartbeat state machine
  -> secure worker deployment
  -> real narrator + asset contract proof
  -> artifact access and retention
  -> observability/alerts
  -> staging failure-path certification
  -> exact production SHA + rollback receipt
```

## 19. Parallel workstreams

- **Runtime state machine:** retries, cancellation, heartbeats, idempotency, DLQ.
- **Platform/security:** IAM, Secret Manager, CI, supply chain, branch rules.
- **Workers/integrations:** narrator, asset, spatial, studio, privacy, subsystem adapters.
- **Operations:** metrics, dashboards, alerts, DR, release receipts.
- **Product boundary:** separate career app/data model from operator runtime.
- **Repository quality:** canonical types, generated-file cleanup, docs.

## 20. External and authority blockers

- Firebase/GCP project access to inspect actual deployed Functions, Firestore indexes, Hosting releases, Cloud Run revisions, service accounts, IAM, Secret Manager, logs, alerts, backups, and billing.
- DNS/Firebase Hosting authority for custom domains.
- Provider/billing authorization for real TTS, asset generation, email/SMS, rendering, or other billable jobs.
- Product authority for final career-product repository/module ownership and public launch scope.
- Privacy/legal authority for retention, data-rights, employer sharing, and autonomous external actions.

No paid provider work or production deployment was triggered during this audit.

## 21. Exact next autonomous actions

1. Keep PR #63 draft until all exact-head CI checks pass.
2. Repair any remaining exact-head failures using uploaded diagnostics and workflow logs.
3. Update issue #53 into the canonical production-readiness tracker and link this report/PR.
4. Open focused child issues for secure deploy, canonical contracts, retry/cancel/heartbeat, worker completion, privacy/retention, and repository hygiene.
5. Consolidate CI in a separate reviewable PR after runtime correctness PR #63.
6. With staging authority, deploy the exact passing SHA and capture the full lifecycle/failure evidence set.
7. Promote to production only with an exact deployment receipt and rollback SHA.

## 22. Final completion classification

**Partially complete.**

Evidence supports a real internal runtime foundation and one real provider-backed worker, but core production guarantees, worker implementations, deployment security, current live proof, privacy operations, and exact release authority remain incomplete. Historical production claims cannot substitute for exact-current-SHA certification.