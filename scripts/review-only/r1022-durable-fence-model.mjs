/**
 * R1022 REVIEW ONLY. SQLite reference for durable atomic reservations / withdrawal.
 * This model is not connected to Firebase, Storage IAM, production, or an issuer.
 * It never authorizes uploads, approves deletion, or grants consent.
 */
import { DatabaseSync } from 'node:sqlite';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

export const DENIED = 'R1022_REVIEW_ONLY_DENIED';
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const FILES = new Set(['life-movie.mp4','life-movie.srt','life-movie.render-manifest.json']);
const TABLE = 'R1022_DURABLE_REVIEW_ONLY_V1';
const deny = () => { throw new Error(DENIED); };
const valid = value => typeof value === 'string' && ID.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const requireExact = (o,keys) => !!o && typeof o === 'object' && !Array.isArray(o) &&
  Reflect.ownKeys(o).length === keys.length && keys.every(k=>Object.hasOwn(o,k));
function withDb(filename,fn) {
  if (typeof filename !== 'string' || !filename || filename === ':memory:') deny();
  const db = new DatabaseSync(resolve(filename));
  try { db.exec('PRAGMA busy_timeout=15000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
    return fn(db);
  } finally { db.close(); }
}
function initSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS scope (
    singleton INTEGER PRIMARY KEY CHECK(singleton=1), schema TEXT NOT NULL,
    owner_uid TEXT NOT NULL, tenant_id TEXT NOT NULL, project_id TEXT NOT NULL,
    purpose TEXT NOT NULL, bucket TEXT NOT NULL, epoch INTEGER NOT NULL,
    version INTEGER NOT NULL, phase TEXT NOT NULL, withdrawal_id TEXT
  );
  CREATE TABLE IF NOT EXISTS attempts (
    attempt_id TEXT PRIMARY KEY, epoch INTEGER NOT NULL, object_path TEXT NOT NULL UNIQUE,
    bucket TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('RESERVED','IN_FLIGHT'))
  );`);
}
function load(db) {
  const s = db.prepare('SELECT * FROM scope WHERE singleton=1').get();
  if (!s || s.schema !== TABLE || s.purpose !== 'life-movie.render' ||
      ![s.owner_uid,s.tenant_id,s.project_id,s.bucket].every(valid) ||
      !positive(s.epoch) || !positive(s.version) ||
      !['OPEN','FENCING'].includes(s.phase) ||
      (s.phase === 'OPEN' ? s.withdrawal_id !== null : !valid(s.withdrawal_id))) deny();
  const attempts = db.prepare('SELECT * FROM attempts ORDER BY attempt_id').all();
  for(const a of attempts) {
    if(!valid(a.attempt_id) || !valid(a.bucket) || a.bucket !== s.bucket ||
       a.epoch !== (s.phase === 'OPEN' ? s.epoch : s.epoch-1) ||
       !['RESERVED','IN_FLIGHT'].includes(a.state) ||
       !FILES.has(a.object_path.slice(`tenants/${s.tenant_id}/life-movies/${s.project_id}/attempt-${a.attempt_id}/`.length)) ||
       !a.object_path.startsWith(`tenants/${s.tenant_id}/life-movies/${s.project_id}/attempt-${a.attempt_id}/`)) deny();
  }
  return {s,attempts};
}
function tx(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try { const out=action(); db.exec('COMMIT'); return out; }
  catch(e) { db.exec('ROLLBACK'); if(e.message === DENIED) throw e; if(e.code === 'ERR_SQLITE_ERROR' && /constraint failed/i.test(e.message)) deny(); throw e; }
}
export function createReviewStore(filename,scope) {
  if(!requireExact(scope,['ownerUid','tenantId','projectId','purpose','bucket','epoch']) ||
     ![scope.ownerUid,scope.tenantId,scope.projectId,scope.bucket].every(valid) ||
     scope.purpose !== 'life-movie.render' || !positive(scope.epoch)) deny();
  return withDb(filename,db=>{initSchema(db);return tx(db,()=>{
    if(db.prepare('SELECT COUNT(*) AS n FROM scope').get().n !== 0) deny();
    db.prepare(`INSERT INTO scope(singleton,schema,owner_uid,tenant_id,project_id,purpose,bucket,epoch,version,phase,withdrawal_id)
      VALUES(1,?,?,?,?,?,?,?,1,'OPEN',NULL)`).run(TABLE,scope.ownerUid,scope.tenantId,scope.projectId,scope.purpose,scope.bucket,scope.epoch);
    return inspectReviewStoreInternal(db);
  });});
}
function inspectReviewStoreInternal(db) {
  const {s,attempts}=load(db);
  return Object.freeze({reviewOnly:true,storageWriteAuthorized:false,deletionAcknowledged:false,
    releaseAuthorized:false,providerProofAuthenticated:false,allWritersStorageFenced:false,
    version:s.version,epoch:s.epoch,phase:s.phase,withdrawalId:s.withdrawal_id,
    attemptCount:attempts.length,attempts:Object.freeze(attempts.map(a=>Object.freeze({...a}))) });
}
export function inspectReviewStore(filename) {return withDb(filename,db=>{initSchema(db);return inspectReviewStoreInternal(db);});}
function checkScope(s,input) {
  if(!requireExact(input,['ownerUid','tenantId','projectId','purpose','bucket','epoch','attemptId','objectPath'])) deny();
  if(input.ownerUid!==s.owner_uid || input.tenantId!==s.tenant_id || input.projectId!==s.project_id ||
     input.purpose!==s.purpose || input.bucket!==s.bucket || input.epoch!==s.epoch || !valid(input.attemptId)) deny();
  const prefix=`tenants/${s.tenant_id}/life-movies/${s.project_id}/attempt-${input.attemptId}/`;
  if(typeof input.objectPath!=='string'||!input.objectPath.startsWith(prefix)||!FILES.has(input.objectPath.slice(prefix.length))) deny();
}
export function reserveReviewAttempt(filename,input,expectedVersion) {
  if(!positive(expectedVersion)) deny();
  return withDb(filename,db=>{initSchema(db);return tx(db,()=>{
    const {s}=load(db);if(s.version!==expectedVersion || s.phase!=='OPEN') deny();checkScope(s,input);
    db.prepare(`INSERT INTO attempts(attempt_id,epoch,object_path,bucket,state) VALUES(?,?,?,?,'RESERVED')`).run(input.attemptId,s.epoch,input.objectPath,s.bucket);
    db.prepare('UPDATE scope SET version=version+1 WHERE singleton=1').run();
    return inspectReviewStoreInternal(db);
  });});
}
export function beginReviewAttempt(filename,attemptId,expectedVersion) {
  if(!valid(attemptId)||!positive(expectedVersion)) deny();
  return withDb(filename,db=>{initSchema(db);return tx(db,()=>{
    const {s}=load(db);if(s.phase!=='OPEN'||s.version!==expectedVersion) deny();
    const change=db.prepare(`UPDATE attempts SET state='IN_FLIGHT' WHERE attempt_id=? AND state='RESERVED' AND epoch=?`).run(attemptId,s.epoch);
    if(change.changes!==1) deny();db.prepare('UPDATE scope SET version=version+1 WHERE singleton=1').run();
    return inspectReviewStoreInternal(db);
  });});
}
export function withdrawReviewScope(filename,withdrawal,expectedVersion) {
  if(!requireExact(withdrawal,['ownerUid','tenantId','projectId','purpose','withdrawalId'])||!valid(withdrawal.withdrawalId)||!positive(expectedVersion)) deny();
  return withDb(filename,db=>{initSchema(db);return tx(db,()=>{
    const {s}=load(db);
    if(withdrawal.ownerUid!==s.owner_uid || withdrawal.tenantId!==s.tenant_id ||
       withdrawal.projectId!==s.project_id || withdrawal.purpose!==s.purpose) deny();
    if(s.phase==='FENCING' && s.withdrawal_id===withdrawal.withdrawalId) return inspectReviewStoreInternal(db);
    if(s.phase!=='OPEN'||s.version!==expectedVersion||!positive(s.epoch+1)) deny();
    db.prepare(`UPDATE scope SET phase='FENCING',withdrawal_id=?,epoch=epoch+1,version=version+1 WHERE singleton=1`).run(withdrawal.withdrawalId);
    return inspectReviewStoreInternal(db);
  });});
}
export function acknowledgeDeletionForReview() { deny(); }
export function authorizePrivateOutputForReview() { deny(); }

// Direct invocation only for independent multi-process race testing; not a server.
if(process.argv[1] && realpathSync(process.argv[1]) === realpathSync(new URL(import.meta.url))) {
  const [cmd,dbPath,arg,version]=process.argv.slice(2);
  try {
    if(cmd==='reserve') reserveReviewAttempt(dbPath,JSON.parse(arg),Number(version));
    else if(cmd==='withdraw') withdrawReviewScope(dbPath,JSON.parse(arg),Number(version));
    else deny();
    process.stdout.write('R1022_REVIEW_ONLY_ATOMIC_SUCCESS\n');
  } catch(e) { process.stderr.write(e.message+'\n');process.exitCode=e.message===DENIED?3:4; }
}
