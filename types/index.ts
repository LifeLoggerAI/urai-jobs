export type JobStatus = 'CREATED' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'RETRY' | 'DEAD' | 'CANCELLED'
export type QueueStatus = 'READY' | 'LEASED' | 'DONE' | 'DEAD'
export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
export type WorkerClass = 'INLINE' | 'FUNCTION' | 'CLOUD_RUN'
export type JobOrigin = 'URAI_SPATIAL' | 'URAI_STUDIO' | 'NARRATOR' | 'ASSET_FACTORY' | 'API' | 'ADMIN' | 'SCHEDULED' | 'SYSTEM'
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export interface LeaseMeta {
  leaseToken?: string | null
  leasedBy?: string | null
  leaseExpiresAt?: string | null
  heartbeatAt?: string | null
}

export interface ProgressMeta {
  percent: number
  stage: string
  message?: string
}

export interface ResultEnvelope {
  ok: boolean
  status: JobStatus
  code: string
  reason: string
  finishedAt?: string
  attemptCount: number
  durationMs?: number
  artifactRefs: string[]
  meta?: Record<string, unknown>
}

export interface ArtifactManifestItem {
  kind: string
  path: string
  contentType?: string
  sizeBytes?: number
  checksum?: string
}

export interface JobDoc {
  jobId: string
  tenantId: string
  orgId: string
  ownerUid: string
  actorUid: string
  origin: JobOrigin
  type: string
  priority: JobPriority
  priorityRank: number
  workerClass: WorkerClass
  status: JobStatus
  payload: Record<string, unknown>
  idempotencyKey?: string | null
  retryPolicy: RetryPolicy
  attemptCount: number
  cancelRequested: boolean
  resultEnvelope?: ResultEnvelope | null
  progress: ProgressMeta
  lease: LeaseMeta
  createdAt: string
  updatedAt: string
  startedAt?: string | null
  finishedAt?: string | null
  lastErrorCode?: string | null
  lastErrorMessage?: string | null
  tags?: string[]
}

export interface JobQueueDoc {
  queueId: string
  jobId: string
  tenantId: string
  orgId: string
  type: string
  priority: JobPriority
  priorityRank: number
  workerClass: WorkerClass
  status: QueueStatus
  availableAt: string
  lease: LeaseMeta
  createdAt: string
  updatedAt: string
}

export interface JobResultDoc {
  jobId: string
  tenantId: string
  orgId: string
  status: JobStatus
  envelope: ResultEnvelope
  artifacts: ArtifactManifestItem[]
  output?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface JobLogDoc {
  logId: string
  jobId: string
  tenantId: string
  orgId: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  createdAt: string
}

export interface PermissionDoc {
  permissionId: string
  description: string
}

export interface RoleDoc {
  roleId: string
  description: string
  permissions: string[]
}

export interface UserDoc {
  uid: string
  email?: string | null
  displayName?: string | null
  tenantId: string
  orgId: string
  roles: string[]
  permissions: string[]
  disabled?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface TerminalEventPayload {
  eventId: string
  jobId: string
  tenantId: string
  orgId: string
  origin: JobOrigin
  type: string
  status: JobStatus
  envelope: ResultEnvelope
  emittedAt: string
}
