import crypto from 'node:crypto';
import axios from 'axios';
import express, { type NextFunction, type Request, type Response } from 'express';

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
const SOURCE_RECEIPT = /^psr_[A-Za-z0-9_-]{16,128}$/;
const REQUEST_RECEIPT = /^req_[A-Za-z0-9_-]{12,128}$/;
const SOURCE_HANDLE = /^psh_[A-Za-z0-9_-]{16,256}$/;
const PRIVATE_REF = /^private:[A-Za-z0-9_./:-]{8,512}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const LIFE_MODEL_EVIDENCE_CLASSES = new Set([
  'SOURCE_CAPTURED',
  'SOURCE_DERIVED',
  'DIRECT_SUBJECT_TESTIMONY',
  'ATTRIBUTED_TESTIMONY',
  'CORROBORATED_INFERENCE',
  'CONTEXTUAL_RESEARCH',
]);
type LifeModelEvidenceClass =
  | 'SOURCE_CAPTURED'
  | 'SOURCE_DERIVED'
  | 'DIRECT_SUBJECT_TESTIMONY'
  | 'ATTRIBUTED_TESTIMONY'
  | 'CORROBORATED_INFERENCE'
  | 'CONTEXTUAL_RESEARCH';

app.use(express.json({ limit: '64kb' }));

function runtimeEnv(): string {
  return String(process.env.URAI_ENV || process.env.NODE_ENV || 'local').toLowerCase();
}

function productionRuntime(): boolean {
  return ['prod', 'production', 'staging'].includes(runtimeEnv());
}

function exactSha(): boolean {
  return /^[0-9a-f]{40}$/.test(String(process.env.URAI_SOURCE_SHA || ''));
}

function httpsUrl(name: string): string {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return '';
  const url = new URL(raw);
  if (productionRuntime() && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS outside local/test.`);
  }
  return raw.replace(/\/$/, '');
}

function timingSafeBearer(actualHeader: string, expectedToken: string): boolean {
  const actual = crypto.createHash('sha256').update(actualHeader).digest();
  const expected = crypto.createHash('sha256').update(`Bearer ${expectedToken}`).digest();
  return crypto.timingSafeEqual(actual, expected);
}

function requireWorkerAuth(req: Request, res: Response, next: NextFunction) {
  const token = String(process.env.URAI_JOBS_WORKER_TOKEN || '');
  const local = ['local', 'test'].includes(runtimeEnv()) || process.env.FUNCTIONS_EMULATOR === 'true';
  if (!token && local) return next();
  if (!token) return res.status(503).send({ ok: false, error: 'worker auth is not configured' });
  if (!timingSafeBearer(req.get('Authorization') || '', token)) {
    return res.status(401).send({ ok: false, error: 'unauthorized' });
  }
  return next();
}

type PrivatePayload = {
  sourceReceiptRef: string;
  requestedPurpose: 'transcribe' | 'memory-index';
  locale?: string;
  requestReceipt?: string;
  transcriptRef?: string;
  provenanceRef?: string;
  priorMemoryIndexRef?: string;
  correlationTrigger?: 'initial-source' | 'new-source' | 'correction' | 'stronger-source';
};

function validateJob(body: any): { jobId: string; jobType: 'memory.private-source.transcribe' | 'memory.private-source.index'; ownerUid: string; payload: PrivatePayload } {
  const jobId = String(body?.jobId || body?.id || '').trim();
  const jobType = String(body?.jobType || body?.type || '').trim();
  const ownerUid = String(body?.ownerUid || '').trim();
  const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};

  if (!jobId) throw new Error('jobId is required');
  if (!['memory.private-source.transcribe', 'memory.private-source.index'].includes(jobType)) {
    throw new Error('unsupported private-source job type');
  }
  if (!ownerUid) throw new Error('server-owned ownerUid is required');

  const allowed = jobType === 'memory.private-source.index'
    ? ['correlationTrigger', 'locale', 'priorMemoryIndexRef', 'provenanceRef', 'requestReceipt', 'requestedPurpose', 'sourceReceiptRef', 'transcriptRef']
    : ['locale', 'requestReceipt', 'requestedPurpose', 'sourceReceiptRef'];
  const keys = Object.keys(payload).sort();
  if (keys.some((key) => !allowed.includes(key))) throw new Error('private-source payload contains forbidden fields');
  if (!SOURCE_RECEIPT.test(String(payload.sourceReceiptRef || ''))) throw new Error('invalid opaque sourceReceiptRef');
  if (!['transcribe', 'memory-index'].includes(String(payload.requestedPurpose || ''))) throw new Error('invalid requestedPurpose');
  if (payload.requestReceipt && !REQUEST_RECEIPT.test(String(payload.requestReceipt))) throw new Error('invalid requestReceipt');
  if (payload.locale && !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(String(payload.locale))) throw new Error('invalid locale');

  if (jobType === 'memory.private-source.index') {
    if (payload.requestedPurpose !== 'memory-index') throw new Error('memory index job requires memory-index purpose');
    if (!PRIVATE_REF.test(String(payload.transcriptRef || ''))) throw new Error('invalid private transcriptRef');
    if (!PRIVATE_REF.test(String(payload.provenanceRef || ''))) throw new Error('invalid private provenanceRef');
    if (payload.priorMemoryIndexRef && !PRIVATE_REF.test(String(payload.priorMemoryIndexRef))) {
      throw new Error('memory index priorMemoryIndexRef must remain private and opaque');
    }
    const correlationTrigger = String(payload.correlationTrigger || 'initial-source');
    if (!['initial-source', 'new-source', 'correction', 'stronger-source'].includes(correlationTrigger)) {
      throw new Error('memory index correlationTrigger is invalid');
    }
  }

  return {
    jobId,
    jobType: jobType as 'memory.private-source.transcribe' | 'memory.private-source.index',
    ownerUid,
    payload: {
      sourceReceiptRef: String(payload.sourceReceiptRef),
      requestedPurpose: String(payload.requestedPurpose) as PrivatePayload['requestedPurpose'],
      ...(payload.locale ? { locale: String(payload.locale) } : {}),
      ...(payload.requestReceipt ? { requestReceipt: String(payload.requestReceipt) } : {}),
      ...(payload.transcriptRef ? { transcriptRef: String(payload.transcriptRef) } : {}),
      ...(payload.provenanceRef ? { provenanceRef: String(payload.provenanceRef) } : {}),
      ...(jobType === 'memory.private-source.index' && payload.priorMemoryIndexRef
        ? { priorMemoryIndexRef: String(payload.priorMemoryIndexRef) }
        : {}),
      ...(jobType === 'memory.private-source.index'
        ? { correlationTrigger: (payload.correlationTrigger || 'initial-source') as NonNullable<PrivatePayload['correlationTrigger']> }
        : {}),
    },
  };
}

function readiness(jobType?: 'memory.private-source.transcribe' | 'memory.private-source.index') {
  const checks = {
    workerAuth: Boolean(process.env.URAI_JOBS_WORKER_TOKEN) || !productionRuntime(),
    sourceShaExact: exactSha() || !productionRuntime(),
    runtimeRevision: Boolean(process.env.K_REVISION) || !productionRuntime(),
    authorityUrl: Boolean(process.env.PRIVATE_SOURCE_AUTHORITY_URL),
    authorityToken: Boolean(process.env.PRIVATE_SOURCE_AUTHORITY_TOKEN),
    transcribeUrl: Boolean(process.env.PRIVATE_SOURCE_TRANSCRIBE_URL),
    transcribeToken: Boolean(process.env.PRIVATE_SOURCE_TRANSCRIBE_TOKEN),
    indexUrl: Boolean(process.env.PRIVATE_SOURCE_INDEX_URL),
    indexToken: Boolean(process.env.PRIVATE_SOURCE_INDEX_TOKEN),
  };
  const baseReady = checks.workerAuth
    && checks.sourceShaExact
    && checks.runtimeRevision
    && checks.authorityUrl
    && checks.authorityToken;
  const transcribeReady = checks.transcribeUrl && checks.transcribeToken;
  const indexReady = checks.indexUrl && checks.indexToken;

  const ok = jobType === 'memory.private-source.transcribe'
    ? baseReady && transcribeReady
    : jobType === 'memory.private-source.index'
      ? baseReady && indexReady
      : baseReady && transcribeReady && indexReady;

  return { checks, capabilities: { transcribe: transcribeReady, index: indexReady }, ok };
}

app.get('/healthz', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).send({
    ok: true,
    service: 'private-source-worker',
    environment: runtimeEnv(),
    sourceSha: String(process.env.URAI_SOURCE_SHA || ''),
  });
});

app.get('/readyz', (_req, res) => {
  const state = readiness();
  res.set('Cache-Control', 'no-store');
  res.status(state.ok ? 200 : 503).send({
    ok: state.ok,
    service: 'private-source-worker',
    sourceSha: String(process.env.URAI_SOURCE_SHA || ''),
    checks: state.checks,
  });
});

app.get('/authz', requireWorkerAuth, (_req, res) => {
  res.status(200).send({ ok: true, service: 'private-source-worker', authorized: true });
});

app.post('/execute-job', requireWorkerAuth, async (req, res) => {
  let job: ReturnType<typeof validateJob>;
  try {
    job = validateJob(req.body);
  } catch (error) {
    return res.status(400).send({ ok: false, error: error instanceof Error ? error.message : 'invalid job' });
  }

  const state = readiness(job.jobType);
  if (!state.ok) {
    return res.status(503).send({
      ok: false,
      code: 'PRIVATE_SOURCE_WORKER_NOT_READY',
      error: 'Private-source worker authority/provider bindings are incomplete; refusing synthetic success.',
      checks: state.checks,
    });
  }

  try {
    const authorityUrl = httpsUrl('PRIVATE_SOURCE_AUTHORITY_URL');

    const authorization = await axios.post(
      `${authorityUrl}/authorize`,
      {
        sourceReceiptRef: job.payload.sourceReceiptRef,
        ownerUid: job.ownerUid,
        requestedPurpose: job.payload.requestedPurpose,
        requestReceipt: job.payload.requestReceipt,
      },
      {
        timeout: 15_000,
        headers: { Authorization: `Bearer ${process.env.PRIVATE_SOURCE_AUTHORITY_TOKEN}` },
        validateStatus: () => true,
      },
    );

    if (authorization.status !== 200 || authorization.data?.authorized !== true) {
      return res.status(403).send({ ok: false, code: 'PRIVATE_SOURCE_NOT_AUTHORIZED', error: 'Private source authorization denied.' });
    }

    const sourceHandle = String(authorization.data?.sourceHandle || '');
    if (!SOURCE_HANDLE.test(sourceHandle)) {
      throw new Error('authority returned an invalid opaque source handle');
    }
    const sourceEvidenceClass = String(authorization.data?.evidenceClass || '');
    if (!LIFE_MODEL_EVIDENCE_CLASSES.has(sourceEvidenceClass)) {
      throw new Error('authority did not return a recognized historical evidence class');
    }
    if (authorization.data?.synthetic !== false) {
      throw new Error('authority did not prove the authorized source is non-synthetic');
    }

    if (job.jobType === 'memory.private-source.index') {
      const indexUrl = httpsUrl('PRIVATE_SOURCE_INDEX_URL');
      const provider = await axios.post(
        indexUrl,
        {
          sourceHandle,
          sourceEvidenceClass,
          transcriptRef: job.payload.transcriptRef,
          provenanceRef: job.payload.provenanceRef,
          requestedPurpose: 'memory-index',
          locale: job.payload.locale,
          priorMemoryIndexRef: job.payload.priorMemoryIndexRef,
          correlationTrigger: job.payload.correlationTrigger || 'initial-source',
          idempotencyKey: job.jobId,
        },
        {
          timeout: 120_000,
          headers: { Authorization: `Bearer ${process.env.PRIVATE_SOURCE_INDEX_TOKEN}` },
          validateStatus: () => true,
        },
      );

      if (provider.status !== 200 || provider.data?.ok !== true) {
        throw new Error(`private memory index provider failed with status ${provider.status}`);
      }

      const memoryIndexRef = String(provider.data?.memoryIndexRef || '');
      const entityGraphRef = String(provider.data?.entityGraphRef || '');
      const temporalIndexRef = String(provider.data?.temporalIndexRef || '');
      const placeIndexRef = String(provider.data?.placeIndexRef || '');
      const conflictSetRef = String(provider.data?.conflictSetRef || '');
      const sceneTruthRef = String(provider.data?.sceneTruthRef || '');
      const provenanceRef = String(provider.data?.provenanceRef || '');
      const checksum = String(provider.data?.checksum || '');
      const lifeModelSchemaVersion = String(provider.data?.lifeModelSchemaVersion || '');
      const syntheticOutputMayBecomeHistoricalSource = provider.data?.syntheticOutputMayBecomeHistoricalSource;
      const indexedSourceEvidenceClass = String(provider.data?.sourceEvidenceClass || '');
      const sourceFixityRef = String(provider.data?.sourceFixityRef || '');
      const dependencyGraphRef = String(provider.data?.dependencyGraphRef || '');
      const backlogState = String(provider.data?.backlogState || '');
      const correlationRevision = Number(provider.data?.correlationRevision);
      const correlationTrigger = String(provider.data?.correlationTrigger || '');
      const terminalBacklogStates = new Set(['INDEXED', 'DUPLICATE', 'CONFLICTED']);
      const refs = [memoryIndexRef, entityGraphRef, temporalIndexRef, placeIndexRef, conflictSetRef, sceneTruthRef, provenanceRef, sourceFixityRef, dependencyGraphRef];
      if (refs.some((ref) => !PRIVATE_REF.test(ref)) || !SHA256.test(checksum)) {
        throw new Error('memory index provider response is missing private refs or integrity checksum');
      }
      if (lifeModelSchemaVersion !== 'urai-life-model-v1') {
        throw new Error('memory index provider returned an unsupported life model schema');
      }
      if (syntheticOutputMayBecomeHistoricalSource !== false) {
        throw new Error('memory index provider did not prove the synthetic-memory firewall');
      }
      if (indexedSourceEvidenceClass !== sourceEvidenceClass) {
        throw new Error('memory index provider source evidence class does not match source authority');
      }
      if (!terminalBacklogStates.has(backlogState)) {
        throw new Error('memory index provider returned a non-terminal backlog state as success');
      }
      if (!Number.isInteger(correlationRevision) || correlationRevision < 1) {
        throw new Error('memory index provider did not return a valid correlation revision');
      }
      if (!['initial-source', 'new-source', 'correction', 'stronger-source'].includes(correlationTrigger)) {
        throw new Error('memory index provider did not return a valid correlation trigger');
      }
      if (correlationTrigger !== (job.payload.correlationTrigger || 'initial-source')) {
        throw new Error('memory index provider correlation trigger does not match the requested recorrelation cause');
      }

      return res.status(200).send({
        ok: true,
        jobId: job.jobId,
        jobType: job.jobType,
        result: {
          memoryIndexRef,
          entityGraphRef,
          temporalIndexRef,
          placeIndexRef,
          conflictSetRef,
          sceneTruthRef,
          provenanceRef,
          checksum,
          lifeModelSchemaVersion,
          syntheticOutputMayBecomeHistoricalSource: false,
          sourceEvidenceClass: sourceEvidenceClass as LifeModelEvidenceClass,
          sourceFixityRef,
          dependencyGraphRef,
          backlogState,
          correlationRevision,
          correlationTrigger,
          requestedPurpose: 'memory-index',
        },
      });
    }

    const transcribeUrl = httpsUrl('PRIVATE_SOURCE_TRANSCRIBE_URL');
    const provider = await axios.post(
      transcribeUrl,
      {
        sourceHandle,
        sourceEvidenceClass,
        requestedPurpose: job.payload.requestedPurpose,
        locale: job.payload.locale,
        idempotencyKey: job.jobId,
      },
      {
        timeout: 120_000,
        headers: { Authorization: `Bearer ${process.env.PRIVATE_SOURCE_TRANSCRIBE_TOKEN}` },
        validateStatus: () => true,
      },
    );

    if (provider.status !== 200 || provider.data?.ok !== true) {
      throw new Error(`private transcription provider failed with status ${provider.status}`);
    }

    const transcriptRef = String(provider.data?.transcriptRef || '');
    const provenanceRef = String(provider.data?.provenanceRef || '');
    const checksum = String(provider.data?.checksum || '');
    if (!PRIVATE_REF.test(transcriptRef) || !PRIVATE_REF.test(provenanceRef) || !SHA256.test(checksum)) {
      throw new Error('provider response is missing private references or integrity checksum');
    }

    return res.status(200).send({
      ok: true,
      jobId: job.jobId,
      jobType: 'memory.private-source.transcribe',
      result: {
        transcriptRef,
        provenanceRef,
        checksum,
        sourceEvidenceClass: sourceEvidenceClass as LifeModelEvidenceClass,
        requestedPurpose: job.payload.requestedPurpose,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'private-source.execution.failed',
      service: 'private-source-worker',
      jobId: job.jobId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return res.status(502).send({ ok: false, error: 'Private-source processing failed.' });
  }
});

app.use((_req, res) => {
  res.status(404).send({ ok: false, error: 'not_found' });
});

app.listen(port, host, () => {
  console.log(JSON.stringify({ event: 'worker.started', service: 'private-source-worker', host, port }));
});
