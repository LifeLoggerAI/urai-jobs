
// URAI-JOBS System Contracts

// Note: Using 'any' for FirebaseFirestore.Timestamp as imports are not available here.

export type JobStatus = 'CREATED' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'RETRY' | 'DEAD' | 'CANCELLED';
export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type JobOrigin = 'SPATIAL' | 'STUDIO' | 'NARRATOR' | 'ASSET_FACTORY' | 'API' | 'SCHEDULER' | 'ADMIN';
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
  | 'system.cleanup'
  | 'system.reconcile'
  | 'system.replay.deadletter';

export interface JobDoc {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  origin: JobOrigin;
  requestedBy: {
    uid: string;
    actorType: 'USER' | 'SYSTEM' | 'SERVICE';
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

  payloadRef?: string;
  payloadInline?: Record<string, unknown>;
  inputManifest?: {
    refs: string[];
    version?: string;
    hash?: string;
  };

  target: {
    system: 'SPATIAL' | 'STUDIO' | 'NARRATOR' | 'ASSET_FACTORY' | 'SYSTEM';
    resourceId?: string;
    outputBucketPath?: string;
  };

  scheduling: {
    notBefore?: any; // FirebaseFirestore.Timestamp;
    expiresAt?: any; // FirebaseFirestore.Timestamp;
    cronId?: string;
  };

  execution: {
    workerClass: string;
    queueName: string;
    maxAttempts: number;
    attemptCount: number;
    claimedBy?: string;
    claimedAt?: any; // FirebaseFirestore.Timestamp;
    startedAt?: any; // FirebaseFirestore.Timestamp;
    heartbeatAt?: any; // FirebaseFirestore.Timestamp;
    completedAt?: any; // FirebaseFirestore.Timestamp;
    timeoutSec: number;
    leaseExpiresAt?: any; // FirebaseFirestore.Timestamp;
    concurrencyKey?: string;
    rateLimitKey?: string;
    isolationMode: 'FUNCTION' | 'CLOUD_RUN' | 'IN_PROCESS';
    region: string;
  };

  progress: {
    percent: number;
    stage?: string;
    message?: string;
    checkpoints?: Array<{
      at: any; // FirebaseFirestore.Timestamp;
      name: string;
      value?: string;
    }>;
  };

  result: {
    resultId?: string;
    outputRefs?: string[];
    summary?: string;
    checksum?: string;
  };

  error?: {
    code: string;
    category: 'VALIDATION' | 'AUTH' | 'TRANSIENT' | 'PERMANENT' | 'DEPENDENCY' | 'TIMEOUT' | 'INTERNAL';
    message: string;
    detail?: Record<string, unknown>;
    lastFailedAt?: any; // FirebaseFirestore.Timestamp;
    lastFailedBy?: string;
  };

  timestamps: {
    createdAt: any; // FirebaseFirestore.Timestamp;
    updatedAt: any; // FirebaseFirestore.Timestamp;
    queuedAt?: any; // FirebaseFirestore.Timestamp;
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
  status: 'READY' | 'LEASED' | 'DONE' | 'DEAD';
  priorityScore: number;
  availableAt: any; // FirebaseFirestore.Timestamp;
  leaseOwner?: string;
  leaseToken?: string;
  leaseAcquiredAt?: any; // FirebaseFirestore.Timestamp;
  leaseExpiresAt?: any; // FirebaseFirestore.Timestamp;
  attemptCount: number;
  maxAttempts: number;
  concurrencyKey?: string;
  rateLimitKey?: string;
  sizeClass: 'XS' | 'S' | 'M' | 'L' | 'XL';
  region: string;
  createdAt: any; // FirebaseFirestore.Timestamp;
  updatedAt: any; // FirebaseFirestore.Timestamp;
}

export interface JobResultDoc {
  jobId: string;
  rootJobId: string;
  correlationId: string;
  tenantId: string;
  type: JobType;
  status: 'SUCCESS' | 'FAILED' | 'DEAD' | 'CANCELLED';
  producedAt: any; // FirebaseFirestore.Timestamp;
  durationMs: number;
  outputs: Array<{
    kind: 'FILE' | 'JSON' | 'URL' | 'METRIC' | 'EVENT';
    ref: string;
    mimeType?: string;
    sizeBytes?: number;
    checksum?: string;
  }>;
  metrics?: {
    cpuMs?: number;
    memoryMb?: number;
    renderFrames?: number;
    tokensUsed?: number;
    retries?: number;
  };
  summary?: string;
  error?: {
    code: string;
    message: string;
    category: string;
  };
}

export interface UserDoc {
  uid: string;
  email: string;
  displayName?: string;
  tenantId: string;
  roleIds: string[];
  status: 'ACTIVE' | 'DISABLED' | 'INVITED';
  profile?: {
    avatarUrl?: string;
    locale?: string;
    timezone?: string;
  };
  createdAt: any; // FirebaseFirestore.Timestamp;
  updatedAt: any; // FirebaseFirestore.Timestamp;
  lastLoginAt?: any; // FirebaseFirestore.Timestamp;
}

export interface RoleDoc {
  id: string;
  name: string;
  permissions: string[];
  system: boolean;
  createdAt: any; // FirebaseFirestore.Timestamp;
  updatedAt: any; // FirebaseFirestore.Timestamp;
}

export interface PermissionDoc {
  id: string;
  description: string;
  category: 'JOBS' | 'RESULTS' | 'ADMIN' | 'SYSTEM' | 'INTEGRATION';
}

export interface LogDoc {
  jobId?: string;
  rootJobId?: string;
  correlationId?: string;
  tenantId: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  source: 'API' | 'TRIGGER' | 'QUEUE' | 'WORKER' | 'SCHEDULER' | 'SECURITY' | 'SYSTEM';
  event: string;
  message: string;
  context?: Record<string, unknown>;
  actor?: {
    uid?: string;
    service?: string;
    workerId?: string;
  };
  timestamp: any; // FirebaseFirestore.Timestamp;
}

export interface GlobalStateDoc {
  maintenanceMode: boolean;
  acceptedOrigins: string[];
  minWorkerVersion?: string;
  createdAt: any; // FirebaseFirestore.Timestamp;
  updatedAt: any; // FirebaseFirestore.Timestamp;
}

export interface QueueConfigDoc {
  queues: Array<{
    name: string;
    maxConcurrency: number;
    defaultTimeoutSec: number;
    backoffBaseSec: number;
    backoffMaxSec: number;
    enabled: boolean;
  }>;
  updatedAt: any; // FirebaseFirestore.Timestamp;
}

export interface DeadletterStateDoc {
  replayEnabled: boolean;
  maxReplayBatchSize: number;
  updatedAt: any; // FirebaseFirestore.Timestamp;
}

export type ErrorCategory = 'VALIDATION' | 'AUTH' | 'TRANSIENT' | 'PERMANENT' | 'DEPENDENCY' | 'TIMEOUT' | 'INTERNAL';

export const jobTypeConfig = {
    'spatial.render.scene': { queue: 'render-queue', workerClass: 'spatial-worker', timeout: 3600, maxAttempts: 2 },
    'spatial.render.replay': { queue: 'render-queue', workerClass: 'spatial-worker', timeout: 3600, maxAttempts: 2 },
    'spatial.capture.snapshot': { queue: 'capture-queue', workerClass: 'spatial-worker', timeout: 60, maxAttempts: 3 },
    'studio.render.video': { queue: 'video-render-queue', workerClass: 'studio-render-worker', timeout: 7200, maxAttempts: 1 },
    'studio.export.bundle': { queue: 'export-queue', workerClass: 'studio-worker', timeout: 300, maxAttempts: 3 },
    'studio.generate.subtitles': { queue: 'ai-queue', workerClass: 'studio-worker', timeout: 600, maxAttempts: 2 },
    'narrator.generate.script': { queue: 'ai-queue', workerClass: 'narrator-worker', timeout: 180, maxAttempts: 3 },
    'narrator.synthesize.voice': { queue: 'tts-queue', workerClass: 'narrator-voice-worker', timeout: 300, maxAttempts: 3 },
    'narrator.align.captions': { queue: 'ai-queue', workerClass: 'narrator-worker', timeout: 120, maxAttempts: 3 },
    'asset.generate': { queue: 'asset-queue', workerClass: 'asset-factory-worker', timeout: 600, maxAttempts: 2 },
    'asset.validate': { queue: 'asset-queue', workerClass: 'asset-factory-worker', timeout: 120, maxAttempts: 3 },
    'asset.package': { queue: 'asset-queue', workerClass: 'asset-factory-worker', timeout: 300, maxAttempts: 3 },
    'asset.publish': { queue: 'publish-queue', workerClass: 'asset-factory-worker', timeout: 120, maxAttempts: 2 },
    'system.cleanup': { queue: 'system-queue', workerClass: 'system-worker', timeout: 600, maxAttempts: 1 },
    'system.reconcile': { queue: 'system-queue', workerClass: 'system-worker', timeout: 300, maxAttempts: 1 },
    'system.replay.deadletter': { queue: 'system-queue', workerClass: 'system-worker', timeout: 300, maxAttempts: 1 },
};
