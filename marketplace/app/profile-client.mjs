// Isolated Career client. The host supplies its existing Auth subscription and
// purpose-specific consent authority; this module creates neither authority.
const emptyDraft = () => ({displayName:'',location:'',skills:[],links:[],experience:''});
const strings = value => Array.isArray(value) && value.length <= 40 && value.every(x => typeof x === 'string' && x.trim().length > 0 && x.length <= 256);
const validDraft = d => d && typeof d.displayName === 'string' && d.displayName.trim().length > 0 && d.displayName.length <= 256
  && typeof d.location === 'string' && d.location.length <= 256 && typeof d.experience === 'string' && d.experience.length <= 4096
  && strings(d.skills) && strings(d.links);
const validConsent = c => c && c.purpose === 'career.profile' && typeof c.policyVersion === 'string' && /^[A-Za-z0-9._:-]{1,80}$/.test(c.policyVersion)
  && typeof c.decisionReceiptId === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(c.decisionReceiptId) && Object.keys(c).length === 3;
const copy = x => structuredClone(x);
class ProfileError extends Error { constructor(code, authoritative = false) { super(code); this.code = code; this.authoritative = authoritative; } }

export function firebaseProfileSession(auth, onIdTokenChanged) {
  return {currentUser:() => auth.currentUser, subscribe:listener => onIdTokenChanged(auth, listener)};
}

export function createProfileClient({session, consentAuthority, fetch:send = globalThis.fetch}) {
  if (!session?.currentUser || !session?.subscribe || typeof consentAuthority !== 'function' || typeof send !== 'function') throw new Error('PROFILE_HOST_BINDING_REQUIRED');
  const listeners = new Set();
  let user = session.currentUser(), epoch = 0, operation = 0, abort, disposed = false;
  let state = {phase:user ? 'idle' : 'signed-out',uid:user?.uid ?? null,profile:null,draft:emptyDraft(),revision:0,dirty:false,code:null};
  const emit = patch => { state = {...state,...patch}; for (const listener of listeners) listener(copy(state)); };
  const cancel = () => { operation++; abort?.abort('PROFILE_REQUEST_SUPERSEDED'); abort = undefined; };
  const reset = next => {
    cancel(); epoch++; user = next;
    emit({phase:next ? 'idle' : 'signed-out',uid:next?.uid ?? null,profile:null,draft:emptyDraft(),revision:0,dirty:false,code:null});
  };
  // Firebase emits the same User object on token refresh (including the refresh
  // requested below). It is not an account change and must not cancel itself.
  const unsubscribe = session.subscribe(next => { if (next !== user) reset(next); });
  function begin(phase) {
    if (disposed) throw new ProfileError('PROFILE_CLIENT_DISPOSED');
    const current = session.currentUser();
    if (current !== user) reset(current);
    if (!user) { emit({phase:'signed-out',code:'AUTH_REQUIRED'}); return null; }
    cancel(); abort = new AbortController();
    const context = {user,epoch,operation,signal:abort.signal,controller:abort,attempted:false};
    // One fixed production deadline covers the entire operation, including
    // token refresh, consent authority, transport and authoritative readback.
    context.timer = setTimeout(() => { if (!context.signal.aborted) context.controller.abort('PROFILE_REQUEST_TIMEOUT'); },20000);
    emit({phase,code:null}); return context;
  }
  const current = c => !disposed && c.epoch === epoch && c.operation === operation && session.currentUser() === c.user && user === c.user;
  const assertCurrent = c => {
    if (!disposed && session.currentUser() !== user) reset(session.currentUser());
    if (!current(c)) throw new ProfileError('PROFILE_REQUEST_SUPERSEDED');
    if (c.signal.aborted) throw new ProfileError(c.signal.reason === 'PROFILE_REQUEST_TIMEOUT' ? 'PROFILE_REQUEST_TIMEOUT' : 'PROFILE_REQUEST_SUPERSEDED');
  };
  async function wait(c,start) {
    assertCurrent(c);
    let onAbort;
    const stopped = new Promise((_,reject) => { onAbort = () => reject(new ProfileError(c.signal.reason === 'PROFILE_REQUEST_TIMEOUT' ? 'PROFILE_REQUEST_TIMEOUT' : 'PROFILE_REQUEST_SUPERSEDED')); c.signal.addEventListener('abort',onAbort,{once:true}); });
    // Observe work even after the race stops waiting. The thunk prevents stale
    // token/consent/provider work from being started before the current fence.
    const pending = Promise.resolve().then(() => { assertCurrent(c); return start(); });
    try { return await Promise.race([pending,stopped]); }
    finally { c.signal.removeEventListener('abort',onAbort); }
  }
  async function request(c, method, body) {
    const token = await wait(c,() => c.user.getIdToken(true)); assertCurrent(c);
    const response = await wait(c,() => {
      if (method === 'POST') c.attempted = true;
      return send('/api/marketplace/profiles/me', {method,credentials:'same-origin',cache:'no-store',signal:c.signal,
        headers:{Authorization:'Bearer '+token,...(body ? {'Content-Type':'application/json'} : {})},...(body ? {body:JSON.stringify(body)} : {})});
    });
    const result = await wait(c,() => response.json()); assertCurrent(c);
    if (!response.ok || result?.ok !== true) {
      // A parsed server rejection is different from an unconfirmed transport
      // or body failure after POST may already have persisted the write.
      const rejected = result?.ok === false && typeof result.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(result.code);
      throw new ProfileError(rejected ? result.code : 'PROFILE_RESPONSE_INVALID',rejected);
    }
    return result;
  }
  function read(result, c) {
    const p = result.profile;
    const d = {displayName:p?.displayName,location:p?.location ?? '',skills:p?.skills ?? [],links:p?.links ?? [],experience:p?.experience ?? ''};
    if (p?.uid !== c.user.uid || !Number.isSafeInteger(p?.revision) || p.revision < 1 || !validDraft(d)) throw new ProfileError('PROFILE_RESPONSE_INVALID');
    return {profile:{uid:p.uid,...copy(d),revision:p.revision},draft:copy(d),revision:p.revision,dirty:false};
  }
  function failure(c, error, saved = false) {
    if (!disposed && session.currentUser() !== user) { reset(session.currentUser()); return; }
    if (!current(c)) return;
    const code = typeof error?.code === 'string' && /^(?:[A-Z][A-Z0-9_]{0,79}|auth\/[a-z0-9-]{1,70})$/.test(error.code) ? error.code : 'PROFILE_CONNECTION_FAILED';
    const denied = /^(auth\/|AUTH_|INVALID_AUTHORIZATION|ACCOUNT_|TENANT_|CONSENT_)/.test(code);
    if (denied) emit({phase:'denied',code,profile:null,draft:emptyDraft(),revision:0,dirty:false});
    else emit({phase:saved ? 'saved-unverified' : code === 'PROFILE_REVISION_CHANGED' ? 'conflict'
      : c.attempted && (!(error instanceof ProfileError && error.authoritative) || code === 'INTERNAL_MARKETPLACE_ERROR') ? 'save-uncertain'
      : code === 'PROFILE_REQUEST_TIMEOUT' ? 'timed-out' : 'error',code});
  }
  return {
    snapshot:() => copy(state),
    subscribe(listener) { listeners.add(listener); listener(copy(state)); return () => listeners.delete(listener); },
    update(patch) {
      if (disposed || !user || ['loading','saving','denied','signed-out'].includes(state.phase)) return;
      const draft = {...state.draft};
      for (const key of Object.keys(emptyDraft())) if (Object.hasOwn(patch,key)) draft[key] = copy(patch[key]);
      emit({draft,dirty:true});
    },
    async load() {
      const c = begin('loading'); if (!c) return;
      try { const result = await request(c,'GET'); assertCurrent(c); emit({...read(result,c),phase:'ready',code:null}); }
      catch (error) {
        if (current(c) && error.code === 'PROFILE_NOT_FOUND') emit({phase:'empty',profile:null,draft:emptyDraft(),revision:0,dirty:false,code:null});
        else failure(c,error);
      }
      finally { clearTimeout(c.timer); }
    },
    async save(consentGranted) {
      if (session.currentUser() !== user) { reset(session.currentUser()); return; }
      if (!['ready','empty','saved','error'].includes(state.phase) || !user) return;
      if (!validDraft(state.draft)) { emit({phase:'error',code:'PROFILE_INPUT_INVALID'}); return; }
      if (consentGranted !== true) { emit({phase:'error',code:'CONSENT_REQUIRED'}); return; }
      const draft = copy(state.draft), revision = state.revision;
      const c = begin('saving'); if (!c) return;
      let saved = false;
      try {
        const consent = await wait(c,() => consentAuthority({uid:c.user.uid,purpose:'career.profile',signal:c.signal}));
        assertCurrent(c);
        if (!validConsent(consent)) throw new ProfileError('CONSENT_AUTHORITY_UNAVAILABLE');
        const result = await request(c,'POST',{...draft,expectedRevision:revision,consentGranted:true,consent});
        assertCurrent(c);
        if (result.uid !== c.user.uid || result.revision !== revision + 1) throw new ProfileError('PROFILE_RESPONSE_INVALID');
        saved = true;
        // Success means authoritative readback, not an optimistic local draft.
        const readback = await request(c,'GET'); assertCurrent(c);
        const checked = read(readback,c);
        const expected = Object.fromEntries(Object.entries(draft).map(([key,value]) => [key,Array.isArray(value) ? value.map(x=>x.trim()) : value.trim()]));
        if (checked.revision !== result.revision || JSON.stringify(checked.draft) !== JSON.stringify(expected)) throw new ProfileError('PROFILE_READBACK_CHANGED');
        emit({...checked,phase:'saved',code:null});
      } catch (error) { failure(c,error,saved); }
      finally { clearTimeout(c.timer); }
    },
    dispose() { if (!disposed) { disposed = true; cancel(); unsubscribe(); listeners.clear(); state = {...state,profile:null,draft:emptyDraft()}; } },
  };
}
