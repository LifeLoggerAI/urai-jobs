const crypto = require('node:crypto');
const express = require('express');
const admin = require('firebase-admin');

admin.initializeApp();

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

const db = admin.firestore();
const workerToken = process.env.URAI_JOBS_WORKER_TOKEN || '';
const githubToken = process.env.URAI_WHEEL_GITHUB_TOKEN || '';
const callbackSecret = process.env.URAI_JOBS_CALLBACK_SECRET || '';
const assetFactoryRepo = process.env.ASSET_FACTORY_REPO || 'LifeLoggerAI/asset-factory';
const configuredPublicBaseUrl = (process.env.ASSET_WORKER_PUBLIC_URL || '').replace(/\/$/, '');
const runtimeEnv = String(process.env.URAI_ENV || process.env.NODE_ENV || 'local').toLowerCase();
const sourceSha = String(process.env.URAI_SOURCE_SHA || '');
const productionRuntime = ['prod', 'production', 'staging'].includes(runtimeEnv);
const configuredCallbackTimeoutMs = Number(process.env.ASSET_CALLBACK_TIMEOUT_MS || 6 * 60 * 60 * 1000);
const callbackTimeoutMs = Math.max(15 * 60 * 1000, Math.min(24 * 60 * 60 * 1000, configuredCallbackTimeoutMs));
const allowedTypes = new Set([
  'asset.generate',
  'asset.validate',
  'asset.package',
  'asset.publish',
  'asset.forge.v1',
]);

class CallbackRejected extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

class GithubDispatchRejected extends Error {}

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function bearer(req) {
  const value = req.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function timingSafeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function timestampMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
}

function requireWorkerAuth(req, res, next) {
  const localBypass = runtimeEnv === 'local' || runtimeEnv === 'test' || process.env.FUNCTIONS_EMULATOR === 'true';
  if (!workerToken && localBypass) return next();
  if (!workerToken) return res.status(503).send({ ok: false, error: 'worker auth is not configured' });
  if (!timingSafeEqual(bearer(req), workerToken)) {
    return res.status(401).send({ ok: false, error: 'unauthorized' });
  }
  return next();
}

function validateProductionConfiguration() {
  if (!productionRuntime) return;
  const required = {
    URAI_JOBS_WORKER_TOKEN: workerToken,
    URAI_WHEEL_GITHUB_TOKEN: githubToken,
    URAI_JOBS_CALLBACK_SECRET: callbackSecret,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

function publicBaseUrl(req) {
  if (configuredPublicBaseUrl) return configuredPublicBaseUrl;
  const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) throw new Error('Could not determine public worker host for callback');
  return `${protocol}://${host}`.replace(/\/$/, '');
}

async function githubRequest(path, init = {}) {
  if (!githubToken) throw new GithubDispatchRejected('URAI_WHEEL_GITHUB_TOKEN is not configured');
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'urai-jobs-asset-worker',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    let detail = '<response body unavailable>';
    try {
      detail = await response.text();
    } catch (error) {
      console.warn('Could not read definitive GitHub rejection body', error);
    }
    throw new GithubDispatchRejected(`GitHub ${response.status}: ${detail.slice(0, 800)}`);
  }
  return response;
}

validateProductionConfiguration();

app.get('/', (_req, res) => {
  res.status(200).send({
    service: 'asset-worker',
    ok: true,
    mode: 'github-production-wheel',
    sourceSha,
  });
});

app.get('/healthz', (_req, res) => {
  const configured = {
    workerToken: Boolean(workerToken),
    githubToken: Boolean(githubToken),
    callbackSecret: Boolean(callbackSecret),
  };
  const ok = productionRuntime ? Object.values(configured).every(Boolean) : true;
  res.status(ok ? 200 : 503).send({
    ok,
    sourceSha,
    configured,
    runtimeEnv,
    assetFactoryRepo,
    callbackUrlMode: configuredPublicBaseUrl ? 'configured' : 'request-derived',
    callbackTimeoutMs,
  });
});

app.get('/authz', requireWorkerAuth, (_req, res) => {
  res.status(200).send({ ok: true, service: 'asset-worker', authorized: true });
});

app.post('/', requireWorkerAuth, async (req, res) => {
  const { jobId, leaseToken } = req.body || {};
  if (!jobId || !leaseToken) {
    return res.status(400).send({ error: 'jobId and leaseToken are required' });
  }

  const jobRef = db.collection('jobs').doc(jobId);
  const queueRef = db.collection('jobQueue').doc(jobId);
  const callbackToken = crypto.randomBytes(32).toString('hex');
  const callbackTokenHash = sha256(callbackToken);
  const callbackDeadlineAt = admin.firestore.Timestamp.fromMillis(Date.now() + callbackTimeoutMs);
  const callbackUrl = `${publicBaseUrl(req)}/callback?callbackToken=${encodeURIComponent(callbackToken)}`;
  let dispatchAttempted = false;
  let dispatchAccepted = false;

  try {
    const job = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(jobRef);
      const current = snapshot.exists ? snapshot.data() : null;
      if (!current || current.execution?.leaseToken !== leaseToken) {
        throw new CallbackRejected(403, 'Invalid job ID or lease token');
      }
      if (current.status !== 'RUNNING') {
        throw new CallbackRejected(409, 'Job is not in the active RUNNING state');
      }
      if (!allowedTypes.has(current.type)) {
        throw new CallbackRejected(422, `Unsupported asset job type: ${current.type}`);
      }

      transaction.update(jobRef, {
        'progress.percent': 10,
        'progress.stage': 'ASSET_FORGE_DISPATCH',
        'progress.message': 'Provider-backed V1 asset forge dispatched',
        'execution.startedAt': current.execution?.startedAt || serverTimestamp(),
        'execution.heartbeatAt': serverTimestamp(),
        'execution.asyncCallbackPending': true,
        'execution.callbackTokenHash': callbackTokenHash,
        'execution.callbackLeaseToken': leaseToken,
        'execution.callbackDeadlineAt': callbackDeadlineAt,
        'lease.heartbeatAt': serverTimestamp(),
        'timestamps.updatedAt': serverTimestamp(),
        'result.summary': 'Awaiting Asset Factory callback',
      });
      transaction.set(queueRef, {
        jobId,
        status: 'RUNNING',
        'lease.heartbeatAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return current;
    });

    const payload = job.payload && typeof job.payload === 'object'
      ? job.payload
      : (job.payloadInline && typeof job.payloadInline === 'object' ? job.payloadInline : {});
    const rounds = Math.max(1, Math.min(5, Number(payload.rounds || 3)));
    const correlationId = job.correlationId || jobId;

    dispatchAttempted = true;
    await githubRequest(`/repos/${assetFactoryRepo}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'urai-v1-forge-requested',
        client_payload: {
          job_id: jobId,
          correlation_id: correlationId,
          operation: job.type,
          rounds: String(rounds),
          callback_url: callbackUrl,
        },
      }),
    });
    dispatchAccepted = true;

    await db.collection('logs').add({
      jobId,
      rootJobId: job.rootJobId || jobId,
      correlationId,
      tenantId: job.tenantId,
      level: 'INFO',
      source: 'WORKER',
      event: 'ASSET_FORGE_DISPATCHED',
      message: `Dispatched ${job.type} to ${assetFactoryRepo}`,
      context: {
        rounds,
        assetFactoryRepo,
        callbackDeadlineAt: callbackDeadlineAt.toDate().toISOString(),
        callbackLeaseBound: true,
      },
      timestamp: serverTimestamp(),
    });

    return res.status(202).send({
      accepted: true,
      jobId,
      status: 'RUNNING',
      rounds,
      assetFactoryRepo,
      callbackDeadlineAt: callbackDeadlineAt.toDate().toISOString(),
    });
  } catch (error) {
    if (error instanceof CallbackRejected) {
      return res.status(error.statusCode).send({ error: error.message });
    }

    const dispatchAcceptanceIsAmbiguous = dispatchAttempted && !(error instanceof GithubDispatchRejected);
    if (dispatchAccepted || dispatchAcceptanceIsAmbiguous) {
      console.error('asset-worker dispatch may have been accepted; callback authority preserved', error);
      return res.status(202).send({
        accepted: true,
        jobId,
        status: 'RUNNING',
        callbackPending: true,
        callbackDeadlineAt: callbackDeadlineAt.toDate().toISOString(),
        warning: 'Asset Factory accepted the dispatch; callback authority remains active.',
      });
    }

    console.error('asset-worker dispatch failed', error);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(jobRef);
      if (!snapshot.exists) return;
      const current = snapshot.data();
      if (
        current.execution?.leaseToken !== leaseToken ||
        current.execution?.callbackTokenHash !== callbackTokenHash
      ) return;
      transaction.update(jobRef, {
        status: 'FAILED',
        error: {
          code: 'ASSET_FORGE_DISPATCH_FAILED',
          category: 'DEPENDENCY',
          message: String(error?.message || error),
          lastFailedAt: serverTimestamp(),
          lastFailedBy: 'asset-worker',
        },
        'progress.stage': 'FAILED',
        'progress.message': 'Asset forge dispatch failed',
        'execution.asyncCallbackPending': false,
        'execution.callbackTokenHash': admin.firestore.FieldValue.delete(),
        'execution.callbackLeaseToken': admin.firestore.FieldValue.delete(),
        'execution.callbackDeadlineAt': admin.firestore.FieldValue.delete(),
        'execution.completedAt': serverTimestamp(),
        'timestamps.updatedAt': serverTimestamp(),
      });
      transaction.set(queueRef, {
        jobId,
        status: 'DONE',
        lease: admin.firestore.FieldValue.delete(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    return res.status(502).send({ error: String(error?.message || error) });
  }
});

app.post('/callback', async (req, res) => {
  if (!timingSafeEqual(bearer(req), callbackSecret)) {
    return res.status(403).send({ error: 'Invalid callback authorization' });
  }

  const callbackToken = typeof req.query.callbackToken === 'string' ? req.query.callbackToken : '';
  if (!callbackToken) {
    return res.status(400).send({ error: 'callbackToken is required' });
  }

  const { jobId, status, summary, spatialSha, assetFactoryRun } = req.body || {};
  if (!jobId || !['SUCCESS', 'FAILED'].includes(status)) {
    return res.status(400).send({ error: 'jobId and SUCCESS|FAILED status are required' });
  }

  const jobRef = db.collection('jobs').doc(jobId);
  const queueRef = db.collection('jobQueue').doc(jobId);
  const resultRef = db.collection('jobResults').doc();
  const producedAt = admin.firestore.Timestamp.now();
  const success = status === 'SUCCESS';

  try {
    const callbackResult = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(jobRef);
      if (!snapshot.exists) throw new CallbackRejected(404, 'Job not found');
      const job = snapshot.data();
      const execution = job.execution || {};
      const presentedCallbackTokenHash = sha256(callbackToken);
      const expectedTokenHash = String(execution.callbackTokenHash || '');
      const completedCallbackTokenHash = String(execution.completedCallbackTokenHash || '');
      const callbackLeaseToken = String(execution.callbackLeaseToken || '');
      const activeLeaseToken = String(execution.leaseToken || '');
      const callbackDeadlineMillis = timestampMillis(execution.callbackDeadlineAt);

      // A provider can retry after Firestore commits but before it receives the
      // HTTP response. Retain one bounded consumed-attempt receipt on the job so
      // the same token deterministically returns the original result.
      if (
        completedCallbackTokenHash &&
        timingSafeEqual(presentedCallbackTokenHash, completedCallbackTokenHash)
      ) {
        return {
          duplicate: true,
          resultId: String(execution.completedCallbackResultId || ''),
          status: String(execution.completedCallbackStatus || ''),
        };
      }

      if (!timingSafeEqual(presentedCallbackTokenHash, expectedTokenHash)) {
        throw new CallbackRejected(403, 'Invalid callback token');
      }
      if (
        job.status !== 'RUNNING' ||
        execution.asyncCallbackPending !== true ||
        !callbackLeaseToken ||
        callbackLeaseToken !== activeLeaseToken
      ) {
        throw new CallbackRejected(409, 'Callback no longer owns the active job attempt');
      }
      if (!callbackDeadlineMillis || callbackDeadlineMillis <= Date.now()) {
        throw new CallbackRejected(409, 'Callback deadline expired');
      }

      const outputs = [];
      if (spatialSha) {
        outputs.push({
          kind: 'GIT_COMMIT',
          ref: `https://github.com/LifeLoggerAI/urai-spatial/commit/${spatialSha}`,
        });
      }
      if (assetFactoryRun) {
        outputs.push({
          kind: 'GITHUB_ACTIONS_RUN',
          ref: `https://github.com/${assetFactoryRepo}/actions/runs/${assetFactoryRun}`,
        });
      }

      transaction.set(resultRef, {
        jobId,
        rootJobId: job.rootJobId || jobId,
        correlationId: job.correlationId || jobId,
        tenantId: job.tenantId,
        type: job.type,
        status: success ? 'SUCCESS' : 'FAILED',
        producedAt,
        durationMs: job.execution?.startedAt?.toMillis
          ? Math.max(0, producedAt.toMillis() - job.execution.startedAt.toMillis())
          : 0,
        outputs,
        summary: summary || `V1 asset forge ${status.toLowerCase()}`,
        callbackLeaseTokenHash: sha256(callbackLeaseToken),
      });

      const update = {
        status: success ? 'SUCCESS' : 'FAILED',
        lease: admin.firestore.FieldValue.delete(),
        'progress.percent': 100,
        'progress.stage': success ? 'PROMOTED' : 'FAILED',
        'progress.message': summary || `V1 asset forge ${status.toLowerCase()}`,
        'execution.completedAt': serverTimestamp(),
        'execution.heartbeatAt': serverTimestamp(),
        'execution.asyncCallbackPending': false,
        'execution.callbackTokenHash': admin.firestore.FieldValue.delete(),
        'execution.callbackLeaseToken': admin.firestore.FieldValue.delete(),
        'execution.callbackDeadlineAt': admin.firestore.FieldValue.delete(),
        'execution.completedCallbackTokenHash': presentedCallbackTokenHash,
        'execution.completedCallbackResultId': resultRef.id,
        'execution.completedCallbackStatus': success ? 'SUCCESS' : 'FAILED',
        'execution.completedCallbackAt': serverTimestamp(),
        'timestamps.updatedAt': serverTimestamp(),
        'result.resultId': resultRef.id,
        'result.outputRefs': outputs.map((output) => output.ref),
        'result.summary': summary || `V1 asset forge ${status.toLowerCase()}`,
      };
      if (!success) {
        update.error = {
          code: 'ASSET_FORGE_FAILED',
          category: 'INTERNAL',
          message: summary || 'Asset Factory workflow failed',
          lastFailedAt: serverTimestamp(),
          lastFailedBy: 'asset-factory-workflow',
        };
      } else {
        update.error = admin.firestore.FieldValue.delete();
      }

      transaction.update(jobRef, update);
      transaction.set(queueRef, {
        jobId,
        status: 'DONE',
        lease: admin.firestore.FieldValue.delete(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return { duplicate: false, resultId: resultRef.id, status };
    });

    return res.status(200).send({
      success: true,
      jobId,
      resultId: callbackResult.resultId,
      status: callbackResult.status,
      duplicate: callbackResult.duplicate,
    });
  } catch (error) {
    if (error instanceof CallbackRejected) {
      return res.status(error.statusCode).send({ error: error.message });
    }
    console.error('asset-worker callback failed', error);
    return res.status(500).send({ error: 'Callback processing failed' });
  }
});

const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  console.log(`asset-worker listening on ${host}:${port}`);
});
