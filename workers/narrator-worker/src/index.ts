import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { handleJob } from './handlers/index.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req: any, res: any) => {
  res.status(200).send({ service: 'narrator-worker', ok: true });
});

app.get('/healthz', (_req: any, res: any) => {
  res.status(200).send({ ok: true });
});

app.post('/execute-job', async (req: any, res: any) => {
  try {
    const result = await handleJob(req.body);
    res.status(200).send(result);
  } catch (error) {
    console.error('Error handling job:', error);
    res.status(500).send({ error: 'Failed to handle job.' });
  }
});

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`narrator-worker listening on ${host}:${port}`);
});
