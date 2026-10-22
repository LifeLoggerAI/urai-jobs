// Exact-source launcher for real, isolated Chalk review emulator acceptance.
// Nothing here deploys, merges, creates cloud projects, or admits engineering jobs.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PROJECT = 'demo-urai-auth-journey';
const SHA = /^[a-f0-9]{40}$/;
const fail = code => { throw Error('CHALK_LOCAL_' + code); };
export function validateChalkLaunch(env) {
  if (env.CHALK_INTAKE_E2E !== '1' || env.URAI_CHALK_INTAKE_ENABLED !== 'true') fail('EXPLICIT_OPT_IN');
  if (!SHA.test(env.CHALK_JOBS_SOURCE_SHA || '') || !SHA.test(env.URAI_CHALK_SPATIAL_SOURCE_SHA || '')) fail('EXACT_SHAS');
  if (env.GCLOUD_PROJECT && env.GCLOUD_PROJECT !== PROJECT ||
      env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== PROJECT ||
      env.GCP_PROJECT && env.GCP_PROJECT !== PROJECT) fail('REAL_PROJECT');
  if (env.FIREBASE_AUTH_EMULATOR_HOST && env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
      env.FIRESTORE_EMULATOR_HOST && env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') fail('REMOTE_EMULATOR');
  if (['production', 'prod', 'staging'].includes((env.URAI_ENV || '').toLowerCase())) fail('ENVIRONMENT');
  if (env.FIREBASE_CONFIG) {
    let config; try { config = JSON.parse(env.FIREBASE_CONFIG); } catch { fail('FIREBASE_CONFIG'); }
    if (config?.projectId !== PROJECT) fail('FIREBASE_CONFIG');
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS || env.GOOGLE_OAUTH_ACCESS_TOKEN) fail('CLOUD_CREDENTIALS');
  return Object.freeze({projectId:PROJECT,jobsSha:env.CHALK_JOBS_SOURCE_SHA,spatialSha:env.URAI_CHALK_SPATIAL_SOURCE_SHA});
}
function command(binary,args,{cwd=ROOT,timeout=120000,env=process.env}={}) {
  const run=spawnSync(binary,args,{cwd,timeout,env,encoding:'utf8',shell:false,windowsHide:true});
  if (run.error || run.status !== 0) {
    console.error(run.stdout || ''); console.error(run.stderr || run.error?.message || '');
    fail('COMMAND_FAILED_' + args[0]);
  }
  return (run.stdout || '').trim();
}
async function execute() {
  const a=validateChalkLaunch(process.env);
  if (Number(process.versions.node.split('.')[0]) !== 22) fail('NODE_22_REQUIRED');
  const java=spawnSync('java',['-version'],{encoding:'utf8',timeout:10000});
  const m=(java.stderr||java.stdout||'').match(/version "(\d+)/);
  if (java.status !== 0 || !m || Number(m[1])<21) fail('JAVA_21_REQUIRED');
  if (command('git',['rev-parse','HEAD']) !== a.jobsSha) fail('JOBS_SOURCE_DRIFT');
  if (command('git',['status','--porcelain','--untracked-files=all'])) fail('DIRTY_WORKTREE');
  const fnRequire=createRequire(new URL('../functions/package.json',import.meta.url));
  let ts,cliPkgPath;
  try {
    ts=fnRequire.resolve('typescript/lib/tsc.js');
    fnRequire.resolve('firebase-admin/firestore');
    cliPkgPath=fnRequire.resolve('firebase-tools/package.json');
  } catch { fail('INSTALL_EXISTING_DEPS_FIRST'); }
  const cliPkg=JSON.parse(readFileSync(cliPkgPath,'utf8'));
  if (cliPkg.version !== '15.24.0' || typeof cliPkg.bin?.firebase !== 'string') fail('PINNED_FIREBASE_CLI_REQUIRED');
  const cliPath=resolve(dirname(cliPkgPath),cliPkg.bin.firebase);
  const pkgRoot=dirname(cliPkgPath)+sep;
  if (!cliPath.startsWith(pkgRoot) || !existsSync(cliPath)) fail('FIREBASE_CLI_PATH');
  // Compile native packages from checked-out source, never reuse stale generated JS.
  command(process.execPath,[ts,'-p','packages/shared-types/tsconfig.json'],{timeout:180000});
  if (!existsSync(resolve(ROOT,'packages/shared-types/dist/index.d.ts'))) fail('SHARED_TYPES_BUILD_MISSING');
  command(process.execPath,[ts,'-p','functions/tsconfig.json'],{timeout:180000});
  if (!existsSync(resolve(ROOT,'functions/lib/functions/index.js'))) fail('FUNCTIONS_BUILD_MISSING');
  const permitted=['PATH','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','TMPDIR','SYSTEMROOT','COMSPEC','JAVA_HOME'];
  const cleanEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>permitted.includes(key.toUpperCase())));
  Object.assign(cleanEnv,{GCLOUD_PROJECT:PROJECT,GCP_PROJECT:PROJECT,GOOGLE_CLOUD_PROJECT:PROJECT,
    FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',
    FUNCTIONS_EMULATOR:'true',URAI_ENV:'development',URAI_CHALK_INTAKE_ENABLED:'true',CHALK_INTAKE_E2E:'1',
    URAI_CHALK_SPATIAL_SOURCE_SHA:a.spatialSha,FIREBASE_CLI_DISABLE_TELEMETRY:'1',CI:'true'});
  console.log('CHALK_ISOLATED_ACCEPTANCE_START '+JSON.stringify({jobsSha:a.jobsSha,spatialSha:a.spatialSha,project:PROJECT}));
  command(process.execPath,[cliPath,'--project',PROJECT,'emulators:exec','--only','auth,firestore,functions',
    'node scripts/chalk-review-emulator-e2e.mjs'],{timeout:720000,env:cleanEnv});
  console.log('CHALK_ISOLATED_ACCEPTANCE_REAL_EMULATORS_PASSED '+a.jobsSha);
}
const isMain=process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url);
if (isMain) await execute();
