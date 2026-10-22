// Canonical Jobs master/queue transaction: no worker dispatch or queue creation.
import type { ChalkIntakeRecord } from './chalkDiagnosticIntakeAuthority.js';
type Ref={id:string};
type Snapshot={exists:boolean;data():unknown};
type Tx={get(ref:Ref):Promise<Snapshot>;create(ref:Ref,data:Record<string,unknown>):void;
 set(ref:Ref,data:Record<string,unknown>,opts:{merge:true}):void};
export type MinimalTransaction=Tx;
const fail=(code:string):never=>{throw Error('CHALK_HELD_INTAKE_'+code)};
function match(v:unknown,r:ChalkIntakeRecord){
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const x=v as Record<string,unknown>,p=x.payload as Record<string,unknown>|null,
   a=x.admission as Record<string,unknown>|null;
 return x.jobId===r.jobId&&x.ownerUid===r.ownerUid&&x.type==='engineering.verify'&&
  x.jobType==='engineering.verify'&&x.status==='PENDING'&&
  p?.repository===r.payload.repository&&p?.baseSha===r.payload.baseSha&&
  p?.requestDigest===r.payload.requestDigest&&a?.state==='HELD_UNQUEUED'&&
  a?.workerAdmitted===false;
}
export async function persistChalkHeldIntake(input:{transaction:Tx;masterRef:Ref;queueRef:Ref;
 logRef:Ref;quotaRef:Ref;record:ChalkIntakeRecord;nowMs:number;timestamp:unknown;
 originSpatialUid?:string;bindingRevision?:number}){
 const {transaction:tx,masterRef,queueRef,logRef,quotaRef,record,nowMs,timestamp}=input;
 if(!Number.isSafeInteger(nowMs)||nowMs<0)fail('CLOCK');
 const bound=input.originSpatialUid!==undefined||input.bindingRevision!==undefined;
 if(bound&&(!/^[A-Za-z0-9_-]{8,128}$/.test(input.originSpatialUid??'')||
    !Number.isSafeInteger(input.bindingRevision)||Number(input.bindingRevision)<1))fail('ORIGIN_BINDING');
 // Read before writing; shared Jobs master-before-queue ordering.
 const master=await tx.get(masterRef),queue=await tx.get(queueRef),quota=await tx.get(quotaRef);
 if(queue.exists)fail('QUEUE_PRESENT');
 if(master.exists){
  const prior=master.data();
  if(!match(prior,record))fail('REQUEST_CONFLICT');
  if(bound){
   const stored=prior as Record<string,unknown>;
   if(stored.chalkOriginSpatialUid!==input.originSpatialUid||
      stored.chalkBindingRevision!==input.bindingRevision)fail('ORIGIN_CHANGED');
  }
  return {jobId:record.jobId,status:'PENDING',admission:'HELD_UNQUEUED',queued:false,deduplicated:true} as const;
 }
 const q=quota.exists?quota.data():null;
 if(q!==null&&(!q||typeof q!=='object'||Array.isArray(q)))fail('QUOTA_CORRUPT');
 const v=q as {windowStartMs?:unknown;count?:unknown}|null;
 if(v&&(!Number.isSafeInteger(v.windowStartMs)||!Number.isSafeInteger(v.count)||
  Number(v.windowStartMs)>nowMs||Number(v.count)<0||Number(v.count)>10000))fail('QUOTA_CORRUPT');
 const same=v!==null&&nowMs-Number(v.windowStartMs)<3600000;
 const count=same?Number(v?.count):0;
 if(count>=8)fail('RATE_LIMIT');
 tx.create(masterRef,{...record,
  ...(bound?{chalkOriginSpatialUid:input.originSpatialUid,chalkBindingRevision:input.bindingRevision}:{}),
  createdAt:timestamp,updatedAt:timestamp});
 tx.create(logRef,{level:'info',source:'chalk-emulator-intake',
  message:'Held engineering diagnostic; no queue or worker dispatch.',
  metadata:{sourceSha:record.payload.baseSha,requestDigest:record.payload.requestDigest,
   queued:false,providerSpendUsd:0,originSpatialUid:input.originSpatialUid??null,
   bindingRevision:input.bindingRevision??null},createdAt:timestamp});
 tx.set(quotaRef,{windowStartMs:same?v!.windowStartMs:nowMs,count:count+1},{merge:true});
 return {jobId:record.jobId,status:'PENDING',admission:'HELD_UNQUEUED',queued:false,deduplicated:false} as const;
}
