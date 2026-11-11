/**
 * R1069: immutable-source private Storage write-surface custody inspection.
 * This offline diagnostic inventories KNOWN Jobs direct writer surfaces; it is
 * NOT a complete enterprise-wide principal or bucket inventory and NEVER
 * authorizes a GCS write, deployment, IAM grant, deletion ACK or release.
 * Run on one exact source tree. Do not treat it as live IAM evidence.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const KNOWN_PATHS = Object.freeze({
  studio:'workers/studio-worker/index.js',
  broker:'workers/studio-worker/private-output-broker-boundary.js',
  hardOff:'workers/studio-worker/private-output-write-authority.js',
  narrator:'workers/narrator-worker/src/handlers/narrator-tts.ts',
  export:'functions/src/privacy/dataRightsExecution.ts',
  gcs:'functions/src/core/gcs.ts',
  marketplace:'marketplace/functions/signed-upload-runtime.ts',
  deploy:'scripts/deploy-workers.sh',
  deployVeto:'scripts/studio-worker-deploy-veto.mjs',
  iamBootstrap:'scripts/bootstrap-managed-worker-iam.sh',
});

const SRC_DENIED = 'R1069_SOURCE_CUSTODY_UNVERIFIED';
const isText = x => typeof x === 'string' && x.length > 0 && x.length < 2_000_000;
const token = (s, pattern) => pattern.test(s);
const count = (s, p) => [...s.matchAll(p)].length;

/**
 * Returns findings only, never positive authority or completeness.
 * Accepts strings ONLY so no privileged provider identity is ever consulted.
 */
export function auditKnownJobsWriteSurfaces(src) {
  const findings = new Set([
    'LIVE_IAM_AND_LEGACY_IDENTITY_ENFORCEMENT_UNVERIFIED',
    'SIGNED_URL_SCOPE_AND_EXPIRY_UNVERIFIED',
    'ACTIVE_UPLOAD_DRAIN_AND_GENERATION_ACK_UNVERIFIED',
    'OTHER_REPOSITORIES_AND_LEGACY_DEPLOYMENTS_NOT_INVENTORIED',
  ]);
  if (!src || typeof src !== 'object' || Array.isArray(src) ||
      Reflect.ownKeys(src).length !== Object.keys(KNOWN_PATHS).length ||
      Object.keys(KNOWN_PATHS).some(k => !Object.hasOwn(src,k) || !isText(src[k]))) {
    throw new Error(SRC_DENIED);
  }
  const {studio,broker,hardOff,narrator,export:exp,gcs,marketplace,deploy,deployVeto,iamBootstrap} = src;
  // Both render and assembly output must continue crossing the ALWAYS-DENY
  // interface; never infer authority from syntactically valid worker claims.
  if (count(studio,/\bawait\s+submitPrivateOutputToExclusiveBroker\s*\(/g) !== 2)
    findings.add('STUDIO_BROKER_CALL_SITE_DRIFT');
  if (!token(studio,/require\(['"]\.\/private-output-broker-boundary['"]\)/))
    findings.add('STUDIO_BROKER_IMPORT_MISSING');
  if (!token(hardOff,/function\s+privateOutputWriteAuthorityAvailable\s*\(\s*\)\s*\{\s*return\s+false\s*;/))
    findings.add('STUDIO_PRIVATE_WRITE_HARD_OFF_CHANGED');
  if (!token(broker,/function\s+privateOutputBrokerCertified\s*\(\s*\)\s*\{\s*return\s+false\s*;/) ||
      !token(broker,/async\s+function\s+submitPrivateOutputToExclusiveBroker\s*\([^)]*\)\s*\{\s*throw\s+new\s+Error\(['"]life_movie_exclusive_storage_broker_unavailable['"]\)/))
    findings.add('BROKER_UNCONDITIONAL_DENIAL_CHANGED');
  // A local fs stream is allowed; every OTHER .createWriteStream is treated as
  // a potential GCS path until a reviewer updates the exact-source inventory.
  const streamCalls = [...studio.matchAll(/\b([A-Za-z_$][\w$]*)\s*\.\s*createWriteStream\s*\(/g)];
  if (streamCalls.some(x=>x[1]!=='fs') ||
      /\b(?:\.save|\.getSignedUrl|uploadToGcs)\s*\(/.test(studio) ||
      /\b(?:gcloud\s+storage\s+cp|gsutil\s+cp)\b/.test(studio))
    findings.add('DIRECT_STUDIO_STORAGE_WRITER_REINTRODUCED');
  // These are SEPARATE product boundaries; discovering one is a reviewer
  // obligation, not a request to remove legitimate exports or narrator audio.
  if (!token(narrator,/\.save\(audioBuffer\s*,/))
    findings.add('NARRATOR_WRITE_SURFACE_DRIFT');
  if (!token(exp,/uploadToGcs\(bytes\s*,\s*destination\s*,/))
    findings.add('DATA_RIGHTS_EXPORT_SURFACE_DRIFT');
  if (!token(gcs,/await\s+file\.save\(buffer\s*,/))
    findings.add('SHARED_GCS_EXPORT_HELPER_DRIFT');
  if (!token(marketplace,/\.getSignedUrl\(\{/))
    findings.add('MARKETPLACE_SIGNED_UPLOAD_SURFACE_DRIFT');
  if (!token(deploy,/--service-account\s+"\$WORKER_RUNTIME_SERVICE_ACCOUNT"/))
    findings.add('WORKER_DEPLOY_PRINCIPAL_ASSIGNMENT_DRIFT');
  const gate = deploy.indexOf('node scripts/studio-worker-deploy-veto.mjs');
  const firstMutating = deploy.search(/\bgcloud\s+(?:run\s+deploy|config\s+set|storage\s+|iam\s+)/);
  if (gate < 0 || (firstMutating >= 0 && gate >= firstMutating) ||
      !token(deployVeto,/workers\.includes\(['"]studio-worker['"]\)/))
    findings.add('STUDIO_DEPLOYMENT_PREMUTATION_VETO_DRIFT');
  if (!token(iamBootstrap,/MANAGED_WORKER_BROAD_STORAGE_IAM_BOOTSTRAP_HARD_OFF/) ||
      !token(iamBootstrap,/\bexit\s+1\b/))
    findings.add('BROAD_IAM_BOOTSTRAP_VETO_DRIFT');
  return Object.freeze({
    schema:'R1069_KNOWN_WRITER_CUSTODY_V1', verdict:'HOLD',
    productionAuthorized:false, effectiveIamVerified:false,
    cloudWriterExclusiveVerified:false, allWritersDrained:false,
    deletionAcknowledged:false, launchApproved:false,
    inspectedPaths:Object.keys(KNOWN_PATHS).length,
    findings:Object.freeze([...findings].sort()),
  });
}

function main() {
  // Explicit --offline-only, no provider tooling, no credentials.
  if (process.argv.length!==3 || process.argv[2]!=='--offline-only') throw Error(SRC_DENIED);
  const src=Object.fromEntries(Object.entries(KNOWN_PATHS).map(([k,p])=>
    [k,readFileSync(new URL('../../'+p,import.meta.url),'utf8')]));
  const result=auditKnownJobsWriteSurfaces(src);
  process.stdout.write(JSON.stringify(result)+'\n');
  process.exitCode=2; // Audit NEVER passes a production approval gate.
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  try { main(); } catch {
    process.stderr.write('R1069_OFFLINE_SOURCE_CUSTODY_HOLD\n'); process.exitCode=3;
  }
}
