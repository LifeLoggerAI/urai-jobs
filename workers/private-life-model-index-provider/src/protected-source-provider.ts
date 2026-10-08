import crypto from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Express, NextFunction, Request, Response } from 'express';

const CONTRACT = 'urai-private-source-receipt-v2';
const TRANSCRIPT_CONTRACT = 'urai-private-source-transcript-v2';
const PRIVATE_REF = /^private:[A-Za-z0-9_./:-]{8,512}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_AUDIO_BYTES = 25_000_000;
const MAX_TRANSCRIPT_CHARS = 240000;
const MAX_SEGMENTS = 256;
const MAX_DURATION_SECONDS = 600;
const MODEL = 'gpt-4o-transcribe-diarize';
const EVIDENCE = new Set(['SOURCE_CAPTURED','SOURCE_DERIVED','DIRECT_SUBJECT_TESTIMONY','ATTRIBUTED_TESTIMONY','CORROBORATED_INFERENCE','CONTEXTUAL_RESEARCH']);
const AUDIO_TYPES = new Map([['audio/wav','wav'],['audio/x-wav','wav'],['audio/mpeg','mp3'],['audio/mp4','m4a'],['audio/webm','webm']]);
type Dependencies = {
  firestore: () => Firestore;
  stableHash: (value: string) => string;
  canonicalJson: (value: unknown) => string;
  boundedResponse: (response: globalThis.Response, maximum: number) => Promise<string>;
};
type ProtectedRequest = { schemaVersion: string; ownerUid: string; jobId: string; leaseToken: string; sourceReceiptRef: string;
  requestedPurpose: 'transcribe' | 'memory-index' | 'reconstruct-place'; idempotencyKey: string; [key: string]: unknown };

function parseRequest(value: any): ProtectedRequest {
  const allowed = new Set(['schemaVersion','ownerUid','jobId','leaseToken','sourceReceiptRef','requestedPurpose','idempotencyKey','requestReceipt',
    'sourceHandle','sourceEvidenceClass','sourceSha256','sourceByteLength','sourceFixityRef','sourceRevision','transcriptRef','provenanceRef','locale']);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.has(key))) throw new Error('protected_source_invalid_fields');
  if (value.schemaVersion !== CONTRACT && value.schemaVersion !== TRANSCRIPT_CONTRACT) throw new Error('protected_source_contract_required');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value.ownerUid) || !/^[A-Za-z0-9._:-]{8,200}$/.test(value.jobId)
    || !/^[A-Za-z0-9._:-]{8,256}$/.test(value.leaseToken) || value.idempotencyKey !== value.jobId
    || !/^psr_[A-Za-z0-9_-]{16,128}$/.test(value.sourceReceiptRef) || !['transcribe','memory-index','reconstruct-place'].includes(value.requestedPurpose)) throw new Error('protected_source_invalid_authority');
  return value;
}

export function registerProtectedSourceRoutes(app: Express, deps: Dependencies) {
  const { firestore, stableHash: hash, canonicalJson, boundedResponse } = deps;
  const sourceRef = (request: ProtectedRequest) => firestore().collection('uraiPrivateSourceReceipts').doc(hash(request.sourceReceiptRef));
  const digest = (value: unknown) => hash(canonicalJson(value));
  function readiness(transcribe = false) {
    const checks = {
      contract: process.env.URAI_PRIVATE_SOURCE_CONTRACT === CONTRACT,
      firebaseProject: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT),
      sourceSha: /^[a-f0-9]{40}$/.test(String(process.env.URAI_SOURCE_SHA || '')),
      runtimeRevision: Boolean(process.env.K_REVISION),
      authorityToken: Boolean(process.env.PRIVATE_SOURCE_AUTHORITY_TOKEN),
      resolverToken: Boolean(process.env.PRIVATE_SOURCE_REF_RESOLVER_TOKEN),
      ...(transcribe ? {
        transcribeToken: Boolean(process.env.PRIVATE_SOURCE_TRANSCRIBE_TOKEN),
        executionEnabled: process.env.URAI_PRIVATE_SOURCE_TRANSCRIPTION_ENABLED === 'true',
        executionAuthority: PRIVATE_REF.test(String(process.env.URAI_PRIVATE_SOURCE_TRANSCRIPTION_AUTHORITY_REF || '')),
        privateBucket: /^[a-z0-9][a-z0-9._-]{2,221}$/.test(String(process.env.PRIVATE_SOURCE_ALLOWED_BUCKET || '')),
        extractorKey: Boolean(process.env.OPENAI_API_KEY), model: process.env.URAI_PRIVATE_SOURCE_DIARIZATION_MODEL === MODEL,
      } : {}),
    };
    return { ok: Object.values(checks).every(Boolean), checks };
  }
  const authenticated = (name: string) => (req: Request, res: Response, next: NextFunction) => {
    const token = String(process.env[name] || '');
    if (!token) return res.status(503).send({ ok: false, code: 'PROTECTED_SOURCE_AUTH_UNCONFIGURED' });
    if (!crypto.timingSafeEqual(Buffer.from(hash(req.get('Authorization') || ''),'hex'),Buffer.from(hash('Bearer '+token),'hex'))) return res.status(401).send({ok:false,code:'UNAUTHORIZED'});
    return next();
  };
  // Privileged grant documents are provisioned by the existing source authority,
  // never by a caller or this service. The Firestore default client-deny rule applies.
  async function currentGrant(tx: any, request: ProtectedRequest) {
    const db = firestore();
    const job = (await tx.get(db.collection('jobs').doc(request.jobId))).data();
    const expectedType = request.requestedPurpose === 'memory-index'
      ? 'memory.private-source.index'
      : request.requestedPurpose === 'reconstruct-place'
        ? 'memory.private-source.reconstruct-place'
        : 'memory.private-source.transcribe';
    const sourceRefs = request.requestedPurpose === 'reconstruct-place'
      ? (Array.isArray(job?.payload?.sourceReceiptRefs) ? job.payload.sourceReceiptRefs : [])
      : [job?.payload?.sourceReceiptRef];
    if (!job || job.ownerUid !== request.ownerUid || (job.type || job.jobType) !== expectedType || job.status !== 'RUNNING'
      || job.execution?.leaseToken !== request.leaseToken || !sourceRefs.includes(request.sourceReceiptRef)
      || job.payload?.requestedPurpose !== request.requestedPurpose) throw new Error('protected_source_job_mismatch');
    if (request.locale && request.locale !== job.payload?.locale) throw new Error('protected_source_locale_mismatch');
    if (request.requestReceipt && request.requestReceipt !== job.payload?.requestReceipt && request.requestReceipt !== job.jobId) throw new Error('protected_source_request_receipt_mismatch');

    const requiredConsents = request.requestedPurpose === 'reconstruct-place'
      ? (Array.isArray(job.consents) ? job.consents : [])
      : (job.consent ? [job.consent] : []);
    const requiredPurposes = request.requestedPurpose === 'reconstruct-place'
      ? new Set(['memory.storage','location.context'])
      : new Set(['memory.storage']);
    const consentByPurpose = new Map(requiredConsents.map((entry:any)=>[entry?.purpose,entry]));
    if (consentByPurpose.size !== requiredPurposes.size || [...requiredPurposes].some(purpose => {
      const consent = consentByPurpose.get(purpose);
      return !consent?.policyVersion || !consent?.decisionReceiptId;
    })) throw new Error('protected_source_required_consent_missing');
    const blocks = await Promise.all([...requiredPurposes].map(purpose =>
      tx.get(db.collection('jobConsentBlocks').doc(hash(request.ownerUid+'\n'+purpose)))
    ));
    const [source, fence] = await Promise.all([
      tx.get(sourceRef(request)),
      tx.get(db.collection('uraiPrivateLifeModelOwnerFences').doc(hash(request.ownerUid)))
    ]);
    const grant = source.data();
    if (blocks.some(block => block.data()?.active === true) || fence.data()?.deleted === true) throw new Error('protected_source_revoked_deleted');
    if (!grant || grant.schemaVersion !== CONTRACT || grant.ownerUid !== request.ownerUid || grant.sourceReceiptRef !== request.sourceReceiptRef
      || grant.status !== 'ACTIVE' || grant.synthetic !== false || !/^psh_[A-Za-z0-9_-]{16,256}$/.test(grant.sourceHandle)
      || !EVIDENCE.has(grant.sourceEvidenceClass) || !PRIVATE_REF.test(grant.sourceFixityRef) || !SHA256.test(grant.sourceSha256)
      || !Number.isSafeInteger(grant.sourceByteLength) || grant.sourceByteLength < 1 || grant.sourceByteLength > 2 * 1024 ** 3
      || !Number.isSafeInteger(grant.sourceRevision) || grant.sourceRevision < 1
      || !Array.isArray(grant.purposes) || !grant.purposes.includes(request.requestedPurpose)
      || !requiredConsents.every((consent:any) => {
        const grants = Array.isArray(grant.consents) ? grant.consents : (grant.consent ? [grant.consent] : []);
        const current = grants.find((entry:any)=>entry?.purpose === consent.purpose);
        return current?.policyVersion === consent.policyVersion && current?.decisionReceiptId === consent.decisionReceiptId;
      })) throw new Error('protected_source_grant_mismatch');
    for (const key of ['sourceHandle','sourceSha256','sourceByteLength','sourceFixityRef','sourceRevision']) {
      if (request[key] !== undefined && request[key] !== grant[key]) throw new Error('protected_source_fixity_mismatch');
    }
    if (request.sourceEvidenceClass !== undefined && request.sourceEvidenceClass !== grant.sourceEvidenceClass) throw new Error('protected_source_evidence_mismatch');
    return { grant, job, grantDigest: digest({ownerUid:grant.ownerUid,sourceReceiptRef:grant.sourceReceiptRef,sourceHandle:grant.sourceHandle,
      sourceRevision:grant.sourceRevision,sourceSha256:grant.sourceSha256,sourceByteLength:grant.sourceByteLength,sourceFixityRef:grant.sourceFixityRef,
      sourceEvidenceClass:grant.sourceEvidenceClass,purposes:grant.purposes,consent:grant.consent || null,consents:grant.consents || null,storage:grant.storage || null}) };
  }
  const current = (request: ProtectedRequest) => firestore().runTransaction(tx => currentGrant(tx,request));
  function proof(request: ProtectedRequest, grant: any) {
    return { schemaVersion: CONTRACT, authorized:true, ownerUid:request.ownerUid,jobId:request.jobId,leaseTokenHash:hash(request.leaseToken),
      sourceReceiptRef:request.sourceReceiptRef,requestedPurpose:request.requestedPurpose,idempotencyKey:request.idempotencyKey,
      sourceHandle:grant.sourceHandle,evidenceClass:grant.sourceEvidenceClass,sourceEvidenceClass:grant.sourceEvidenceClass,
      synthetic:false,currentConsent:true,currentCorrection:true,sourceRevision:grant.sourceRevision,sourceSha256:grant.sourceSha256,
      sourceFixityRef:grant.sourceFixityRef,sourceByteLength:grant.sourceByteLength,historicalSourceAuthority:false,reviewState:'OWNER_REVIEW_REQUIRED' };
  }
  async function resolve(request: ProtectedRequest) {
    if (request.requestedPurpose !== 'memory-index') throw new Error('protected_source_index_purpose_required');
    const value = await firestore().runTransaction(async tx => {
      const {grant,job} = await currentGrant(tx,request);
      if (!PRIVATE_REF.test(String(request.transcriptRef || '')) || !PRIVATE_REF.test(String(request.provenanceRef || ''))
        || request.transcriptRef !== job.payload?.transcriptRef || request.provenanceRef !== job.payload?.provenanceRef) throw new Error('protected_transcript_request_mismatch');
      const record = (await tx.get(sourceRef(request).collection('transcripts').doc(hash(String(request.transcriptRef))))).data();
      if (!record || record.schemaVersion !== TRANSCRIPT_CONTRACT || record.ownerUid !== request.ownerUid || record.sourceReceiptRef !== request.sourceReceiptRef
        || record.transcriptRef !== request.transcriptRef || record.provenanceRef !== request.provenanceRef || record.status !== 'CURRENT'
        || record.synthetic !== false || record.requestedPurpose !== 'memory-index' || record.sourceRevision !== grant.sourceRevision || record.sourceSha256 !== grant.sourceSha256
        || typeof record.transcriptText !== 'string' || !record.transcriptText || record.transcriptText.length > MAX_TRANSCRIPT_CHARS
        || record.transcriptByteLength !== Buffer.byteLength(record.transcriptText,'utf8') || record.transcriptSha256 !== hash(record.transcriptText)
        || !record.provenance || record.provenanceSha256 !== digest(record.provenance)) throw new Error('protected_transcript_current_fixity_required');
      return {...proof(request,grant),transcriptRef:record.transcriptRef,provenanceRef:record.provenanceRef,transcriptText:record.transcriptText,
        transcriptByteLength:record.transcriptByteLength,transcriptSha256:record.transcriptSha256,provenanceSha256:record.provenanceSha256,provenance:record.provenance};
    });
    return value;
  }
  async function privateAudio(request: ProtectedRequest, grant: any, signal: AbortSignal) {
    const storage = grant.storage;
    if (!storage || storage.bucket !== process.env.PRIVATE_SOURCE_ALLOWED_BUCKET || typeof storage.object !== 'string'
      || !storage.object.startsWith('private-source/'+hash(request.ownerUid)+'/') || storage.object.includes('..')
      || !/^[0-9]{1,30}$/.test(String(storage.generation || '')) || grant.sourceByteLength > MAX_AUDIO_BYTES
      || !AUDIO_TYPES.has(String(storage.contentType || '')) || !Number.isFinite(storage.durationSeconds)
      || storage.durationSeconds <= 0 || storage.durationSeconds > MAX_DURATION_SECONDS) throw new Error('protected_audio_grant_invalid');
    const bucket = getStorage().bucket(storage.bucket);
    const [bucketMeta] = await bucket.getMetadata();
    if (bucketMeta.iamConfiguration?.uniformBucketLevelAccess?.enabled !== true || bucketMeta.iamConfiguration?.publicAccessPrevention !== 'enforced') throw new Error('protected_audio_bucket_not_private');
    const file = bucket.file(storage.object,{generation:String(storage.generation)});
    const [meta] = await file.getMetadata();
    if (String(meta.generation) !== String(storage.generation) || Number(meta.size) !== grant.sourceByteLength || meta.contentType !== storage.contentType
      || meta.acl?.some((entry:any)=>['allUsers','allAuthenticatedUsers'].includes(entry.entity))) throw new Error('protected_audio_generation_mismatch');
    const stream = file.createReadStream({validation:'crc32c'});
    const abort = () => stream.destroy(new Error('protected_audio_aborted'));
    signal.addEventListener('abort',abort,{once:true});
    const chunks: Buffer[] = [];let size=0;
    try { for await (const value of stream) {if(signal.aborted)throw new Error('protected_audio_aborted');const chunk=Buffer.from(value);size+=chunk.length;
      if(size>MAX_AUDIO_BYTES || size>grant.sourceByteLength){stream.destroy();throw new Error('protected_audio_byte_limit');}chunks.push(chunk);}
    } finally {signal.removeEventListener('abort',abort);stream.destroy();}
    const bytes=Buffer.concat(chunks);
    if (bytes.length !== grant.sourceByteLength || crypto.createHash('sha256').update(bytes).digest('hex') !== grant.sourceSha256) throw new Error('protected_audio_hash_mismatch');
    return {bytes,contentType:storage.contentType,extension:AUDIO_TYPES.get(storage.contentType)!};
  }
  function normalizeDiarization(value: any) {
    const text=String(value?.text || '');
    if(!text || text.length>MAX_TRANSCRIPT_CHARS || !Array.isArray(value?.segments) || !value.segments.length || value.segments.length>MAX_SEGMENTS)throw new Error('private_diarization_invalid');
    const speakers = new Map<string,string>();let cursor=0,lastStart=-1;
    const segments=value.segments.map((segment:any,index:number)=>{
      const speaker=String(segment.speaker || '');const segmentText=String(segment.text || '').trim();
      if(!speaker || speaker.length>128 || !segmentText || !Number.isFinite(segment.start) || !Number.isFinite(segment.end)
        || segment.start<0 || segment.start<lastStart || segment.end<=segment.start || segment.end>MAX_DURATION_SECONDS)throw new Error('private_diarization_segment_invalid');
      if(!speakers.has(speaker))speakers.set(speaker,'speaker_'+(speakers.size+1));if(speakers.size>16)throw new Error('private_diarization_speaker_limit');
      const startChar=text.indexOf(segmentText,cursor);if(startChar<0)throw new Error('private_diarization_span_mismatch');cursor=startChar+segmentText.length;lastStart=segment.start;
      return {segmentId:'segment_'+(index+1),speakerId:speakers.get(speaker),startSeconds:segment.start,endSeconds:segment.end,
        startChar,endChar:cursor,identityAccepted:false};
    });
    return {text,segments,speakerCount:speakers.size};
  }
  async function transcribe(request: ProtectedRequest) {
    if (request.requestedPurpose !== 'transcribe') throw new Error('protected_source_transcription_purpose_required');
    const db=firestore(),attemptRef=sourceRef(request).collection('transcriptionAttempts').doc(hash(request.idempotencyKey));
    const admitted=await db.runTransaction(async tx=>{
      const authority=await currentGrant(tx,request);const prior=(await tx.get(attemptRef)).data();
      const requestDigest=digest({ownerUid:request.ownerUid,jobId:request.jobId,sourceReceiptRef:request.sourceReceiptRef,requestedPurpose:request.requestedPurpose,
        locale:request.locale || null,grantDigest:authority.grantDigest,model:MODEL});
      if(prior){if(prior.ownerUid!==request.ownerUid || prior.requestDigest!==requestDigest)throw new Error('private_transcription_idempotency_conflict');
        if(prior.state!=='FINISHED')throw new Error('private_transcription_reconciliation_required');
        const transcript=(await tx.get(sourceRef(request).collection('transcripts').doc(hash(String(prior.result?.transcriptRef || ''))))).data();
        if(!transcript || transcript.ownerUid!==request.ownerUid || transcript.status!=='CURRENT' || transcript.synthetic!==false
          || transcript.sourceRevision!==authority.grant.sourceRevision || transcript.transcriptSha256!==prior.result?.transcriptSha256
          || transcript.provenanceSha256!==prior.result?.provenanceSha256 || hash(String(transcript.transcriptText || ''))!==transcript.transcriptSha256
          || digest(transcript.provenance)!==transcript.provenanceSha256)throw new Error('private_transcription_replay_stale');
        return {...authority,requestDigest,replayed:true,reservation:'',result:prior.result};}
      const reservation=crypto.randomUUID();tx.create(attemptRef,{ownerUid:request.ownerUid,jobId:request.jobId,requestDigest,reservation,state:'STARTED',createdAt:FieldValue.serverTimestamp()});
      return {...authority,requestDigest,reservation,replayed:false,result:undefined};
    });
    if(admitted.replayed)return {...admitted.result,leaseTokenHash:hash(request.leaseToken),replayed:true};
    const controller=new AbortController();let checking=false;
    const monitor=setInterval(()=>{if(checking)return;checking=true;void current(request).then(fresh=>{if(fresh.grantDigest!==admitted.grantDigest)controller.abort();}).catch(()=>controller.abort()).finally(()=>{checking=false;});},5000);
    const timeout=setTimeout(()=>controller.abort(),110000);
    let audio: Buffer | undefined;
    try {
      const fresh=await current(request);if(fresh.grantDigest!==admitted.grantDigest)throw new Error('protected_source_changed_before_download');
      const input=await privateAudio(request,admitted.grant,controller.signal);audio=input.bytes;
      const before=await current(request);if(before.grantDigest!==admitted.grantDigest || controller.signal.aborted)throw new Error('protected_source_changed_before_provider');
      const form=new FormData();form.set('file',new Blob([new Uint8Array(audio)],{type:input.contentType}),'private-source.'+input.extension);
      form.set('model',MODEL);form.set('response_format','diarized_json');form.set('chunking_strategy','auto');
      // No speaker name/reference, voice identity, arbitrary prompt or user URL.
      const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',redirect:'error',
        headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:form,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)])});
      if(!response.ok)throw new Error('private_transcription_provider_failed');
      const diarized=normalizeDiarization(JSON.parse(await boundedResponse(response,2*1024*1024)));
      const refs='private:source/'+hash(request.sourceReceiptRef)+'/r'+admitted.grant.sourceRevision+'/'+hash(request.jobId).slice(0,24);
      const transcriptRef=refs+'/transcript',provenanceRef=refs+'/provenance';
      const provenance={schemaVersion:TRANSCRIPT_CONTRACT,ownerUid:request.ownerUid,jobId:request.jobId,sourceReceiptRef:request.sourceReceiptRef,
        sourceSha256:admitted.grant.sourceSha256,sourceByteLength:admitted.grant.sourceByteLength,sourceRevision:admitted.grant.sourceRevision,
        sourceFixityRef:admitted.grant.sourceFixityRef,model:MODEL,provider:'openai',sourceSha:process.env.URAI_SOURCE_SHA,runtimeRevision:process.env.K_REVISION,
        executionAuthorityRef:process.env.URAI_PRIVATE_SOURCE_TRANSCRIPTION_AUTHORITY_REF,segments:diarized.segments,speakerCount:diarized.speakerCount,
        speakerIdentityAccepted:false,historicalSourceAuthority:false,reviewState:'OWNER_REVIEW_REQUIRED',candidateAcceptance:false,publicReleaseAuthorized:false};
      const record={schemaVersion:TRANSCRIPT_CONTRACT,ownerUid:request.ownerUid,jobId:request.jobId,sourceReceiptRef:request.sourceReceiptRef,
        transcriptRef,provenanceRef,transcriptText:diarized.text,transcriptSha256:hash(diarized.text),transcriptByteLength:Buffer.byteLength(diarized.text,'utf8'),
        provenance,provenanceSha256:digest(provenance),sourceSha256:admitted.grant.sourceSha256,sourceRevision:admitted.grant.sourceRevision,
        status:'CURRENT',synthetic:false,requestedPurpose:'memory-index',historicalSourceAuthority:false,reviewState:'OWNER_REVIEW_REQUIRED'};
      if(Buffer.byteLength(canonicalJson(record),'utf8')>900*1024)throw new Error('private_transcription_document_limit');
      const result={ok:true,schemaVersion:TRANSCRIPT_CONTRACT,ownerUid:request.ownerUid,jobId:request.jobId,sourceReceiptRef:request.sourceReceiptRef,
        leaseTokenHash:hash(request.leaseToken),requestedPurpose:'transcribe',synthetic:false,transcriptRef,provenanceRef,
        transcriptSha256:record.transcriptSha256,transcriptByteLength:record.transcriptByteLength,provenanceSha256:record.provenanceSha256,
        sourceSha256:record.sourceSha256,sourceRevision:record.sourceRevision,sourceFixityRef:admitted.grant.sourceFixityRef,checksum:digest(record),
        historicalSourceAuthority:false,reviewState:'OWNER_REVIEW_REQUIRED',speakerIdentityAccepted:false,replayed:false};
      await db.runTransaction(async tx=>{
        const authority=await currentGrant(tx,request);const prior=(await tx.get(attemptRef)).data();
        if(controller.signal.aborted || authority.grantDigest!==admitted.grantDigest || prior?.state!=='STARTED'
          || prior.reservation!==admitted.reservation || prior.requestDigest!==admitted.requestDigest)throw new Error('private_transcription_stale_result');
        tx.create(sourceRef(request).collection('transcripts').doc(hash(transcriptRef)),{...record,createdAt:FieldValue.serverTimestamp()});
        tx.set(attemptRef,{ownerUid:request.ownerUid,jobId:request.jobId,state:'FINISHED',requestDigest:admitted.requestDigest,result,completedAt:FieldValue.serverTimestamp()});
      });
      await current(request);return result;
    } catch(error) {
      await db.runTransaction(async tx=>{const prior=(await tx.get(attemptRef)).data();if(prior?.state==='STARTED' && prior.reservation===admitted.reservation)
        tx.set(attemptRef,{state:'FAILED_RECONCILIATION_REQUIRED',failureCode:'PRIVATE_TRANSCRIPTION_FAILED',failedAt:FieldValue.serverTimestamp()},{merge:true});});
      throw error;
    } finally {clearInterval(monitor);clearTimeout(timeout);audio?.fill(0);}
  }
  const handler=(operation:(request:ProtectedRequest)=>Promise<any>,needsExecution=false)=>async(req:Request,res:Response)=>{
    const state=readiness(needsExecution);res.set('Cache-Control','no-store');
    if(!state.ok)return res.status(503).send({ok:false,code:'PROTECTED_SOURCE_NOT_READY',checks:state.checks});
    try{return res.status(200).send(await operation(parseRequest(req.body)));}
    catch{return res.status(403).send({ok:false,code:'PROTECTED_SOURCE_DENIED_OR_RECONCILIATION_REQUIRED'});}
  };
  app.get('/private-source-readyz',(_req,res)=>{const state=readiness(true);res.set('Cache-Control','no-store');res.status(state.ok?200:503).send({...state,
    sourceContract:CONTRACT,candidateAcceptance:false,publicReleaseAuthorized:false});});
  app.post('/authorize',authenticated('PRIVATE_SOURCE_AUTHORITY_TOKEN'),handler(async request=>proof(request,(await current(request)).grant)));
  app.post('/resolve-life-model-inputs',authenticated('PRIVATE_SOURCE_REF_RESOLVER_TOKEN'),handler(resolve));
  app.post('/transcribe',authenticated('PRIVATE_SOURCE_TRANSCRIBE_TOKEN'),handler(transcribe,true));
}
