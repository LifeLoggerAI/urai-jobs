import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { handleJob } from './handlers/index.js';
import {
  asyncHandler,
  emitMetric,
  errorMiddleware,
  getHost,
  getPort,
  log,
  requestIdMiddleware,
  RuntimeRequest,
  validateRequiredEnv,
} from './runtime.js';

validateRequiredEnv([]);

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware);

app.get('/', (_req: any, res: any) => {
  res.status(200).send({ service: 'narrator-worker', ok: true });
});

app.get('/healthz', (_req: any, res: any) => {
  res.status(200).send({ ok: true });
});

app.post('/execute-job', asyncHandler(async (req: RuntimeRequest, res: any) => {
  const jobId = req.body?.jobId || req.body?.id;
  const requestId = req.requestId;

  log('INFO', 'job_execution_started', {
    jobId,
    requestId,
  });

  const startedAt = Date.now();

  try {
    const result = await handleJob(req.body);

    emitMetric('job_execution_duration_ms', Date.now() - startedAt, {
      jobId,
      requestId,
    });

    log('INFO', 'job_execution_completed', {
      jobId,
      requestId,
    });

    res.status(200).send(result);
  } catch (error) {
    emitMetric('job_execution_failures_total', 1, {
      jobId,
      requestId,
    });

    throw error;
  }
}));

app.use(errorMiddleware);

const port = getPort();
const host = getHost();

app.listen(port, host, () => {
  log('INFO', 'worker_started', {
    host,
    port,
  });
});
