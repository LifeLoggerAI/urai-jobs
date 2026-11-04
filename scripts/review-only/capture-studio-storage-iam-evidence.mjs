/** Read-only GCP evidence collector for Jobs #252. NOT an IAM approval or GO. */
import { spawnSync } from 'node:child_process';
import { openSync, closeSync, writeFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'urai-studio-private-storage-iam-review-v1';
const PROJECT = /^[a-z][a-z0-9-]{4,62}$/;
const BUCKET = /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/;
const REGION = /^[a-z][a-z0-9-]{2,35}[0-9]$/;
const DIGITS = /^[0-9]{1,24}$/;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exactScope = ({ projectId, bucket, region }) => {
  if (!PROJECT.test(projectId || '') || !BUCKET.test(bucket || '') ||
      bucket.includes('..') || !REGION.test(region || '')) throw Error('INVALID_SCOPE');
};
const name = value => String(value || '').split('/').at(-1);
const identity = item => item?.spec?.template?.spec?.template?.spec?.serviceAccountName ??
  item?.template?.template?.serviceAccount ??
  item?.spec?.template?.spec?.serviceAccountName ??
  item?.spec?.serviceAccountName ?? item?.template?.serviceAccount ??
  item?.serviceAccount ?? null;
const policy = x => {
  if (!isObject(x) || !Array.isArray(x.bindings)) throw Error('INCOMPLETE_POLICY');
  return x;
};
const array = x => {
  if (!Array.isArray(x) || x.length >= 10000) throw Error('INCOMPLETE_INVENTORY');
  return x;
};
const cloudCommand = args => {
  const r = spawnSync('gcloud', args, { encoding:'utf8', shell:false, timeout:45000,
    maxBuffer:3_000_000, env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS:'1' } });
  if (r.error || r.status !== 0 || !r.stdout) throw Error('READ_ONLY_COLLECTION_FAILED');
  return JSON.parse(r.stdout);
};

/** Inject command runner only for offline synthetic tests. Never mutates GCP. */
export function captureIamEvidence(scope, run = cloudCommand) {
  exactScope(scope);
  const { projectId, bucket, region } = scope;
  const common = ['--project',projectId,'--format=json','--quiet'];
  const query = args => run([...args,...common]);
  const projectPolicy = policy(query(['projects','get-iam-policy',projectId]));
  const bucketPolicy = policy(query(['storage','buckets','get-iam-policy',`gs://${bucket}`]));
  const ancestors = array(query(['projects','get-ancestors',projectId]));
  const ancestorPolicies = [];
  for (const item of ancestors) {
    if (!isObject(item) || !['project','folder','organization'].includes(item.type)) throw Error('INCOMPLETE_ANCESTORS');
    if (item.type === 'project') continue;
    const id = String(item.id || '').split('/').at(-1);
    if (!DIGITS.test(id)) throw Error('INCOMPLETE_ANCESTORS');
    ancestorPolicies.push({ level:item.type, policy:policy(query(item.type === 'folder'
      ? ['resource-manager','folders','get-iam-policy',id]
      : ['organizations','get-iam-policy',id])) });
  }
  const services = array(query(['run','services','list','--region',region]));
  const revisions = array(query(['run','revisions','list','--region',region]));
  // Cloud Run Jobs have independently configured runtime service accounts and
  // can write Storage without ever appearing in Cloud Run service/revision lists.
  // Describe each listed Job: some list response formats omit its service identity.
  const jobs = array(query(['run','jobs','list','--region',region]));
  if (jobs.length > 1000) throw Error('INCOMPLETE_JOB_INVENTORY');
  const convert = x => {
    if (!isObject(x)) throw Error('INCOMPLETE_RUNTIME_IDENTITY');
    const label = name(x?.metadata?.name ?? x.name);
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(label)) throw Error('INCOMPLETE_RUNTIME_IDENTITY');
    const principal = identity(x);
    return { name:label, serviceAccount: typeof principal === 'string' && principal.length ? principal : null };
  };
  const jobNames = jobs.map(job => convert(job).name);
  if (new Set(jobNames).size !== jobNames.length) throw Error('DUPLICATE_JOB_IDENTITY');
  const runJobs = jobNames.map(jobName => {
    const detail = query(['run','jobs','describe',jobName,'--region',region]);
    const job = convert(detail);
    if (job.name !== jobName) throw Error('JOB_DETAILS_MISMATCH');
    return job;
  });
  return {
    schemaVersion:SCHEMA, projectId, bucket, collectedAt:new Date().toISOString(),
    bucketPolicy, projectPolicy, ancestorPolicies,
    runServices:services.map(convert), revisionInventory:revisions.map(convert), runJobs,
    collectorCoverage:'ONE_REGION_ONLY_NOT_EFFECTIVE_IAM_OR_GLOBAL_REVISION_PROOF',
    collectionRegion:region,
  };
}

function privateDestination(out) {
  if (!isAbsolute(out || '')) throw Error('PRIVATE_ABSOLUTE_OUTPUT_REQUIRED');
  const parent = realpathSync(dirname(out));
  const cwd = realpathSync(process.cwd());
  const r = relative(cwd,parent);
  if (r === '' || (r !== '..' && !r.startsWith('..'+sep))) throw Error('OUTPUT_INSIDE_REPOSITORY');
  const stat = statSync(parent);
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 ||
      (process.getuid && stat.uid !== process.getuid())) throw Error('PRIVATE_PARENT_REQUIRED');
  return join(parent,out.split(/[\\/]/).at(-1));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 8 || args[0] !== '--project' || args[2] !== '--bucket' ||
        args[4] !== '--region' || args[6] !== '--out') throw Error('INVALID_ARGUMENTS');
    const target = privateDestination(args[7]);
    const snapshot = captureIamEvidence({ projectId:args[1],bucket:args[3],region:args[5] });
    const fd = openSync(target,'wx',0o600);
    try { writeFileSync(fd,JSON.stringify(snapshot,null,2)+'\n'); }
    finally { closeSync(fd); }
    console.log('PRIVATE_IAM_REVIEW_SNAPSHOT_SAVED: HOLD; no IAM mutation; no release approval');
  } catch {
    console.error('PRIVATE_IAM_REVIEW_CAPTURE_BLOCKED: evidence unavailable; no release approval');
    process.exitCode=1;
  }
}
