import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const TOKEN = process.env.URAI_JOBS_WORKER_TOKEN || '';
const port = process.env.PORT || 8080;

function requireWorkerAuth(req: Request, res: Response): boolean {
  if (!TOKEN) {
    res.status(503).json({
      ok: false,
      service: 'urai-jobs-legacy-worker',
      code: 'WORKER_AUTH_NOT_CONFIGURED',
      error: 'worker auth token is not configured; execution disabled'
    });
    return false;
  }

  const header = req.headers.authorization || '';
  if (header !== `Bearer ${TOKEN}`) {
    res.status(401).json({
      ok: false,
      service: 'urai-jobs-legacy-worker',
      code: 'UNAUTHORIZED_WORKER_REQUEST',
      error: 'unauthorized'
    });
    return false;
  }

  return true;
}

function blockedResponse(req: Request, res: Response) {
  if (!requireWorkerAuth(req, res)) return;

  const jobId = String(req.body?.jobId || req.body?.id || 'unknown-job');
  const jobType = String(req.body?.type || req.body?.jobType || 'unknown-job-type');

  res.status(501).json({
    ok: false,
    service: 'urai-jobs-legacy-worker',
    jobId,
    jobType,
    status: 'NOT_IMPLEMENTED',
    code: 'NOT_IMPLEMENTED',
    error: 'legacy worker execution is disabled until a real implementation and lifecycle proof exist'
  });
}

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'urai-jobs-legacy-worker',
    executionReady: Boolean(TOKEN),
    implemented: false
  });
});

app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'urai-jobs-legacy-worker',
    executionReady: Boolean(TOKEN),
    implemented: false
  });
});

app.post('/', blockedResponse);
app.post('/execute', blockedResponse);
app.post('/execute-job', blockedResponse);

app.listen(port, () => {
  console.log(JSON.stringify({
    event: 'worker.started',
    service: 'urai-jobs-legacy-worker',
    port,
    executionReady: Boolean(TOKEN),
    implemented: false
  }));
});
