import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { handleJob } from './handlers/index.js';
import { errorMessage, getHost, getPort, log } from './runtime.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req: any, res: any) => {
  res.status(200).send({ service: 'narrator-worker', ok: true });
});

app.get('/healthz', (_req: any, res: any) => {
  res.status(200).send({ ok: true });
});

app.post('/execute-job', async (req: any, res: any) => {
  const jobId = req.body?.jobId || req.body?.id;

  try {
    log('INFO', 'job_execution_started', { jobId });

    const result = await handleJob(req.body);

    log('INFO', 'job_execution_completed', { jobId });

    res.status(200).send(result);
  } catch (error) {
    log('ERROR', 'job_execution_failed', {
      jobId,
      error: errorMessage(error),
    });

    res.status(500).send({ error: 'Failed to handle job.' });
  }
});

const port = getPort();
const host = getHost();

app.listen(port, host, () => {
  log('INFO', 'worker_started', {
    host,
    port,
  });
});
