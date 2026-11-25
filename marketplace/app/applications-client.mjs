const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const applicationId = value => typeof value === 'string' && /^(?:application-[a-f0-9]{64}|[A-Za-z0-9_-]{1,128}:[A-Za-z0-9_-]{1,128})$/.test(value);
const statuses = new Set(['submitted','reviewing','withdrawn','rejected','advanced']);
const stoppable = item => ['submitted','reviewing'].includes(item.status);
const copy = value => structuredClone(value);
class ApplicationError extends Error { constructor(code) { super(code); this.code = code; } }

export function createApplicationsClient({session,fetch:send = globalThis.fetch,waitTimeoutMs = 20000}) {
  if (!session?.currentUser || !session?.subscribe || typeof send !== 'function') throw new Error('APPLICATION_HOST_BINDING_REQUIRED');
  if (!Number.isSafeInteger(waitTimeoutMs) || waitTimeoutMs<1 || waitTimeoutMs>60000) throw new Error('APPLICATION_WAIT_BOUND_REQUIRED');
  const listeners = new Set();
  let user = session.currentUser(), epoch = 0, operation = 0, abort, disposed = false, pages=[];
  let state = {phase:user ? 'idle' : 'signed-out',uid:user?.uid ?? null,items:[],nextCursor:null,stale:false,code:null,activeId:null};
  const emit = patch => { state = {...state,...patch}; for (const listener of listeners) listener(copy(state)); };
  const cancel = () => { operation++; abort?.abort('APPLICATION_REQUEST_SUPERSEDED'); abort = undefined; };
  const reset = next => { cancel();epoch++;user=next;pages=[];emit({phase:next ? 'idle' : 'signed-out',uid:next?.uid ?? null,items:[],nextCursor:null,stale:false,code:null,activeId:null}); };
  const unsubscribe = session.subscribe(next => { if (next !== user) reset(next); });
  const current = c => !disposed && c.epoch===epoch && c.operation===operation && user===c.user && session.currentUser()===c.user;
  const assertCurrent = c => {
    if (!disposed && session.currentUser()!==user) reset(session.currentUser());
    if (!current(c)) throw new ApplicationError('APPLICATION_REQUEST_SUPERSEDED');
    if (c.signal.aborted) throw new ApplicationError(c.signal.reason==='APPLICATION_REQUEST_TIMEOUT' ? 'APPLICATION_REQUEST_TIMEOUT' : 'APPLICATION_REQUEST_SUPERSEDED');
  };
  function begin(phase,activeId = null) {
    if (disposed) throw new ApplicationError('APPLICATION_CLIENT_DISPOSED');
    if (session.currentUser() !== user) reset(session.currentUser());
    if (!user) { emit({phase:'signed-out',code:'AUTH_REQUIRED'});return null; }
    cancel();abort=new AbortController();const c={user,epoch,operation,signal:abort.signal,controller:abort};
    c.timer=setTimeout(()=>{if(!c.signal.aborted)c.controller.abort('APPLICATION_REQUEST_TIMEOUT');},waitTimeoutMs);
    emit({phase,activeId,code:null});return c;
  }
  const finish = c => clearTimeout(c.timer);
  async function wait(c,start) {
    assertCurrent(c);
    let onAbort;
    const stopped=new Promise((_,reject)=>{onAbort=()=>reject(new ApplicationError(c.signal.reason==='APPLICATION_REQUEST_TIMEOUT' ? 'APPLICATION_REQUEST_TIMEOUT' : 'APPLICATION_REQUEST_SUPERSEDED'));c.signal.addEventListener('abort',onAbort,{once:true});});
    const pending=Promise.resolve().then(()=>{assertCurrent(c);return start();});
    try { return await Promise.race([pending,stopped]); }
    finally { c.signal.removeEventListener('abort',onAbort); }
  }
  async function request(c,path,method='GET',authenticated=true) {
    const token = authenticated ? await wait(c,()=>c.user.getIdToken(true)) : null;assertCurrent(c);
    const response=await wait(c,()=>send(path,{method,credentials:'same-origin',cache:'no-store',signal:c.signal,
      headers:{...(token ? {Authorization:'Bearer '+token} : {}),...(method==='PATCH' ? {'Content-Type':'application/json'} : {})},...(method==='PATCH' ? {body:'{}'} : {})}));
    const body=await wait(c,()=>response.json());assertCurrent(c);
    if (!response.ok || body?.ok!==true) throw new ApplicationError(typeof body?.code==='string' ? body.code : 'APPLICATION_RESPONSE_INVALID');
    return body;
  }
  function decode(result,c) {
    if (!Array.isArray(result.applications) || result.applications.length>50) throw new ApplicationError('APPLICATION_RESPONSE_INVALID');
    const seen=new Set();
    return result.applications.map(data=>{
      if (!applicationId(data?.id) || !id(data.jobId) || !id(data.employerId) || seen.has(data.id)
        || (data.status!=='withdrawn' && data.candidateUid!==c.user.uid)
        || (data.candidateUid!==undefined && data.candidateUid!==c.user.uid)) throw new ApplicationError('APPLICATION_RESPONSE_INVALID');
      seen.add(data.id);
      // Keep only the fields this view needs. A withdrawn stop receipt may omit
      // candidate/profile/answer fields; it must never restore revoked snapshots.
      return {id:data.id,jobId:data.jobId,employerId:data.employerId,status:statuses.has(data.status) ? data.status : 'unknown',title:null};
    });
  }
  async function read(c,cursor=null) {
    const result=await request(c,'/api/marketplace/applications/me'+(cursor===null?'':'?after='+encodeURIComponent(cursor)));
    const items=decode(result,c),nextCursor=result.nextCursor??null;
    if(nextCursor!==null&&(!applicationId(nextCursor)||items.length!==50||nextCursor!==items.at(-1).id||nextCursor===cursor))throw new ApplicationError('APPLICATION_RESPONSE_INVALID');
    const jobs=[...new Set(items.map(x=>x.jobId))],titles=new Map();let jobCursor=0;
    // Job labels come from existing public published-job reads, not inferred
    // application facts. Missing/closed posts do not prevent an authorized stop.
    await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{
      while(jobCursor<jobs.length) {
        const jobId=jobs[jobCursor++];
        try {
          const result=await request(c,'/api/marketplace/jobs/'+encodeURIComponent(jobId),'GET',false);
          const job=result.job;
          if (job?.id===jobId && job.status==='published' && job.moderationStatus==='approved' && typeof job.title==='string' && job.title.trim() && job.title.length<=256) titles.set(jobId,{title:job.title,employerId:job.employerId});
        } catch (error) { assertCurrent(c); }
      }
    }));
    // A revoked SDK session during the label awaits must clear private rows too.
    await wait(c,()=>c.user.getIdToken(true));assertCurrent(c);
    return {cursor,nextCursor,items:items.map(item=>({...item,title:titles.get(item.jobId)?.employerId===item.employerId ? titles.get(item.jobId).title : null}))};
  }
  function joined(nextPages){
    const items=nextPages.flatMap(page=>page.items);
    if(new Set(items.map(item=>item.id)).size!==items.length)throw new ApplicationError('APPLICATION_RESPONSE_INVALID');
    return{items,nextCursor:nextPages.at(-1)?.nextCursor??null};
  }
  function failure(c,error,attempted = false,acknowledged = false) {
    if (!disposed && session.currentUser()!==user) { reset(session.currentUser());return; }
    if (!current(c)) return;
    const code=error?.code || 'APPLICATION_CONNECTION_FAILED';
    if (/^(auth\/|AUTH_|INVALID_AUTHORIZATION|ACCOUNT_|TENANT_|CONSENT_|APPLICATION_OWNER_REQUIRED)/.test(code)) {pages=[];emit({phase:'denied',items:[],nextCursor:null,stale:false,code,activeId:null});}
    else emit({phase:code==='APPLICATION_NOT_PENDING' ? 'conflict' : acknowledged ? 'withdrawal-unverified' : attempted && /CONNECTION|RESPONSE_INVALID|REQUEST_TIMEOUT/.test(code) ? 'withdrawal-uncertain' : code==='APPLICATION_REQUEST_TIMEOUT' ? 'timed-out' : 'error',stale:true,code,activeId:null});
  }
  return {
    snapshot:()=>copy(state),
    subscribe(listener) { listeners.add(listener);listener(copy(state));return()=>listeners.delete(listener); },
    async load() {
      const c=begin('loading');if(!c)return;
      try { const page=await read(c);assertCurrent(c);const result=joined([page]);pages=[page];emit({phase:result.items.length ? 'ready' : 'empty',...result,stale:false,code:null,activeId:null}); }
      catch(error) { failure(c,error); }
      finally { finish(c); }
    },
    async loadMore() {
      if(session.currentUser()!==user){reset(session.currentUser());return;}
      if(disposed||state.stale||!['ready','withdrawn'].includes(state.phase)||!state.nextCursor)return;
      const cursor=state.nextCursor,c=begin('loading-more');if(!c)return;
      try{const page=await read(c,cursor);assertCurrent(c);const nextPages=[...pages,page],result=joined(nextPages);pages=nextPages;emit({phase:'ready',...result,stale:false,code:null,activeId:null});}
      catch(error){failure(c,error);}
      finally{finish(c);}
    },
    async withdraw(selectedId) {
      // Do not redirect an old account's click to a new session when its SDK
      // subscription callback has not yet arrived.
      if (session.currentUser()!==user) { reset(session.currentUser());return; }
      if (disposed || !['ready','withdrawn'].includes(state.phase) || state.stale || !user) return;
      const selected=state.items.find(x=>x.id===selectedId);
      if (!selected || !stoppable(selected)) { emit({code:'APPLICATION_NOT_PENDING'});return; }
      const pageIndex=pages.findIndex(page=>page.items.some(item=>item.id===selectedId)),cursor=pages[pageIndex]?.cursor;
      if(pageIndex<0)return;
      const c=begin('withdrawing',selectedId);if(!c)return;let attempted=false,acknowledged=false;
      try {
        attempted=true;const acknowledgment=await request(c,'/api/marketplace/applications/'+encodeURIComponent(selected.id)+'/withdraw','PATCH');
        if (acknowledgment.applicationId!==selected.id || acknowledgment.status!=='withdrawn') throw new ApplicationError('APPLICATION_RESPONSE_INVALID');
        acknowledged=true;
        const page=await read(c,cursor);assertCurrent(c);const receipt=page.items.find(x=>x.id===selected.id);
        if (receipt?.status!=='withdrawn' || receipt.jobId!==selected.jobId || receipt.employerId!==selected.employerId) throw new ApplicationError('APPLICATION_WITHDRAWAL_UNVERIFIED');
        // Page boundaries may shift after a concurrent insertion. Keep loaded
        // membership/cursors and update only the exact verified stop receipt;
        // discovering new records requires a deliberate fresh reload.
        const nextPages=pages.map(previous=>({...previous,items:previous.items.map(item=>item.id===selected.id?receipt:item)})),result=joined(nextPages);pages=nextPages;
        emit({phase:'withdrawn',...result,stale:false,code:null,activeId:null});
        return {verified:true,isCurrent:()=>current(c)};
      } catch(error) { failure(c,error,attempted,acknowledged); }
      finally { finish(c); }
    },
    interrupt() {
      if (!['loading','loading-more','withdrawing'].includes(state.phase)) return;
      cancel();emit({phase:'interrupted',stale:true,code:'APPLICATION_REQUEST_INTERRUPTED',activeId:null});
    },
    dispose() { if(!disposed){disposed=true;cancel();unsubscribe();listeners.clear();pages=[];state={...state,items:[],nextCursor:null};} },
  };
}
