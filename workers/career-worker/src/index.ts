import express from 'express';
import { handleJob } from './handlers/index';

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
const token = process.env.URAI_JOBS_WORKER_TOKEN || '';

function requireWorkerAuth(req: express.Request, res: express.Response): boolean {
  if (!token) {
    res.status(503).send({
      ok: false,
      service: 'career-worker',
      error: 'worker auth token is not configured; execution disabled',
      code: 'WORKER_AUTH_NOT_CONFIGURED',
    });
    return false;
  }

  if (req.headers.authorization !== `Bearer ${token}`) {
    res.status(401).send({ ok: false, service: 'career-worker', error: 'unauthorized', code: 'UNAUTHORIZED_WORKER_REQUEST' });
    return false;
  }

  return true;
}

app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.status(200).send({ service: 'career-worker', ok: true, executionReady: Boolean(token), implemented: false });
});

app.get('/healthz', (_req, res) => {
  res.status(200).send({ service: 'career-worker', ok: true, executionReady: Boolean(token), implemented: false });
});

app.post('/execute-job', async (req, res) => {
  if (!requireWorkerAuth(req, res)) return;
  const result = await handleJob(req.body ?? {});
  res.status(501).send(result);
});

app.listen(port, host, () => {
  console.log(JSON.stringify({ event: 'worker.started', service: 'career-worker', host, port, executionReady: Boolean(token), implemented: false }));
});
