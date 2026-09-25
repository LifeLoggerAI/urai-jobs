import crypto from 'node:crypto';
import axios from 'axios';
import express, { type NextFunction, type Request, type Response } from 'express';

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
const SOURCE_RECEIPT = /^psr_[A-Za-z0-9_-]{16,128}$/;
const REQUEST_RECEIPT = /^req_[A-Za-z0-9_-]{12,128}$/;
const IMPORT_REQUEST = /^hir_[A-Za-z0-9_-]{16,128}$/;
const PREVIEW_RECEIPT = /^ghp_[A-Za-z0-9_-]{16,128}$/;
const SOURCE_HANDLE = /^psh_[A-Za-z0-9_-]{16,256}$/;
const IMPORT_HANDLE = /^hih_[A-Za-z0-9_-]{16,256}$/;
const PRIVATE_REF = /^private:[A-Za-z0-9_./:-]{8,512}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const HISTORICAL_CATEGORIES = new Set(['gmail', 'calendar', 'contacts', 'drive-selected']);

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

type TranscribePayload = {
  sourceReceiptRef: string;
  requestedPurpose: 'transcribe' | 'memory-index';
  locale?: string;
  requestReceipt?: string;
};

type HistoricalImportPayload = {
  importRequestRef: string;
  provider: 'google-workspace';
  categories: Array<'gmail' | 'calendar' | 'contacts' | 'drive-selected'>;
  historyDays: number;
  previewReceiptRef?: string;
};

type ValidatedJob =
  | {
      kind: 'transcribe';
      jobId: string;
      ownerUid: string;
      jobType: 'memory.private-source.transcribe';
      payload: TranscribePayload;
    }
  | {
      kind: 'historical-import';
      jobId: string;
      ownerUid: string;
      jobType: 'memory.historical-context.import';
      payload: HistoricalImportPayload;
    };

function baseJob(body: any) {
  const jobId = String(body?.jobId || body?.id || '').trim();
  const jobType = String(body?.jobType || body?.type || '').trim();
  const ownerUid = String(body?.ownerUid || '').trim();
  const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};
  if (!jobId) throw new Error('jobId is required');
  if (!ownerUid) throw new Error('server-owned ownerUid is required');
  return { jobId, jobType, ownerUid, payload };
}

function validateJob(body: any): ValidatedJob {
  const base = baseJob(body);

  if (base.jobType === 'memory.private-source.transcribe') {
    const keys = Object.keys(base.payload).sort();
    const allowed = ['locale', 'requestReceipt', 'requestedPurpose', 'sourceReceiptRef'];
    if (keys.some((key) => !allowed.includes(key))) throw new Error('private-source payload contains forbidden fields');
    if (!SOURCE_RECEIPT.test(String(base.payload.sourceReceiptRef || ''))) throw new Error('invalid opaque sourceReceiptRef');
    if (!['transcribe', 'memory-index'].includes(String(base.payload.requestedPurpose || ''))) throw new Error('invalid requestedPurpose');
    if (base.payload.requestReceipt && !REQUEST_RECEIPT.test(String(base.payload.requestReceipt))) throw new Error('invalid requestReceipt');
    if (base.payload.locale && !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(String(base.payload.locale))) throw new Error('invalid locale');
    return {
      kind: 'transcribe',
      jobId: base.jobId,
      ownerUid: base.ownerUid,
      jobType: 'memory.private-source.transcribe',
      payload: {
        sourceReceiptRef: String(base.payload.sourceReceiptRef),
        requestedPurpose: String(base.payload.requestedPurpose) as TranscribePayload['requestedPurpose'],
        ...(base.payload.locale ? { locale: String(base.payload.locale) } : {}),
        ...(base.payload.requestReceipt ? { requestReceipt: String(base.payload.requestReceipt) } : {}),
      },
    };
  }

  if (base.jobType === 'memory.historical-context.import') {
    const keys = Object.keys(base.payload).sort();
    const allowed = ['categories', 'historyDays', 'importRequestRef', 'previewReceiptRef', 'provider'];
    if (keys.some((key) => !allowed.includes(key))) throw new Error('historical-context payload contains forbidden fields');
    if (!IMPORT_REQUEST.test(String(base.payload.importRequestRef || ''))) throw new Error('invalid opaque importRequestRef');
    if (String(base.payload.provider || '') !== 'google-workspace') throw new Error('unsupported historical-context provider');
    const rawCategories = Array.isArray(base.payload.categories) ? base.payload.categories.map(String) : [];
    if (rawCategories.length < 1 || rawCategories.length > 4) throw new Error('historical-context categories must contain 1 to 4 entries');
    if (new Set(rawCategories).size !== rawCategories.length) throw new Error('historical-context categories must be unique');
    if (rawCategories.some((category) => !HISTORICAL_CATEGORIES.has(category))) throw new Error('unsupported historical-context category');
    const historyDays = Number(base.payload.historyDays);
    if (!Number.isInteger(historyDays) || historyDays < 30 || historyDays > 3650) throw new Error('historical-context historyDays must be between 30 and 3650');
    if (base.payload.previewReceiptRef && !PREVIEW_RECEIPT.test(String(base.payload.previewReceiptRef))) throw new Error('invalid previewReceiptRef');
    return {
      kind: 'historical-import',
      jobId: base.jobId,
      ownerUid: base.ownerUid,
      jobType: 'memory.historical-context.import',
      payload: {
        importRequestRef: String(base.payload.importRequestRef),
        provider: 'google-workspace',
        categories: rawCategories as HistoricalImportPayload['categories'],
        historyDays,
        ...(base.payload.previewReceiptRef ? { previewReceiptRef: String(base.payload.previewReceiptRef) } : {}),
      },
    };
  }

  throw new Error('unsupported private-source job type');
}

function commonReadiness() {
  return {
    workerAuth: Boolean(process.env.URAI_JOBS_WORKER_TOKEN) || !productionRuntime(),
    sourceShaExact: exactSha() || !productionRuntime(),
    runtimeRevision: Boolean(process.env.K_REVISION) || !productionRuntime(),
  };
}

function readiness(jobType?: string) {
  const common = commonReadiness();
  if (jobType === 'memory.historical-context.import') {
    const checks = {
      ...common,
      historicalAuthorityUrl: Boolean(process.env.HISTORICAL_CONTEXT_AUTHORITY_URL),
      historicalAuthorityToken: Boolean(process.env.HISTORICAL_CONTEXT_AUTHORITY_TOKEN),
      historicalImportUrl: Boolean(process.env.HISTORICAL_CONTEXT_IMPORT_URL),
      historicalImportToken: Boolean(process.env.HISTORICAL_CONTEXT_IMPORT_TOKEN),
    };
    return { checks, ok: Object.values(checks).every(Boolean) };
  }
  const checks = {
    ...common,
    authorityUrl: Boolean(process.env.PRIVATE_SOURCE_AUTHORITY_URL),
    authorityToken: Boolean(process.env.PRIVATE_SOURCE_AUTHORITY_TOKEN),
    transcribeUrl: Boolean(process.env.PRIVATE_SOURCE_TRANSCRIBE_URL),
    transcribeToken: Boolean(process.env.PRIVATE_SOURCE_TRANSCRIBE_TOKEN),
  };
  return { checks, ok: Object.values(checks).every(Boolean) };
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
  const transcribe = readiness('memory.private-source.transcribe');
  const historicalImport = readiness('memory.historical-context.import');
  const ok = transcribe.ok || historicalImport.ok;
  res.set('Cache-Control', 'no-store');
  res.status(ok ? 200 : 503).send({
    ok,
    service: 'private-source-worker',
    sourceSha: String(process.env.URAI_SOURCE_SHA || ''),
    lanes: {
      transcribe: transcribe.checks,
      historicalImport: historicalImport.checks,
    },
  });
});

app.get('/authz', requireWorkerAuth, (_req, res) => {
  res.status(200).send({ ok: true, service: 'private-source-worker', authorized: true });
});

async function executeTranscription(job: Extract<ValidatedJob, { kind: 'transcribe' }>) {
  const authorityUrl = httpsUrl('PRIVATE_SOURCE_AUTHORITY_URL');
  const transcribeUrl = httpsUrl('PRIVATE_SOURCE_TRANSCRIBE_URL');

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
    return { denied: true as const };
  }

  const sourceHandle = String(authorization.data?.sourceHandle || '');
  if (!SOURCE_HANDLE.test(sourceHandle)) throw new Error('authority returned an invalid opaque source handle');

  const provider = await axios.post(
    transcribeUrl,
    {
      sourceHandle,
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

  return {
    denied: false as const,
    result: {
      transcriptRef,
      provenanceRef,
      checksum,
      requestedPurpose: job.payload.requestedPurpose,
    },
  };
}

async function executeHistoricalImport(job: Extract<ValidatedJob, { kind: 'historical-import' }>) {
  const authorityUrl = httpsUrl('HISTORICAL_CONTEXT_AUTHORITY_URL');
  const importUrl = httpsUrl('HISTORICAL_CONTEXT_IMPORT_URL');

  const authorization = await axios.post(
    `${authorityUrl}/authorize`,
    {
      importRequestRef: job.payload.importRequestRef,
      ownerUid: job.ownerUid,
      provider: job.payload.provider,
      categories: job.payload.categories,
      historyDays: job.payload.historyDays,
      previewReceiptRef: job.payload.previewReceiptRef,
      requestedPurpose: 'historical-context-import',
    },
    {
      timeout: 15_000,
      headers: { Authorization: `Bearer ${process.env.HISTORICAL_CONTEXT_AUTHORITY_TOKEN}` },
      validateStatus: () => true,
    },
  );

  if (authorization.status !== 200 || authorization.data?.authorized !== true) {
    return { denied: true as const };
  }

  const importHandle = String(authorization.data?.importHandle || '');
  if (!IMPORT_HANDLE.test(importHandle)) throw new Error('authority returned an invalid opaque historical import handle');

  const provider = await axios.post(
    importUrl,
    {
      importHandle,
      provider: job.payload.provider,
      categories: job.payload.categories,
      historyDays: job.payload.historyDays,
      idempotencyKey: job.jobId,
    },
    {
      timeout: 120_000,
      headers: { Authorization: `Bearer ${process.env.HISTORICAL_CONTEXT_IMPORT_TOKEN}` },
      validateStatus: () => true,
    },
  );

  if (provider.status !== 200 || provider.data?.ok !== true) {
    throw new Error(`historical-context import provider failed with status ${provider.status}`);
  }

  const sourceBatchRef = String(provider.data?.sourceBatchRef || '');
  const provenanceRef = String(provider.data?.provenanceRef || '');
  const checksum = String(provider.data?.checksum || '');
  const importedItemCount = Number(provider.data?.importedItemCount);
  if (
    !PRIVATE_REF.test(sourceBatchRef) ||
    !PRIVATE_REF.test(provenanceRef) ||
    !SHA256.test(checksum) ||
    !Number.isSafeInteger(importedItemCount) ||
    importedItemCount < 0
  ) {
    throw new Error('historical-context provider response is missing private references, item count, or integrity checksum');
  }

  return {
    denied: false as const,
    result: {
      sourceBatchRef,
      provenanceRef,
      checksum,
      importedItemCount,
      provider: job.payload.provider,
      categories: job.payload.categories,
      historyDays: job.payload.historyDays,
      admittedToMemory: false,
      admittedToModels: false,
    },
  };
}

app.post('/execute-job', requireWorkerAuth, async (req, res) => {
  let job: ValidatedJob;
  try {
    job = validateJob(req.body);
  } catch (error) {
    return res.status(400).send({ ok: false, error: error instanceof Error ? error.message : 'invalid job' });
  }

  const state = readiness(job.jobType);
  if (!state.ok) {
    return res.status(503).send({
      ok: false,
      code: job.kind === 'historical-import' ? 'HISTORICAL_CONTEXT_WORKER_NOT_READY' : 'PRIVATE_SOURCE_WORKER_NOT_READY',
      error: 'Private-source worker authority/provider bindings are incomplete; refusing synthetic success.',
      checks: state.checks,
    });
  }

  try {
    const outcome = job.kind === 'historical-import'
      ? await executeHistoricalImport(job)
      : await executeTranscription(job);

    if (outcome.denied) {
      return res.status(403).send({
        ok: false,
        code: job.kind === 'historical-import' ? 'HISTORICAL_CONTEXT_NOT_AUTHORIZED' : 'PRIVATE_SOURCE_NOT_AUTHORIZED',
        error: 'Private source authorization denied.',
      });
    }

    return res.status(200).send({
      ok: true,
      jobId: job.jobId,
      jobType: job.jobType,
      result: outcome.result,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'private-source.execution.failed',
      service: 'private-source-worker',
      jobId: job.jobId,
      jobType: job.jobType,
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
