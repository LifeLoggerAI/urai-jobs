export const ACTIVE_RUNTIME_JOB_TYPES = [
  'narrator.tts',
  'asset-render',
  'asset.render',
  'studio.render.video',
  'communications.message.send',
  'memory.private-source.transcribe',
  'memory.private-source.reconstruct-place',
] as const;

export type ActiveRuntimeJobType = typeof ACTIVE_RUNTIME_JOB_TYPES[number];

export type RuntimeJobDefinition = {
  owner: 'urai-jobs' | 'asset-factory' | 'urai-studio' | 'urai-communications';
  payloadContract: string;
  resultContract: string;
  workerEnvKey: string;
  route: string;
  mode: 'sync' | 'async';
  timeoutMs: number;
  maxAttempts: number;
  cancellation: 'lease-fenced' | 'callback-fenced';
  providerCostClass: 'local-compute' | 'external-provider-hard-off' | 'provider-bound';
  artifactContract: string;
};

export const RUNTIME_JOB_REGISTRY: Record<ActiveRuntimeJobType, RuntimeJobDefinition> = {
  'narrator.tts': {
    owner: 'urai-jobs',
    payloadContract: 'Narrator worker request',
    resultContract: 'Narrator artifact/result',
    workerEnvKey: 'NARRATOR_WORKER_URL',
    route: '/execute-job',
    mode: 'sync',
    timeoutMs: 120000,
    maxAttempts: 3,
    cancellation: 'lease-fenced',
    providerCostClass: 'provider-bound',
    artifactContract: 'private narration artifact + manifest',
  },
  'asset-render': {
    owner: 'asset-factory',
    payloadContract: 'Asset worker request (legacy alias)',
    resultContract: 'Asset artifact/result',
    workerEnvKey: 'ASSET_WORKER_URL',
    route: '/',
    mode: 'async',
    timeoutMs: 120000,
    maxAttempts: 3,
    cancellation: 'callback-fenced',
    providerCostClass: 'external-provider-hard-off',
    artifactContract: 'asset manifest + provenance receipt',
  },
  'asset.render': {
    owner: 'asset-factory',
    payloadContract: 'Asset worker request',
    resultContract: 'Asset artifact/result',
    workerEnvKey: 'ASSET_WORKER_URL',
    route: '/',
    mode: 'async',
    timeoutMs: 120000,
    maxAttempts: 3,
    cancellation: 'callback-fenced',
    providerCostClass: 'external-provider-hard-off',
    artifactContract: 'asset manifest + provenance receipt',
  },
  'studio.render.video': {
    owner: 'urai-studio',
    payloadContract: 'StudioLifeMovieRenderPayloadSchema',
    resultContract: 'Life Movies render receipt',
    workerEnvKey: 'STUDIO_WORKER_URL',
    route: '/',
    mode: 'sync',
    timeoutMs: 120000,
    maxAttempts: 3,
    cancellation: 'lease-fenced',
    providerCostClass: 'local-compute',
    artifactContract: 'MP4 + SRT + JSON provenance/render receipt',
  },
  'communications.message.send': {
    owner: 'urai-communications',
    payloadContract: 'CommunicationsMessagePayloadSchema',
    resultContract: 'Communications delivery receipt',
    workerEnvKey: 'COMMUNICATIONS_WORKER_URL',
    route: '/executeJob',
    mode: 'sync',
    timeoutMs: 120000,
    maxAttempts: 3,
    cancellation: 'lease-fenced',
    providerCostClass: 'provider-bound',
    artifactContract: 'delivery/audit receipt',
  },
  'memory.private-source.transcribe': {
    owner: 'urai-jobs',
    payloadContract: 'PrivateSourcePayloadSchema + JobConsentSchema',
    resultContract: 'Private-source transcript/provenance receipt',
    workerEnvKey: 'PRIVATE_SOURCE_WORKER_URL',
    route: '/execute-job',
    mode: 'sync',
    timeoutMs: 120000,
    maxAttempts: 3,
    cancellation: 'lease-fenced',
    providerCostClass: 'provider-bound',
    artifactContract: 'private transcript/index derivative + provenance receipt',
  },
  'memory.private-source.reconstruct-place': {
    owner: 'urai-jobs',
    payloadContract: 'CapturedRealityReconstructionPayloadSchema + dual JobConsentSchema',
    resultContract: 'Captured Reality reconstruction + provenance receipts',
    workerEnvKey: 'CAPTURED_REALITY_WORKER_URL',
    route: '/execute-job',
    mode: 'async',
    timeoutMs: 120000,
    maxAttempts: 2,
    cancellation: 'callback-fenced',
    providerCostClass: 'local-compute',
    artifactContract: 'archival reconstruction + web splat + collision proxy + QA receipts',
  },
};

const ACTIVE_RUNTIME_JOB_TYPE_SET = new Set<string>(ACTIVE_RUNTIME_JOB_TYPES);

export function isActiveRuntimeJobType(jobType: string): jobType is ActiveRuntimeJobType {
  return ACTIVE_RUNTIME_JOB_TYPE_SET.has(jobType);
}

export function workerEnvKeyForJobType(jobType: string): string | null {
  return isActiveRuntimeJobType(jobType) ? RUNTIME_JOB_REGISTRY[jobType].workerEnvKey : null;
}

export function workerRouteForJobType(jobType: string): string | null {
  return isActiveRuntimeJobType(jobType) ? RUNTIME_JOB_REGISTRY[jobType].route : null;
}
