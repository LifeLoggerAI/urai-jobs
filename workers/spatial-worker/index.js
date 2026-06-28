const express = require('express');

const app = express();
const token = process.env.URAI_JOBS_WORKER_TOKEN || '';

app.use(express.json({ limit: '1mb' }));

function requireWorkerAuth(req, res) {
  if (!token) {
    res.status(503).send({ ok: false, service: 'spatial-worker', code: 'WORKER_AUTH_NOT_CONFIGURED', error: 'worker auth token is not configured; execution disabled' });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${token}`) {
    res.status(401).send({ ok: false, service: 'spatial-worker', code: 'UNAUTHORIZED_WORKER_REQUEST', error: 'unauthorized' });
    return false;
  }
  return true;
}

app.get('/', (_req, res) => {
  res.status(200).send({ service: 'spatial-worker', ok: true, executionReady: Boolean(token), implemented: false });
});

app.get('/healthz', (_req, res) => {
  res.status(200).send({ service: 'spatial-worker', ok: true, executionReady: Boolean(token), implemented: false });
});

app.post('/', async (req, res) => {
  if (!requireWorkerAuth(req, res)) return;
  const jobId = req.body?.jobId || req.body?.id || 'unknown-job';
  const jobType = req.body?.type || req.body?.jobType || 'spatial.index';
  res.status(501).send({ ok: false, service: 'spatial-worker', jobId, jobType, status: 'NOT_IMPLEMENTED', code: 'NOT_IMPLEMENTED', error: 'spatial-worker execution is gated until real implementation and lifecycle proof exist' });
});

const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  console.log(JSON.stringify({ event: 'worker.started', service: 'spatial-worker', host, port, executionReady: Boolean(token), implemented: false }));
});
