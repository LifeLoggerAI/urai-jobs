import crypto from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { registerProtectedSourceRoutes } from './protected-source-provider';
import { validateExtraction as validateExtractionGraph } from './contracts.js';
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
const MAX_TRANSCRIPT_CHARS = 240000;
const MAX_EXTRACTION_BYTES = 512 * 1024;
const SOURCE_CONTRACT = 'urai-private-source-receipt-v2';
const TRANSCRIPT_CONTRACT = 'urai-private-source-transcript-v2';

// Opaque private refs and authority responses must not be retained by caches.
app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(rateLimit({ windowMs: 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
  ipv6Subnet: 56, passOnStoreError: false, message: { ok: false, code: 'PRIVATE_SOURCE_RATE_LIMIT' } }));
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
  ownerUid: string;
  jobId: string;
  leaseToken: string;
  sourceReceiptRef: string;
  sourceSha256: string;
  sourceByteLength: number;
  sourceRevision: number;
  sourceFixityRef: string;
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
    'ownerUid', 'jobId', 'leaseToken', 'sourceReceiptRef', 'sourceSha256', 'sourceByteLength', 'sourceRevision', 'sourceFixityRef',
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
    ownerUid: String(body?.ownerUid || ''),
    jobId: String(body?.jobId || ''),
    leaseToken: String(body?.leaseToken || ''),
    sourceReceiptRef: String(body?.sourceReceiptRef || ''),
    sourceSha256: String(body?.sourceSha256 || ''), sourceFixityRef: String(body?.sourceFixityRef || ''),
    sourceByteLength: Number(body?.sourceByteLength), sourceRevision: Number(body?.sourceRevision),
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
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(request.ownerUid)) throw new Error('invalid trusted ownerUid');
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(request.jobId) || request.idempotencyKey !== request.jobId) throw new Error('invalid trusted job identity');
  if (!/^[A-Za-z0-9._:-]{8,256}$/.test(request.leaseToken)) throw new Error('invalid trusted lease');
  if (!/^psr_[A-Za-z0-9_-]{16,128}$/.test(request.sourceReceiptRef)) throw new Error('invalid sourceReceiptRef');
  if (!SHA256.test(request.sourceSha256) || !PRIVATE_REF.test(request.sourceFixityRef)
    || !Number.isSafeInteger(request.sourceRevision) || request.sourceRevision < 1
    || !Number.isSafeInteger(request.sourceByteLength) || request.sourceByteLength < 1 || request.sourceByteLength > 2 * 1024 ** 3) throw new Error('invalid expected source fixity');
  if (request.locale && !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(request.locale)) throw new Error('invalid locale');
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
    method: 'POST', redirect: 'error',
    headers: {
      Authorization: `Bearer ${resolverToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: SOURCE_CONTRACT,
      ownerUid: request.ownerUid, jobId: request.jobId, leaseToken: request.leaseToken,
      sourceReceiptRef: request.sourceReceiptRef,
      sourceSha256: request.sourceSha256, sourceFixityRef: request.sourceFixityRef,
      sourceByteLength: request.sourceByteLength, sourceRevision: request.sourceRevision, sourceEvidenceClass: request.sourceEvidenceClass,
      sourceHandle: request.sourceHandle,
      transcriptRef: request.transcriptRef,
      provenanceRef: request.provenanceRef,
      requestedPurpose: 'memory-index',
      idempotencyKey: request.idempotencyKey,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) throw new Error(`private ref resolver failed with status ${response.status}`);
  const resolverBytes = await boundedResponse(response, 1024 * 1024);
  const payload = JSON.parse(resolverBytes) as any;
  if (payload?.schemaVersion !== SOURCE_CONTRACT
    || payload.ownerUid !== request.ownerUid || payload.jobId !== request.jobId
    || payload.leaseTokenHash !== stableHash(request.leaseToken)
    || payload.sourceReceiptRef !== request.sourceReceiptRef
    || payload.requestedPurpose !== request.requestedPurpose
    || payload.idempotencyKey !== request.idempotencyKey
    || payload.currentConsent !== true || payload.currentCorrection !== true) throw new Error('resolver authority binding mismatch');
  if (payload?.authorized !== true) throw new Error('private ref resolver denied access');
  if (payload?.synthetic !== false) throw new Error('resolved source must be explicitly non-synthetic');
  for (const key of ['sourceSha256','sourceFixityRef','sourceByteLength','sourceRevision']) {
    if (payload[key] !== request[key as keyof IndexRequest]) throw new Error('resolver expected source fixity mismatch');
  }
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

  const transcriptSha256 = String(payload.transcriptSha256 || '');
  const provenanceSha256 = String(payload.provenanceSha256 || '');
  const sourceByteLength = Number(payload.sourceByteLength);
  const sourceRevision = Number(payload.sourceRevision);
  const transcriptByteLength = Buffer.byteLength(transcriptText, 'utf8');
  if (!SHA256.test(transcriptSha256) || stableHash(transcriptText) !== transcriptSha256
    || !SHA256.test(provenanceSha256) || !payload.provenance
    || stableHash(canonicalJson(payload.provenance)) !== provenanceSha256
    || payload.transcriptByteLength !== transcriptByteLength
    || !Number.isSafeInteger(sourceByteLength) || sourceByteLength < 1 || sourceByteLength > 2 * 1024 ** 3
    || !Number.isSafeInteger(sourceRevision) || sourceRevision < 1) throw new Error('resolver byte/fixity binding mismatch');
  return { transcriptText, sourceFixityRef, sourceSha256, sourceByteLength, sourceRevision, transcriptSha256, provenanceSha256, transcriptByteLength };
}

function validateExtraction(value: any, sourceEvidenceClass: string, transcriptLength = MAX_TRANSCRIPT_CHARS): Extraction {
  const extraction = value as Extraction;
  if (!extraction || typeof extraction !== 'object') throw new Error('extractor returned invalid object');
  if (Buffer.byteLength(canonicalJson(extraction), 'utf8') > MAX_EXTRACTION_BYTES) throw new Error('extraction exceeds bounded size');
  for (const key of ['entities', 'claims', 'relationships', 'temporalStates', 'places', 'conflicts', 'negativeConstraints']) {
    if (!Array.isArray((extraction as any)[key]) || (extraction as any)[key].length > 256) throw new Error(`extractor missing ${key}`);
  }
  if (!extraction.sceneTruth || !['READY', 'READY_WITH_OCCLUSION', 'READY_INTERPRETIVE', 'BLOCKED'].includes(extraction.sceneTruth.decision)) {
    throw new Error('extractor returned invalid sceneTruth decision');
  }
  const entities = new Set<string>();
  const claims = new Set<string>();
  for (const entity of extraction.entities) {
    if (!/^[A-Za-z0-9._:-]{1,160}$/.test(entity.entityId) || entities.has(entity.entityId)
      || !['person','place','object','event','organization','animal','other'].includes(entity.type)
      || typeof entity.label !== 'string' || !entity.label.trim() || entity.label.length > 180
      || (entity.aliases && (!Array.isArray(entity.aliases) || entity.aliases.length > 24 || entity.aliases.some(a => typeof a !== 'string' || a.length > 120)))) throw new Error('invalid extracted entity');
    entities.add(entity.entityId);
  }
  for (const claim of extraction.claims) {
    if (!/^[A-Za-z0-9._:-]{1,160}$/.test(claim.claimId) || claims.has(claim.claimId)
      || !entities.has(claim.subject) || !/^[A-Za-z0-9._:-]{1,160}$/.test(claim.predicate)
      || Buffer.byteLength(String(claim.object), 'utf8') > 8192
      || !Number.isInteger(claim.sourceSpan?.startChar) || !Number.isInteger(claim.sourceSpan?.endChar)
      || Number(claim.sourceSpan?.startChar) < 0 || Number(claim.sourceSpan?.endChar) <= Number(claim.sourceSpan?.startChar)
      || Number(claim.sourceSpan?.endChar) > transcriptLength) throw new Error('invalid claim lineage/span');
    claims.add(claim.claimId);
    if (!claim.claimId || !claim.subject || !claim.predicate || typeof claim.object !== 'string') throw new Error('invalid extracted claim');
    if (!ALLOWED_EVIDENCE.has(claim.evidenceClass)) throw new Error('claim uses unsupported evidence class');
    if (claim.evidenceClass !== sourceEvidenceClass && claim.evidenceClass !== 'CORROBORATED_INFERENCE') {
      throw new Error('claim attempts unsupported evidence promotion');
    }
    if (!Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1) throw new Error('invalid claim confidence');
  }
  for (const edge of extraction.relationships) {
    if (!entities.has(edge.from) || !entities.has(edge.to) || typeof edge.type !== 'string' || edge.type.length > 160
      || !Number.isFinite(edge.confidence) || edge.confidence < 0 || edge.confidence > 1) throw new Error('invalid extracted relationship');
  }
  for (const state of extraction.temporalStates) if (!entities.has(state.entityId)) throw new Error('invalid temporal entity');
  for (const conflict of extraction.conflicts) if (!Array.isArray(conflict.claimIds) || conflict.claimIds.length > 256 || conflict.claimIds.some(id => !claims.has(id))) throw new Error('invalid conflict lineage');
  for (const constraint of extraction.negativeConstraints) if (!Array.isArray(constraint.sourceClaimIds) || constraint.sourceClaimIds.length > 256 || constraint.sourceClaimIds.some(id => !claims.has(id))) throw new Error('invalid negative constraint lineage');
  return validateExtractionGraph(extraction, sourceEvidenceClass, transcriptLength) as Extraction;
}

async function extractLifeModel(transcriptText: string, request: IndexRequest): Promise<Extraction> {
  const apiKey = String(process.env.OPENAI_API_KEY || '');
  const model = String(process.env.URAI_LIFE_MODEL_EXTRACTOR_MODEL || '');
  if (!apiKey || !/^[A-Za-z0-9._:-]{8,100}$/.test(model)) throw new Error('life model extractor is not configured');

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
    method: 'POST', redirect: 'error',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      max_completion_tokens: 10000,
      store: false,
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
  const json = JSON.parse(await boundedResponse(response, 1024 * 1024)) as any;
  const content = String(json?.choices?.[0]?.message?.content || '');
  if (!content) throw new Error('life model extractor returned empty content');
  return validateExtraction(JSON.parse(content), request.sourceEvidenceClass, transcriptText.length);
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

// Bound the whole response body, not only its headers, before decoding private data.
async function boundedResponse(response: globalThis.Response, maximum: number): Promise<string> {
  if (!response.body) throw new Error('provider body missing');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const timer = setTimeout(() => { void reader.cancel(); }, 90000);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new Error('provider body exceeds bound'); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

function binding(request: IndexRequest, resolved: ResolvedInputs) {
  return {
    schemaVersion: SOURCE_CONTRACT, ownerUid: request.ownerUid, jobId: request.jobId,
    sourceReceiptRef: request.sourceReceiptRef, sourceHandleHash: stableHash(request.sourceHandle),
    sourceEvidenceClass: request.sourceEvidenceClass, requestedPurpose: request.requestedPurpose,
    transcriptRef: request.transcriptRef, provenanceRef: request.provenanceRef,
    sourceFixityRef: resolved.sourceFixityRef, sourceSha256: resolved.sourceSha256,
    sourceByteLength: resolved.sourceByteLength, sourceRevision: resolved.sourceRevision,
    transcriptSha256: resolved.transcriptSha256, provenanceSha256: resolved.provenanceSha256,
    transcriptByteLength: resolved.transcriptByteLength,
    priorMemoryIndexRef: request.priorMemoryIndexRef || null, locale: request.locale || null,
    correlationTrigger: request.correlationTrigger || 'initial-source', idempotencyKey: request.idempotencyKey,
  };
}

function privateRoot(request: IndexRequest) {
  const handleHash = stableHash(request.ownerUid + '\n' + request.sourceHandle).slice(0, 40);
  return { handleHash, root: firestore().collection('uraiPrivateLifeModel').doc(handleHash) };
}

// The resolver's declaration alone is insufficient. Read the canonical job,
// protected grant, transcript fixity and consent block in every write transaction.
// Revocation/correction writes conflict with these reads and force revalidation.
async function requireCurrentAuthority(tx: any, request: IndexRequest, resolved: ResolvedInputs) {
  const db = firestore();
  const job = (await tx.get(db.collection('jobs').doc(request.jobId))).data();
  if (!job || job.ownerUid !== request.ownerUid || (job.type || job.jobType) !== 'memory.private-source.index'
    || job.status !== 'RUNNING' || job.execution?.leaseToken !== request.leaseToken) throw new Error('canonical job authority mismatch');
  const p = job.payload || {};
  for (const key of ['sourceReceiptRef','transcriptRef','provenanceRef','requestedPurpose','priorMemoryIndexRef','locale']) {
    if (String(p[key] || '') !== String((request as any)[key] || '')) throw new Error('canonical payload mismatch');
  }
  if ((p.correlationTrigger || 'initial-source') !== request.correlationTrigger) throw new Error('canonical trigger mismatch');
  const consent = job.consent;
  if (consent?.purpose !== 'memory.storage' || !consent.policyVersion || !consent.decisionReceiptId) throw new Error('canonical memory consent required');
  const receiptRef = db.collection('uraiPrivateSourceReceipts').doc(stableHash(request.sourceReceiptRef));
  const [block, fence, sourceSnap, transcriptSnap] = await Promise.all([
    tx.get(db.collection('jobConsentBlocks').doc(stableHash(request.ownerUid + '\n' + consent.purpose))),
    tx.get(db.collection('uraiPrivateLifeModelOwnerFences').doc(stableHash(request.ownerUid))),
    tx.get(receiptRef), tx.get(receiptRef.collection('transcripts').doc(stableHash(request.transcriptRef))),
  ]);
  if (block.data()?.active === true || fence.data()?.deleted === true) throw new Error('private authority revoked/deleted');
  const source = sourceSnap.data();
  const transcript = transcriptSnap.data();
  const sourceConsents = Array.isArray(source?.consents) ? source.consents : (source?.consent ? [source.consent] : []);
  const sourceConsent = sourceConsents.find((entry:any) => entry?.purpose === consent.purpose);
  if (!source || source.schemaVersion !== SOURCE_CONTRACT || source.ownerUid !== request.ownerUid
    || source.sourceReceiptRef !== request.sourceReceiptRef || source.sourceHandle !== request.sourceHandle
    || source.status !== 'ACTIVE' || source.synthetic !== false
    || source.sourceEvidenceClass !== request.sourceEvidenceClass
    || !Array.isArray(source.purposes) || !source.purposes.includes(request.requestedPurpose)
    || sourceConsent?.policyVersion !== consent.policyVersion
    || sourceConsent?.decisionReceiptId !== consent.decisionReceiptId) throw new Error('protected source grant mismatch');
  for (const key of ['sourceRevision','sourceFixityRef','sourceSha256','sourceByteLength']) {
    if (source[key] !== resolved[key as keyof ResolvedInputs]) throw new Error('protected source corrected/fixity mismatch');
  }
  if (!transcript || transcript.schemaVersion !== TRANSCRIPT_CONTRACT || transcript.ownerUid !== request.ownerUid
    || transcript.sourceReceiptRef !== request.sourceReceiptRef || transcript.status !== 'CURRENT'
    || transcript.synthetic !== false || transcript.requestedPurpose !== 'memory-index'
    || transcript.transcriptRef !== request.transcriptRef || transcript.provenanceRef !== request.provenanceRef) throw new Error('protected transcript binding mismatch');
  for (const key of ['sourceRevision','sourceSha256','transcriptSha256','provenanceSha256','transcriptByteLength']) {
    if (transcript[key] !== resolved[key as keyof ResolvedInputs]) throw new Error('protected transcript corrected/fixity mismatch');
  }
  return stableHash(canonicalJson(binding(request, resolved)));
}

// This is an inert import plan, never a write to Spatial's historical collections.
// Every claim is UNKNOWN/disputed and blocked by synthetic:true until an owner
// separately reviews evidence and uses the canonical governed callable path.
function quarantinedImport(request: IndexRequest, extraction: Extraction, resolved: ResolvedInputs) {
  const lineage = binding(request, resolved);
  const prefix = 'candidate:' + stableHash(canonicalJson(lineage)).slice(0, 24) + ':';
  const entityId = (id: string) => prefix + stableHash(id).slice(0, 24);
  const claimId = (id: string) => prefix + stableHash(id).slice(0, 24);
  return {
    schemaVersion: 'urai-spatial-owner-review-import-candidate-v1', ownerId: request.ownerUid,
    reviewState: 'OWNER_REVIEW_REQUIRED', importExecutable: false, historicalSourceAuthority: false,
    lineage, lineageSha256: stableHash(canonicalJson(lineage)),
    entities: extraction.entities.map(entity => ({ id: entityId(entity.entityId), ownerId: request.ownerUid,
      kind: ['animal','other'].includes(entity.type) ? 'statement' : entity.type,
      canonicalLabel: entity.label, aliases: entity.aliases || [], createdFromSourceIds: [request.sourceReceiptRef],
      reviewState: 'QUARANTINED' })),
    claims: extraction.claims.map(claim => ({ id: claimId(claim.claimId), ownerId: request.ownerUid,
      subjectEntityId: entityId(claim.subject), predicate: claim.predicate, value: claim.object,
      evidenceClass: 'UNKNOWN', confidence: 'unknown', status: 'disputed', synthetic: true,
      sourceIds: [request.sourceReceiptRef], valueDigest: stableHash(JSON.stringify(claim.object)),
      sourceSpan: claim.sourceSpan, proposedEvidenceClass: claim.evidenceClass, reviewState: 'QUARANTINED' })),
    relationships: extraction.relationships.map(edge => ({ ownerId: request.ownerUid,
      fromEntityId: entityId(edge.from), toEntityId: entityId(edge.to), proposedKind: edge.type,
      evidenceClass: 'UNKNOWN', confidence: 'unknown', status: 'disputed', synthetic: true,
      sourceIds: [request.sourceReceiptRef], reviewState: 'QUARANTINED' })),
    temporalStates: extraction.temporalStates.map(state => ({ ...state, entityId: entityId(state.entityId), reviewState: 'QUARANTINED' })),
    places: extraction.places,
    conflicts: extraction.conflicts.map(conflict => ({ ...conflict, claimIds: conflict.claimIds.map(claimId) })),
    negativeConstraints: extraction.negativeConstraints.map(constraint => ({ ...constraint, sourceClaimIds: constraint.sourceClaimIds.map(claimId) })),
    sceneTruth: { decision: 'BLOCKED', reasons: ['OWNER_EVIDENCE_REVIEW_REQUIRED'], proposedDecision: extraction.sceneTruth.decision },
  };
}

async function reserveExtraction(request: IndexRequest, resolved: ResolvedInputs) {
  const db = firestore();
  const { root, handleHash } = privateRoot(request);
  const idempotencyRef = root.collection('idempotency').doc(stableHash(request.idempotencyKey));
  return db.runTransaction(async (tx) => {
    const requestDigest = await requireCurrentAuthority(tx, request, resolved);
    const existing = await tx.get(idempotencyRef);
    if (existing.exists) {
      const data = existing.data() || {};
      if (data.ownerUid !== request.ownerUid || data.requestDigest !== requestDigest) throw new Error('idempotency binding conflict');
      if (data.state !== 'FINISHED') throw new Error('extraction attempt requires reconciliation');
      if (!Number.isSafeInteger(data.revision) || data.revision < 1 || !SHA256.test(String(data.checksum))) throw new Error('invalid replay receipt');
      const [revisionSnap, currentSnap] = await Promise.all([
        tx.get(root.collection('revisions').doc(String(data.revision).padStart(8, '0'))), tx.get(root.collection('state').doc('current')),
      ]);
      const record = revisionSnap.data();
      if (!record || record.ownerUid !== request.ownerUid || record.requestDigest !== requestDigest
        || record.historicalSourceAuthority !== false || record.reviewState !== 'OWNER_REVIEW_REQUIRED'
        || currentSnap.data()?.revision !== data.revision || currentSnap.data()?.requestDigest !== requestDigest) throw new Error('private extraction replay stale');
      const { checksum: _checksum, backlogState: _backlog, createdAt: _created, ...retained } = record;
      if (stableHash(canonicalJson(retained)) !== data.checksum || record.checksum !== data.checksum) throw new Error('private extraction replay bytes mismatch');
      return { handleHash, revision: Number(data.revision), checksum: String(data.checksum), backlogState: String(data.backlogState), replayed: true, reservation: '' };
    }
    const reservation = crypto.randomUUID();
    tx.set(root, { ownerUid: request.ownerUid, sourceHandleHash: handleHash, historicalSourceAuthority: false }, { merge: true });
    tx.create(idempotencyRef, { ownerUid: request.ownerUid, jobId: request.jobId, requestDigest,
      state: 'STARTED', reservation, createdAt: FieldValue.serverTimestamp() });
    return { handleHash, revision: 0, checksum: '', backlogState: '', replayed: false, reservation };
  });
}

async function persistRevision(request: IndexRequest, extraction: Extraction, resolved: ResolvedInputs, reservation: string) {
  const db = firestore();
  const { root, handleHash } = privateRoot(request);
  const idempotencyRef = root.collection('idempotency').doc(stableHash(request.idempotencyKey));
  return db.runTransaction(async (tx) => {
    const requestDigest = await requireCurrentAuthority(tx, request, resolved);
    const existing = await tx.get(idempotencyRef);
    const attempt = existing.data();
    if (!attempt || attempt.ownerUid !== request.ownerUid || attempt.requestDigest !== requestDigest
      || attempt.state !== 'STARTED' || attempt.reservation !== reservation) throw new Error('stale extraction reservation');
    const currentRef = root.collection('state').doc('current');
    const currentSnap = await tx.get(currentRef);
    const revision = Number(currentSnap.data()?.revision || 0) + 1;
    const record = {
      schemaVersion: 'urai-life-model-v1', ownerUid: request.ownerUid, jobId: request.jobId, revision,
      correlationTrigger: request.correlationTrigger || 'initial-source', sourceHandleHash: handleHash,
      sourceEvidenceClass: request.sourceEvidenceClass, sourceFixityRef: resolved.sourceFixityRef,
      sourceSha256: resolved.sourceSha256, transcriptRef: request.transcriptRef, provenanceRef: request.provenanceRef,
      lineage: binding(request, resolved), requestDigest, historicalSourceAuthority: false,
      reviewState: 'OWNER_REVIEW_REQUIRED', priorMemoryIndexRef: request.priorMemoryIndexRef || null,
      syntheticOutputMayBecomeHistoricalSource: false, extraction,
      producer: { repository: 'LifeLoggerAI/urai-jobs', sourceSha: process.env.URAI_SOURCE_SHA,
        runtimeRevision: process.env.K_REVISION, model: process.env.URAI_LIFE_MODEL_EXTRACTOR_MODEL,
        executionAuthorityRef: process.env.URAI_PRIVATE_LIFE_MODEL_EXECUTION_AUTHORITY_REF,
        candidateAcceptance: false, publicReleaseAuthorized: false },
      importCandidate: quarantinedImport(request, extraction, resolved),
    };
    // Includes model hypotheses and the exact inert canonical import candidate.
    if (Buffer.byteLength(canonicalJson(record), 'utf8') > 900 * 1024) throw new Error('private revision document exceeds bound');
    const checksum = stableHash(canonicalJson(record));
    const backlogState = extraction.conflicts.length ? 'QUARANTINED_CONFLICTED' : 'QUARANTINED_OWNER_REVIEW';
    tx.create(root.collection('revisions').doc(String(revision).padStart(8, '0')), {
      ...record, checksum, backlogState, createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(currentRef, { ownerUid: request.ownerUid, revision, checksum, backlogState, requestDigest,
      sourceRevision: resolved.sourceRevision, reviewState: 'OWNER_REVIEW_REQUIRED', historicalSourceAuthority: false,
      sourceEvidenceClass: request.sourceEvidenceClass, syntheticOutputMayBecomeHistoricalSource: false,
      updatedAt: FieldValue.serverTimestamp() });
    tx.set(idempotencyRef, { ownerUid: request.ownerUid, jobId: request.jobId, requestDigest,
      state: 'FINISHED', revision, checksum, backlogState, completedAt: FieldValue.serverTimestamp() });
    return { handleHash, revision, checksum, backlogState, replayed: false };
  });
}

async function failReservation(request: IndexRequest, reservation: string) {
  const db = firestore();
  const target = privateRoot(request).root.collection('idempotency').doc(stableHash(request.idempotencyKey));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(target);
    if (snap.data()?.reservation === reservation && snap.data()?.state === 'STARTED') {
      tx.set(target, { state: 'FAILED_RECONCILIATION_REQUIRED', failureCode: 'PRIVATE_EXTRACTION_FAILED', failedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  });
}

function readiness() {
  const checks = {
    auth: Boolean(process.env.PRIVATE_SOURCE_INDEX_TOKEN),
    executionEnabled: process.env.URAI_PRIVATE_LIFE_MODEL_EXECUTION_ENABLED === 'true',
    executionAuthority: PRIVATE_REF.test(String(process.env.URAI_PRIVATE_LIFE_MODEL_EXECUTION_AUTHORITY_REF || '')),
    sourceContract: process.env.URAI_PRIVATE_SOURCE_CONTRACT === SOURCE_CONTRACT,
    resolverUrl: Boolean(process.env.PRIVATE_SOURCE_REF_RESOLVER_URL),
    resolverToken: Boolean(process.env.PRIVATE_SOURCE_REF_RESOLVER_TOKEN),
    extractorKey: Boolean(process.env.OPENAI_API_KEY),
    extractorModel: /^[A-Za-z0-9._:-]{8,100}$/.test(String(process.env.URAI_LIFE_MODEL_EXTRACTOR_MODEL || '')),
    firebaseProject: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT),
    sourceSha: /^[0-9a-f]{40}$/.test(String(process.env.URAI_SOURCE_SHA || '')),
    runtimeRevision: Boolean(process.env.K_REVISION),
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
    const admitted = await reserveExtraction(request, resolved);
    let stored: { handleHash: string; revision: number; checksum: string; backlogState: string; replayed: boolean } = admitted;
    if (!admitted.replayed) {
      try {
        const extraction = await extractLifeModel(resolved.transcriptText, request);
        const fresh = await resolvePrivateInputs(request);
        if (stableHash(canonicalJson(binding(request, fresh))) !== stableHash(canonicalJson(binding(request, resolved)))) throw new Error('source changed during extraction');
        stored = await persistRevision(request, extraction, fresh, admitted.reservation);
      } catch (error) {
        await failReservation(request, admitted.reservation);
        throw error;
      }
    }
    await firestore().runTransaction(tx => requireCurrentAuthority(tx, request, resolved));

    const base = (leaf: string) => privateRef(stored.handleHash, stored.revision, leaf);
    return res.status(200).send({
      ok: true,
      ownerUid: request.ownerUid, jobId: request.jobId, sourceReceiptRef: request.sourceReceiptRef,
      requestedPurpose: request.requestedPurpose, lineageSha256: stableHash(canonicalJson(binding(request, resolved))),
      sourceSha256: resolved.sourceSha256, sourceRevision: resolved.sourceRevision,
      transcriptSha256: resolved.transcriptSha256, provenanceSha256: resolved.provenanceSha256,
      historicalSourceAuthority: false, reviewState: 'OWNER_REVIEW_REQUIRED',
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
      failureCode: 'PRIVATE_LIFE_MODEL_INDEX_FAILED',
    }));
    return res.status(502).send({ ok: false, error: 'Private Life Model indexing failed.' });
  }
});

registerProtectedSourceRoutes(app, { firestore, stableHash, canonicalJson, boundedResponse });

app.use((_req, res) => res.status(404).send({ ok: false, error: 'not_found' }));

app.listen(port, host, () => {
  console.log(JSON.stringify({ event: 'provider.started', service: 'private-life-model-index-provider', host, port }));
});
