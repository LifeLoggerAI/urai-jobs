import fs from 'node:fs';

let failed = 0;
const check = (label, condition) => {
  if (condition) console.log(`[PASS] ${label}`);
  else { failed += 1; console.error(`[FAIL] ${label}`); }
};
const read = (path) => fs.readFileSync(path, 'utf8');

const createJob = read('functions/src/jobs/createJob.ts');
const executeJob = read('functions/src/jobs/executeJob.ts');
const worker = read('workers/private-source-worker/src/index.ts');
const dockerfile = read('workers/private-source-worker/Dockerfile');
const runtimeTypes = read('functions/src/core/runtimeJobTypes.ts');
const pkg = JSON.parse(read('package.json'));

check(
  'createJob registers only governed private source types',
  createJob.includes("jobType === 'memory.private-source.transcribe'") && createJob.includes("jobType === 'memory.private-source.index'") && createJob.includes("jobType === 'memory.private-source.reconstruct-place'")
    && !createJob.includes("jobType.startsWith('memory.private-source')")
);
check('private source payload is strict', createJob.includes('PrivateSourcePayloadSchema') && createJob.includes('.strict()'));
check('private source payload requires opaque receipt', createJob.includes('sourceReceiptRef') && createJob.includes('/^psr_'));
check('private source owner is not accepted in payload', !createJob.includes("ownerUid: z."));
check('executeJob routes dedicated private source worker', executeJob.includes('workerEnvKeyForJobType(jobType)') && runtimeTypes.includes("'memory.private-source.transcribe':") && runtimeTypes.includes("workerEnvKey: 'PRIVATE_SOURCE_WORKER_URL'") && runtimeTypes.includes("route: '/execute-job'"));
check(
  'private source inline fallback is forbidden',
  executeJob.includes("jobType === 'memory.private-source.transcribe' || jobType === 'memory.private-source.index' || jobType === 'memory.private-source.reconstruct-place') return false")
);
check('worker validates governed private-source job types', worker.includes("'memory.private-source.transcribe', 'memory.private-source.index'"));
check('worker requires server-owned owner uid', worker.includes('server-owned ownerUid is required'));
check('worker rejects arbitrary payload fields', worker.includes('private-source payload contains forbidden fields'));
check('worker checks purpose-specific source authority', worker.includes('PRIVATE_SOURCE_AUTHORITY_URL') && worker.includes('/authorize'));
check('worker uses private transcription provider binding', worker.includes('PRIVATE_SOURCE_TRANSCRIBE_URL'));
check('memory index runtime type is admitted', runtimeTypes.includes("'memory.private-source.index':"));
check('memory index payload is strict and opaque', createJob.includes('PrivateSourceIndexPayloadSchema') && createJob.includes('transcriptRef') && createJob.includes('provenanceRef'));
check('worker uses dedicated memory index provider binding', worker.includes('PRIVATE_SOURCE_INDEX_URL') && worker.includes('PRIVATE_SOURCE_INDEX_TOKEN'));
check('memory index provider must match canonical life model schema', worker.includes("lifeModelSchemaVersion !== 'urai-life-model-v1'"));
check('memory index provider must prove synthetic-memory firewall', worker.includes('syntheticOutputMayBecomeHistoricalSource !== false'));
check('transcription readiness is independent from memory-index readiness', worker.includes("jobType === 'memory.private-source.transcribe'") && worker.includes('baseReady && transcribeReady'));
check('memory-index readiness is independent from transcription readiness', worker.includes("jobType === 'memory.private-source.index'") && worker.includes('baseReady && indexReady'));
check('transcription provider URL is resolved only on transcription path', worker.indexOf("const transcribeUrl = httpsUrl('PRIVATE_SOURCE_TRANSCRIBE_URL')") > worker.indexOf("if (job.jobType === 'memory.private-source.index')"));

check('worker returns correlation refs without raw memory content', worker.includes('memoryIndexRef') && worker.includes('entityGraphRef') && worker.includes('temporalIndexRef') && worker.includes('placeIndexRef') && worker.includes('conflictSetRef') && worker.includes('sceneTruthRef'));
check('memory index admits opaque incremental re-correlation context', createJob.includes('priorMemoryIndexRef') && createJob.includes('correlationTrigger') && worker.includes('priorMemoryIndexRef') && worker.includes("'stronger-source'"));
check('memory index success requires source fixity and dependency lineage', worker.includes('sourceFixityRef') && worker.includes('dependencyGraphRef'));
check('memory index success requires machine-readable terminal backlog state', worker.includes("new Set(['INDEXED', 'DUPLICATE', 'CONFLICTED'])") && worker.includes('non-terminal backlog state as success'));
check('memory index success carries monotonic correlation revision', worker.includes('correlationRevision') && worker.includes('valid correlation revision'));
check('memory index returns correlation trigger used for this revision', worker.includes('correlationTrigger') && worker.includes('valid correlation trigger'));
check('memory index receipt is bound to the requested recorrelation cause', worker.includes('correlation trigger does not match the requested recorrelation cause'));

check('worker refuses synthetic success when unconfigured', worker.includes('PRIVATE_SOURCE_WORKER_NOT_READY') && worker.includes('refusing synthetic success'));
check('worker never returns transcript text', !/transcript(Text|\s*:\s*provider\.data)/.test(worker));
check('worker returns private refs and checksum', worker.includes('transcriptRef') && worker.includes('provenanceRef') && worker.includes('checksum'));
check('root verify includes private source contract', String(pkg.scripts?.['urai-jobs:verify'] || '').includes('private-source-worker-contract.mjs'));
check('private source worker build is in root build', String(pkg.scripts?.build || '').includes('private-source-worker:build'));
check('private source worker typecheck is in root typecheck', String(pkg.scripts?.typecheck || '').includes('private-source-worker:typecheck'));
check('private source worker has a reproducible Node 22 container', dockerfile.includes('FROM node:22-slim') && dockerfile.includes('RUN npm run build') && dockerfile.includes('CMD ["node", "dist/index.js"]'));

if (failed) {
  console.error(`[FAIL] PRIVATE_SOURCE_WORKER_CONTRACT ${failed} checks failed`);
  process.exit(1);
}
console.log('[PASS] PRIVATE_SOURCE_WORKER_CONTRACT');
