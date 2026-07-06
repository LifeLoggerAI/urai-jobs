import express, { type NextFunction, type Request, type Response } from 'express';
import { handleJob } from './handlers/index.js';

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';

app.use(express.json({ limit: '1mb' }));

function runtimeEnv(): string {
  return String(process.env.URAI_ENV || process.env.NODE_ENV || 'local').toLowerCase();
}

function requireWorkerAuth(req: Request, res: Response, next: NextFunction) {
  const expectedToken = process.env.URAI_JOBS_WORKER_TOKEN;
  const env = runtimeEnv();
  const localBypass = env === 'local' || env === 'test' || process.env.FUNCTIONS_EMULATOR === 'true';

  if (!expectedToken && localBypass) return next();
  if (!expectedToken) return res.status(503).send({ ok: false, error: 'worker auth is not configured' });
  if ((req.get('authorization') || '') !== `Bearer ${expectedToken}`) {
    return res.status(401).send({ ok: false, error: 'unauthorized' });
  }
  return next();
}

app.get('/', (_req, res) => {
  res.status(200).send({ service: 'career-worker', ok: true, implementation: 'scaffold' });
});

app.get('/healthz', (_req, res) => {
  res.status(200).send({
    service: 'career-worker',
    ok: true,
    implementationReady: false,
    authConfigured: Boolean(process.env.URAI_JOBS_WORKER_TOKEN),
  });
});

app.post('/execute-job', requireWorkerAuth, async (req, res, next) => {
  try {
    const result = await handleJob(req.body ?? {});
    if (result.status === 'stubbed' && !['local', 'test'].includes(runtimeEnv()) && process.env.FUNCTIONS_EMULATOR !== 'true') {
      return res.status(501).send({
        ok: false,
        code: 'CAREER_WORKER_NOT_IMPLEMENTED',
        error: 'Career worker execution is scaffold-only. Refusing to emit synthetic production success.',
        jobId: result.jobId,
        jobType: result.jobType,
      });
    }
    return res.status(200).send(result);
  } catch (error) {
    return next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(JSON.stringify({
    event: 'worker.request.failed',
    service: 'career-worker',
    error: error instanceof Error ? error.message : String(error),
  }));
  res.status(500).send({ ok: false, error: 'Internal server error.' });
});

app.listen(port, host, () => {
  console.log(JSON.stringify({ event: 'worker.started', service: 'career-worker', host, port }));
});
