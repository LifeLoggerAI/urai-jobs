// Review-only operator engineering observation. NOT a Jobs worker or source authority.
import { createHash } from 'node:crypto';

const SHA = /^[a-f0-9]{40}$/;
const REQUEST_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ROUTES: Record<string, string> = {
  '/': 'home', '/home': 'home', '/ascent': 'ascent',
  '/life-map': 'life-map', '/focus': 'focus', '/replay': 'replay',
};
const FIELDS = ['kind', 'repository', 'sourceSha', 'component', 'route',
  'selectedStar', 'frameSamples', 'p95Ms', 'status', 'authority'];
const fail = (reason: string): never => { throw Error('CHALK_INTAKE_' + reason); };
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, fields: string[]) =>
  Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export type ReviewDiagnostic = Readonly<{
  kind: 'chalk-spatial-diagnostic-v1'; repository: 'LifeLoggerAI/urai-spatial';
  sourceSha: string; component: string; route: string; selectedStar: null;
  frameSamples: number; p95Ms: number | null; status: 'LOCAL_UNSUBMITTED';
  authority: 'client-observation-not-server-verified';
}>;
export type ReviewIntake = Readonly<{
  requestId: string; reviewId: string; ownerUid: string; digest: string;
  diagnostic: ReviewDiagnostic; state: 'REVIEW_ONLY_NOT_QUEUED';
}>;

export function prepareChalkDiagnosticReview(
  input: unknown, ownerUid: string, authorizedSourceSha: string,
): ReviewIntake {
  if (!record(input) || !exact(input, ['requestId', 'diagnostic'])) fail('INPUT');
  const requestId = input.requestId;
  if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId)) fail('REQUEST_ID');
  if (typeof ownerUid !== 'string' || !/^[^/\s]{1,128}$/.test(ownerUid)) fail('OWNER');
  if (typeof authorizedSourceSha !== 'string' || !SHA.test(authorizedSourceSha)) fail('SERVER_SOURCE');
  const data = input.diagnostic;
  if (!record(data) || !exact(data, FIELDS)) fail('FIELDS');
  if (data.kind !== 'chalk-spatial-diagnostic-v1' ||
      data.repository !== 'LifeLoggerAI/urai-spatial' ||
      data.status !== 'LOCAL_UNSUBMITTED' ||
      data.authority !== 'client-observation-not-server-verified' ||
      data.selectedStar !== null) fail('AUTHORITY');
  if (data.sourceSha !== authorizedSourceSha) fail('SOURCE_DRIFT');
  if (typeof data.route !== 'string' || !Object.hasOwn(ROUTES, data.route) ||
      data.component !== ROUTES[data.route]) fail('ROUTE');
  if (!Number.isSafeInteger(data.frameSamples) || (data.frameSamples as number) < 0 ||
      (data.frameSamples as number) > 90) fail('FRAMES');
  if (data.frameSamples === 0 ? data.p95Ms !== null :
    (typeof data.p95Ms !== 'number' || !Number.isFinite(data.p95Ms) ||
     data.p95Ms <= 0 || data.p95Ms > 5000)) fail('P95');
  const diagnostic: ReviewDiagnostic = Object.freeze({
    kind: 'chalk-spatial-diagnostic-v1', repository: 'LifeLoggerAI/urai-spatial',
    sourceSha: authorizedSourceSha, component: data.component as string, route: data.route,
    selectedStar: null, frameSamples: data.frameSamples as number,
    p95Ms: data.p95Ms as number | null, status: 'LOCAL_UNSUBMITTED',
    authority: 'client-observation-not-server-verified',
  });
  return Object.freeze({requestId, reviewId: 'cr_' + digest(ownerUid + '\n' + requestId),
    ownerUid, digest: digest(JSON.stringify(diagnostic)), diagnostic,
    state: 'REVIEW_ONLY_NOT_QUEUED'});
}
