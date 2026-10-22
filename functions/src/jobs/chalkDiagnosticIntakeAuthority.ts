// Nonproduction-only, canonical UrAi Jobs master intake. Never an execution grant.
// This projection deliberately excludes personal-memory data, raw media and tool calls.
import { createHash } from 'node:crypto';

const ID = /^[A-Za-z0-9_-]{12,64}$/;
const UID = /^[A-Za-z0-9_-]{8,128}$/;
const SHA = /^[a-f0-9]{40}$/;
const ROUTE_COMPONENT: Readonly<Record<string, string>> = Object.freeze({
  '/': 'home', '/home': 'home', '/ascent': 'ascent', '/life-map': 'life-map',
  '/focus': 'focus', '/replay': 'replay',
});
const DIAGNOSTIC_FIELDS = ['kind', 'repository', 'sourceSha', 'component', 'route',
  'selectedStar', 'frameSamples', 'p95Ms', 'status', 'authority'] as const;
const deny = (reason: string): never => { throw new Error('CHALK_INTAKE_' + reason); };
const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (input: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(input).every(key => keys.includes(key));
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

export type ChalkIntakeRecord = Readonly<{
  jobId: string; ownerUid: string; type: 'engineering.verify'; jobType: 'engineering.verify';
  status: 'PENDING'; payload: {
    repository: 'LifeLoggerAI/urai-spatial'; baseSha: string; requestDigest: string;
    problem: string; diagnostic: {kind:string; route:string; component:string;
      frameSamples:number; p95Ms:number|null; sourceSha:string; selectedStar:null};
  };
  admission: {state:'HELD_UNQUEUED'; environment:'firestore-emulator-only';
    providerSpendUsd:0; workerAdmitted:false; humanApprovalRequired:true};
  retryCount:0; execution:{attemptCount:0;maxAttempts:1};
}>;

export function assertChalkLocalEmulatorGate(env: Record<string,string|undefined>): void {
  const project = env.GCLOUD_PROJECT ?? env.GOOGLE_CLOUD_PROJECT;
  const firestore = env.FIRESTORE_EMULATOR_HOST ?? '';
  const auth = env.FIREBASE_AUTH_EMULATOR_HOST ?? '';
  const loopback = /^(?:127\.0\.0\.1|localhost):(?:[0-9]{2,5})$/;
  if (env.FUNCTIONS_EMULATOR !== 'true' || project !== 'demo-urai-jobs' ||
      (env.GOOGLE_CLOUD_PROJECT !== undefined && env.GOOGLE_CLOUD_PROJECT !== project) ||
      env.CHALK_NONPRODUCTION_INTAKE !== 'true' ||
      !loopback.test(firestore) || !loopback.test(auth)) deny('EMULATOR_ONLY');
}

export function buildChalkDiagnosticIntake(input: unknown, trusted: {
  ownerUid: string; pinnedSourceSha: string;
}): ChalkIntakeRecord {
  if (!UID.test(trusted.ownerUid) || !SHA.test(trusted.pinnedSourceSha)) deny('SERVER_AUTHORITY');
  if (!plain(input) || !onlyKeys(input, ['requestId', 'problem', 'diagnostic']) ||
      !ID.test(String(input.requestId ?? ''))) deny('REQUEST');
  const request = input as Record<string, unknown>;
  const description = request.problem;
  if (typeof description !== 'string' || description !== description.trim() ||
      description.length < 10 || description.length > 500 ||
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(description)) deny('PROBLEM');
  const d = request.diagnostic as Record<string, unknown> | null;
  if (!plain(d) || !onlyKeys(d, DIAGNOSTIC_FIELDS) ||
      d.kind !== 'chalk-spatial-diagnostic-v1' ||
      d.repository !== 'LifeLoggerAI/urai-spatial' ||
      d.status !== 'LOCAL_UNSUBMITTED' ||
      d.authority !== 'client-observation-not-server-verified' ||
      d.sourceSha !== trusted.pinnedSourceSha || !SHA.test(String(d.sourceSha)) ||
      typeof d.route !== 'string' || ROUTE_COMPONENT[d.route] !== d.component ||
      (typeof d.frameSamples !== 'number' || !Number.isSafeInteger(d.frameSamples)) || Number(d.frameSamples) < 0 || Number(d.frameSamples) > 90 ||
      (d.frameSamples === 0 ? d.p95Ms !== null :
        typeof d.p95Ms !== 'number' || !Number.isFinite(d.p95Ms) ||
        d.p95Ms <= 0 || d.p95Ms > 5000) ||
      d.selectedStar !== null) deny('DIAGNOSTIC');
  const diagnostic = {
    kind: String(d.kind), route: String(d.route), component: String(d.component),
    frameSamples: Number(d.frameSamples), p95Ms: d.p95Ms as number|null,
    sourceSha: trusted.pinnedSourceSha, selectedStar: null,
  } as const;
  // A request ID is an idempotency key; changing its payload must not be accepted.
  const problem = description as string;
  const requestDigest = sha256(JSON.stringify({problem, diagnostic}));
  const jobId = 'chalk_' + sha256(trusted.ownerUid + '\n' + String(request.requestId)).slice(0, 32);
  return Object.freeze({
    jobId, ownerUid: trusted.ownerUid, type: 'engineering.verify', jobType: 'engineering.verify',
    status: 'PENDING',
    payload: {repository:'LifeLoggerAI/urai-spatial' as const,baseSha:trusted.pinnedSourceSha,
      requestDigest,problem,diagnostic},
    admission: {state:'HELD_UNQUEUED' as const,environment:'firestore-emulator-only' as const,
      providerSpendUsd:0 as const,workerAdmitted:false as const,humanApprovalRequired:true as const},
    retryCount:0 as const,execution:{attemptCount:0 as const,maxAttempts:1 as const},
  });
}

export function existingChalkIntakeMatches(existing: unknown, requested: ChalkIntakeRecord): boolean {
  if (!plain(existing) || !plain(existing.payload) || !plain(existing.admission)) return false;
  return existing.jobId === requested.jobId && existing.ownerUid === requested.ownerUid &&
    existing.type === 'engineering.verify' && existing.jobType === 'engineering.verify' &&
    existing.status === 'PENDING' && existing.payload.repository === requested.payload.repository &&
    existing.payload.baseSha === requested.payload.baseSha &&
    existing.payload.requestDigest === requested.payload.requestDigest &&
    existing.admission.state === 'HELD_UNQUEUED' && existing.admission.workerAdmitted === false;
}
