import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { handleJob } from './handlers/index.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

function extractJob(body: unknown): unknown {
  if (body && typeof body === 'object' && 'job' in body) {
    return (body as { job?: unknown }).job;
  }
  return body;
}

async function execute(req: express.Request, res: express.Response) {
  try {
    const result = await handleJob(extractJob(req.body) as any);
    res.status(200).send(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to handle job.';
    console.error('Error handling job:', error);
    res.status(500).send({ error: message });
  }
}

app.get('/healthz', (_req, res) => {
  res.status(200).send({ ok: true, worker: 'narrator-worker' });
});

app.post('/execute', execute);
app.post('/execute-job', execute);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`narrator-worker listening on port ${port}`);
});
