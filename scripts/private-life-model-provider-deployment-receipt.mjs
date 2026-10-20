/** A failed or absent exact runtime readback cannot certify configured authority. */
export function createPrivateProviderDeploymentReceipt(env={}){
  const sha=/^[a-f0-9]{40}$/;
  const sourceSha=String(env.TARGET_SHA||'');
  const verified=env.DEPLOYMENT_VERIFY_SUCCEEDED==='true'
    && sha.test(sourceSha)&&env.VERIFIED_SOURCE_SHA===sourceSha
    && /^sha256:[a-f0-9]{64}$/.test(String(env.VERIFIED_IMAGE_DIGEST||''))
    && /^https:\/\/[A-Za-z0-9.-]+\/?$/.test(String(env.VERIFIED_URL||''))
    && /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(String(env.VERIFIED_REVISION||''));
  return {
    schemaVersion:'urai-private-life-model-provider-deploy-1',repository:env.GITHUB_REPOSITORY||null,
    workflowRunId:env.GITHUB_RUN_ID||null,sourceSha:sourceSha||null,rollbackSha:env.ROLLBACK_SHA||null,
    environment:env.URAI_ENV||null,project:env.GCLOUD_PROJECT||null,region:env.GCP_REGION||null,
    service:'private-life-model-index-provider',
    verificationStatus:verified?'VERIFIED_HARD_OFF_AUTHORITY_SURFACE':'UNVERIFIED_DO_NOT_ACCEPT',
    deploymentVerified:verified,serviceUrl:verified?env.VERIFIED_URL:null,revision:verified?env.VERIFIED_REVISION:null,
    imageDigest:verified?env.VERIFIED_IMAGE_DIGEST:null,authoritySurfaceConfigured:verified,resolverSurfaceConfigured:verified,
    privateSourceTranscriptionEnabled:false,privateLifeModelExecutionEnabled:false,providerCallsAuthorized:false,
    paidExecutionAuthorized:false,familyMediaProcessed:false,publicReleaseAuthorized:false,
  };
}
