import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {auditKnownJobsWriteSurfaces as audit} from './r1069-write-surface-custody.mjs';
const base=()=>({
  studio:"const {submitPrivateOutputToExclusiveBroker}=require('./private-output-broker-boundary'); await submitPrivateOutputToExclusiveBroker({}); await submitPrivateOutputToExclusiveBroker({}); fs.createWriteStream('/tmp/a');",
  broker:"function privateOutputBrokerCertified() { return false; } async function submitPrivateOutputToExclusiveBroker(_intent) { throw new Error('life_movie_exclusive_storage_broker_unavailable'); }",
  hardOff:'function privateOutputWriteAuthorityAvailable() { return false; }',
  narrator:'await file.save(audioBuffer, { resumable: false });',
  export:"const x=await uploadToGcs(bytes, destination, 'application/json');",
  gcs:'await file.save(buffer, {});',
  marketplace:'const [signedUrl]=await bucket.file(path).getSignedUrl({action:"write"});',
  deploy:'WORKERS_CSV="$WORKERS_CSV" node scripts/studio-worker-deploy-veto.mjs; gcloud config set project; --service-account "$WORKER_RUNTIME_SERVICE_ACCOUNT"',
  deployVeto:"if (workers.includes('studio-worker')) throw new Error(DENIED);",
  iamBootstrap:'echo MANAGED_WORKER_BROAD_STORAGE_IAM_BOOTSTRAP_HARD_OFF; exit 1',
});
const check = src => {const v=audit(src); assert.equal(v.verdict,'HOLD');
  for (const f of ['productionAuthorized','effectiveIamVerified','cloudWriterExclusiveVerified',
    'allWritersDrained','deletionAcknowledged','launchApproved'])assert.equal(v[f],false,f);
  return v;};
const has=(src,code)=>assert.ok(check(src).findings.includes(code),code);
test('known surfaces counted but never produce live IAM or release permission',()=>{
  const r=check(base());assert.equal(r.inspectedPaths,10);
  assert.deepEqual(r.findings,[...r.findings].sort());
  assert.ok(r.findings.includes('OTHER_REPOSITORIES_AND_LEGACY_DEPLOYMENTS_NOT_INVENTORIED'));
});
test('missing/injected/empty source is rejected, never treated as absence',()=>{
  const x=base();delete x.marketplace;assert.throws(()=>audit(x));
  assert.throws(()=>audit({...base(),authorized:true}));
  assert.throws(()=>audit({...base(),studio:''}));
});
test('both Studio paths must use broker; local fs stream remains valid',()=>{
  assert.ok(!check(base()).findings.includes('DIRECT_STUDIO_STORAGE_WRITER_REINTRODUCED'));
  const x=base();x.studio=x.studio.replace('await submitPrivateOutputToExclusiveBroker({});','');
  has(x,'STUDIO_BROKER_CALL_SITE_DRIFT');
});
test('direct GCS createWriteStream or save in Studio causes finding',()=>{
  for(const suffix of ['gcsFile.createWriteStream()','file.save(bytes)',
    'bucket.getSignedUrl({})','uploadToGcs(bytes)','gcloud storage cp x y']){
    const x=base();x.studio+='\n'+suffix;
    has(x,'DIRECT_STUDIO_STORAGE_WRITER_REINTRODUCED');
  }
});
test('a forged environment flag cannot convert deny-only broker to certified',()=>{
  const x=base();x.broker=x.broker.replace('return false;','return !!process.env.ENABLE;');
  has(x,'BROKER_UNCONDITIONAL_DENIAL_CHANGED');
  const y=base();y.hardOff=y.hardOff.replace('return false','return true');
  has(y,'STUDIO_PRIVATE_WRITE_HARD_OFF_CHANGED');
});
test('Narrator, export, shared GCS and marketplace remain separately inventoried',()=>{
  for(const [field,needle,code] of [
    ['narrator','.save(audioBuffer','NARRATOR_WRITE_SURFACE_DRIFT'],
    ['export','uploadToGcs(bytes','DATA_RIGHTS_EXPORT_SURFACE_DRIFT'],
    ['gcs','file.save(buffer','SHARED_GCS_EXPORT_HELPER_DRIFT'],
    ['marketplace','getSignedUrl','MARKETPLACE_SIGNED_UPLOAD_SURFACE_DRIFT'],
  ]){const x=base();x[field]=x[field].replace(needle,'UNREVIEWED');has(x,code);}
});
test('deploy veto must run ahead of first cloud mutation',()=>{
  const x=base();x.deploy=x.deploy.replace('gcloud config set project;','gcloud run deploy bad;');
  assert.ok(!check(x).findings.includes('STUDIO_DEPLOYMENT_PREMUTATION_VETO_DRIFT'));
  const y=base();y.deploy='gcloud run deploy bad; '+y.deploy;
  has(y,'STUDIO_DEPLOYMENT_PREMUTATION_VETO_DRIFT');
});
test('shared runtime identity and broad IAM bootstrap remain explicit custody',()=>{
  const x=base();x.deploy=x.deploy.replace('--service-account','$DISABLED');
  has(x,'WORKER_DEPLOY_PRINCIPAL_ASSIGNMENT_DRIFT');
  const y=base();y.iamBootstrap=y.iamBootstrap.replace('exit 1','exit 0');
  has(y,'BROAD_IAM_BOOTSTRAP_VETO_DRIFT');
});
test('offline CLI refuses absent opt-in and emits no source or private names',()=>{
  const p=fileURLToPath(new URL('./r1069-write-surface-custody.mjs',import.meta.url));
  const r=spawnSync(process.execPath,[p],{encoding:'utf8',timeout:5000});
  assert.equal(r.status,3);assert.equal(r.stdout,'');
  assert.match(r.stderr,/SOURCE_CUSTODY_HOLD/);
});
