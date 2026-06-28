import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { handleJob } from './handlers/index.js';
import { ConcurrencyGovernor } from './concurrency-governor.js';
import { logStructured } from './structured-logger.js';
import {
  asyncHandler,
  emitMetric,
  errorMiddleware,
  getHost,
  getPort,
  requestIdMiddleware,
  RuntimeRequest,
  validateRequiredEnv,
} from './runtime.js';

validateRequiredEnv([]);

const app = express();
const TOKEN = process.env.URAI_JOBS_WORKER_TOKEN || '';
const governor = new ConcurrencyGovernor({
  maxConcurrentJobs: Number(process.env.WORKER_MAX_CONCURRENT_JOBS || 8),
  saturationThreshold: Number(process.env.WORKER_SATURATION_THRESHOLD || 0.9),
});

function requireWorkerAuth(req: RuntimeRequest, res: any): boolean {
  if (!TOKEN) {
    res.status(503).send({
      ok: false,
      error: 'worker auth token is not configured; execution disabled',
      code: 'WORKER_AUTH_NOT_CONFIGURED',
    });
    return false;
  }

  const header = req.headers.authorization || '';
  if (header !== `Bearer ${TOKEN}`) {
    res.status(401).send({ ok: false, error: 'unauthorized', code: 'UNAUTHORIZED_WORKER_REQUEST' });
    return false;
  }

  return true;
}

app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware);

app.get('/', (_req: any, res: any) => {
  res.status(200).send({ service: 'narrator-worker', ok: true, executionReady: Boolean(TOKEN) });
});

app.get('/healthz', (_req: any, res: any) => {
  res.status(200).send({ ok: true, executionReady: Boolean(TOKEN), governor: governor.getStats() });
});

app.post('/execute-job', asyncHandler(async (req: RuntimeRequest, res: any) => {
  if (!requireWorkerAuth(req, res)) return;

  const jobId = req.body?.jobId || req.body?.id;
  const jobType = req.body?.type || req.body?.jobType;
  const requestId = req.requestId;

  if (!governor.canAcceptJob()) {
    const stats = governor.getStats();

    emitMetric('worker_saturation_rejections_total', 1, {
      jobId,
      jobType,
      requestId,
      ...stats,
    });

    logStructured({
      severity: 'WARN',
      event: 'worker.saturated',
      requestId,
      jobId,
      jobType,
      workerName: 'narrator-worker',
      metadata: stats,
    });

    res.status(429).send({
      error: 'Worker saturated.',
      requestId,
      retryAfterSeconds: 30,
    });
    return;
  }

  governor.acquire();
  const startedAt = Date.now();

  logStructured({
    severity: 'INFO',
    event: 'job.execution.started',
    requestId,
    jobId,
    jobType,
    workerName: 'narrator-worker',
    metadata: governor.getStats(),
  });

  try {
    const result = await handleJob(req.body);

    emitMetric('job_execution_duration_ms', Date.now() - startedAt, {
      jobId,
      jobType,
      requestId,
    });

    logStructured({
      severity: 'INFO',
      event: 'job.execution.completed',
      requestId,
      jobId,
      jobType,
      workerName: 'narrator-worker',
      metadata: {
        durationMs: Date.now() - startedAt,
        governor: governor.getStats(),
      },
    });

    res.status(200).send(result);
  } catch (error) {
    emitMetric('job_execution_failures_total', 1, {
      jobId,
      jobType,
      requestId,
    });

    logStructured({
      severity: 'ERROR',
      event: 'job.execution.failed',
      requestId,
      jobId,
      jobType,
      workerName: 'narrator-worker',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
        governor: governor.getStats(),
      },
    });

    throw error;
  } finally {
    governor.release();
    emitMetric('worker_saturation', governor.getSaturation(), {
      workerName: 'narrator-worker',
      requestId,
    });
  }
}));

app.use(errorMiddleware);

const port = getPort();
const host = getHost();

app.listen(port, host, () => {
  logStructured({
    severity: 'INFO',
    event: 'worker.started',
    workerName: 'narrator-worker',
    metadata: {
      host,
      port,
      executionReady: Boolean(TOKEN),
      governor: governor.getStats(),
    },
  });
});
