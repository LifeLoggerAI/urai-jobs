/**
 * ONE URAI R1141 - synthetic, review-only revocation race model.
 * NOT production authorization, live GCS proof, a broker, or deletion ACK.
 * No provider calls, network access, credentials, or private user data.
 * Concurrency model is bounded: its PASS does not prove real-world safety.
 */
export const HOLD = 'R1141_REVIEW_ONLY_DRAIN_HOLD';
const fail = () => { throw new Error(HOLD); };
const idOk = x => typeof x === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(x);
const genOk = x => typeof x === 'string' && /^[1-9][0-9]{0,19}$/.test(x);
export function createModel() {
  return {
    epoch: 1, revoked: false, reservationsClosed: false,
    sessions: new Map(), generations: new Map(),
    unknownProviderSessions: true, unknownProviderGenerations: true,
    retiredWriterDenied: false, alternateWriterDenied: false,
    brokerOnlyEffectiveIam: false, providerIdentitiesAuthenticated: false,
    modelAcknowledged: false
  };
}
export function reserve(m, id) {
  if (!idOk(id) || m.revoked || m.reservationsClosed || m.modelAcknowledged || m.sessions.has(id)) fail();
  m.sessions.set(id, { epoch: m.epoch, started: false, cancelConfirmed: false, finalGeneration: null });
  return m.epoch;
}
export function startUpload(m, id, epoch) {
  const s = m.sessions.get(id);
  if (!s || s.epoch !== epoch || epoch !== m.epoch || m.revoked || s.cancelConfirmed || m.modelAcknowledged) fail();
  s.started = true;
}
export function observeGeneration(m, id, generation) {
  // Simulates a provider-created object, even if the worker is stale.
  // It NEVER makes it eligible for release or acknowledges cleanup.
  const s = m.sessions.get(id);
  if (!s || !genOk(generation) || s.finalGeneration || m.generations.has(generation) || m.modelAcknowledged) fail();
  s.finalGeneration = generation;
  m.generations.set(generation, { sessionId: id, absent: false });
}
export function withdraw(m) {
  if (m.modelAcknowledged) fail();
  m.revoked = true;
  m.reservationsClosed = true;
  m.epoch += 1;
  return m.epoch;
}
export function confirmSessionCancelled(m, id, proof) {
  const s = m.sessions.get(id);
  if (!m.revoked || !s || !proof || proof.deleteStatus !== 499 || ![404,410].includes(proof.statusAfter) || ![404,410].includes(proof.resumeAfter)) fail();
  s.cancelConfirmed = true;
}
export function confirmGenerationAbsent(m, id, generation, proof) {
  const s=m.sessions.get(id), g=m.generations.get(generation);
  if(!m.revoked || !s || !g || s.finalGeneration !== generation || g.sessionId !== id || proof?.httpStatus !== 404) fail();
  g.absent = true;
}
export function observeExhaustiveProviderInventory(m, proof) {
  // Inputs are synthetic fixtures. Production must verify these using independent provider IAM/data-plane receipts.
  if(!m.revoked || proof?.sessionInventoryComplete !== true || proof?.generationInventoryComplete !== true) fail();
  m.unknownProviderSessions=false;
  m.unknownProviderGenerations=false;
}
export function observeExternalFence(m, proof) {
  if(!m.revoked || proof?.brokerOnlyEffectiveIam !== true || proof?.providerIdentitiesAuthenticated !== true ||
     proof?.retiredWriterHttp403 !== true || proof?.alternateWriterHttp403 !== true) fail();
  m.brokerOnlyEffectiveIam=true;
  m.providerIdentitiesAuthenticated=true;
  m.retiredWriterDenied=true;
  m.alternateWriterDenied=true;
}
export function readiness(m) {
  // This can NEVER return 'PRODUCTION_PASS', 'DELETION_ACK', or release GO.
  const allSessions=[...m.sessions.values()].every(s => s.cancelConfirmed);
  const allGenerations=[...m.generations.values()].every(g => g.absent);
  const complete=m.revoked && m.reservationsClosed && allSessions && allGenerations &&
    !m.unknownProviderSessions && !m.unknownProviderGenerations &&
    m.brokerOnlyEffectiveIam && m.providerIdentitiesAuthenticated &&
    m.retiredWriterDenied && m.alternateWriterDenied;
  return complete ? 'SYNTHETIC_READY_NOT_PROVIDER_CERTIFIED' : HOLD;
}
export function acknowledgeSynthetic(m) {
  if(readiness(m)!=='SYNTHETIC_READY_NOT_PROVIDER_CERTIFIED') fail();
  m.modelAcknowledged=true;
  return 'SYNTHETIC_ONLY_NOT_DELETION_ACK';
}
/** A deliberately weak point-in-time design, for a reproducible race witness.
 * NOT an assertion that Jobs' current code behaves this way. */
export function weakInventoryRaceWitness() {
  let objectPresent=false, deletionAck=false;
  const inventory=objectPresent;
  if(!inventory) deletionAck=true;
  objectPresent=true; // stale authorized writer completes AFTER point-in-time list
  return {deletionAck,objectPresent,violatesProperty:deletionAck&&objectPresent};
}
