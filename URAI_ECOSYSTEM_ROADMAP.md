URAI-JOBS Production Audit + Completion Plan

System definition

URAI-JOBS is the execution backbone for asynchronous, traceable, permissioned work across the URAI ecosystem. It accepts job requests from internal systems or authenticated external clients, validates and normalizes them, places them into a controlled execution queue, dispatches them to isolated workers, records intermediate and final state, and exposes result artifacts and telemetry back to the originating system.

Inputs are job creation events from four primary sources. URAI Spatial creates render, transition, capture, replay, or state-precompute jobs. URAI Studio creates video, storyboard, export, caption, bundle, and delivery jobs. Narrator creates script, TTS, alignment, and voice-package jobs. Asset Factory creates asset generation, validation, packaging, and publishing jobs. Secondary inputs include authenticated API requests, admin console actions, scheduled recurring jobs, and internal system events emitted from Firestore or Pub/Sub.

The processing pipeline is fixed. A request enters through an authenticated creation interface. The payload is validated against a job type contract. A job record is written to Firestore in jobs. A dispatchable queue record is written to jobQueue. A queue processor claims eligible work, enforces concurrency and rate rules, and hands execution to a worker. The worker writes heartbeats, progress, structured logs, partial outputs, and final results. Terminal state is committed atomically into jobs, jobResults, and logs. Follow-on events notify the originating URAI subsystem.

Outputs are canonical job records, execution traces, result manifests, generated artifacts, delivery receipts, metrics, and audit logs. Every job must produce a stable result envelope even when it fails. That envelope includes status, reason, retry metadata, timing, actor, and artifact references.

URAI Spatial connects by submitting jobs for scene render prep, replay asset generation, state projection, screenshot/video render orchestration, and transition package builds. URAI Studio connects by using URAI-JOBS as its production execution layer for timeline renders, subtitle generation, voice sync, export packaging, and publish-ready bundles. Narrator connects by issuing script generation, voice model selection, TTS synthesis, caption alignment, and narration export jobs. Asset Factory connects by issuing asset build, validation, conversion, deduplication, packaging, and distribution jobs. URAI-JOBS is not a feature module. It is the operating execution substrate underneath all of them.

Complete Firestore schema

Collection: jobs

Purpose: canonical source of truth for every job’s identity, requested work, lifecycle, ownership, and final status.

Document id: jobId as ULID or time-sortable UUID.

Schema:

type JobStatus = 'CREATED' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'RETRY' | 'DEAD' | 'CANCELLED'
type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
type JobOrigin = 'SPATIAL' | 'STUDIO' | 'NARRATOR' | 'ASSET_FACTORY' | 'API' | 'SCHEDULER' | 'ADMIN'
type JobVisibility = 'PRIVATE' | 'TEAM' | 'SYSTEM'
type JobType =
  | 'spatial.render.scene'
  | 'spatial.render.replay'
  | 'spatial.capture.snapshot'
  | 'studio.render.video'
  | 'studio.export.bundle'
  | 'studio.generate.subtitles'
  | 'narrator.generate.script'
  | 'narrator.synthesize.voice'
  | 'narrator.align.captions'
  | 'asset.generate'
  | 'asset.validate'
  | 'asset.package'
  | 'asset.publish'
  | 'system.cleanup'
  | 'system.reconcile'
  | 'system.replay.deadletter'

interface JobDoc {
  id: string
  type: JobType
  status: JobStatus
  priority: JobPriority
  origin: JobOrigin
  requestedBy: {
    uid: string
    actorType: 'USER' | 'SYSTEM' | 'SERVICE'
    serviceName?: string
  }
  tenantId: string
  projectId?: string
  workspaceId?: string
  visibility: JobVisibility

  dedupeKey: string
  idempotencyKey: string
  correlationId: string
  parentJobId?: string
  rootJobId: string
  chainId?: string

  payloadRef?: string
  payloadInline?: Record<string, unknown>
  inputManifest?: {
    refs: string[]
    version?: string
    hash?: string
  }

  target: {
    system: 'SPATIAL' | 'STUDIO' | 'NARRATOR' | 'ASSET_FACTORY' | 'SYSTEM'
    resourceId?: string
    outputBucketPath?: string
  }

  scheduling: {
    notBefore?: FirebaseFirestore.Timestamp
    expiresAt?: FirebaseFirestore.Timestamp
    cronId?: string
  }

  execution: {
    workerClass: string
    queueName: string
    maxAttempts: number
    attemptCount: number
    claimedBy?: string
    claimedAt?: FirebaseFirestore.Timestamp
    startedAt?: FirebaseFirestore.Timestamp
    heartbeatAt?: FirebaseFirestore.Timestamp
    completedAt?: FirebaseFirestore.Timestamp
    timeoutSec: number
    leaseExpiresAt?: FirebaseFirestore.Timestamp
    concurrencyKey?: string
    rateLimitKey?: string
    isolationMode: 'FUNCTION' | 'CLOUD_RUN' | 'IN_PROCESS'
    region: string
  }

  progress: {
    percent: number
    stage?: string
    message?: string
    checkpoints?: Array<{
      at: FirebaseFirestore.Timestamp
      name: string
      value?: string
    }>
  }

  result: {
    resultId?: string
    outputRefs?: string[]
    summary?: string
    checksum?: string
  }

  error?: {
    code: string
    category: 'VALIDATION' | 'AUTH' | 'TRANSIENT' | 'PERMANENT' | 'DEPENDENCY' | 'TIMEOUT' | 'INTERNAL'
    message: string
    detail?: Record<string, unknown>
    lastFailedAt?: FirebaseFirestore.Timestamp
    lastFailedBy?: string
  }

  timestamps: {
    createdAt: FirebaseFirestore.Timestamp
    updatedAt: FirebaseFirestore.Timestamp
    queuedAt?: FirebaseFirestore.Timestamp
  }

  flags: {
    cancelRequested: boolean
    replayable: boolean
    emitsEvents: boolean
    archived: boolean
  }

  version: number
}

Relationships: jobs/{jobId} links to jobQueue/{jobId}, jobResults/{jobId}, and logs/{logId} through jobId, rootJobId, and correlationId.

Indexes required:
status + priority + scheduling.notBefore
tenantId + status + timestamps.createdAt desc
requestedBy.uid + timestamps.createdAt desc
rootJobId + timestamps.createdAt asc
execution.queueName + status + execution.leaseExpiresAt
dedupeKey + status
correlationId

Lifecycle fields: status, execution.attemptCount, execution.startedAt, execution.completedAt, execution.leaseExpiresAt, progress.percent, error, flags.cancelRequested.

Collection: jobQueue

Purpose: dispatch queue optimized for worker selection and leasing, separate from full job document to reduce hot contention.

Document id: same as jobId.

Schema:

interface JobQueueDoc {
  jobId: string
  tenantId: string
  queueName: string
  workerClass: string
  status: 'READY' | 'LEASED' | 'DONE' | 'DEAD'
  priorityScore: number
  availableAt: FirebaseFirestore.Timestamp
  leaseOwner?: string
  leaseToken?: string
  leaseAcquiredAt?: FirebaseFirestore.Timestamp
  leaseExpiresAt?: FirebaseFirestore.Timestamp
  attemptCount: number
  maxAttempts: number
  concurrencyKey?: string
  rateLimitKey?: string
  sizeClass: 'XS' | 'S' | 'M' | 'L' | 'XL'
  region: string
  createdAt: FirebaseFirestore.Timestamp
  updatedAt: FirebaseFirestore.Timestamp
}

Indexes:
queueName + status + availableAt + priorityScore desc
leaseOwner + status
status + leaseExpiresAt

Lifecycle fields: status, leaseOwner, leaseToken, leaseExpiresAt, attemptCount.

Collection: jobResults

Purpose: immutable result envelope and output manifest.

Document id: same as jobId.

Schema:

interface JobResultDoc {
  jobId: string
  rootJobId: string
  correlationId: string
  tenantId: string
  type: JobType
  status: 'SUCCESS' | 'FAILED' | 'DEAD' | 'CANCELLED'
  producedAt: FirebaseFirestore.Timestamp
  durationMs: number
  outputs: Array<{
    kind: 'FILE' | 'JSON' | 'URL' | 'METRIC' | 'EVENT'
    ref: string
    mimeType?: string
    sizeBytes?: number
    checksum?: string
  }>
  metrics?: {
    cpuMs?: number
    memoryMb?: number
    renderFrames?: number
    tokensUsed?: number
    retries?: number
  }
  summary?: string
  error?: {
    code: string
    message: string
    category: string
  }
}

Indexes:
tenantId + producedAt desc
rootJobId + producedAt asc
type + status + producedAt desc

Collection: users

Purpose: operator and client identity profile used for tenancy and authorization.

Document id: uid.

Schema:

interface UserDoc {
  uid: string
  email: string
  displayName?: string
  tenantId: string
  roleIds: string[]
  status: 'ACTIVE' | 'DISABLED' | 'INVITED'
  profile?: {
    avatarUrl?: string
    locale?: string
    timezone?: string
  }
  createdAt: FirebaseFirestore.Timestamp
  updatedAt: FirebaseFirestore.Timestamp
  lastLoginAt?: FirebaseFirestore.Timestamp
}

Indexes:
tenantId + status
email

Collection: roles

Purpose: RBAC role definitions.

Document id: role slug, such as admin, system, client, worker.

Schema:

interface RoleDoc {
  id: string
  name: string
  permissions: string[]
  system: boolean
  createdAt: FirebaseFirestore.Timestamp
  updatedAt: FirebaseFirestore.Timestamp
}

Collection: permissions

Purpose: optional explicit permission registry for validation and admin UI introspection.

Document id: permission name.

Schema:

interface PermissionDoc {
  id: string
  description: string
  category: 'JOBS' | 'RESULTS' | 'ADMIN' | 'SYSTEM' | 'INTEGRATION'
}

Collection: logs

Purpose: immutable structured execution log events.

Document id: auto-id.

Schema:

interface LogDoc {
  jobId?: string
  rootJobId?: string
  correlationId?: string
  tenantId: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
  source: 'API' | 'TRIGGER' | 'QUEUE' | 'WORKER' | 'SCHEDULER' | 'SECURITY' | 'SYSTEM'
  event: string
  message: string
  context?: Record<string, unknown>
  actor?: {
    uid?: string
    service?: string
    workerId?: string
  }
  timestamp: FirebaseFirestore.Timestamp
}

Indexes:
jobId + timestamp asc
correlationId + timestamp asc
level + timestamp desc
source + timestamp desc

Collection: systemState

Purpose: small set of singleton documents for locks, counters, global flags, and job-engine config.

Document ids:
global
rateLimits
maintenance
queueConfig
deadletter

Schemas:

interface GlobalStateDoc {
  maintenanceMode: boolean
  acceptedOrigins: string[]
  minWorkerVersion?: string
  createdAt: FirebaseFirestore.Timestamp
  updatedAt: FirebaseFirestore.Timestamp
}

interface QueueConfigDoc {
  queues: Array<{
    name: string
    maxConcurrency: number
    defaultTimeoutSec: number
    backoffBaseSec: number
    backoffMaxSec: number
    enabled: boolean
  }>
  updatedAt: FirebaseFirestore.Timestamp
}

interface DeadletterStateDoc {
  replayEnabled: boolean
  maxReplayBatchSize: number
  updatedAt: FirebaseFirestore.Timestamp
}
Job lifecycle engine

Canonical state machine:

CREATED means the request has been accepted and normalized but not yet made dispatchable.

QUEUED means a jobQueue document exists and the job is eligible or scheduled for dispatch.

RUNNING means a worker owns a valid lease and has begun execution.

SUCCESS means execution completed and final results were committed.

FAILED means the current attempt failed but the job is still eligible for retry evaluation.

RETRY means the system explicitly scheduled another attempt after a transient failure or timeout.

DEAD means no additional attempts will be made and the job is permanently dead-lettered.

CANCELLED is a terminal administrative or client-initiated stop.

Transition rules:

CREATED -> QUEUED only after payload validation, authorization, dedupe check, and queue assignment.

QUEUED -> RUNNING only after atomic lease claim with a non-expired leaseToken.

RUNNING -> SUCCESS only after result manifest, status update, queue cleanup, and terminal log write all succeed in a single transaction or transaction-plus-compensating-write pattern.

RUNNING -> FAILED when execution errors before terminal success.

FAILED -> RETRY only if attemptCount < maxAttempts and failure category is transient, timeout, or dependency.

RETRY -> QUEUED when availableAt is computed using backoff and queue record is reset.

FAILED -> DEAD when permanent failure, validation failure, auth failure, explicit poison payload classification, or attempts exhausted.

ANY_NON_TERMINAL -> CANCELLED only when cancellation is allowed by job type and no irreversible output step is in progress.

Failure handling rules:
Validation failures never retry.
Auth/RBAC failures never retry.
Dependency outages retry with exponential backoff plus jitter.
Timeouts retry if heartbeat indicates partial liveness loss but no final commit.
Worker crash during RUNNING triggers lease expiry recovery and requeue if attempts remain.
Duplicate delivery is tolerated through idempotency keys and output commit guards.

Retry logic:
nextDelaySec = min(backoffBaseSec * 2^(attemptCount-1), backoffMaxSec) + jitter
Jitter must be bounded and deterministic enough for operational analysis.
Default recommended values: base 30s, max 3600s.

Idempotency guarantees:
Every create request requires idempotencyKey.
A unique dedupe check is performed against (tenantId, type, idempotencyKey) for active windows.
Workers must write outputs using deterministic output refs when possible.
Terminal commit must verify the job is not already in a terminal state.
Side-effecting integrations must store external receipt IDs in jobResults.
Replay of a lease is blocked by leaseToken mismatch.
Result writes are append-safe but terminal status is single-writer.

Cloud Functions full set

Function: createJob
Trigger type: HTTPS callable or HTTPS onRequest behind Auth.
Input:

{
  type: JobType
  tenantId: string
  projectId?: string
  workspaceId?: string
  payload: Record<string, unknown>
  priority?: JobPriority
  idempotencyKey: string
  target?: Record<string, unknown>
}

Output:

{
  jobId: string
  status: 'CREATED' | 'QUEUED'
  correlationId: string
}

Responsibility: authenticate actor, validate schema by job type, enforce role permissions, compute dedupe key, create jobs, create jobQueue, emit creation logs.

Function: onJobCreatedEnqueue
Trigger type: Firestore onDocumentCreated for jobs/{jobId} or inline in createJob.
Input: JobDoc.
Output: queue record and log events.
Responsibility: transform accepted job into ready queue work when not using inline creation.

Function: processQueueTick
Trigger type: Cloud Scheduler to Pub/Sub or scheduled function every minute or every few seconds depending load.
Input: none.
Output: claimed batches published to execution channel or directly dispatched.
Responsibility: scan eligible queue records by availableAt, respect per-queue concurrency limits, acquire leases atomically, dispatch workers.

Function: executeJob
Trigger type: Pub/Sub or HTTPS internal invocation from queue processor. For heavy workloads, this should hand off to Cloud Run worker rather than do full work inside Functions.
Input:

{
  jobId: string
  leaseToken: string
}

Output: none synchronously beyond ack.
Responsibility: load job, validate lease, mark RUNNING, execute handler by type, heartbeat during long work, write progress, write result or failure.

Function: updateJobHeartbeat
Trigger type: callable internal helper or direct Firestore write by executor.
Input: jobId, leaseToken, progress payload.
Output: updated heartbeat.
Responsibility: keep leases alive and progress visible.

Function: handleJobFailure
Trigger type: internal helper invoked by executor on catch.
Input: jobId, leaseToken, error envelope.
Output: updated jobs, jobQueue, logs.
Responsibility: classify error, increment attempts, compute retry schedule or dead-letter.

Function: retryExpiredLeases
Trigger type: Cloud Scheduler.
Input: none.
Output: requeued orphaned jobs.
Responsibility: find queue items with expired lease and matching non-terminal jobs, restore them to QUEUED or DEAD.

Function: cleanupTerminalJobs
Trigger type: Cloud Scheduler.
Input: none.
Output: archival flags, old queue removal, old logs compaction.
Responsibility: purge stale queue entries, archive logs/results based on retention policy.

Function: replayDeadletterBatch
Trigger type: admin HTTPS internal endpoint or scheduled controlled replay.
Input:

{
  limit: number
  queueName?: string
  reasonFilter?: string
}

Output: batch replay summary.
Responsibility: selectively replay dead-letter jobs after manual approval or known fix rollout.

Function: cancelJob
Trigger type: HTTPS callable.
Input: jobId.
Output: updated status or cancellation requested state.
Responsibility: authorize actor, mark cancellation intent, stop future retries, optionally signal worker.

Function: getJobStatus
Trigger type: HTTPS callable or Firestore direct read.
Input: jobId.
Output: job state, progress, result summary.
Responsibility: safe status retrieval.

Function: onJobTerminalEvent
Trigger type: Firestore onDocumentUpdated for jobs/{jobId} when entering terminal state.
Input: before/after job.
Output: downstream integration events.
Responsibility: emit success/failure events to Spatial, Studio, Narrator, Asset Factory.

Function: systemReconcile
Trigger type: Cloud Scheduler.
Input: none.
Output: integrity report.
Responsibility: compare jobs, jobQueue, jobResults, and logs for drift, missing queue docs, terminal docs missing results, orphaned queue entries.

Function: adminBackfillIndexesBootstrap
Trigger type: one-time admin function or local script.
Responsibility: seed roles, permissions, and system state defaults.

Queue and execution architecture

The queue model should be Firestore plus Pub/Sub hybrid. Firestore remains the canonical, queryable state and lease source. Pub/Sub is the transient dispatch transport. Firestore-only queues become contention-heavy and are weaker for burst dispatch. Pub/Sub-only queues are poor as the system of record and harder to inspect deterministically. URAI-JOBS needs both.

Firestore role:
stores job truth
stores queue truth
stores leases
supports admin UI and auditability
supports recovery and replay

Pub/Sub role:
wakes executors
absorbs burst dispatch
decouples queue scan from worker execution
supports horizontal fan-out

Concurrency handling:
Each queue has maxConcurrency.
Each job may define concurrencyKey.
Before leasing, queue processor counts running jobs by queue and concurrency key.
Only one active job with a single-instance concurrency key may run at once.
Large classes such as studio.render.video and asset.package should be routed to Cloud Run workers with queue-specific caps.

Rate limiting:
Use rateLimitKey for external dependency protection, for example TTS vendor, ffmpeg render service, asset publishing endpoint.
Persist token bucket counters in systemState/rateLimits or move rate counters to Redis if load grows beyond Firestore comfort. For Firebase-only baseline, use coarse-grained Firestore rate windows.

Scaling behavior:
Cloud Scheduler ticks scan queue and publish work.
Pub/Sub scales execution consumers horizontally.
Heavy jobs run on Cloud Run Jobs or Cloud Run services triggered by Pub/Sub payloads.
Cloud Functions remains orchestration and light compute, not sustained render runtime.

Worker isolation model:
Light jobs may run in Cloud Functions Gen 2.
Heavy jobs must run in isolated Cloud Run containers.
Job type to worker class mapping must be explicit:
spatial.* -> spatial-worker
studio.render.video -> studio-render-worker
narrator.synthesize.voice -> narrator-voice-worker
asset.* -> asset-factory-worker
System cleanup/reconcile can remain Functions.

Auth and RBAC system

Roles:
admin can create any job, cancel any job, replay dead-letter jobs, read all jobs/results/logs, modify system state.
system is for internal service accounts and automation. It can create and execute system-scoped jobs and write logs/results.
client can create allowed jobs within its tenant, read its own jobs/results, and cancel its own eligible jobs.
worker can claim execution, update progress, write results, write logs, and transition leased jobs only.

Core permissions:
jobs.create
jobs.read.own
jobs.read.any
jobs.cancel.own
jobs.cancel.any
jobs.retry.deadletter
jobs.execute
jobs.progress.write
results.read.own
results.read.any
logs.read.any
system.state.read
system.state.write

Permission enforcement:
HTTP functions validate Firebase Auth token or IAM identity.
Service-to-service calls use signed identity tokens or service account auth.
Tenant boundary is enforced at both function layer and Firestore rules.
Workers do not use end-user tokens. They use service identity with restricted claims.

Firestore security rules model:
Users may read jobs where resource.data.tenantId == request.auth.token.tenantId and role permission permits.
Users may create jobs only through functions, not direct Firestore write.
Direct client writes to jobQueue, jobResults, logs, and systemState are denied.
Workers and system service accounts may write queue/results/logs through Admin SDK only.
Therefore Firestore rules for client apps are mostly read-only plus limited users self-profile access.

Representative rule posture:

match /jobs/{jobId} {
  allow read: if isSignedIn() && sameTenant(resource.data.tenantId) && hasAny(['jobs.read.own', 'jobs.read.any']);
  allow write: if false;
}
match /jobQueue/{doc} {
  allow read, write: if false;
}
match /jobResults/{jobId} {
  allow read: if isSignedIn() && sameTenant(resource.data.tenantId) && hasAny(['results.read.own', 'results.read.any']);
  allow write: if false;
}
match /logs/{logId} {
  allow read: if isSignedIn() && has('logs.read.any') && sameTenant(resource.data.tenantId);
  allow write: if false;
}
match /users/{uid} {
  allow read: if isSignedIn() && request.auth.uid == uid || has('jobs.read.any');
  allow write: if isSignedIn() && request.auth.uid == uid;
}
match /roles/{roleId} {
  allow read: if isSignedIn();
  allow write: if false;
}
match /permissions/{permId} {
  allow read: if isSignedIn();
  allow write: if false;
}
match /systemState/{doc} {
  allow read: if isSignedIn() && has('system.state.read');
  allow write: if false;
}

Function-level validation:
Every mutating function must enforce:
authenticated identity
tenant membership
role permission
job type allowlist by role
payload schema validation
idempotency key presence
system maintenance state
rate guard

Integration layer with URAI systems

Spatial integration

Spatial issues jobs when a scene requires pre-rendered replay media, memory bloom generation, state transition render prep, frame capture, or exported visual artifacts. The shared schema uses type, target.system = 'SPATIAL', resourceId, projectId, and output bucket refs. Spatial subscribes to terminal state changes via onJobTerminalEvent or direct reads of jobs and jobResults. Data flow is: Spatial UI or service -> createJob -> Firestore/queue -> worker -> jobResults -> Spatial consumes artifact refs and state summaries.

Studio integration

Studio relies on URAI-JOBS for render graph execution. Jobs include storyboard build, voice sync prep, subtitle generation, video render, bundle export, and publish package. Studio submits explicit dependency chains by parentJobId and rootJobId. Data flow is: Studio request -> create ordered job chain -> each terminal success emits follow-on create event -> final bundle result returned to Studio.

Narrator integration

Narrator creates jobs for script drafting, voice synthesis, caption alignment, waveform package generation, and delivery to Studio or Spatial. Shared schemas include script manifest, voice profile id, locale, timing model, and artifact refs. Data flow is: Narrator request -> voice/script jobs -> outputs in jobResults -> downstream Studio export job consumes them.

Asset Factory integration

Asset Factory uses URAI-JOBS as its execution plane for generation, validation, format conversion, dedupe, packaging, and publication. Asset validation jobs can gate downstream publish jobs. Output manifests are stored in jobResults and optionally versioned in storage metadata. Data flow is: Asset Factory submit -> validate input bundle -> generate variants -> validate outputs -> package -> publish -> emit terminal event to consuming system.

Event triggers

There are only three canonical event types between systems:
job requested
job progressed
job terminal

All integrations should consume the same stable event contract:

interface JobEvent {
  jobId: string
  rootJobId: string
  correlationId: string
  type: JobType
  status: JobStatus
  targetSystem: string
  tenantId: string
  progress?: { percent: number; stage?: string }
  resultRef?: string
  errorCode?: string
  emittedAt: string
}

Shared schemas

All systems must share:
job envelope schema
artifact reference schema
correlation and root chain rules
tenant and project identifiers
status semantics
permission model

Deployment architecture

Firebase project structure:
one repo with explicit packages or directories for:
/functions
/workers/spatial-worker
/workers/studio-render-worker
/workers/narrator-voice-worker
/workers/asset-factory-worker
/firestore.rules
/firestore.indexes.json
/firebase.json
/scripts
/docs/canon/urai-jobs

Environments:
urai-jobs-dev
urai-jobs-staging
urai-jobs-prod

Each environment needs isolated:
Firebase project
Pub/Sub topics/subscriptions
Cloud Run services
Cloud Storage buckets
Secrets
Scheduler jobs

CI/CD pipeline:
On merge to development branch: deploy dev.
On release branch/tag: deploy staging.
On approved promotion: deploy prod.

Pipeline steps:
install dependencies
typecheck
lint
run emulator integration tests
deploy firestore rules and indexes
deploy functions
deploy Cloud Run workers
deploy Pub/Sub infra
deploy scheduler jobs
run smoke tests
run reconciliation check

Core CLI commands:

firebase use dev
firebase deploy --only firestore:rules,firestore:indexes,functions

gcloud run deploy spatial-worker --source workers/spatial-worker --region us-central1
gcloud run deploy studio-render-worker --source workers/studio-render-worker --region us-central1
gcloud run deploy narrator-voice-worker --source workers/narrator-voice-worker --region us-central1
gcloud run deploy asset-factory-worker --source workers/asset-factory-worker --region us-central1

gcloud pubsub topics create urai-jobs-execute
gcloud scheduler jobs create pubsub urai-jobs-queue-tick --schedule="* * * * *" --topic=urai-jobs-queue-tick

Required secrets/config:
vendor API keys for TTS/rendering if any
service account bindings
worker image/runtime config
default queue concurrency config
retention durations

Logging and monitoring

Logging schema is the logs collection plus Cloud Logging as the authoritative operational backend. Firestore logs are for product-level traceability and UI. Cloud Logging is for infrastructure and alerting.

Error tracking:
Every terminal failure writes both structured Firestore log entries and a Cloud Error Reporting event.
Errors must include jobId, correlationId, type, attemptCount, workerId, and categorized failure code.

Job traceability:
A single correlationId follows a request through all chained jobs.
A single rootJobId groups multi-step workflows.
All logs, results, and external receipts must link back to both.

Observability metrics:
queue depth by queue
oldest available job age
running jobs by type
success rate by type
p95 and p99 duration by type
retry rate by type
dead-letter count by type
lease expiration count
duplicate suppression count
worker error rate
external dependency failure rate

Alert conditions:
dead-letter spike above threshold
success rate drop below threshold
oldest queue age above SLA
lease expiration spike
scheduler failure
Cloud Run worker crash loop
result commit drift detected by reconcile

Failure map

Invalid payload at create time.
What breaks: job cannot be normalized.
Recovery: reject creation, write validation log, do not create queue entry.
Duplication prevention: no job id allocated unless creation passes or allocation is accompanied by immediate terminal validation failure state.

Missing idempotency key.
What breaks: duplicate protection.
Recovery: reject request.
Duplication prevention: strict function validation.

Auth token invalid or role denied.
What breaks: unauthorized work creation or cancellation.
Recovery: reject and log.
Duplication prevention: deny before writes.

Firestore write failure during create.
What breaks: partial creation risk.
Recovery: wrap job and queue creation in transaction where possible; otherwise reconcile detects orphaned half-writes.
Duplication prevention: dedupe key and reconcile cleanup.

Queue processor race condition.
What breaks: same job leased twice.
Recovery: lease acquisition transaction using compare-and-set on status and leaseToken.
Duplication prevention: terminal commit verifies lease token.

Worker crash after lease, before progress.
What breaks: job appears stuck in RUNNING.
Recovery: lease expires, scheduled retry finds expired leases and requeues.
Duplication prevention: lease token invalidates old worker.

Worker crash after external side effect but before final Firestore commit.
What breaks: external duplicate risk on retry.
Recovery: external receipt IDs stored as soon as possible; worker handlers must be idempotent against external receipt existence.
Duplication prevention: external idempotency keys and output checksum checks.

Timeout during long render.
What breaks: stuck or partial artifact.
Recovery: classify transient, requeue if safe, cleanup partial artifact by deterministic output path.
Duplication prevention: overwrite-safe or versioned storage path.

Pub/Sub delivery duplication.
What breaks: duplicate worker invocation.
Recovery: executor loads job and validates live lease token.
Duplication prevention: only matching lease token may transition.

Scheduler missed tick.
What breaks: queue latency rises.
Recovery: next tick catches up; alert on oldest queue age.
Duplication prevention: none needed.

Cloud Run worker misconfiguration.
What breaks: specific job type cannot execute.
Recovery: failures route to retry or dead-letter depending classification; alert fired.
Duplication prevention: retries capped.

Firestore indexes missing.
What breaks: queue scans or admin views fail.
Recovery: deploy indexes before enabling workload.
Duplication prevention: system should fail closed; queue processor startup health check verifies indexes.

Security rules too permissive.
What breaks: data exposure or unauthorized reads.
Recovery: rules rollback and audit.
Duplication prevention: not applicable; this is a security breach vector.

Security rules too restrictive.
What breaks: app cannot read jobs/results.
Recovery: patch and redeploy rules.
Duplication prevention: not applicable.

Result write succeeds but status update fails.
What breaks: terminal drift.
Recovery: reconciliation detects jobResults without terminal job state and repairs state.
Duplication prevention: terminal repair is idempotent.

Status update succeeds but result write fails.
What breaks: terminal job without result envelope.
Recovery: reconciliation creates synthetic failure result or requests result reconstruction.
Duplication prevention: one result doc per job id.

Dead-letter replay without fix.
What breaks: repeated permanent failures.
Recovery: replay requires admin and explicit filter; not automatic.
Duplication prevention: replay emits new attempt only if current state still DEAD and replay window open.

Final completion gap audit

The following items prevent URAI-JOBS from being considered production-ready unless they already exist and are wired exactly as defined.

Missing collections if absent:
jobQueue
jobResults
roles
permissions
systemState

Incomplete collections if present but missing required lifecycle fields:
jobs.status
jobs.dedupeKey
jobs.idempotencyKey
jobs.correlationId
jobs.rootJobId
jobs.execution.maxAttempts
jobs.execution.attemptCount
jobs.execution.leaseExpiresAt
jobs.progress.percent
jobs.timestamps.createdAt
jobs.flags.cancelRequested

Missing functions if absent:
createJob
processQueueTick
executeJob
handleJobFailure
retryExpiredLeases
cleanupTerminalJobs
systemReconcile
cancelJob
getJobStatus
onJobTerminalEvent

Missing wiring if absent:
automatic jobs -> jobQueue creation
queue lease acquisition with atomic compare-and-set
worker heartbeat updates
terminal result envelope write
dead-letter handling
retry backoff scheduling
downstream terminal event emission to URAI subsystems
scheduler jobs for queue tick, retry, cleanup, reconcile

Missing permissions if absent:
role registry documents
permission registry or equivalent constants
function-level role enforcement
tenant scoping in reads
service account separation for workers

Missing triggers if absent:
scheduler tick trigger
expired lease retry trigger
cleanup trigger
terminal-state integration trigger

Missing observability if absent:
correlation id generation
structured log writes for all state transitions
Cloud Logging-based alerts
success/failure and latency dashboards
dead-letter visibility

Missing deployment assets if absent:
firestore.rules
firestore.indexes.json
firebase.json
environment separation config
Cloud Run worker deployment manifests or scripts
secret management strategy

Missing safety invariants if absent:
idempotency enforcement on create
lease token enforcement on execute
single terminal writer rule
reconcile job for drift repair
external side-effect receipt storage

If any one of these is absent, the platform is not complete.

Implementation plan for Firebase IDE execution

Stage 1: establish system contracts

Create shared TypeScript contracts for JobDoc, JobQueueDoc, JobResultDoc, LogDoc, role and permission models, job type registry, and error taxonomy. Define the exact job type map and worker class map. Validation checkpoint: contracts compile, all job types resolve to a queue, worker class, timeout, and max attempts.

Stage 2: create Firestore schema and indexes

Create collections by writing seed/bootstrap scripts and deploy firestore.indexes.json. Create singleton docs under systemState. Validation checkpoint: emulator and deployed project allow indexed queries for queue scans, tenant job lists, correlation log lookups, and terminal result lookups.

Stage 3: implement RBAC seed and auth utilities

Create roles and permissions seed data. Implement shared auth helpers in functions: identity extraction, tenant extraction, permission checks, and service-account checks. Deploy read-focused Firestore rules. Validation checkpoint: client can read only allowed tenant-scoped docs; direct writes to queue/results/logs/systemState are denied.

Stage 4: implement createJob

Build HTTPS callable/onRequest function. Add schema validation by job type, idempotency checks, correlation generation, transaction for jobs and jobQueue, and structured create logs. Validation checkpoint: creating a valid job returns jobId; duplicate request with same idempotency key returns same effective job; invalid request fails with structured code.

Stage 5: implement queue processor and lease model

Build processQueueTick plus queue acquisition logic. Add atomic lease acquisition, per-queue concurrency enforcement, and Pub/Sub dispatch publication. Validation checkpoint: queued jobs transition to leased state exactly once under parallel tick tests.

Stage 6: implement executor and handler registry

Create executeJob with a registry mapping job type to handler. Add lease token verification, running-state transition, heartbeat support, progress writes, success commit, and failure path invocation. Validation checkpoint: a test handler completes end-to-end and writes jobResults, terminal state, and logs.

Stage 7: implement retry, dead-letter, and lease recovery

Build handleJobFailure, retryExpiredLeases, and dead-letter transitions. Add backoff computation and poison classification rules. Validation checkpoint: transient failures retry on schedule, permanent failures go to DEAD, expired leases are recovered exactly once.

Stage 8: implement cleanup and reconciliation

Build cleanupTerminalJobs and systemReconcile. Reconcile must detect orphan queue docs, running jobs with expired leases, terminal jobs without results, and results without terminal job status. Validation checkpoint: inject synthetic drift and verify repair output.

Stage 9: implement integration events

Build onJobTerminalEvent and stable event envelopes. Wire consumers in Spatial, Studio, Narrator, and Asset Factory to listen or poll jobs and jobResults. Validation checkpoint: a completed job emits one terminal event and the target system can consume the result ref.

Stage 10: route heavy workloads to Cloud Run workers

Create containerized workers for heavy job classes. Add secure internal invocation, environment config, secrets, and runtime resource sizing. Validation checkpoint: a heavy test job executes in Cloud Run and updates Firestore state correctly.

Stage 11: observability and alerts

Create structured logging helpers. Wire Cloud Logging and Error Reporting. Create dashboards and alerting policies for queue age, dead-letter count, success rate, duration, and lease expiry spikes. Validation checkpoint: synthetic errors appear in logs and alerts route correctly.

Stage 12: deployment pipeline and environment promotion

Create environment-specific config, CI/CD workflow, deployment scripts, and smoke tests. Validation checkpoint: deploy dev, run end-to-end smoke test, promote to staging, confirm no environment bleed, then enable prod.

Stage 13: production hardening

Load-test queue processor, duplication scenarios, retries, worker crash recovery, and tenant isolation. Freeze job contracts and permission registry. Validation checkpoint: all failure-map scenarios have been exercised at least once in staging and pass expected recovery behavior.

System status

Realistic completion estimate based only on the specification you provided, not on verified repo inspection: 60%.

What prevents production readiness:
the existence of a schema is not the same as a wired execution engine
the queue/lease/retry/dead-letter machinery must exist and be tested
function-level RBAC and tenant isolation must be enforced
heavy execution must be isolated from light orchestration
reconciliation and observability must exist before production traffic
deployment assets and environment separation must be in place

What must be done to reach 100%:
implement or verify all mandatory collections and indexes
implement or verify all required functions and scheduler triggers
enforce idempotency, lease tokens, and terminal single-writer invariants
wire integration events to Spatial, Studio, Narrator, and Asset Factory
deploy Cloud Run workers for heavy classes
deploy rules, indexes, dashboards, and alerts
run staging failure-map validation and fix every failed scenario

SYSTEM STATUS

URAI-JOBS is architecturally definable as a production job execution platform now, but it is only production-ready when the state machine, queue leasing, retries, dead-letter handling, RBAC, observability, and integration events are all implemented and verified together. Until that is done, it is not complete.