import { Timestamp } from 'firebase-admin/firestore';

// --- Canonical Enums ---

export type JobStatus = 
  | 'CREATED'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRY'
  | 'DEAD'
  | 'CANCELLED';

export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type JobOrigin = 
  | 'SPATIAL' 
  | 'STUDIO' 
  | 'NARRATOR' 
  | 'ASSET_FACTORY'
  | 'JOBS'
  | 'API' 
  | 'SCHEDULER' 
  | 'ADMIN';

export type JobVisibility = 'PRIVATE' | 'TEAM' | 'SYSTEM';

export type JobType =
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
  | 'career.profile.summarize'
  | 'career.fit.score'
  | 'career.document.parse'
  | 'career.document.tailor'
  | 'career.packet.generate'
  | 'career.followup.plan'
  | 'career.interview.prep'
  | 'career.offer.compare'
  | 'career.spatial.portal.generate'
  | 'career.passport.export'
  | 'system.cleanup'
  | 'system.reconcile'
  | 'system.replay.deadletter';

export type ActorType = 'USER' | 'SYSTEM' | 'SERVICE';
export type IsolationMode = 'FUNCTION' | 'CLOUD_RUN' | 'IN_PROCESS';
export type TargetSystem = 'SPATIAL' | 'STUDIO' | 'NARRATOR' | 'ASSET_FACTORY' | 'JOBS' | 'SYSTEM';
export type ErrorCategory = 'VALIDATION' | 'AUTH' | 'TRANSIENT' | 'PERMANENT' | 'DEPENDENCY' | 'TIMEOUT' | 'INTERNAL';
export type QueueStatus = 'READY' | 'LEASED' | 'DONE' | 'DEAD';
export type SizeClass = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type LogSource = 'API' | 'TRIGGER' | 'QUEUE' | 'WORKER' | 'SCHEDULER' | 'SECURITY' | 'SYSTEM';
export type JobResultStatus = 'SUCCESS' | 'FAILED' | 'DEAD' | 'CANCELLED';

// --- Document Interfaces ---

export interface JobDoc {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  origin: JobOrigin;
  requestedBy: { 
    uid: string;
    actorType: ActorType;
    serviceName?: string;
  };
  tenantId: string;
  projectId?: string;
  workspaceId?: string;
  visibility: JobVisibility;
  dedupeKey: string;
  idempotencyKey: string;
  correlationId: string;
  parentJobId?: string;
  rootJobId: string;
  chainId?: string;
  payloadInline?: object;
  payloadRef?: string;
  inputManifest?: { 
    refs: string[];
    version?: string;
    hash?: string;
  };
  target: {
    system: TargetSystem;
    resourceId?: string;
    outputBucketPath?: string;
  };
  scheduling: {
    notBefore?: Timestamp;
    expiresAt?: Timestamp;
    cronId?: string;
  };
  execution: {
    workerClass: string;
    queueName: string;
    maxAttempts: number;
    attemptCount: number;
    claimedBy?: string;
    claimedAt?: Timestamp;
    startedAt?: Timestamp;
    heartbeatAt?: Timestamp;
    completedAt?: Timestamp;
    timeoutSec: number;
    leaseExpiresAt?: Timestamp;
    leaseToken?: string;
    concurrencyKey?: string;
    rateLimitKey?: string;
    isolationMode: IsolationMode;
    region: string;
  };
  progress: {
    percent: number;
    stage?: string;
    message?: string;
    checkpoints?: any[];
  };
  result: {
    resultId?: string;
    outputRefs?: string[];
    summary?: string;
    checksum?: string;
  };
  error?: {
    code: string;
    category: ErrorCategory;
    message: string;
    detail?: object;
    lastFailedAt?: Timestamp;
    lastFailedBy?: string;
  };
  timestamps: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    queuedAt?: Timestamp;
  };
  flags: {
    cancelRequested: boolean;
    replayable: boolean;
    emitsEvents: boolean;
    archived: boolean;
  };
  version: number;
}

export interface JobQueueDoc {
  jobId: string;
  tenantId: string;
  queueName: string;
  workerClass: string;
  status: QueueStatus;
  priorityScore: number;
  availableAt: Timestamp;
  leaseOwner?: string;
  leaseToken?: string;
  leaseAcquiredAt?: Timestamp;
  leaseExpiresAt?: Timestamp;
  attemptCount: number;
  maxAttempts: number;
  concurrencyKey?: string;
  rateLimitKey?: string;
  sizeClass: SizeClass;
  region: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface JobResultDoc {
  jobId: string;
  rootJobId: string;
  correlationId: string;
  tenantId: string;
  type: JobType;
  status: JobResultStatus;
  producedAt: Timestamp;
  durationMs: number;
  outputs: Array<{
    kind: string;
    ref: string;
    mimeType?: string;
    sizeBytes?: number;
    checksum?: string;
  }>;
  metrics?: object;
  summary?: string;
  error?: object;
}

export interface LogDoc {
  jobId?: string;
  rootJobId?: string;
  correlationId?: string;
  tenantId: string;
  level: LogLevel;
  source: LogSource;
  event: string;
  message: string;
  context?: object;
  actor?: object;
  timestamp: Timestamp;
}

export interface RoleDoc {
  name: string;
  permissions: string[];
  createdAt: Timestamp;
}

export interface PermissionDoc {
  name: string;
  description: string;
  createdAt: Timestamp;
}
