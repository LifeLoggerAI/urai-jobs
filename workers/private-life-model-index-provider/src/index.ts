import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';

const PRIVATE_REF = /^private:[A-Za-z0-9_./:-]{8,512}$/;
const SOURCE_HANDLE = /^psh_[A-Za-z0-9_-]{16,256}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const ALLOWED_TRIGGERS = new Set(['initial-source', 'new-source', 'correction', 'stronger-source']);
const ALLOWED_EVIDENCE = new Set([
  'SOURCE_CAPTURED',
  'SOURCE_DERIVED',
  'DIRECT_SUBJECT_TESTIMONY',
  'ATTRIBUTED_TESTIMONY',
  'CORROBORATED_INFERENCE',
  'CONTEXTUAL_RESEARCH',
]);
const MAX_TRANSCRIPT_CHARS = Number(process.env.URAI_LIFE_MODEL_MAX_TRANSCRIPT_CHARS || 240000);

app.use(express.json({ limit: '96kb' }));

function runtimeEnv(): string {
  return String(process.env.URAI_ENV || process.env.NODE_ENV || 'local').toLowerCase();
}

function productionRuntime(): boolean {
  return ['prod', 'production', 'staging'].includes(runtimeEnv());
}

function httpsUrl(name: string): string {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return '';
  const parsed = new URL(raw);
  if (productionRuntime() && parsed.protocol !== 'https:') throw new Error(`${name} must use HTTPS outside local/test`);
  return raw.replace(/\/$/, '');
}

function bearerMatches(header: string, token: string): boolean {
  if (!token) return false;
  const actual = crypto.createHash('sha256').update(header).digest();
  const expected = crypto.createHash('sha256').update(`Bearer ${token}`).digest();
  return crypto.timingSafeEqual(actual, expected);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = String(process.env.PRIVATE_SOURCE_INDEX_TOKEN || '');
  const local = ['local', 'test'].includes(runtimeEnv());
  if (!token && local) return next();
  if (!token) return res.status(503).send({ ok: false, error: 'provider auth is not configured' });
  if (!bearerMatches(req.get('Authorization') || '', token)) {
    return res.status(401).send({ ok: false, error: 'unauthorized' });
  }
  return next();
}

type IndexRequest = {
  sourceHandle: string;
  sourceEvidenceClass: string;
  transcriptRef: string;
  provenanceRef: string;
  requestedPurpose: 'memory-index';
  locale?: string;
  priorMemoryIndexRef?: string;
  correlationTrigger?: 'initial-source' | 'new-source' | 'correction' | 'stronger-source';
  idempotencyKey: string;
};

type ExtractedClaim = {
  claimId: string;
  subject: string;
  predicate: string;
  object: string;
  evidenceClass: string;
  confidence: number;
  time?: { start?: string; end?: string; uncertainty?: string };
  place?: { label?: string; precision?: 'country' | 'region' | 'city' | 'place' | 'room' | 'unknown' };
  sourceSpan?: { startChar?: number; endChar?: number };
  contradictedBy?: string[];
};

type Extraction = {
  entities: Array<{ entityId: string; type: string; label: string; aliases?: string[] }>;
  claims: ExtractedClaim[];
  relationships: Array<{ from: string; to: string; type: string; confidence: number }>;
  temporalStates: Array<{ entityId: string; validFrom?: string; validTo?: string; attributes: Record<string, unknown> }>;
  places: Array<{ placeId: string; label: string; precision: string; attributes?: Record<string, unknown> }>;
  conflicts: Array<{ conflictId: string; claimIds: string[]; reason: string }>;
  negativeConstraints: Array<{ constraintId: string; text: string; sourceClaimIds: string[] }>;
  sceneTruth: {
    decision: 'READY' | 'READY_WITH_OCCLUSION' | 'READY_INTERPRETIVE' | 'BLOCKED';
    reasons: string[];
    requiredOcclusions?: string[];
  };
};

function assertRequest(body: any): IndexRequest {
  const allowed = new Set([
    'sourceHandle',
    'sourceEvidenceClass',
    'transcriptRef',
    'provenanceRef',
    'requestedPurpose',
    'locale',
    'priorMemoryIndexRef',
    'correlationTrigger',
    'idempotencyKey',
  ]);
  for (const key of Object.keys(body || {})) {
    if (!allowed.has(key)) throw new Error(`forbidden field: ${key}`);
  }
  const request: IndexRequest = {
    sourceHandle: String(body?.sourceHandle || ''),
    sourceEvidenceClass: String(body?.sourceEvidenceClass || ''),
    transcriptRef: String(body?.transcriptRef || ''),
    provenanceRef: String(body?.provenanceRef || ''),
    requestedPurpose: String(body?.requestedPurpose || '') as 'memory-index',
    locale: body?.locale ? String(body.locale) : undefined,
    priorMemoryIndexRef: body?.priorMemoryIndexRef ? String(body.priorMemoryIndexRef) : undefined,
    correlationTrigger: (body?.correlationTrigger || 'initial-source') as IndexRequest['correlationTrigger'],
    idempotencyKey: String(body?.idempotencyKey || ''),
  };
  if (!SOURCE_HANDLE.test(request.sourceHandle)) throw new Error('invalid sourceHandle');
  if (!ALLOWED_EVIDENCE.has(request.sourceEvidenceClass)) throw new Error('invalid sourceEvidenceClass');
  if (!PRIVATE_REF.test(request.transcriptRef)) throw new Error('invalid transcriptRef');
  if (!PRIVATE_REF.test(request.provenanceRef)) throw new Error('invalid provenanceRef');
  if (request.priorMemoryIndexRef && !PRIVATE_REF.test(request.priorMemoryIndexRef)) throw new Error('invalid priorMemoryIndexRef');
  if (request.requestedPurpose !== 'memory-index') throw new Error('requestedPurpose must be memory-index');
  if (!ALLOWED_TRIGGERS.has(String(request.correlationTrigger))) throw new Error('invalid correlationTrigger');
  if (!/^[A-Za-z0-9._:-]{8,256}$/.test(request.idempotencyKey)) throw new Error('invalid idempotencyKey');
  return request;
}

function stableHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => JSON.stringify(key) + ':' + canonicalJson(val));
    return '{' + entries.join(',') + '}';
  }
  return JSON.stringify(value);
}

function privateRef(handleHash: string, revision: number, leaf: string): string {
  return `private:life-model/${handleHash}/r${revision}/${leaf}`;
}

async function resolvePrivateInputs(request: IndexRequest) {
  const resolverUrl = httpsUrl('PRIVATE_SOURCE_REF_RESOLVER_URL');
  const resolverToken = String(process.env.PRIVATE_SOURCE_REF_RESOLVER_TOKEN || '');
  if (!resolverUrl || !resolverToken) throw new Error('private ref resolver is not configured');

  const response = await fetch(`${resolverUrl}/resolve-life-model-inputs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolverToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sourceHandle: request.sourceHandle,
      transcriptRef: request.transcriptRef,
      provenanceRef: request.provenanceRef,
      requestedPurpose: 'memory-index',
      idempotencyKey: request.idempotencyKey,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) throw new Error(`private ref resolver failed with status ${response.status}`);
  const payload = await response.json() as any;
  if (payload?.authorized !== true) throw new Error('private ref resolver denied access');
  if (payload?.synthetic !== false) throw new Error('resolved source must be explicitly non-synthetic');
  if (String(payload?.sourceEvidenceClass || '') !== request.sourceEvidenceClass) {
    throw new Error('resolver evidence class mismatch');
  }

  const transcriptText = String(payload?.transcriptText || '');
  const sourceFixityRef = String(payload?.sourceFixityRef || '');
  const sourceSha256 = String(payload?.sourceSha256 || '');
  if (!transcriptText || transcriptText.length > MAX_TRANSCRIPT_CHARS) throw new Error('resolved transcript is empty or exceeds bounded size');
  if (!PRIVATE_REF.test(sourceFixityRef) || !SHA256.test(sourceSha256)) throw new Error('resolver integrity proof is invalid');

  return { transcriptText, sourceFixityRef, sourceSha256 };
}

function validateExtraction(value: any, sourceEvidenceClass: string): Extraction {
  const extraction = value as Extraction;
  if (!extraction || typeof extraction !== 'object') throw new Error('extractor returned invalid object');
  for (const key of ['entities', 'claims', 'relationships', 'temporalStates', 'places', 'conflicts', 'negativeConstraints']) {
    if (!Array.isArray((extraction as any)[key])) throw new Error(`extractor missing ${key}`);
  }
  if (!extraction.sceneTruth || !['READY', 'READY_WITH_OCCLUSION', 'READY_INTERPRETIVE', 'BLOCKED'].includes(extraction.sceneTruth.decision)) {
    throw new Error('extractor returned invalid sceneTruth decision');
  }
  for (const claim of extraction.claims) {
    if (!claim.claimId || !claim.subject || !claim.predicate || typeof claim.object !== 'string') throw new Error('invalid extracted claim');
    if (!ALLOWED_EVIDENCE.has(claim.evidenceClass)) throw new Error('claim uses unsupported evidence class');
    if (claim.evidenceClass !== sourceEvidenceClass && claim.evidenceClass !== 'CORROBORATED_INFERENCE') {
      throw new Error('claim attempts unsupported evidence promotion');
    }
    if (!Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1) throw new Error('invalid claim confidence');
  }
  return extraction;
}

async function extractLifeModel(transcriptText: string, request: IndexRequest): Promise<Extraction> {
  const apiKey = String(process.env.OPENAI_API_KEY || '');
  const model = String(process.env.URAI_LIFE_MODEL_EXTRACTOR_MODEL || 'gpt-5-mini');
  if (!apiKey) throw new Error('life model extractor is not configured');

  const schemaInstruction = {
    entities: [{ entityId: 'entity_1', type: 'person|place|object|event|organization|animal|other', label: 'string', aliases: ['string'] }],
    claims: [{
      claimId: 'claim_1',
      subject: 'entity_1',
      predicate: 'string',
      object: 'string',
      evidenceClass: request.sourceEvidenceClass,
      confidence: 0.0,
      time: { start: 'ISO-8601-or-empty', end: 'ISO-8601-or-empty', uncertainty: 'string' },
      place: { label: 'string', precision: 'country|region|city|place|room|unknown' },
      sourceSpan: { startChar: 0, endChar: 0 },
      contradictedBy: ['claim_id'],
    }],
    relationships: [{ from: 'entity_id', to: 'entity_id', type: 'string', confidence: 0.0 }],
    temporalStates: [{ entityId: 'entity_id', validFrom: 'string', validTo: 'string', attributes: {} }],
    places: [{ placeId: 'place_1', label: 'string', precision: 'string', attributes: {} }],
    conflicts: [{ conflictId: 'conflict_1', claimIds: ['claim_1'], reason: 'string' }],
    negativeConstraints: [{ constraintId: 'constraint_1', text: 'string', sourceClaimIds: ['claim_1'] }],
    sceneTruth: { decision: 'READY|READY_WITH_OCCLUSION|READY_INTERPRETIVE|BLOCKED', reasons: ['string'], requiredOcclusions: ['string'] },
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: [
            'You are the private URAI Life Model evidence extractor.',
            'Extract only evidence-constrained claims from the provided transcript.',
            'Never invent missing facts. Preserve uncertainty and contradictions.',
            'Synthetic or simulated content can never become historical evidence.',
            'Do not infer biometric identity. Do not upgrade evidence beyond the supplied evidence class except CORROBORATED_INFERENCE when the transcript itself supports a bounded inference.',
            'If identity/time/place contradictions block a faithful hero scene, set sceneTruth.decision to BLOCKED.',
            'Return JSON only matching this shape:',
            JSON.stringify(schemaInstruction),
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            locale: request.locale || null,
            sourceEvidenceClass: request.sourceEvidenceClass,
            correlationTrigger: request.correlationTrigger || 'initial-source',
            transcript: transcriptText,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) throw new Error(`life model extractor failed with status ${response.status}`);
  const json = await response.json() as any;
  const content = String(json?.choices?.[0]?.message?.content || '');
  if (!content) throw new Error('life model extractor returned empty content');
  return validateExtraction(JSON.parse(content), request.sourceEvidenceClass);
}

function firestore() {
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
    });
  }
  return getFirestore();
}

async function persistRevision(request: IndexRequest, extraction: Extraction, sourceFixityRef: string, sourceSha256: string) {
  const db = firestore();
  const handleHash = stableHash(request.sourceHandle).slice(0, 40);
  const root = db.collection('uraiPrivateLifeModel').doc(handleHash);
  const idempotencyRef = root.collection('idempotency').doc(stableHash(request.idempotencyKey));

  const result = await db.runTransaction(async (tx) => {
    const existing = await tx.get(idempotencyRef);
    if (existing.exists) {
      const data = existing.data() || {};
      return {
        handleHash,
        revision: Number(data.revision),
        checksum: String(data.checksum),
        backlogState: String(data.backlogState),
        replayed: true,
      };
    }

    const currentRef = root.collection('state').doc('current');
    const currentSnap = await tx.get(currentRef);
    const currentRevision = Number(currentSnap.data()?.revision || 0);
    const revision = currentRevision + 1;
    const record = {
      schemaVersion: 'urai-life-model-v1',
      revision,
      correlationTrigger: request.correlationTrigger || 'initial-source',
      sourceEvidenceClass: request.sourceEvidenceClass,
      sourceFixityRef,
      sourceSha256,
      transcriptRef: request.transcriptRef,
      provenanceRef: request.provenanceRef,
      priorMemoryIndexRef: request.priorMemoryIndexRef || null,
      syntheticOutputMayBecomeHistoricalSource: false,
      extraction,
    };
    const checksum = stableHash(canonicalJson(record));
    const backlogState = extraction.conflicts.length ? 'CONFLICTED' : 'INDEXED';
    const revisionRef = root.collection('revisions').doc(String(revision).padStart(8, '0'));

    tx.create(revisionRef, {
      ...record,
      checksum,
      backlogState,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(currentRef, {
      revision,
      checksum,
      backlogState,
      sourceEvidenceClass: request.sourceEvidenceClass,
      syntheticOutputMayBecomeHistoricalSource: false,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.create(idempotencyRef, {
      revision,
      checksum,
      backlogState,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { handleHash, revision, checksum, backlogState, replayed: false };
  });

  return result;
}

function readiness() {
  const checks = {
    auth: Boolean(process.env.PRIVATE_SOURCE_INDEX_TOKEN) || !productionRuntime(),
    resolverUrl: Boolean(process.env.PRIVATE_SOURCE_REF_RESOLVER_URL),
    resolverToken: Boolean(process.env.PRIVATE_SOURCE_REF_RESOLVER_TOKEN),
    extractorKey: Boolean(process.env.OPENAI_API_KEY),
    firebaseProject: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT),
    sourceSha: /^[0-9a-f]{40}$/.test(String(process.env.URAI_SOURCE_SHA || '')) || !productionRuntime(),
  };
  return { checks, ok: Object.values(checks).every(Boolean) };
}

app.get('/healthz', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).send({ ok: true, service: 'private-life-model-index-provider', environment: runtimeEnv() });
});

app.get('/readyz', (_req, res) => {
  const state = readiness();
  res.set('Cache-Control', 'no-store');
  res.status(state.ok ? 200 : 503).send({
    ok: state.ok,
    service: 'private-life-model-index-provider',
    sourceSha: String(process.env.URAI_SOURCE_SHA || ''),
    checks: state.checks,
  });
});

app.post('/', requireAuth, async (req, res) => {
  try {
    const request = assertRequest(req.body);
    const state = readiness();
    if (!state.ok) return res.status(503).send({ ok: false, code: 'LIFE_MODEL_PROVIDER_NOT_READY', checks: state.checks });

    const resolved = await resolvePrivateInputs(request);
    const extraction = await extractLifeModel(resolved.transcriptText, request);
    const stored = await persistRevision(request, extraction, resolved.sourceFixityRef, resolved.sourceSha256);

    const base = (leaf: string) => privateRef(stored.handleHash, stored.revision, leaf);
    return res.status(200).send({
      ok: true,
      memoryIndexRef: base('memory-index'),
      entityGraphRef: base('entity-graph'),
      temporalIndexRef: base('temporal-index'),
      placeIndexRef: base('place-index'),
      conflictSetRef: base('conflicts'),
      sceneTruthRef: base('scene-truth'),
      provenanceRef: request.provenanceRef,
      sourceFixityRef: resolved.sourceFixityRef,
      dependencyGraphRef: base('dependency-graph'),
      checksum: stored.checksum,
      lifeModelSchemaVersion: 'urai-life-model-v1',
      syntheticOutputMayBecomeHistoricalSource: false,
      sourceEvidenceClass: request.sourceEvidenceClass,
      backlogState: stored.backlogState,
      correlationRevision: stored.revision,
      correlationTrigger: request.correlationTrigger || 'initial-source',
      replayed: stored.replayed,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'private-life-model.index.failed',
      service: 'private-life-model-index-provider',
      error: error instanceof Error ? error.message : 'unknown_error',
    }));
    return res.status(502).send({ ok: false, error: 'Private Life Model indexing failed.' });
  }
});

app.use((_req, res) => res.status(404).send({ ok: false, error: 'not_found' }));

app.listen(port, host, () => {
  console.log(JSON.stringify({ event: 'provider.started', service: 'private-life-model-index-provider', host, port }));
});
