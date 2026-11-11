/**
 * R1023 REVIEW ONLY — fail-closed parser for actual Studio worker output layout.
 * Path parsing is NOT consent, IAM, source authenticity, upload permission,
 * a durable reservation, deletion ACK, or production release authorization.
 */
export const DENIED = 'R1023_REVIEW_ONLY_OUTPUT_PATH_DENIED';
const IDENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const RENDER = new Set(['life-movie.mp4', 'life-movie.srt', 'life-movie.render-manifest.json']);
const FINAL = new Set(['life-movie-final.mp4', 'life-movie-final.srt', 'life-movie-final.assembly-manifest.json']);
const KEYS = ['tenantId','projectId','attemptId','objectPath'];
function deny() { throw new Error(DENIED); }
function id(s) { return typeof s === 'string' && IDENT.test(s); }
function exact(o) {
  return o && typeof o === 'object' && !Array.isArray(o) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(o)) &&
    Reflect.ownKeys(o).length === KEYS.length &&
    KEYS.every(k => { const d = Object.getOwnPropertyDescriptor(o,k); return d && Object.hasOwn(d,'value'); });
}
export function inspectWorkerOutputPath(input) {
  if (!exact(input) || !id(input.tenantId) || !id(input.projectId) || !id(input.attemptId) ||
      typeof input.objectPath !== 'string') deny();
  const prefix = 'tenants/' + input.tenantId + '/life-movies/' + input.projectId + '/';
  if (!input.objectPath.startsWith(prefix)) deny();
  const parts = input.objectPath.slice(prefix.length).split('/');
  let stage, qualifier = null, attempt, kind;
  if (parts.length === 2) { stage='legacy-review'; [attempt, kind] = parts; }
  else if (parts.length === 3) { [stage, attempt, kind] = parts; }
  else if (parts.length === 4) { [stage, qualifier, attempt, kind] = parts; if (!id(qualifier)) deny(); }
  else deny();
  if (!['legacy-review','segments','final'].includes(stage) ||
      attempt !== 'attempt-' + input.attemptId ||
      !(stage === 'final' ? FINAL : RENDER).has(kind)) deny();
  return Object.freeze({ schema:'R1023_REVIEW_ONLY_OUTPUT_PATH_V1',
    stage, qualifier, fileKind:kind, objectPath:input.objectPath,
    storageWriteAuthorized:false, deletionAcknowledged:false,
    providerProofAuthenticated:false, reviewOnly:true });
}
