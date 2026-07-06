const express = require('express');

const app = express();
app.use(express.json({ limit: '1mb' }));

function requireWorkerAuth(req, res, next) {
  const expectedToken = process.env.URAI_JOBS_WORKER_TOKEN;
  const env = String(process.env.URAI_ENV || process.env.NODE_ENV || 'local').toLowerCase();
  const localBypass = env === 'local' || env === 'test' || process.env.FUNCTIONS_EMULATOR === 'true';

  if (!expectedToken && localBypass) return next();
  if (!expectedToken) return res.status(503).send({ ok: false, error: 'worker auth is not configured' });
  if ((req.get('authorization') || '') !== `Bearer ${expectedToken}`) {
    return res.status(401).send({ ok: false, error: 'unauthorized' });
  }
  return next();
}

app.get('/', (_req, res) => {
  res.status(200).send({ service: 'studio-worker', ok: true, implementation: 'placeholder-disabled' });
});

app.get('/healthz', (_req, res) => {
  res.status(200).send({
    ok: true,
    service: 'studio-worker',
    implementationReady: false,
    authConfigured: Boolean(process.env.URAI_JOBS_WORKER_TOKEN),
  });
});

app.post('/', requireWorkerAuth, async (req, res) => {
  const { jobId, leaseToken } = req.body || {};
  if (!jobId || !leaseToken) {
    return res.status(400).send({ error: 'jobId and leaseToken are required' });
  }

  return res.status(501).send({
    ok: false,
    code: 'STUDIO_WORKER_NOT_IMPLEMENTED',
    error: 'Studio worker execution is not implemented. Refusing to emit synthetic success.',
    jobId,
  });
});

const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  console.log(`studio-worker listening on ${host}:${port}`);
});
