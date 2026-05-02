import { JobType, TargetSystem, IsolationMode } from './types';

export interface JobWorkerConfig {
  queueName: string;
  workerClass: string;
  maxAttempts: number;
  timeoutSec: number;
  isolationMode: IsolationMode;
  region: string;
  targetSystem: TargetSystem;
}

export const jobRegistry: Record<JobType, JobWorkerConfig> = {
  // Spatial Worker Jobs
  'spatial.render.scene': {
    queueName: 'spatialQueue',
    workerClass: 'spatial-worker',
    maxAttempts: 3,
    timeoutSec: 3600,
    isolationMode: 'CLOUD_RUN',
    region: 'us-central1',
    targetSystem: 'SPATIAL',
  },
  'spatial.render.replay': {
    queueName: 'spatialQueue',
    workerClass: 'spatial-worker',
    maxAttempts: 3,
    timeoutSec: 1800,
    isolationMode: 'CLOUD_RUN',
    region: 'us-central1',
    targetSystem: 'SPATIAL',
  },
  'spatial.capture.snapshot': {
    queueName: 'defaultQueue',
    workerClass: 'spatial-worker',
    maxAttempts: 5,
    timeoutSec: 300,
    isolationMode: 'FUNCTION',
    region: 'us-central1',
    targetSystem: 'SPATIAL',
  },

  // Studio Worker Jobs
  'studio.render.video': {
    queueName: 'studioQueue',
    workerClass: 'studio-worker',
    maxAttempts: 2,
    timeoutSec: 7200,
    isolationMode: 'CLOUD_RUN',
    region: 'us-east1',
    targetSystem: 'STUDIO',
  },
  'studio.export.bundle': {
    queueName: 'studioQueue',
    workerClass: 'studio-worker',
    maxAttempts: 3,
    timeoutSec: 900,
    isolationMode: 'CLOUD_RUN',
    region: 'us-east1',
    targetSystem: 'STUDIO',
  },
  'studio.generate.subtitles': {
    queueName: 'defaultQueue',
    workerClass: 'studio-worker',
    maxAttempts: 5,
    timeoutSec: 600,
    isolationMode: 'FUNCTION',
    region: 'us-east1',
    targetSystem: 'STUDIO',
  },

  // Narrator Worker Jobs
  'narrator.generate.script': {
    queueName: 'narratorQueue',
    workerClass: 'narrator-worker',
    maxAttempts: 3,
    timeoutSec: 1200,
    isolationMode: 'CLOUD_RUN',
    region: 'us-west1',
    targetSystem: 'NARRATOR',
  },
  'narrator.synthesize.voice': {
    queueName: 'narratorQueue',
    workerClass: 'narrator-worker',
    maxAttempts: 4,
    timeoutSec: 1800,
    isolationMode: 'CLOUD_RUN',
    region: 'us-west1',
    targetSystem: 'NARRATOR',
  },
  'narrator.align.captions': {
    queueName: 'defaultQueue',
    workerClass: 'narrator-worker',
    maxAttempts: 5,
    timeoutSec: 300,
    isolationMode: 'FUNCTION',
    region: 'us-west1',
    targetSystem: 'NARRATOR',
  },

  // Asset Factory Jobs
  'asset.generate': {
    queueName: 'assetQueue',
    workerClass: 'asset-worker',
    maxAttempts: 3,
    timeoutSec: 900,
    isolationMode: 'CLOUD_RUN',
    region: 'us-central1',
    targetSystem: 'ASSET_FACTORY',
  },
  'asset.validate': {
    queueName: 'defaultQueue',
    workerClass: 'asset-worker',
    maxAttempts: 5,
    timeoutSec: 300,
    isolationMode: 'FUNCTION',
    region: 'us-central1',
    targetSystem: 'ASSET_FACTORY',
  },
  'asset.package': {
    queueName: 'assetQueue',
    workerClass: 'asset-worker',
    maxAttempts: 3,
    timeoutSec: 600,
    isolationMode: 'CLOUD_RUN',
    region: 'us-central1',
    targetSystem: 'ASSET_FACTORY',
  },
  'asset.publish': {
    queueName: 'defaultQueue',
    workerClass: 'asset-worker',
    maxAttempts: 3,
    timeoutSec: 300,
    isolationMode: 'FUNCTION',
    region: 'us-central1',
    targetSystem: 'ASSET_FACTORY',
  },

  // System Jobs
  'system.cleanup': {
    queueName: 'systemQueue',
    workerClass: 'system-worker',
    maxAttempts: 1,
    timeoutSec: 300,
    isolationMode: 'FUNCTION',
    region: 'us-central1',
    targetSystem: 'SYSTEM',
  },
  'system.reconcile': {
    queueName: 'systemQueue',
    workerClass: 'system-worker',
    maxAttempts: 1,
    timeoutSec: 600,
    isolationMode: 'FUNCTION',
    region: 'us-central1',
    targetSystem: 'SYSTEM',
  },
  'system.replay.deadletter': {
    queueName: 'systemQueue',
    workerClass: 'system-worker',
    maxAttempts: 1,
    timeoutSec: 300,
    isolationMode: 'FUNCTION',
    region: 'us-central1',
    targetSystem: 'SYSTEM',
  },
};
