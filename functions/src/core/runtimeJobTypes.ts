export const ACTIVE_RUNTIME_JOB_TYPES = [
  'narrator.tts',
  'asset-render',
  'asset.render',
  'studio.render.video',
  'communications.message.send',
  'memory.private-source.transcribe',
] as const;

export type ActiveRuntimeJobType = typeof ACTIVE_RUNTIME_JOB_TYPES[number];

const ACTIVE_RUNTIME_JOB_TYPE_SET = new Set<string>(ACTIVE_RUNTIME_JOB_TYPES);

export function isActiveRuntimeJobType(jobType: string): jobType is ActiveRuntimeJobType {
  return ACTIVE_RUNTIME_JOB_TYPE_SET.has(jobType);
}

export function workerEnvKeyForJobType(jobType: string): string | null {
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
