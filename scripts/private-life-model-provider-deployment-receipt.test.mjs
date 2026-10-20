import assert from 'node:assert/strict';
import {createPrivateProviderDeploymentReceipt as receipt} from './private-life-model-provider-deployment-receipt.mjs';
const valid={DEPLOYMENT_VERIFY_SUCCEEDED:'true',TARGET_SHA:'a'.repeat(40),VERIFIED_SOURCE_SHA:'a'.repeat(40),
  VERIFIED_URL:'https://synthetic-provider.run.app',VERIFIED_REVISION:'synthetic-provider-00001',VERIFIED_IMAGE_DIGEST:'sha256:'+'b'.repeat(64)};
let passed=0;
for(const patch of [{},{DEPLOYMENT_VERIFY_SUCCEEDED:undefined},{DEPLOYMENT_VERIFY_SUCCEEDED:'false'},
  {VERIFIED_SOURCE_SHA:'c'.repeat(40)},{TARGET_SHA:'wrong'},{VERIFIED_IMAGE_DIGEST:'latest'},
  {VERIFIED_URL:''},{VERIFIED_URL:'http://synthetic.invalid'},{VERIFIED_REVISION:''},{VERIFIED_REVISION:'../foreign'}]){
  const input=Object.keys(patch).length?{...valid,...patch}:{};const out=receipt(input);
  assert.equal(out.deploymentVerified,false);assert.equal(out.authoritySurfaceConfigured,false);assert.equal(out.resolverSurfaceConfigured,false);
  assert.equal(out.serviceUrl,null);assert.equal(out.revision,null);assert.equal(out.imageDigest,null);assert.equal(out.verificationStatus,'UNVERIFIED_DO_NOT_ACCEPT');passed++;
}
const out=receipt(valid);assert.equal(out.deploymentVerified,true);assert.equal(out.sourceSha,valid.TARGET_SHA);
assert.equal(out.imageDigest,valid.VERIFIED_IMAGE_DIGEST);assert.equal(out.revision,valid.VERIFIED_REVISION);
for(const key of ['privateSourceTranscriptionEnabled','privateLifeModelExecutionEnabled','providerCallsAuthorized','paidExecutionAuthorized','familyMediaProcessed','publicReleaseAuthorized'])assert.equal(out[key],false);
passed++;
console.log(JSON.stringify({kind:'actual-fail-closed-provider-deployment-receipt',passed,providerCalls:0,cloudWrites:0,releaseApproval:false}));
