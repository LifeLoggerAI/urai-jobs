import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { validateExtraction } from './contracts.js';

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
const INDEX_LEASE_MS = 180000;
const MAX_INDEX_ATTEMPTS = 3;

class AdmissionError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

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
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AdmissionError('LIFE_MODEL_INVALID_REQUEST', 400);
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
    if (!allowed.has(key) || typeof body[key] !== 'string') throw new AdmissionError('LIFE_MODEL_INVALID_REQUEST', 400);
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
  if (request.locale && !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(request.locale)) throw new Error('invalid locale');
  return request;
}

function stableHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
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
  if (String(payload.sourceHandle) !== request.sourceHandle) {
    throw new Error('resolver source handle mismatch');
  }
  const resolvedTranscriptRef = String(payload?.transcriptRef || '');
  const resolvedProvenanceRef = String(payload?.provenanceRef || '');
  if (resolvedTranscriptRef !== request.transcriptRef) {
    throw new Error('resolver transcript ref mismatch');
  }
  if (resolvedProvenanceRef !== request.provenanceRef) {
    throw new Error('resolver provenance ref mismatch');
  }
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

type ExtractionResult = { extraction: Extraction; provider: { name: 'openai'; requestedModel: string; responseModel: string | null; responseId: string | null; sourceSha: string | null; usage: { promptTokens: number | null; completionTokens: number | null } } };

async function extractLifeModel(transcriptText: string, request: IndexRequest): Promise<ExtractionResult> {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const model = String(process.env.URAI_LIFE_MODEL_EXTRACTOR_MODEL || '').trim();
  if (!apiKey || !model) throw new Error('life model extractor is not configured');

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
      sourceSpan: { startChar: 0, endChar: 1 },
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
      max_completion_tokens: 8192,
      messages: [
        {
          role: 'system',
          content: [
            'You are the private URAI Life Model evidence extractor.',
            'Extract only evidence-constrained claims from the provided transcript.',
            'Never invent missing facts. Preserve uncertainty and contradictions.',
            'Synthetic or simulated content can never become historical evidence.',
            'Every claim must have a nonempty sourceSpan with exact startChar/endChar offsets in the supplied transcript. Relationships, temporal states, constraints and conflicts must reference declared entities/claims.',
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
  const metadata = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value) ? value : null;
  const usage = (value: unknown): number | null => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
  const completionTokens = usage(json?.usage?.completion_tokens);
  if (completionTokens !== null && completionTokens > 8192) throw new Error('extractor exceeded output budget');
  return {
    extraction: validateExtraction(JSON.parse(content), request.sourceEvidenceClass, transcriptText.length) as Extraction,
    provider: {
      name: 'openai', requestedModel: model,
      responseModel: metadata(json?.model), responseId: metadata(json?.id),
      sourceSha: /^[a-f0-9]{40}$/.test(String(process.env.URAI_SOURCE_SHA || '')) ? String(process.env.URAI_SOURCE_SHA) : null,
      usage: { promptTokens: usage(json?.usage?.prompt_tokens), completionTokens },
    },
  };
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

type ResolvedInputs = Awaited<ReturnType<typeof resolvePrivateInputs>>;
type StoredIndex = { handleHash: string; revision: number; checksum: string; backlogState: string; replayed: boolean };
type IndexAdmission = { handleHash: string; requestHash: string; leaseToken: string; replay?: StoredIndex };

function requestHash(request: IndexRequest, resolved: ResolvedInputs): string {
  return stableHash(canonicalJson({
    schemaVersion: 'urai-life-model-index-admission-v2',
    sourceHandleHash: stableHash(request.sourceHandle),
    sourceEvidenceClass: request.sourceEvidenceClass,
    transcriptRef: request.transcriptRef, provenanceRef: request.provenanceRef,
    requestedPurpose: request.requestedPurpose, locale: request.locale || null,
    priorMemoryIndexRef: request.priorMemoryIndexRef || null,
    correlationTrigger: request.correlationTrigger || 'initial-source',
    sourceFixityRef: resolved.sourceFixityRef, sourceSha256: resolved.sourceSha256,
    transcriptSha256: stableHash(resolved.transcriptText),
  }));
}

function indexRefs(request: IndexRequest) {
  const handleHash = stableHash(request.sourceHandle).slice(0, 40);
  const root = firestore().collection('uraiPrivateLifeModel').doc(handleHash);
  return { handleHash, root, idempotencyRef: root.collection('idempotency').doc(stableHash(request.idempotencyKey)) };
}

async function reserveIndex(request: IndexRequest, resolved: ResolvedInputs): Promise<IndexAdmission> {
  const db = firestore();
  const { handleHash, root, idempotencyRef } = indexRefs(request);
  const binding = requestHash(request, resolved);
  const leaseToken = crypto.randomUUID();
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(idempotencyRef);
    const data = existing.data() || {};
    if (existing.exists && data.requestHash !== binding) {
      // Legacy unbound receipts cannot prove that the same key meant this input.
      throw new AdmissionError('LIFE_MODEL_IDEMPOTENCY_CONFLICT', 409);
    }
    if (data.state === 'SUCCESS') {
      if (!Number.isSafeInteger(data.revision) || data.revision < 1 || !SHA256.test(data.checksum) || !['INDEXED', 'CONFLICTED'].includes(data.backlogState)) {
        throw new AdmissionError('LIFE_MODEL_STORED_RECEIPT_INVALID', 409);
      }
      const retained = await tx.get(root.collection('revisions').doc(String(data.revision).padStart(8, '0')));
      const { checksum, backlogState, createdAt: _createdAt, ...record } = retained.data() || {};
      if (!retained.exists || checksum !== data.checksum || backlogState !== data.backlogState
        || record.admissionRequestHash !== binding || record.sourceHandleHash !== handleHash
        || stableHash(canonicalJson(record)) !== data.checksum) {
        throw new AdmissionError('LIFE_MODEL_STORED_RECEIPT_INVALID', 409);
      }
      return { handleHash, requestHash: binding, leaseToken: '', replay: {
        handleHash, revision: data.revision, checksum: data.checksum, backlogState: data.backlogState, replayed: true,
      } };
    }
    if (existing.exists && !['RUNNING', 'FAILED'].includes(data.state)) {
      throw new AdmissionError('LIFE_MODEL_INDEX_STATE_INVALID', 409);
    }
    if (data.state === 'RUNNING' && (!Number.isSafeInteger(data.leaseExpiresAtMs) || data.leaseExpiresAtMs > Date.now())) {
      throw new AdmissionError('LIFE_MODEL_INDEX_IN_PROGRESS', 503);
    }
    const previousAttempts = existing.exists ? data.attempts : 0;
    if (!Number.isSafeInteger(previousAttempts) || previousAttempts < 0 || previousAttempts >= MAX_INDEX_ATTEMPTS) {
      throw new AdmissionError('LIFE_MODEL_RETRY_LIMIT', 409);
    }
    tx.set(idempotencyRef, {
      admissionSchemaVersion: 2, requestHash: binding, state: 'RUNNING',
      attempts: previousAttempts + 1, leaseToken, leaseExpiresAtMs: Date.now() + INDEX_LEASE_MS,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    return { handleHash, requestHash: binding, leaseToken };
  });
}

async function releaseFailedIndex(request: IndexRequest, admission: IndexAdmission) {
  if (!admission.leaseToken) return;
  const { idempotencyRef } = indexRefs(request);
  await firestore().runTransaction(async (tx) => {
    const existing = await tx.get(idempotencyRef);
    const data = existing.data() || {};
    if (data.state !== 'RUNNING' || data.leaseToken !== admission.leaseToken || data.requestHash !== admission.requestHash) return;
    tx.update(idempotencyRef, { state: 'FAILED', leaseToken: null, leaseExpiresAtMs: 0, updatedAt: FieldValue.serverTimestamp() });
  });
}

async function assertCurrentInputs(request: IndexRequest, admission: IndexAdmission) {
  const current = await resolvePrivateInputs(request);
  if (requestHash(request, current) !== admission.requestHash) throw new AdmissionError('LIFE_MODEL_SOURCE_AUTHORITY_CHANGED', 409);
}

async function persistRevision(request: IndexRequest, output: ExtractionResult, resolved: ResolvedInputs, admission: IndexAdmission): Promise<StoredIndex> {
  const db = firestore();
  const extraction = output.extraction;
  const { handleHash, root, idempotencyRef } = indexRefs(request);

  const result = await db.runTransaction(async (tx) => {
    const existing = await tx.get(idempotencyRef);
    const data = existing.data() || {};
    if (!existing.exists || data.state !== 'RUNNING' || data.requestHash !== admission.requestHash || data.leaseToken !== admission.leaseToken || !Number.isSafeInteger(data.leaseExpiresAtMs) || data.leaseExpiresAtMs <= Date.now()) {
      throw new AdmissionError('LIFE_MODEL_STALE_LEASE', 409);
    }

    const currentRef = root.collection('state').doc('current');
    const currentSnap = await tx.get(currentRef);
    const currentRevision = Number(currentSnap.data()?.revision || 0);
    if (!Number.isSafeInteger(currentRevision) || currentRevision < 0 || currentRevision >= Number.MAX_SAFE_INTEGER) throw new Error('invalid stored revision');
    const revision = currentRevision + 1;
    const record = {
      schemaVersion: 'urai-life-model-v1',
      hashAlgorithm: 'sha256-canonical-json-lexical-v2',
      revision,
      correlationTrigger: request.correlationTrigger || 'initial-source',
      sourceHandleHash: handleHash,
      sourceEvidenceClass: request.sourceEvidenceClass,
      sourceFixityRef: resolved.sourceFixityRef,
      sourceSha256: resolved.sourceSha256,
      transcriptSha256: stableHash(resolved.transcriptText),
      admissionRequestHash: admission.requestHash,
      transcriptRef: request.transcriptRef,
      provenanceRef: request.provenanceRef,
      priorMemoryIndexRef: request.priorMemoryIndexRef || null,
      syntheticOutputMayBecomeHistoricalSource: false,
      extraction,
      extractionProvider: output.provider,
    };
    const checksum = stableHash(canonicalJson(record));
    const backlogState = extraction.sceneTruth.decision === 'BLOCKED' ? 'CONFLICTED' : 'INDEXED';
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
    tx.update(idempotencyRef, {
      state: 'SUCCESS', leaseToken: null, leaseExpiresAtMs: 0,
      revision,
      checksum,
      backlogState,
      updatedAt: FieldValue.serverTimestamp(),
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
    extractorKey: Boolean(String(process.env.OPENAI_API_KEY || '').trim()),
    extractorModel: /^[A-Za-z0-9._:-]{1,160}$/.test(String(process.env.URAI_LIFE_MODEL_EXTRACTOR_MODEL || '').trim()),
    transcriptBound: Number.isSafeInteger(MAX_TRANSCRIPT_CHARS) && MAX_TRANSCRIPT_CHARS > 0 && MAX_TRANSCRIPT_CHARS <= 240000,
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
  let request: IndexRequest | undefined;
  let admission: IndexAdmission | undefined;
  try {
    try { request = assertRequest(req.body); } catch { throw new AdmissionError('LIFE_MODEL_INVALID_REQUEST', 400); }
    const state = readiness();
    if (!state.ok) return res.status(503).send({ ok: false, code: 'LIFE_MODEL_PROVIDER_NOT_READY', checks: state.checks });

    const resolved = await resolvePrivateInputs(request);
    admission = await reserveIndex(request, resolved);
    let stored = admission.replay;
    if (!stored) {
      const extraction = await extractLifeModel(resolved.transcriptText, request);
      await assertCurrentInputs(request, admission);
      stored = await persistRevision(request, extraction, resolved, admission);
    }
    // Authorize both new output and replay immediately before returning private refs.
    await assertCurrentInputs(request, admission);

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
    if (request && admission) {
      try { await releaseFailedIndex(request, admission); } catch { /* Lease expiry permits a bounded recovery when Firestore is unavailable. */ }
    }
    const code = error instanceof AdmissionError ? error.code : 'LIFE_MODEL_INDEX_FAILED';
    console.error(JSON.stringify({
      event: 'private-life-model.index.failed',
      service: 'private-life-model-index-provider',
      code,
    }));
    if (code === 'LIFE_MODEL_INDEX_IN_PROGRESS') res.set('Retry-After', '5');
    return res.status(error instanceof AdmissionError ? error.status : 502).send({ ok: false, code, error: 'Private Life Model indexing failed.' });
  }
});

app.use((_req, res) => res.status(404).send({ ok: false, error: 'not_found' }));

app.listen(port, host, () => {
  console.log(JSON.stringify({ event: 'provider.started', service: 'private-life-model-index-provider', host, port }));
});
