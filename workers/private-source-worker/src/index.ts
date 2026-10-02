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
};

function validateJob(body: any): { jobId: string; ownerUid: string; payload: PrivatePayload } {
  const jobId = String(body?.jobId || body?.id || '').trim();
  const jobType = String(body?.jobType || body?.type || '').trim();
  const ownerUid = String(body?.ownerUid || '').trim();
  const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};
  const keys = Object.keys(payload).sort();
  const allowed = ['locale', 'requestReceipt', 'requestedPurpose', 'sourceReceiptRef'];

  if (!jobId) throw new Error('jobId is required');
  if (jobType !== 'memory.private-source.transcribe') throw new Error('unsupported private-source job type');
  if (!ownerUid) throw new Error('server-owned ownerUid is required');
  if (keys.some((key) => !allowed.includes(key))) throw new Error('private-source payload contains forbidden fields');
  if (!SOURCE_RECEIPT.test(String(payload.sourceReceiptRef || ''))) throw new Error('invalid opaque sourceReceiptRef');
  if (!['transcribe', 'memory-index'].includes(String(payload.requestedPurpose || ''))) throw new Error('invalid requestedPurpose');
  if (payload.requestReceipt && !REQUEST_RECEIPT.test(String(payload.requestReceipt))) throw new Error('invalid requestReceipt');
  if (payload.locale && !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(String(payload.locale))) throw new Error('invalid locale');

  return {
    jobId,
    ownerUid,
    payload: {
      sourceReceiptRef: String(payload.sourceReceiptRef),
      requestedPurpose: String(payload.requestedPurpose) as PrivatePayload['requestedPurpose'],
      ...(payload.locale ? { locale: String(payload.locale) } : {}),
      ...(payload.requestReceipt ? { requestReceipt: String(payload.requestReceipt) } : {}),
    },
  };
}

function readiness() {
  const checks = {
    workerAuth: Boolean(process.env.URAI_JOBS_WORKER_TOKEN) || !productionRuntime(),
    sourceShaExact: exactSha() || !productionRuntime(),
    runtimeRevision: Boolean(process.env.K_REVISION) || !productionRuntime(),
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

  const state = readiness();
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
      return res.status(403).send({ ok: false, code: 'PRIVATE_SOURCE_NOT_AUTHORIZED', error: 'Private source authorization denied.' });
    }

    const sourceHandle = String(authorization.data?.sourceHandle || '');
    if (!SOURCE_HANDLE.test(sourceHandle)) {
      throw new Error('authority returned an invalid opaque source handle');
    }

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

    return res.status(200).send({
      ok: true,
      jobId: job.jobId,
      jobType: 'memory.private-source.transcribe',
      result: {
        transcriptRef,
        provenanceRef,
        checksum,
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
