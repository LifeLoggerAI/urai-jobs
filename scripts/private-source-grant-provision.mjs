import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { getFirestore } = require('firebase-admin/firestore');
const { applicationDefault, getApps, initializeApp } = require('firebase-admin/app');

const CONTRACT='urai-private-source-receipt-v2';
const PRIVATE_REF=/^private:[A-Za-z0-9_./:-]{8,512}$/;
const SHA256=/^[a-f0-9]{64}$/;
const RECEIPT=/^psr_[A-Za-z0-9_-]{16,128}$/;
const HANDLE=/^psh_[A-Za-z0-9_-]{16,256}$/;
const OWNER=/^[A-Za-z0-9_-]{1,128}$/;
const PURPOSES=new Set(['transcribe','memory-index','reconstruct-place']);
const EVIDENCE=new Set(['SOURCE_CAPTURED','SOURCE_DERIVED','DIRECT_SUBJECT_TESTIMONY','ATTRIBUTED_TESTIMONY','CORROBORATED_INFERENCE','CONTEXTUAL_RESEARCH']);
const AUDIO_TYPES=new Set(['audio/wav','audio/x-wav','audio/mpeg','audio/mp4','audio/webm']);
const MAX_BYTES=2*1024**3;
const MAX_AUDIO_BYTES=25_000_000;
const MAX_AUDIO_SECONDS=600;

function hash(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function canonical(value){
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
function fail(message){throw new Error(message);}
function consentMap(grant){
  const entries=Array.isArray(grant.consents)?grant.consents:(grant.consent?[grant.consent]:[]);
  const map=new Map();
  for(const entry of entries){
    if(!entry || typeof entry!=='object' || typeof entry.purpose!=='string' || !entry.policyVersion || !entry.decisionReceiptId) fail('invalid consent');
    if(map.has(entry.purpose)) fail('duplicate consent purpose');
    map.set(entry.purpose,{purpose:entry.purpose,policyVersion:String(entry.policyVersion),decisionReceiptId:String(entry.decisionReceiptId)});
  }
  return map;
}
export function validateGrant(input, env=process.env){
  if(!input || typeof input!=='object' || Array.isArray(input)) fail('grant must be an object');
  const grant=structuredClone(input);
  if(grant.schemaVersion!==CONTRACT) fail('unsupported schemaVersion');
  if(!OWNER.test(String(grant.ownerUid||''))) fail('invalid ownerUid');
  if(!RECEIPT.test(String(grant.sourceReceiptRef||''))) fail('invalid sourceReceiptRef');
  if(!HANDLE.test(String(grant.sourceHandle||''))) fail('invalid sourceHandle');
  if(grant.status!=='ACTIVE') fail('status must be ACTIVE');
  if(grant.synthetic!==false) fail('synthetic must be false');
  if(!EVIDENCE.has(String(grant.sourceEvidenceClass||''))) fail('invalid sourceEvidenceClass');
  if(!PRIVATE_REF.test(String(grant.sourceFixityRef||''))) fail('invalid sourceFixityRef');
  if(!SHA256.test(String(grant.sourceSha256||''))) fail('invalid sourceSha256');
  if(!Number.isSafeInteger(grant.sourceByteLength) || grant.sourceByteLength<1 || grant.sourceByteLength>MAX_BYTES) fail('invalid sourceByteLength');
  if(!Number.isSafeInteger(grant.sourceRevision) || grant.sourceRevision<1) fail('invalid sourceRevision');
  if(!Array.isArray(grant.purposes) || grant.purposes.length<1 || grant.purposes.some(p=>!PURPOSES.has(p))) fail('invalid purposes');
  if(new Set(grant.purposes).size!==grant.purposes.length) fail('duplicate purposes');

  const consents=consentMap(grant);
  if(grant.purposes.some(p=>p==='transcribe'||p==='memory-index') && !consents.has('memory.storage')) fail('memory.storage consent required');
  if(grant.purposes.includes('reconstruct-place') && (!consents.has('memory.storage')||!consents.has('location.context'))) fail('reconstruct-place requires memory.storage and location.context consent');

  if(grant.purposes.includes('transcribe') && grant.storage===undefined) fail('transcribe purpose requires storage metadata');
  if(grant.storage!==undefined){
    const storage=grant.storage;
    if(!storage || typeof storage!=='object') fail('invalid storage');
    const allowedBucket=String(env.PRIVATE_SOURCE_ALLOWED_BUCKET||'').trim();
    if(allowedBucket && storage.bucket!==allowedBucket) fail('storage bucket does not match PRIVATE_SOURCE_ALLOWED_BUCKET');
    if(typeof storage.bucket!=='string' || !/^[a-z0-9][a-z0-9._-]{2,221}$/.test(storage.bucket)) fail('invalid storage bucket');
    const prefix='private-source/'+hash(grant.ownerUid)+'/';
    if(typeof storage.object!=='string' || !storage.object.startsWith(prefix) || storage.object.includes('..')) fail('invalid storage object');
    if(!/^[0-9]{1,30}$/.test(String(storage.generation||''))) fail('invalid storage generation');
    if(!AUDIO_TYPES.has(String(storage.contentType||''))) fail('invalid storage contentType');
    if(!Number.isFinite(storage.durationSeconds) || storage.durationSeconds<=0 || storage.durationSeconds>MAX_AUDIO_SECONDS) fail('invalid storage durationSeconds');
    if(grant.sourceByteLength>MAX_AUDIO_BYTES) fail('audio source exceeds private transcription byte limit');
  }
  return grant;
}
export function documentId(sourceReceiptRef){return hash(sourceReceiptRef);}
export function grantDigest(grant){return hash(canonical(grant));}

function args(argv){
  const out={apply:false,input:''};
  for(let i=2;i<argv.length;i++){
    if(argv[i]==='--apply') out.apply=true;
    else if(argv[i]==='--input') out.input=String(argv[++i]||'');
    else fail('unknown argument: '+argv[i]);
  }
  if(!out.input) fail('--input is required');
  return out;
}
async function main(){
  const cli=args(process.argv);
  const grant=validateGrant(JSON.parse(fs.readFileSync(cli.input,'utf8')));
  const id=documentId(grant.sourceReceiptRef);
  const result={ok:true,mode:cli.apply?'apply':'dry-run',documentPath:'uraiPrivateSourceReceipts/'+id,grantDigest:grantDigest(grant),sourceRevision:grant.sourceRevision,purposes:grant.purposes};
  if(!cli.apply){process.stdout.write(JSON.stringify(result)+'\n');return;}
  if(process.env.URAI_PRIVATE_SOURCE_GRANT_PROVISION_ENABLED!=='true') fail('URAI_PRIVATE_SOURCE_GRANT_PROVISION_ENABLED=true required for --apply');
  const project=String(process.env.FIREBASE_PROJECT_ID||process.env.GOOGLE_CLOUD_PROJECT||'').trim();
  if(!project) fail('FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT required for --apply');
  if(!getApps().length) initializeApp({credential:applicationDefault(),projectId:project});
  const db=getFirestore();
  const ref=db.collection('uraiPrivateSourceReceipts').doc(id);
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(snap.exists){
      const existing=snap.data();
      if(canonical(existing)!==canonical(grant)) fail('existing receipt differs; corrections require explicit governed revision flow');
      return;
    }
    tx.create(ref,grant);
  });
  process.stdout.write(JSON.stringify({...result,project,createdOrAlreadyExact:true})+'\n');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{console.error('[FAIL] '+(error instanceof Error?error.message:String(error)));process.exit(1);});
}
