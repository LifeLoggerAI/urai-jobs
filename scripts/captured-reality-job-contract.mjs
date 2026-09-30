import fs from 'node:fs';

const runtime = fs.readFileSync('functions/src/core/runtimeJobTypes.ts', 'utf8');
const create = fs.readFileSync('functions/src/jobs/createJob.ts', 'utf8');
const execute = fs.readFileSync('functions/src/jobs/executeJob.ts', 'utf8');
const shared = fs.readFileSync('packages/shared-types/src/index.ts', 'utf8');

let failures = 0;
const check = (name, ok) => {
  if (ok) console.log('[PASS] ' + name);
  else { failures += 1; console.error('[FAIL] ' + name); }
};

check('captured reconstruction has dedicated worker URL', runtime.includes("workerEnvKey: 'CAPTURED_REALITY_WORKER_URL'"));
check('captured reconstruction is async/callback fenced', runtime.includes("'memory.private-source.reconstruct-place'") && runtime.includes("cancellation: 'callback-fenced'"));
check('payload is opaque receipt/project/governance references', create.includes('CapturedRealityReconstructionPayloadSchema'));
check('payload forbids provider spend', create.includes('providerSpendAuthorized: z.literal(false)'));
check('payload forbids public release', create.includes('publicReleaseAuthorized: z.literal(false)'));
const schemaStart = create.indexOf('const CapturedRealityReconstructionPayloadSchema');
const schemaEnd = create.indexOf('}).strict();', schemaStart) + '}).strict();'.length;
const reconstructionSchemaSource = schemaStart >= 0 && schemaEnd > schemaStart ? create.slice(schemaStart, schemaEnd) : '';
check('payload contains no raw media URL field', Boolean(reconstructionSchemaSource) && !/(rawMediaUrl|sourceUrl|address|latitude|longitude)\s*:/.test(reconstructionSchemaSource));
check('dual consent requires memory storage', create.includes("purposes.has('memory.storage')"));
check('dual consent requires location context', create.includes("purposes.has('location.context')"));
check('shared job type carries multiple consent receipts', shared.includes('consents?: JobConsentContext[]'));
check('execution evaluates all consent contexts', execute.includes('function jobConsentContexts'));
check('execution checks consent before starting', execute.includes('consentContexts.map((context) => transaction.get(consentBlockRef'));
check('execution rechecks consent before worker dispatch', execute.includes('dispatchConsentContexts.map((context) => consentBlockRef'));
check('captured reconstruction inline fallback disabled', execute.includes("jobType === 'memory.private-source.reconstruct-place') return false"));
check('no reconstruction placeholder artifact is generated inline', !execute.includes('captured-reality-inline-artifacts'));

if (failures) throw new Error(`CAPTURED_REALITY_JOB_CONTRACT ${failures} checks failed`);
console.log('[PASS] CAPTURED_REALITY_JOB_CONTRACT');
