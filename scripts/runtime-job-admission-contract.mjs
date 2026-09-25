import fs from 'node:fs';

const runtime = fs.readFileSync('functions/src/core/runtimeJobTypes.ts','utf8');
const createJob = fs.readFileSync('functions/src/jobs/createJob.ts','utf8');
const executeJob = fs.readFileSync('functions/src/jobs/executeJob.ts','utf8');

let failures = 0;
const check = (name, ok) => {
  if (ok) console.log('[PASS] ' + name);
  else { failures += 1; console.error('[FAIL] ' + name); }
};

const active = [
  'narrator.tts',
  'asset-render',
  'asset.render',
  'studio.render.video',
  'communications.message.send',
  'memory.private-source.transcribe',
  'memory.private-source.reconstruct-place',
];

for (const type of active) {
  check('active registry contains ' + type, runtime.includes(`'${type}'`));
}

for (const forbidden of [
  'career.',
  'spatial.',
  'storytime.',
  'analytics.',
  'content.',
  'admin.',
  'deployment.',
  'proof.',
]) {
  check('active registry does not advertise ' + forbidden, !runtime.includes(`'${forbidden}`));
}

check('createJob uses canonical active runtime admission', createJob.includes('isActiveRuntimeJobType(jobType)'));
check('createJob broad allowlist removed', !createJob.includes('ALLOWED_JOB_TYPE_PATTERNS'));
check('executeJob derives env from canonical registry', executeJob.includes('workerEnvKeyForJobType(jobType)'));
check('executeJob derives route from canonical registry', executeJob.includes('workerRouteForJobType(jobType)'));
check('executeJob broad worker env prefix routing removed', !/getWorkerEnvKey[\s\S]*jobType\.startsWith\(/.test(executeJob));
check('executeJob contains no broad jobType prefix fallback', !executeJob.includes("jobType.startsWith("));
check('implicit narrator default removed', !executeJob.includes("job.jobType || 'narrator.tts'"));
check('communications remains exact-type admission', runtime.includes("'communications.message.send'"));
check('private-source remains exact-type admission', runtime.includes("'memory.private-source.transcribe'"));
check('captured-reality reconstruction is exact-type admission', runtime.includes("'memory.private-source.reconstruct-place'"));
check('captured-reality worker is dedicated', runtime.includes("workerEnvKey: 'CAPTURED_REALITY_WORKER_URL'"));
check('captured-reality does not use inline fallback', executeJob.includes("jobType === 'memory.private-source.reconstruct-place'"));

if (failures) {
  throw new Error(`RUNTIME_JOB_ADMISSION_CONTRACT ${failures} checks failed`);
}

console.log('[PASS] RUNTIME_JOB_ADMISSION_CONTRACT');
