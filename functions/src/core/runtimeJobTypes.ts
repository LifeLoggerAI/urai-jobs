export const ACTIVE_RUNTIME_JOB_TYPES = [
  'narrator.tts',
  'asset-render',
  'asset.render',
  'studio.render.video',
  'communications.message.send',
  'memory.private-source.transcribe',
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
};

const ACTIVE_RUNTIME_JOB_TYPE_SET = new Set<string>(ACTIVE_RUNTIME_JOB_TYPES);

export function isActiveRuntimeJobType(jobType: string): jobType is ActiveRuntimeJobType {
  return ACTIVE_RUNTIME_JOB_TYPE_SET.has(jobType);
}

export function workerEnvKeyForJobType(jobType: string): string | null {
  if (isActiveRuntimeJobType(jobType)) return RUNTIME_JOB_REGISTRY[jobType].workerEnvKey;
  switch (jobType) {
    case 'narrator.tts':
      return 'NARRATOR_WORKER_URL';
    case 'asset-render':
    case 'asset.render':
      return 'ASSET_WORKER_URL';
    case 'studio.render.video':
      return 'STUDIO_WORKER_URL';
    case 'communications.message.send':
      return 'COMMUNICATIONS_WORKER_URL';
    case 'memory.private-source.transcribe':
      return 'PRIVATE_SOURCE_WORKER_URL';
    default:
      return null;
  }
}

export function workerRouteForJobType(jobType: string): string | null {
  if (isActiveRuntimeJobType(jobType)) return RUNTIME_JOB_REGISTRY[jobType].route;
  switch (jobType) {
    case 'asset-render':
    case 'asset.render':
    case 'studio.render.video':
      return '/';
    case 'communications.message.send':
      return '/executeJob';
    case 'narrator.tts':
    case 'memory.private-source.transcribe':
      return '/execute-job';
    default:
      return null;
  }
}
