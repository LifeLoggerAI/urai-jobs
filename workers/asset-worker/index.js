const crypto = require('node:crypto');
const express = require('express');
const admin = require('firebase-admin');

admin.initializeApp();

const app = express();
app.use(express.json({ limit: '1mb' }));

const db = admin.firestore();
const githubToken = process.env.URAI_WHEEL_GITHUB_TOKEN || '';
const callbackSecret = process.env.URAI_JOBS_CALLBACK_SECRET || '';
const assetFactoryRepo = process.env.ASSET_FACTORY_REPO || 'LifeLoggerAI/asset-factory';
const publicBaseUrl = (process.env.ASSET_WORKER_PUBLIC_URL || '').replace(/\/$/, '');
const allowedTypes = new Set([
  'asset.generate',
  'asset.validate',
  'asset.package',
  'asset.publish',
  'asset.forge.v1',
]);

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

async function githubRequest(path, init = {}) {
  if (!githubToken) throw new Error('URAI_WHEEL_GITHUB_TOKEN is not configured');
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
    const detail = await response.text();
    throw new Error(`GitHub ${response.status}: ${detail.slice(0, 800)}`);
  }
  return response;
}

app.get('/', (_req, res) => {
  res.status(200).send({
    service: 'asset-worker',
    ok: true,
    mode: 'github-production-wheel',
  });
});

app.get('/healthz', (_req, res) => {
  const configured = {
    githubToken: Boolean(githubToken),
    callbackSecret: Boolean(callbackSecret),
    publicBaseUrl: Boolean(publicBaseUrl),
  };
  res.status(Object.values(configured).every(Boolean) ? 200 : 503).send({
    ok: Object.values(configured).every(Boolean),
    configured,
    assetFactoryRepo,
  });
});

app.post('/', async (req, res) => {
  const { jobId, leaseToken } = req.body || {};
  if (!jobId || !leaseToken) {
    return res.status(400).send({ error: 'jobId and leaseToken are required' });
  }

  const jobRef = db.collection('jobs').doc(jobId);
  try {
    const snapshot = await jobRef.get();
    const job = snapshot.exists ? snapshot.data() : null;
    if (!job || job.execution?.leaseToken !== leaseToken) {
      return res.status(403).send({ error: 'Invalid job ID or lease token' });
    }
    if (!allowedTypes.has(job.type)) {
      return res.status(422).send({ error: `Unsupported asset job type: ${job.type}` });
    }
    if (!publicBaseUrl) {
      throw new Error('ASSET_WORKER_PUBLIC_URL is not configured');
    }

    const rounds = Math.max(1, Math.min(5, Number(job.payloadInline?.rounds || 3)));
    const callbackUrl = `${publicBaseUrl}/callback`;
    const correlationId = job.correlationId || jobId;

    await jobRef.update({
      status: 'RUNNING',
      'progress.percent': 10,
      'progress.stage': 'ASSET_FORGE_DISPATCH',
      'progress.message': 'Provider-backed V1 asset forge dispatched',
      'execution.startedAt': serverTimestamp(),
      'execution.heartbeatAt': serverTimestamp(),
      'timestamps.updatedAt': serverTimestamp(),
      'result.summary': 'Awaiting Asset Factory callback',
    });

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

    await db.collection('logs').add({
      jobId,
      rootJobId: job.rootJobId || jobId,
      correlationId,
      tenantId: job.tenantId,
      level: 'INFO',
      source: 'WORKER',
      event: 'ASSET_FORGE_DISPATCHED',
      message: `Dispatched ${job.type} to ${assetFactoryRepo}`,
      context: { rounds, callbackUrl, assetFactoryRepo },
      timestamp: serverTimestamp(),
    });

    return res.status(202).send({
      accepted: true,
      jobId,
      status: 'RUNNING',
      rounds,
      assetFactoryRepo,
    });
  } catch (error) {
    console.error('asset-worker dispatch failed', error);
    await jobRef.set({
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
      'timestamps.updatedAt': serverTimestamp(),
    }, { merge: true });
    return res.status(502).send({ error: String(error?.message || error) });
  }
});

app.post('/callback', async (req, res) => {
  if (!timingSafeEqual(bearer(req), callbackSecret)) {
    return res.status(403).send({ error: 'Invalid callback authorization' });
  }

  const { jobId, status, summary, spatialSha, assetFactoryRun } = req.body || {};
  if (!jobId || !['SUCCESS', 'FAILED'].includes(status)) {
    return res.status(400).send({ error: 'jobId and SUCCESS|FAILED status are required' });
  }

  const jobRef = db.collection('jobs').doc(jobId);
  const snapshot = await jobRef.get();
  if (!snapshot.exists) {
    return res.status(404).send({ error: 'Job not found' });
  }
  const job = snapshot.data();
  const producedAt = admin.firestore.Timestamp.now();
  const resultRef = db.collection('jobResults').doc();
  const success = status === 'SUCCESS';
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

  await resultRef.set({
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
  });

  const update = {
    status: success ? 'SUCCESS' : 'FAILED',
    'progress.percent': 100,
    'progress.stage': success ? 'PROMOTED' : 'FAILED',
    'progress.message': summary || `V1 asset forge ${status.toLowerCase()}`,
    'execution.completedAt': serverTimestamp(),
    'execution.heartbeatAt': serverTimestamp(),
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
  }
  await jobRef.update(update);

  res.status(200).send({ success: true, jobId, resultId: resultRef.id });
});

const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  console.log(`asset-worker listening on ${host}:${port}`);
});
