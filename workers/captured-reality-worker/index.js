const crypto = require('node:crypto');
const express = require('express');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const app = express();
app.use(express.json({ limit: '256kb' }));

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
const SOURCE_RECEIPT = /^[A-Za-z0-9._:-]{8,256}$/;
const PRIVATE_HANDLE = /^[A-Za-z0-9._:-]{8,512}$/;
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const callbackTimeoutMs = Math.max(5 * 60_000, Number(process.env.CAPTURED_REALITY_CALLBACK_TIMEOUT_MS || 45 * 60_000));

function productionRuntime() {
  return ['prod', 'production', 'staging'].includes(String(process.env.URAI_ENV || process.env.NODE_ENV || 'local').toLowerCase());
}
function exactSha() { return SHA40.test(String(process.env.URAI_SOURCE_SHA || '')); }
function safeHttps(name) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return '';
  const url = new URL(raw);
  if (productionRuntime() && url.protocol !== 'https:') throw new Error(`${name} must use HTTPS outside local/test`);
  return raw.replace(/\/$/, '');
}
function bearer(req) { return String(req.get('authorization') || '').replace(/^Bearer\s+/i, ''); }
function timingSafeString(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}
function requireWorkerAuth(req, res, next) {
  const token = String(process.env.URAI_JOBS_WORKER_TOKEN || '');
  if (!token && !productionRuntime()) return next();
  if (!token) return res.status(503).send({ ok:false, error:'worker auth is not configured' });
  if (!timingSafeString(bearer(req), token)) return res.status(401).send({ ok:false, error:'unauthorized' });
  next();
}
function readiness() {
  const checks = {
    workerAuth: Boolean(process.env.URAI_JOBS_WORKER_TOKEN) || !productionRuntime(),
    sourceShaExact: exactSha() || !productionRuntime(),
    runtimeRevision: Boolean(process.env.K_REVISION) || !productionRuntime(),
    authorityUrl: Boolean(process.env.PRIVATE_SOURCE_AUTHORITY_URL),
    authorityToken: Boolean(process.env.PRIVATE_SOURCE_AUTHORITY_TOKEN),
    engineUrl: Boolean(process.env.CAPTURED_REALITY_ENGINE_URL),
    engineToken: Boolean(process.env.CAPTURED_REALITY_ENGINE_TOKEN),
  };
  return { checks, ok:Object.values(checks).every(Boolean) };
}
function validateJob(body) {
  const jobId=String(body?.jobId||'').trim();
  const leaseToken=String(body?.leaseToken||'').trim();
  const ownerUid=String(body?.ownerUid||'').trim();
  const jobType=String(body?.jobType||body?.type||'').trim();
  const payload=body?.payload && typeof body.payload==='object' ? body.payload : {};
  const sourceReceiptRefs=Array.isArray(payload.sourceReceiptRefs) ? payload.sourceReceiptRefs.map(String) : [];
  if(!jobId||!leaseToken||!ownerUid) throw new Error('jobId leaseToken and ownerUid are required');
  if(jobType!=='memory.private-source.reconstruct-place') throw new Error('unsupported job type');
  if(sourceReceiptRefs.length<1||sourceReceiptRefs.length>32||sourceReceiptRefs.some(x=>!SOURCE_RECEIPT.test(x))) throw new Error('invalid sourceReceiptRefs');
  if(!SHA40.test(String(payload.spatialAuthorityHead||''))) throw new Error('exact spatialAuthorityHead required');
  if(!['3dgs','photogrammetry','nerf-derived','hybrid'].includes(String(payload.reconstructionMethod||''))) throw new Error('invalid reconstructionMethod');
  if(payload.providerSpendAuthorized!==false||payload.publicReleaseAuthorized!==false) throw new Error('provider spend and public release must remain false');
  return {jobId,leaseToken,ownerUid,payload:{sourceReceiptRefs,studioProjectRef:String(payload.studioProjectRef||''),assetFactoryGovernanceRef:String(payload.assetFactoryGovernanceRef||''),spatialAuthorityHead:String(payload.spatialAuthorityHead),reconstructionMethod:String(payload.reconstructionMethod)}};
}
async function authorizeSources(job) {
  const authorityUrl=safeHttps('PRIVATE_SOURCE_AUTHORITY_URL');
  const token=String(process.env.PRIVATE_SOURCE_AUTHORITY_TOKEN||'');
  const handles=[];
  for(const sourceReceiptRef of job.payload.sourceReceiptRefs){
    const response=await fetch(`${authorityUrl}/authorize`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({sourceReceiptRef,ownerUid:job.ownerUid,requestedPurpose:'reconstruct-place',requestReceipt:job.jobId})});
    const data=await response.json().catch(()=>({}));
    if(response.status!==200||data.authorized!==true||!PRIVATE_HANDLE.test(String(data.sourceHandle||''))) throw new Error('private source authorization denied or invalid');
    handles.push(String(data.sourceHandle));
  }
  return handles;
}
function publicBaseUrl(req){
  const configured=String(process.env.CAPTURED_REALITY_WORKER_PUBLIC_URL||'').trim();
  if(configured){
    const url=new URL(configured);
    if(productionRuntime()&&url.protocol!=='https:') throw new Error('CAPTURED_REALITY_WORKER_PUBLIC_URL must use HTTPS outside local/test');
    return configured.replace(/\/$/,'');
  }
  const proto=String(req.get('x-forwarded-proto')||req.protocol||'https').split(',')[0].trim();
  const hostName=req.get('x-forwarded-host')||req.get('host');
  if(!hostName) throw new Error('public worker host unavailable');
  if(productionRuntime()&&proto!=='https') throw new Error('captured reality callback origin must use HTTPS outside local/test');
  return `${proto}://${hostName}`;
}
function consentBlockId(ownerUid,purpose){
  return crypto.createHash('sha256').update(String(ownerUid)+'\n'+String(purpose)).digest('hex');
}
function requiredConsentPurposes(job){
  const values=Array.isArray(job?.consents)?job.consents.map(x=>String(x?.purpose||'')):[];
  return [...new Set(values.filter(Boolean))];
}
function validArtifact(x){
  return x && PRIVATE_HANDLE.test(String(x.ref||'')) && SHA256.test(String(x.sha256||'')) && Number.isSafeInteger(x.byteSize) && x.byteSize>0;
}

app.get('/healthz',(_req,res)=>res.status(200).send({ok:true,service:'captured-reality-worker',sourceSha:String(process.env.URAI_SOURCE_SHA||'')}));
app.get('/readyz',(_req,res)=>{const state=readiness();res.set('cache-control','no-store');res.status(state.ok?200:503).send({ok:state.ok,service:'captured-reality-worker',checks:state.checks,sourceSha:String(process.env.URAI_SOURCE_SHA||'')});});
app.get('/authz',requireWorkerAuth,(_req,res)=>res.status(200).send({ok:true,service:'captured-reality-worker',authorized:true}));

app.post('/execute-job',requireWorkerAuth,async(req,res)=>{
  let job;
  try{job=validateJob(req.body);}catch(error){return res.status(400).send({ok:false,error:error.message});}
  const state=readiness();
  if(!state.ok) return res.status(503).send({ok:false,code:'CAPTURED_REALITY_WORKER_NOT_READY',checks:state.checks});
  const jobRef=db.collection('jobs').doc(job.jobId);
  const queueRef=db.collection('jobQueue').doc(job.jobId);
  const callbackToken=crypto.randomBytes(32).toString('hex');
  const callbackTokenHash=crypto.createHash('sha256').update(callbackToken).digest('hex');
  const deadline=admin.firestore.Timestamp.fromMillis(Date.now()+callbackTimeoutMs);
  let callbackAuthorityRegistered=false;
  try{
    const initial=await jobRef.get();
    const current=initial.exists?initial.data():null;
    if(!current||current.status!=='RUNNING'||current.execution?.leaseToken!==job.leaseToken) throw new Error('stale job or lease');

    // Source authorization happens before callback authority exists. A denial is
    // therefore a definitive dispatch failure and can safely terminalize upstream.
    const sourceHandles=await authorizeSources(job);
    const engineUrl=safeHttps('CAPTURED_REALITY_ENGINE_URL');
    const callbackUrl=`${publicBaseUrl(req)}/engine-callback?callbackToken=${encodeURIComponent(callbackToken)}`;

    await db.runTransaction(async tx=>{
      const snap=await tx.get(jobRef); const active=snap.exists?snap.data():null;
      if(!active||active.status!=='RUNNING'||active.execution?.leaseToken!==job.leaseToken) throw new Error('stale job or lease');
      tx.update(jobRef,{'progress.percent':15,'progress.stage':'CAPTURED_REALITY_DISPATCH','execution.asyncCallbackPending':true,'execution.callbackTokenHash':callbackTokenHash,'execution.callbackLeaseToken':job.leaseToken,'execution.callbackDeadlineAt':deadline,'lease.heartbeatAt':admin.firestore.FieldValue.serverTimestamp(),updatedAt:admin.firestore.FieldValue.serverTimestamp()});
      tx.set(queueRef,{jobId:job.jobId,status:'RUNNING','lease.heartbeatAt':admin.firestore.FieldValue.serverTimestamp(),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    });
    callbackAuthorityRegistered=true;

    let engine;
    try{
      engine=await fetch(`${engineUrl}/reconstruct`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.CAPTURED_REALITY_ENGINE_TOKEN}`},body:JSON.stringify({jobId:job.jobId,sourceHandles,reconstructionMethod:job.payload.reconstructionMethod,spatialAuthorityHead:job.payload.spatialAuthorityHead,studioProjectRef:job.payload.studioProjectRef,assetFactoryGovernanceRef:job.payload.assetFactoryGovernanceRef,callbackUrl})});
    }catch(error){
      // Transport loss after dispatch is ambiguous: the engine may have accepted
      // the request. Preserve callback authority and let the callback/reconciler
      // resolve the attempt instead of double-dispatching or false-failing it.
      console.error(JSON.stringify({event:'captured-reality.dispatch.ambiguous',jobId:job.jobId,error:error instanceof Error?error.message:String(error)}));
      return res.status(202).send({ok:true,accepted:true,callbackPending:true,jobId:job.jobId,status:'RUNNING',callbackDeadlineAt:deadline.toDate().toISOString(),warning:'Reconstruction dispatch response was ambiguous; callback authority remains active.'});
    }

    const data=await engine.json().catch(()=>({}));
    if(!engine.ok||data.accepted!==true){
      // A concrete non-acceptance response is definitive. Remove callback
      // authority so the Jobs executor can mark this attempt failed.
      await jobRef.update({'execution.asyncCallbackPending':false,'execution.callbackTokenHash':admin.firestore.FieldValue.delete(),'execution.callbackLeaseToken':admin.firestore.FieldValue.delete(),'execution.callbackDeadlineAt':admin.firestore.FieldValue.delete(),updatedAt:admin.firestore.FieldValue.serverTimestamp()});
      callbackAuthorityRegistered=false;
      throw new Error(`reconstruction engine rejected dispatch status ${engine.status}`);
    }
    await jobRef.update({'progress.percent':20,'progress.stage':'CAPTURED_REALITY_RECONSTRUCT','progress.message':'Private reconstruction engine accepted opaque source handles',updatedAt:admin.firestore.FieldValue.serverTimestamp()});
    return res.status(202).send({ok:true,accepted:true,jobId:job.jobId,status:'RUNNING',callbackDeadlineAt:deadline.toDate().toISOString()});
  }catch(error){
    console.error(JSON.stringify({event:'captured-reality.dispatch.failed',jobId:job.jobId,callbackAuthorityRegistered,error:error instanceof Error?error.message:String(error)}));
    return res.status(502).send({ok:false,error:'Captured Reality dispatch failed.'});
  }
});

app.post('/engine-callback',async(req,res)=>{
  const jobId=String(req.body?.jobId||'').trim();
  const token=String(req.query.callbackToken||'');
  const status=String(req.body?.status||'').toLowerCase();
  if(!jobId||!token||!['success','failed'].includes(status)) return res.status(400).send({ok:false,error:'invalid callback'});
  const jobRef=db.collection('jobs').doc(jobId); const queueRef=db.collection('jobQueue').doc(jobId);
  try{
    await db.runTransaction(async tx=>{
      const snap=await tx.get(jobRef); if(!snap.exists) throw new Error('job not found');
      const job=snap.data(); const expected=String(job.execution?.callbackTokenHash||'');
      const presented=crypto.createHash('sha256').update(token).digest('hex');
      if(!expected||!timingSafeString(presented,expected)) throw new Error('callback token rejected');
      if(job.status!=='RUNNING'||job.execution?.asyncCallbackPending!==true) throw new Error('callback not active');
      const deadline=job.execution?.callbackDeadlineAt?.toMillis?.()||0; if(deadline<=Date.now()) throw new Error('callback expired');

      const requiredPurposes=requiredConsentPurposes(job);
      if(!requiredPurposes.includes('memory.storage')||!requiredPurposes.includes('location.context')) throw new Error('required consent receipts missing from active job');
      const blockSnaps=[];
      for(const purpose of requiredPurposes){
        blockSnaps.push({purpose,snapshot:await tx.get(db.collection('jobConsentBlocks').doc(consentBlockId(String(job.ownerUid||''),purpose)))});
      }
      const blocked=blockSnaps.find(x=>x.snapshot.exists&&x.snapshot.data()?.active===true);
      const now=admin.firestore.FieldValue.serverTimestamp();
      if(blocked){
        tx.update(jobRef,{status:'CANCELLED',error:{message:`Captured Reality consent revoked: ${blocked.purpose}`},lease:admin.firestore.FieldValue.delete(),updatedAt:now,completedAt:now,'execution.asyncCallbackPending':false,'execution.callbackTokenHash':admin.firestore.FieldValue.delete(),'execution.callbackLeaseToken':admin.firestore.FieldValue.delete(),'execution.callbackDeadlineAt':admin.firestore.FieldValue.delete()});
        tx.set(queueRef,{jobId,status:'DONE',lease:admin.firestore.FieldValue.delete(),updatedAt:now},{merge:true});
        return 'cancelled';
      }
      if(status==='success'){
        const result=req.body?.result||{};
        if(!validArtifact(result.archival)||!validArtifact(result.runtime)||!validArtifact(result.collision)||!PRIVATE_HANDLE.test(String(result.cameraSolveReceiptRef||''))||!PRIVATE_HANDLE.test(String(result.trainingReceiptRef||''))||!PRIVATE_HANDLE.test(String(result.sourceVsReconstructionReceiptRef||''))) throw new Error('callback missing governed reconstruction artifacts or QA receipts');
        tx.update(jobRef,{status:'SUCCESS',result,output:result,error:admin.firestore.FieldValue.delete(),lease:admin.firestore.FieldValue.delete(),updatedAt:now,completedAt:now,'execution.asyncCallbackPending':false,'execution.callbackTokenHash':admin.firestore.FieldValue.delete(),'execution.callbackLeaseToken':admin.firestore.FieldValue.delete(),'execution.callbackDeadlineAt':admin.firestore.FieldValue.delete()});
      }else{
        tx.update(jobRef,{status:'FAILED',error:{message:'Captured Reality reconstruction engine reported failure.'},lease:admin.firestore.FieldValue.delete(),updatedAt:now,completedAt:now,'execution.asyncCallbackPending':false,'execution.callbackTokenHash':admin.firestore.FieldValue.delete(),'execution.callbackLeaseToken':admin.firestore.FieldValue.delete(),'execution.callbackDeadlineAt':admin.firestore.FieldValue.delete()});
      }
      tx.set(queueRef,{jobId,status:'DONE',lease:admin.firestore.FieldValue.delete(),updatedAt:now},{merge:true});
    });
    return res.status(200).send({ok:true,jobId,status});
  }catch(error){
    console.error(JSON.stringify({event:'captured-reality.callback.rejected',jobId,error:error instanceof Error?error.message:String(error)}));
    return res.status(403).send({ok:false,error:'callback rejected'});
  }
});

app.use((_req,res)=>res.status(404).send({ok:false,error:'not_found'}));
app.listen(port,host,()=>console.log(JSON.stringify({event:'worker.started',service:'captured-reality-worker',host,port})));
