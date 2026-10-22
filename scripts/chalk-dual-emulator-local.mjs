// Run from exact, clean, dependency-installed Jobs checkout only.
// node scripts/chalk-dual-emulator-local.mjs --sha <reviewed-jobs-head> --spatial-sha <exact-spatial-head>
import {spawnSync} from 'node:child_process';
const argv=process.argv.slice(2),SHA=/^[a-f0-9]{40}$/;
const die=(s)=>{console.error('CHALK_LOCAL_PROOF_'+s);process.exit(2)};
if(argv.length!==4||argv[0]!=='--sha'||!SHA.test(argv[1])||argv[2]!=='--spatial-sha'||!SHA.test(argv[3]))die('EXACT_HEADS_REQUIRED');
if(process.versions.node.split('.')[0]!=='22')die('NODE22_ONLY');
const git=(args)=>spawnSync('git',args,{encoding:'utf8',timeout:10000});
const head=git(['rev-parse','HEAD']);if(head.status!==0||head.stdout.trim()!==argv[1])die('SOURCE_DRIFT');
const dirty=git(['status','--porcelain','--untracked-files=all']);if(dirty.status!==0||dirty.stdout.trim())die('UNCLEAN_CHECKOUT');
const project='demo-urai-jobs',spatial='demo-urai-auth-journey';
if(process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.FIRESTORE_EMULATOR_HOST)die('UNTRUSTED_ENVIRONMENT');
const java=spawnSync('java',['-version'],{timeout:10000});if(java.status!==0)die('JAVA21_REQUIRED');
const npm=process.platform==='win32'?'npx.cmd':'npx';
const proofEnv={...process.env,CHALK_EMULATOR_PROOF:'1',CHALK_NONPRODUCTION_INTAKE:'true',
 CHALK_PINNED_SPATIAL_SHA:argv[3],FUNCTIONS_EMULATOR:'true',GOOGLE_CLOUD_PROJECT:project,
 GCLOUD_PROJECT:project,FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',
 FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',CHALK_FUNCTIONS_EMULATOR_HOST:'127.0.0.1:5001',
 NODE_ENV:'test'};
for(const key of Object.keys(proofEnv))if(/(?:CREDENTIAL|TOKEN|SECRET|PRIVATE_KEY|SERVICE_ACCOUNT)/i.test(key)&&!['CHALK_NONPRODUCTION_INTAKE'].includes(key))delete proofEnv[key];
const checks=spawnSync(process.execPath,['--test','scripts/chalk-dual-emulator-contract.test.mjs'],{stdio:'inherit',env:proofEnv,timeout:30000});if(checks.status!==0)die('CONTRACT_TEST_FAILED');
const typecheck=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','typecheck','--prefix','functions'],{stdio:'inherit',env:proofEnv,timeout:180000});if(typecheck.status!==0)die('TYPECHECK_FAILED');
const run=spawnSync(npm,['--yes','firebase-tools@15.24.0','emulators:exec','--project',project,'--only','auth,firestore,functions','node scripts/chalk-dual-emulator-proof.mjs'],{stdio:'inherit',env:proofEnv,timeout:600000,shell:false});
if(run.error)console.error('CHALK_LOCAL_EMULATOR_ERROR',run.error.message);
if(run.status!==0)die('EMULATOR_INTEGRATION_FAILED');
console.log('CHALK_REAL_DUAL_PROJECT_EMULATOR_PROOF_PASSED '+argv[1]+' '+argv[3]);
